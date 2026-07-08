(() => {
  "use strict";

  const els = {
    beforeInput: document.getElementById("beforeCsvInput"),
    afterInput: document.getElementById("afterCsvInput"),
    compareButton: document.getElementById("compareButton"),
    errorMessage: document.getElementById("errorMessage"),
    statusText: document.getElementById("statusText"),
    resultSection: document.getElementById("resultSection"),
    summaryGrid: document.getElementById("summaryGrid"),
    resultTableBody: document.getElementById("resultTableBody"),
    contentOnlyFilter: document.getElementById("contentOnlyFilter"),
    emptyFilterNote: document.getElementById("emptyFilterNote"),
    ruleBasisSelect: document.getElementById("ruleBasisSelect"),
    beforeHtmlInput: document.getElementById("beforeHtmlInput"),
    afterHtmlInput: document.getElementById("afterHtmlInput"),
    localCompareButton: document.getElementById("localCompareButton"),
    localErrorMessage: document.getElementById("localErrorMessage"),
    htmlCheckerPathInput: document.getElementById("htmlCheckerPathInput"),
    saveSettingsButton: document.getElementById("saveSettingsButton"),
    settingsStatus: document.getElementById("settingsStatus"),
  };

  const TYPE_SEVERITY = {
    "問題あり": 0,
    "問題の可能性大": 1,
    "要判断箇所": 2,
    "手動確認": 3,
  };

  const STATUS_ORDER = { new: 0, unresolved: 1, resolved: 2 };
  const STATUS_LABEL = { new: "新規", unresolved: "未解消", resolved: "解消" };

  // CSS/セレクタ参照を含む指摘は、CMSの本文編集では触れないサイト共通スタイル起因である
  // 可能性が高い(実データ85件中13件がこのパターンで、全件「行番号」が空欄だった)。
  // ただしCSVだけでは断定できないため、あくまで初期値の推定として扱い、常に人が上書きできる。
  const TEMPLATE_STYLE_REFERENCE_PATTERN = /\.css\b|セレクタ\s*=/;

  const CLASSIFICATION_OPTIONS = [
    { value: "unknown", label: "未分類" },
    { value: "content", label: "本文(content)" },
    { value: "old-site-template", label: "旧サイトテンプレート" },
    { value: "new-cms-template", label: "新CMSテンプレート" },
  ];

  let currentResults = [];
  let lookupIndexes = null;
  let ruleBasis = "kb";

  els.compareButton.addEventListener("click", handleCompareClick);
  els.contentOnlyFilter.addEventListener("change", applyContentOnlyFilter);
  els.ruleBasisSelect.addEventListener("change", handleRuleBasisChange);
  els.resultTableBody.addEventListener("change", handleClassificationChange);
  els.localCompareButton.addEventListener("click", handleLocalCompareClick);
  els.saveSettingsButton.addEventListener("click", handleSaveSettingsClick);

  loadLocalSettings();
  loadReverseLookupData();

  async function loadReverseLookupData() {
    try {
      const [rulesResponse, checkitemsResponse] = await Promise.all([
        fetch("/api/rules"),
        fetch("/api/michecker-checkitems"),
      ]);
      const rulesBody = await rulesResponse.json();
      const checkitemsBody = await checkitemsResponse.json();
      if (!rulesResponse.ok || !checkitemsResponse.ok) return;
      lookupIndexes = buildLookupIndexes(rulesBody.rules, checkitemsBody.checkitems);
    } catch {
      // 逆引きデータの取得に失敗しても、比較機能自体は動くのでここでは何もしない。
    }
  }

  function pathToRuleId(rulePath) {
    return rulePath.replace(/^\/rules\//, "").replace(/\.md$/, "").replace(/\//g, ".");
  }

  function escapeForRegex(text) {
    return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function buildLookupIndexes(rules, checkitems) {
    const ruleByCheckId = new Map();
    rules.forEach((rule) => {
      (rule.michecker_check_ids || []).forEach((checkId) => {
        if (!ruleByCheckId.has(checkId)) ruleByCheckId.set(checkId, []);
        ruleByCheckId.get(checkId).push(rule);
      });
    });

    const manualIncludesIndex = new Map();
    rules.forEach((rule) => {
      (rule.includes || []).forEach((includedPath) => {
        const includedId = pathToRuleId(includedPath);
        if (!manualIncludesIndex.has(includedId)) manualIncludesIndex.set(includedId, []);
        manualIncludesIndex.get(includedId).push(rule);
      });
    });

    const checkitemById = new Map(checkitems.map((item) => [item.id, item]));
    const staticTextIndex = new Map();
    const templateMatchers = [];
    checkitems.forEach((item) => {
      if (!item.desc_ja_normalized) return;
      if (item.is_static) {
        if (!staticTextIndex.has(item.desc_ja_normalized)) staticTextIndex.set(item.desc_ja_normalized, []);
        staticTextIndex.get(item.desc_ja_normalized).push(item.id);
      } else {
        const pattern = escapeForRegex(item.desc_ja_normalized).replace(/\\\{0\\\}/g, "[\\s\\S]*?");
        templateMatchers.push({ id: item.id, regex: new RegExp(`^${pattern}$`) });
      }
    });

    return { ruleByCheckId, manualIncludesIndex, checkitemById, staticTextIndex, templateMatchers };
  }

  function matchCheckitemIds(message, indexes) {
    const normalized = normalizeWhitespace(message || "");
    if (!normalized) return [];
    const staticMatch = indexes.staticTextIndex.get(normalized);
    if (staticMatch) return staticMatch;
    const matched = [];
    indexes.templateMatchers.forEach((matcher) => {
      if (matcher.regex.test(normalized)) matched.push(matcher.id);
    });
    return matched;
  }

  function enrichWithLookup(results, indexes) {
    results.forEach((result) => {
      const checkitemIds = matchCheckitemIds(result.message, indexes);
      const kbRuleMap = new Map();
      checkitemIds.forEach((checkId) => {
        (indexes.ruleByCheckId.get(checkId) || []).forEach((rule) => {
          kbRuleMap.set(rule.id, rule);
        });
      });
      const kbMatches = [...kbRuleMap.values()];
      const manualNotes = [];
      kbMatches.forEach((rule) => {
        (indexes.manualIncludesIndex.get(rule.id) || []).forEach((manualRule) => {
          if (!manualNotes.some((note) => note.id === manualRule.id)) {
            manualNotes.push({ id: manualRule.id, title: manualRule.title });
          }
        });
      });
      const wcagGap = [];
      const scopeNotes = [];
      if (!kbMatches.length) {
        checkitemIds.forEach((checkId) => {
          const item = indexes.checkitemById.get(checkId);
          if (!item) return;
          item.wcag20.forEach((entry) => wcagGap.push(entry.criterion));
          if (item.content_scope_note && !scopeNotes.includes(item.content_scope_note)) {
            scopeNotes.push(item.content_scope_note);
          }
        });
      }
      result.checkitemIds = checkitemIds;
      result.kbMatches = kbMatches;
      result.manualNotes = manualNotes;
      result.wcagGap = [...new Set(wcagGap)];
      // 一致したチェック項目のすべてに本文スコープ外の分類が付いている場合のみ、
      // 「KB未対応」ではなく「本文スコープ外」として扱う(一部でも本文対応可能性が
      // 残る場合はKB未対応側に倒す)。
      result.outOfContentScope =
        checkitemIds.length > 0 &&
        checkitemIds.every((checkId) => indexes.checkitemById.get(checkId)?.content_scope_note);
      result.scopeNotes = scopeNotes;
    });
    return results;
  }

  async function loadLocalSettings() {
    try {
      const response = await fetch("/api/local-settings");
      const body = await response.json();
      if (!response.ok || !body.ok) return;
      els.htmlCheckerPathInput.value = body.htmlCheckerExePath || "";
      if (body.envOverride) {
        els.settingsStatus.textContent = "環境変数 MICHECKER_HTMLCHECKER_EXE が優先されています。";
      } else if (!body.isWindows) {
        els.settingsStatus.textContent = "現在Windows以外の環境で動作しています。この設定はWindows上でのみ使用されます。";
      }
    } catch {
      // 設定の取得に失敗しても、比較機能自体は動くのでここでは何もしない。
    }
  }

  async function handleSaveSettingsClick() {
    const htmlCheckerExePath = els.htmlCheckerPathInput.value.trim();
    els.settingsStatus.textContent = "保存中…";
    try {
      const response = await fetch("/api/local-settings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ htmlCheckerExePath }),
      });
      const body = await response.json();
      if (!response.ok || !body.ok) {
        throw new Error(body.message || "保存に失敗しました");
      }
      els.settingsStatus.textContent = "保存しました。";
    } catch (error) {
      els.settingsStatus.textContent = `保存に失敗しました: ${error.message}`;
    }
  }

  async function handleLocalCompareClick() {
    hideLocalError();
    const beforeHtml = els.beforeHtmlInput.value;
    const afterHtml = els.afterHtmlInput.value;
    if (!beforeHtml.trim() || !afterHtml.trim()) {
      showLocalError("移行元・移行後の両方のHTMLを貼り付けてください。");
      return;
    }

    els.statusText.textContent = "htmlchecker.exe 実行中…";
    els.localCompareButton.disabled = true;
    try {
      const response = await fetch("/api/michecker-local-compare", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ beforeHtml, afterHtml }),
      });
      const body = await response.json();
      if (!response.ok || !body.ok) {
        throw new Error(body.message || "htmlchecker.exe の実行に失敗しました");
      }
      const beforeRecords = parseMicheckerCsv(body.beforeCsvText);
      const afterRecords = parseMicheckerCsv(body.afterCsvText);
      const results = diffMicheckerRecords(beforeRecords, afterRecords);
      renderResults(results);
      els.statusText.textContent = `比較完了(移行元${beforeRecords.length}件 / 移行後${afterRecords.length}件、htmlchecker.exe自動実行)`;
    } catch (error) {
      showLocalError(error.message);
      els.statusText.textContent = "CSV未読み込み";
    } finally {
      els.localCompareButton.disabled = false;
    }
  }

  function showLocalError(message) {
    els.localErrorMessage.textContent = message;
    els.localErrorMessage.hidden = false;
  }

  function hideLocalError() {
    els.localErrorMessage.hidden = true;
    els.localErrorMessage.textContent = "";
  }

  async function handleCompareClick() {
    hideError();
    const beforeFile = els.beforeInput.files[0];
    const afterFile = els.afterInput.files[0];
    if (!beforeFile || !afterFile) {
      showError("移行元・移行後の両方のCSVファイルを選択してください。");
      return;
    }

    els.statusText.textContent = "読み込み中…";
    try {
      const [beforeRecords, afterRecords] = await Promise.all([
        readMicheckerCsv(beforeFile),
        readMicheckerCsv(afterFile),
      ]);
      const results = diffMicheckerRecords(beforeRecords, afterRecords);
      renderResults(results);
      els.statusText.textContent = `比較完了(移行元${beforeRecords.length}件 / 移行後${afterRecords.length}件)`;
    } catch (error) {
      showError(`CSVの読み込みに失敗しました: ${error.message}`);
      els.statusText.textContent = "CSV未読み込み";
    }
  }

  function showError(message) {
    els.errorMessage.textContent = message;
    els.errorMessage.hidden = false;
  }

  function hideError() {
    els.errorMessage.hidden = true;
    els.errorMessage.textContent = "";
  }

  async function readMicheckerCsv(file) {
    const buffer = await file.arrayBuffer();
    const text = new TextDecoder("shift_jis").decode(buffer);
    const records = parseMicheckerCsv(text);
    if (!records.length) {
      throw new Error(`${file.name}: 有効な行が見つかりませんでした`);
    }
    return records;
  }

  function parseMicheckerCsv(text) {
    const rows = parseCsvRows(text);
    if (!rows.length) return [];
    const header = rows[0].map((cell) => normalizeWhitespace(cell));
    return rows.slice(1).map((cols) => {
      const record = {};
      header.forEach((name, index) => {
        record[name] = normalizeWhitespace(cols[index] || "");
      });
      return record;
    });
  }

  function parseCsvRows(text) {
    const rows = [];
    let row = [];
    let field = "";
    let inQuotes = false;
    let i = 0;
    const len = text.length;
    while (i < len) {
      const ch = text[i];
      if (inQuotes) {
        if (ch === '"') {
          if (text[i + 1] === '"') {
            field += '"';
            i += 2;
            continue;
          }
          inQuotes = false;
          i += 1;
          continue;
        }
        field += ch;
        i += 1;
        continue;
      }
      if (ch === '"') {
        inQuotes = true;
        i += 1;
        continue;
      }
      if (ch === ",") {
        row.push(field);
        field = "";
        i += 1;
        continue;
      }
      if (ch === "\r" || ch === "\n") {
        row.push(field);
        rows.push(row);
        row = [];
        field = "";
        if (ch === "\r" && text[i + 1] === "\n") i += 1;
        i += 1;
        continue;
      }
      field += ch;
      i += 1;
    }
    if (field.length || row.length) {
      row.push(field);
      rows.push(row);
    }
    return rows.filter((cells) => !(cells.length === 1 && cells[0] === ""));
  }

  function normalizeWhitespace(value) {
    return value.replace(/\s+/g, " ").trim();
  }

  function signatureFor(record) {
    return `${record["種別"]}|${record["JIS"]}|${record["達成方法"]}`;
  }

  function groupBySignature(records) {
    const map = new Map();
    records.forEach((record) => {
      const key = signatureFor(record);
      if (!map.has(key)) {
        map.set(key, { count: 0, sample: record, lines: [] });
      }
      const entry = map.get(key);
      entry.count += 1;
      if (record["行番号"]) entry.lines.push(record["行番号"]);
    });
    return map;
  }

  function diffMicheckerRecords(beforeRecords, afterRecords) {
    const beforeMap = groupBySignature(beforeRecords);
    const afterMap = groupBySignature(afterRecords);
    const keys = new Set([...beforeMap.keys(), ...afterMap.keys()]);

    const results = [...keys].map((key) => {
      const before = beforeMap.get(key);
      const after = afterMap.get(key);
      const beforeCount = before ? before.count : 0;
      const afterCount = after ? after.count : 0;
      const status = beforeCount > 0 && afterCount === 0 ? "resolved" : beforeCount === 0 && afterCount > 0 ? "new" : "unresolved";
      const sample = after ? after.sample : before.sample;
      const message = sample["内容"];
      const classificationAuto = TEMPLATE_STYLE_REFERENCE_PATTERN.test(message);
      return {
        status,
        beforeCount,
        afterCount,
        type: sample["種別"],
        jis: sample["JIS"],
        method: sample["達成方法"],
        message,
        afterLines: after ? after.lines.filter(Boolean) : [],
        classification: classificationAuto ? "old-site-template" : "unknown",
        classificationAuto,
      };
    });

    results.sort((a, b) => {
      const severityDiff = (TYPE_SEVERITY[a.type] ?? 9) - (TYPE_SEVERITY[b.type] ?? 9);
      if (severityDiff !== 0) return severityDiff;
      return STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
    });

    return results;
  }

  function renderResults(results) {
    if (lookupIndexes) enrichWithLookup(results, lookupIndexes);
    currentResults = results;
    els.resultSection.hidden = false;
    els.contentOnlyFilter.checked = false;
    els.emptyFilterNote.hidden = true;
    renderSummary(results);
    renderTable(results);
  }

  function renderSummary(results) {
    const totals = { new: 0, unresolved: 0, resolved: 0 };
    results.forEach((r) => {
      totals[r.status] += 1;
    });
    els.summaryGrid.innerHTML = "";
    [
      { key: "new", label: "新規(移行後のみ)" },
      { key: "unresolved", label: "未解消" },
      { key: "resolved", label: "解消" },
    ].forEach(({ key, label }) => {
      const tile = document.createElement("div");
      tile.className = `michecker-stat michecker-stat-${key}`;
      tile.innerHTML = `<span class="michecker-stat-value">${totals[key]}</span><span class="michecker-stat-label">${label}</span>`;
      els.summaryGrid.appendChild(tile);
    });
  }

  function renderTable(results) {
    els.resultTableBody.innerHTML = "";
    if (!results.length) {
      const row = document.createElement("tr");
      row.innerHTML = `<td colspan="10">比較対象の指摘がありませんでした。</td>`;
      els.resultTableBody.appendChild(row);
      return;
    }
    results.forEach((result, index) => {
      const row = document.createElement("tr");
      row.className = `michecker-row-${result.status}`;
      row.dataset.index = String(index);
      row.innerHTML = `
        <td><span class="michecker-status-badge michecker-status-${result.status}">${STATUS_LABEL[result.status]}</span></td>
        <td>${renderClassificationSelect(result, index)}</td>
        <td>${escapeHtml(result.type)}</td>
        <td>${escapeHtml(result.jis)}</td>
        <td>${escapeHtml(result.method)}</td>
        <td class="michecker-message">${escapeHtml(result.message)}</td>
        <td class="michecker-count">${result.beforeCount}</td>
        <td class="michecker-count">${result.afterCount}</td>
        <td>${escapeHtml(result.afterLines.join(" / "))}</td>
        <td>${renderRuleMatch(result)}</td>
      `;
      els.resultTableBody.appendChild(row);
    });
  }

  function handleRuleBasisChange() {
    ruleBasis = els.ruleBasisSelect.value;
    if (!currentResults.length) return;
    renderTable(currentResults);
    applyContentOnlyFilter();
  }

  function renderRuleMatch(result) {
    if (!lookupIndexes) return "";
    if (result.kbMatches && result.kbMatches.length) {
      // miChecker基準のみモードでは、マニュアル版とmiChecker版の両方に一致する行で
      // miChecker版(最小限の修正観点)だけを表示する。マニュアル版しか無い行は、
      // それがmiChecker指摘を解消する唯一の対応ルールなのでそのまま表示する。
      const micheckerMatches = result.kbMatches.filter((rule) => rule.origin === "michecker");
      const matchesToShow =
        ruleBasis === "michecker" && micheckerMatches.length ? micheckerMatches : result.kbMatches;
      const badges = matchesToShow
        .map((rule) => {
          const isManual = rule.origin === "manual";
          const badgeClass = isManual ? "michecker-origin-manual" : "michecker-origin-michecker";
          const badgeLabel = isManual ? "マニュアル版" : "miChecker版";
          return `<span class="michecker-rule-match"><span class="michecker-origin-badge ${badgeClass}">${badgeLabel}</span> ${escapeHtml(rule.title)}</span>`;
        })
        .join("");
      const notes =
        ruleBasis === "kb" && result.manualNotes && result.manualNotes.length
          ? `<span class="michecker-rule-note">(${result.manualNotes.map((note) => escapeHtml(note.title)).join("、")}に内包)</span>`
          : "";
      return `${badges}${notes}`;
    }
    if (result.checkitemIds && result.checkitemIds.length) {
      if (result.outOfContentScope) {
        const note = result.scopeNotes && result.scopeNotes.length ? result.scopeNotes[0] : "";
        const noteLabel = note ? `<span class="michecker-rule-note">${escapeHtml(note)}</span>` : "";
        return `<span class="michecker-origin-badge michecker-origin-scope-out">本文スコープ外</span>${noteLabel}`;
      }
      const wcagText = result.wcagGap && result.wcagGap.length ? result.wcagGap.join(", ") : "";
      const wcagLabel = wcagText ? ` <span class="michecker-wcag-gap">(WCAG ${escapeHtml(wcagText)})</span>` : "";
      return `<span class="michecker-origin-badge michecker-origin-gap">KB未対応</span>${wcagLabel}`;
    }
    return `<span class="michecker-rule-unmatched">照合不可</span>`;
  }

  function renderClassificationSelect(result, index) {
    const options = CLASSIFICATION_OPTIONS.map(
      ({ value, label }) => `<option value="${value}" ${value === result.classification ? "selected" : ""}>${escapeHtml(label)}</option>`
    ).join("");
    const autoBadge = result.classificationAuto ? '<span class="michecker-auto-badge">自動推定</span>' : "";
    return `
      <label class="michecker-classification">
        <span class="visually-hidden">分類</span>
        <select class="michecker-classification-select" data-index="${index}">${options}</select>
        ${autoBadge}
      </label>
    `;
  }

  function handleClassificationChange(event) {
    const select = event.target.closest(".michecker-classification-select");
    if (!select) return;
    const index = Number(select.dataset.index);
    const result = currentResults[index];
    if (!result) return;
    result.classification = select.value;
    result.classificationAuto = false;
    const badge = select.closest(".michecker-classification")?.querySelector(".michecker-auto-badge");
    if (badge) badge.remove();
    applyContentOnlyFilter();
  }

  function applyContentOnlyFilter() {
    const onlyContent = els.contentOnlyFilter.checked;
    let visibleCount = 0;
    [...els.resultTableBody.querySelectorAll("tr[data-index]")].forEach((row) => {
      const index = Number(row.dataset.index);
      const result = currentResults[index];
      const matches = !onlyContent || (result && result.classification === "content");
      row.hidden = !matches;
      if (matches) visibleCount += 1;
    });
    els.emptyFilterNote.hidden = !(onlyContent && visibleCount === 0);
  }

  function escapeHtml(value) {
    return String(value || "").replace(/[&<>"']/g, (ch) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    })[ch]);
  }
})();

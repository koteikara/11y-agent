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
    beforeHtmlInput: document.getElementById("beforeHtmlInput"),
    afterHtmlInput: document.getElementById("afterHtmlInput"),
    localCompareButton: document.getElementById("localCompareButton"),
    localErrorMessage: document.getElementById("localErrorMessage"),
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

  els.compareButton.addEventListener("click", handleCompareClick);
  els.contentOnlyFilter.addEventListener("change", applyContentOnlyFilter);
  els.resultTableBody.addEventListener("change", handleClassificationChange);
  els.localCompareButton.addEventListener("click", handleLocalCompareClick);

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
      row.innerHTML = `<td colspan="9">比較対象の指摘がありませんでした。</td>`;
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
      `;
      els.resultTableBody.appendChild(row);
    });
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

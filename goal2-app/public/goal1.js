(function () {
  "use strict";

  const els = {
    engineStatus: document.getElementById("engineStatus"),
    csvFileInput: document.getElementById("csvFileInput"),
    urlListInput: document.getElementById("urlListInput"),
    htmlFilesInput: document.getElementById("htmlFilesInput"),
    buildQueueButton: document.getElementById("buildQueueButton"),
    inputErrorMessage: document.getElementById("inputErrorMessage"),
    queueStatus: document.getElementById("queueStatus"),
    ruleScopeSelect: document.getElementById("ruleScopeSelect"),
    llmAvailability: document.getElementById("llmAvailability"),
    runBatchButton: document.getElementById("runBatchButton"),
    pauseBatchButton: document.getElementById("pauseBatchButton"),
    resumeBatchButton: document.getElementById("resumeBatchButton"),
    batchProgress: document.getElementById("batchProgress"),
    batchProgressFill: document.getElementById("batchProgressFill"),
    batchProgressText: document.getElementById("batchProgressText"),
    batchSummary: document.getElementById("batchSummary"),
    batchSummaryGrid: document.getElementById("batchSummaryGrid"),
    pageTableBody: document.getElementById("pageTableBody"),
    downloadEvidenceCsvButton: document.getElementById("downloadEvidenceCsvButton"),
    downloadSummaryCsvButton: document.getElementById("downloadSummaryCsvButton"),
    downloadBatchJsonButton: document.getElementById("downloadBatchJsonButton"),
    loadBatchJsonInput: document.getElementById("loadBatchJsonInput"),
  };

  const DB_NAME = "goal1";
  const DB_VERSION = 1;
  const STORE_NAME = "batches";

  const state = {
    batch: null, // { batchId, createdAt, settings, pages: [...] }
    llmConfigured: false,
    paused: false,
    running: false,
    stopRequested: false,
  };

  bindEvents();
  init();

  async function init() {
    bindEvents.done = true;
    await checkLlmStatus();
    await restoreLatestBatch();
    els.engineStatus.textContent = "準備完了";
    render();
  }

  function bindEvents() {
    if (bindEvents.done) return;
    els.buildQueueButton.addEventListener("click", buildQueue);
    els.runBatchButton.addEventListener("click", runBatch);
    els.pauseBatchButton.addEventListener("click", () => {
      state.paused = true;
      els.pauseBatchButton.hidden = true;
      els.resumeBatchButton.hidden = false;
    });
    els.resumeBatchButton.addEventListener("click", () => {
      state.paused = false;
      els.pauseBatchButton.hidden = false;
      els.resumeBatchButton.hidden = true;
    });
    els.downloadEvidenceCsvButton.addEventListener("click", downloadEvidenceCsv);
    els.downloadSummaryCsvButton.addEventListener("click", downloadSummaryCsv);
    els.downloadBatchJsonButton.addEventListener("click", downloadBatchJson);
    els.loadBatchJsonInput.addEventListener("change", loadBatchJsonFile);
  }

  async function checkLlmStatus() {
    try {
      const response = await fetch("/api/llm/status", { cache: "no-store" });
      const payload = await response.json();
      state.llmConfigured = Boolean(payload.configured);
    } catch {
      state.llmConfigured = false;
    }
    els.llmAvailability.textContent = state.llmConfigured ? "有効(コストが発生します)" : "未設定(コストゼロ)";
    els.llmAvailability.className = `michecker-status-badge ${state.llmConfigured ? "goal1-llm-on" : "goal1-llm-off"}`;
  }

  // ---- Step 1: build the page queue from CSV / URL list / HTML files ----------------------

  async function buildQueue() {
    hideError();
    const pages = [];
    try {
      const csvFile = els.csvFileInput.files?.[0];
      if (csvFile) {
        pages.push(...(await pagesFromCsvFile(csvFile)));
      }
      pages.push(...pagesFromUrlList(els.urlListInput.value));
      if (els.htmlFilesInput.files?.length) {
        pages.push(...(await pagesFromHtmlFiles(els.htmlFilesInput.files)));
      }
    } catch (error) {
      showError(`入力の読み込みに失敗しました: ${error.message}`);
      return;
    }

    if (!pages.length) {
      showError("CSV・URL一覧・HTMLファイルのいずれかを入力してください。");
      return;
    }

    markDuplicateUrls(pages);

    state.batch = {
      batchId: `batch_${Date.now()}`,
      createdAt: new Date().toISOString(),
      settings: { ruleScopeMode: els.ruleScopeSelect.value },
      pages: pages.map((page) => ({
        ...page,
        status: "pending",
        errorMessage: "",
        extractedHtml: "",
        finalHtml: "",
        evidence: null,
        autoAcceptedCount: 0,
        remainingCount: 0,
      })),
    };

    // HTML files can't be re-fetched by URL, so their content is kept in memory for this
    // session only (not persisted to IndexedDB — see saveBatch()'s stripping below).
    state.pendingHtmlBySourceId = new Map(pages.filter((p) => p.rawHtml).map((p) => [p.id, p.rawHtml]));

    els.runBatchButton.disabled = false;
    els.queueStatus.textContent = `${pages.length}件のページを読み込みました。「一括実行」を押すと処理を開始します。`;
    await saveBatch();
    render();
  }

  async function pagesFromCsvFile(file) {
    const buffer = await file.arrayBuffer();
    const text = decodeCsvBuffer(buffer);
    const rows = parseCsvText(text);
    if (!rows.length) return [];

    const header = rows[0];
    const idxOf = (name) => header.indexOf(name);
    const isMigrationCsv = idxOf("移行管理ID") >= 0 && idxOf("移行元URL") >= 0;

    if (isMigrationCsv) {
      const iId = idxOf("移行管理ID");
      const iTitle = idxOf("ページタイトル");
      const iTemplate = idxOf("テンプレートNo");
      const iUrl = idxOf("移行元URL");
      const iCategory = idxOf("移行先カテゴリ");
      const iStatus = idxOf("ステータス");
      return rows
        .slice(1)
        .filter((row) => (row[iUrl] || "").trim())
        .map((row) => ({
          id: (row[iId] || "").trim() || `csv_${cryptoRandomId()}`,
          url: (row[iUrl] || "").trim(),
          pageTitle: (row[iTitle] || "").trim(),
          templateNo: (row[iTemplate] || "").trim(),
          category: (row[iCategory] || "").trim(),
          sourceStatus: (row[iStatus] || "").trim(),
          source: "csv",
        }));
    }

    // Fallback: 1 line = 1 URL, or "URL,カテゴリ".
    return rows
      .filter((row) => (row[0] || "").trim())
      .map((row) => ({
        id: `csv_${cryptoRandomId()}`,
        url: (row[0] || "").trim(),
        pageTitle: "",
        templateNo: "",
        category: (row[1] || "").trim(),
        sourceStatus: "",
        source: "csv",
      }));
  }

  function decodeCsvBuffer(buffer) {
    const bytes = new Uint8Array(buffer);
    const hasUtf8Bom = bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf;
    if (hasUtf8Bom) {
      return new TextDecoder("utf-8").decode(buffer);
    }
    try {
      return new TextDecoder("utf-8", { fatal: true }).decode(buffer);
    } catch {
      return new TextDecoder("shift_jis").decode(buffer);
    }
  }

  // Minimal RFC4180-ish CSV parser: handles quoted fields, embedded commas/newlines, and
  // escaped quotes ("" inside a quoted field). No external dependency.
  function parseCsvText(text) {
    const rows = [];
    let row = [];
    let field = "";
    let inQuotes = false;
    let i = 0;
    const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    while (i < normalized.length) {
      const char = normalized[i];
      if (inQuotes) {
        if (char === '"') {
          if (normalized[i + 1] === '"') {
            field += '"';
            i += 2;
            continue;
          }
          inQuotes = false;
          i += 1;
          continue;
        }
        field += char;
        i += 1;
        continue;
      }
      if (char === '"') {
        inQuotes = true;
        i += 1;
        continue;
      }
      if (char === ",") {
        row.push(field);
        field = "";
        i += 1;
        continue;
      }
      if (char === "\n") {
        row.push(field);
        rows.push(row);
        row = [];
        field = "";
        i += 1;
        continue;
      }
      field += char;
      i += 1;
    }
    if (field.length || row.length) {
      row.push(field);
      rows.push(row);
    }
    return rows.filter((r) => r.some((cell) => cell.trim() !== ""));
  }

  function pagesFromUrlList(text) {
    return (text || "")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [url, category] = line.split(",").map((part) => (part || "").trim());
        return {
          id: `url_${cryptoRandomId()}`,
          url,
          pageTitle: "",
          templateNo: "",
          category: category || "",
          sourceStatus: "",
          source: "url-list",
        };
      })
      .filter((page) => /^https?:\/\//i.test(page.url));
  }

  async function pagesFromHtmlFiles(fileList) {
    const files = [...fileList];
    const pages = [];
    for (const file of files) {
      const html = await file.text();
      const parsed = new DOMParser().parseFromString(html, "text/html");
      pages.push({
        id: file.name.replace(/\.[^.]+$/, ""),
        url: "",
        pageTitle: (parsed.querySelector("title")?.textContent || "").trim(),
        templateNo: "",
        category: "",
        sourceStatus: "",
        source: "html-file",
        rawHtml: html,
      });
    }
    return pages;
  }

  function markDuplicateUrls(pages) {
    const counts = new Map();
    pages.forEach((page) => {
      if (!page.url) return;
      counts.set(page.url, (counts.get(page.url) || 0) + 1);
    });
    pages.forEach((page) => {
      page.duplicateUrl = Boolean(page.url) && counts.get(page.url) > 1;
    });
  }

  function cryptoRandomId() {
    return Math.random().toString(36).slice(2, 8);
  }

  // ---- Step 2: run the batch (sequential, one page at a time) -----------------------------

  async function runBatch() {
    if (!state.batch || state.running) return;
    state.running = true;
    state.paused = false;
    state.stopRequested = false;
    els.runBatchButton.disabled = true;
    els.pauseBatchButton.disabled = false;
    els.pauseBatchButton.hidden = false;
    els.resumeBatchButton.hidden = true;
    els.batchProgress.hidden = false;
    els.engineStatus.textContent = "一括実行中";

    await window.goal2Engine.init();

    const pages = state.batch.pages;
    for (let index = 0; index < pages.length; index += 1) {
      while (state.paused) {
        // eslint-disable-next-line no-await-in-loop
        await sleep(200);
      }
      updateProgress(index, pages.length, pages[index]);
      // eslint-disable-next-line no-await-in-loop
      await processPage(pages[index]);
      render();
      // eslint-disable-next-line no-await-in-loop
      await saveBatch();
    }

    updateProgress(pages.length, pages.length, null);
    state.running = false;
    els.engineStatus.textContent = "実行完了";
    els.runBatchButton.disabled = false;
    els.pauseBatchButton.disabled = true;
    els.pauseBatchButton.hidden = false;
    els.resumeBatchButton.hidden = true;
    els.downloadEvidenceCsvButton.disabled = false;
    els.downloadSummaryCsvButton.disabled = false;
    els.downloadBatchJsonButton.disabled = false;
  }

  function updateProgress(done, total, currentPage) {
    const pct = total ? Math.round((done / total) * 100) : 0;
    els.batchProgressFill.style.width = `${pct}%`;
    els.batchProgressText.textContent = currentPage
      ? `${done + 1}/${total}件目を処理中: ${currentPage.pageTitle || currentPage.url || currentPage.id}`
      : `完了: ${done}/${total}件`;
  }

  // Processes one page end-to-end. Errors at any stage are recorded on the page (status +
  // errorMessage) rather than thrown, so one broken page never stops the batch.
  async function processPage(page) {
    try {
      page.status = "fetching";
      const html = await resolvePageHtml(page);
      if (!html) {
        page.status = "fetch-failed";
        page.errorMessage = page.errorMessage || "HTMLを取得できませんでした。";
        return;
      }

      page.status = "extracting";
      const extraction = window.goal3Engine.extract(html, page.pageTitle);
      if (!extraction.candidates.length) {
        page.status = "extract-failed";
        page.errorMessage = "本文候補を抽出できませんでした。";
        return;
      }
      const topCandidate = extraction.candidates[0];
      page.extractedHtml = topCandidate.html;
      if (!page.pageTitle) {
        page.pageTitle = extraction.pageTitle;
      }

      page.status = "analyzing";
      const analysis = await window.goal2Engine.analyze({
        html: topCandidate.html,
        pageTitle: page.pageTitle,
        oldUrl: page.url,
        ruleScopeMode: state.batch.settings.ruleScopeMode,
      });

      const autoAccepted = window.goal2Engine.autoAcceptSafe(analysis.candidates);
      const finalHtml = window.goal2Engine.buildFinalHtml(topCandidate.html, analysis.candidates);
      const evidence = window.goal2Engine.buildEvidence(
        {
          sessionId: window.goal2Engine.sessionIdFor(page.url, page.pageTitle),
          pageTitle: page.pageTitle,
          oldUrl: page.url,
          generatedAt: analysis.generatedAt,
          ruleScopeMode: state.batch.settings.ruleScopeMode,
          sourceHtml: topCandidate.html,
          candidates: analysis.candidates,
          notices: analysis.notices,
        },
        finalHtml
      );

      page.finalHtml = finalHtml;
      page.evidence = evidence;
      page.autoAcceptedCount = autoAccepted;
      page.remainingCount = analysis.candidates.filter((c) => !c.decision.status).length;
      page.llmUsage = { ...analysis.llmUsage };
      page.status = "done";
    } catch (error) {
      page.status = "error";
      page.errorMessage = error?.message || String(error);
    }
  }

  async function resolvePageHtml(page) {
    if (page.source === "html-file") {
      return state.pendingHtmlBySourceId?.get(page.id) || "";
    }
    const response = await fetch(`/api/fetch-html?${new URLSearchParams({ url: page.url }).toString()}`, {
      cache: "no-store",
    });
    const payload = await response.json();
    if (!response.ok || !payload.ok) {
      page.errorMessage = payload.message || "取得できませんでした。";
      return "";
    }
    if (!page.pageTitle && payload.title) {
      page.pageTitle = payload.title;
    }
    return payload.html || "";
  }

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // ---- Work list rendering -----------------------------------------------------------------

  const STATUS_LABELS = {
    pending: "未処理",
    fetching: "取得中",
    extracting: "抽出中",
    analyzing: "候補生成中",
    done: "完了",
    "fetch-failed": "取得失敗",
    "extract-failed": "抽出失敗",
    error: "エラー",
  };

  const STATUS_CLASSES = {
    pending: "goal1-status-pending",
    fetching: "goal1-status-running",
    extracting: "goal1-status-running",
    analyzing: "goal1-status-running",
    done: "goal1-status-done",
    "fetch-failed": "goal1-status-error",
    "extract-failed": "goal1-status-error",
    error: "goal1-status-error",
  };

  function render() {
    renderSummary();
    renderTable();
  }

  function renderSummary() {
    if (!state.batch) {
      els.batchSummary.textContent = "ページ一覧を読み込むと、ここに一覧が表示されます。";
      els.batchSummaryGrid.innerHTML = "";
      return;
    }
    const pages = state.batch.pages;
    const done = pages.filter((p) => p.status === "done").length;
    const failed = pages.filter((p) => p.status === "fetch-failed" || p.status === "extract-failed" || p.status === "error").length;
    const totalAutoAccepted = pages.reduce((sum, p) => sum + (p.autoAcceptedCount || 0), 0);
    const totalRemaining = pages.reduce((sum, p) => sum + (p.remainingCount || 0), 0);
    const totalCostUsd = pages.reduce((sum, p) => sum + (p.llmUsage?.estimatedCostUsd || 0), 0);
    const duplicates = pages.filter((p) => p.duplicateUrl).length;

    els.batchSummary.textContent = `全${pages.length}件中 完了${done}件・失敗${failed}件${duplicates ? `・URL重複${duplicates}件` : ""}`;
    els.batchSummaryGrid.innerHTML = `
      <div class="michecker-stat"><div class="michecker-stat-value">${totalAutoAccepted}</div><div class="michecker-stat-label">自動採用件数</div></div>
      <div class="michecker-stat michecker-stat-unresolved"><div class="michecker-stat-value">${totalRemaining}</div><div class="michecker-stat-label">要確認残数</div></div>
      <div class="michecker-stat"><div class="michecker-stat-value">$${totalCostUsd.toFixed(4)}</div><div class="michecker-stat-label">LLM概算コスト合計</div></div>
    `;
  }

  function renderTable() {
    els.pageTableBody.innerHTML = "";
    if (!state.batch) return;
    state.batch.pages.forEach((page) => {
      const row = document.createElement("tr");
      const statusClass = STATUS_CLASSES[page.status] || "goal1-status-pending";
      const statusLabel = STATUS_LABELS[page.status] || page.status;
      const candidateTotal = page.evidence ? page.evidence.candidates.length : "";
      row.innerHTML = `
        <td>${escapeHtml(page.id)}${page.duplicateUrl ? '<span class="goal1-duplicate-badge">重複URL</span>' : ""}</td>
        <td>${escapeHtml(page.pageTitle || "(未取得)")}</td>
        <td>${escapeHtml(page.category || "")}</td>
        <td><span class="goal1-status-badge ${statusClass}">${escapeHtml(statusLabel)}</span>${
        page.errorMessage ? `<div class="michecker-rule-note">${escapeHtml(page.errorMessage)}</div>` : ""
      }</td>
        <td class="michecker-count">${candidateTotal}</td>
        <td class="michecker-count">${page.autoAcceptedCount || ""}</td>
        <td class="michecker-count">${page.remainingCount || ""}</td>
        <td class="michecker-count">${page.llmUsage ? `$${page.llmUsage.estimatedCostUsd.toFixed(4)}` : ""}</td>
        <td class="goal1-row-actions"></td>
      `;
      const actionsCell = row.querySelector(".goal1-row-actions");
      appendRowActions(actionsCell, page);
      els.pageTableBody.appendChild(row);
    });
  }

  function appendRowActions(cell, page) {
    if (page.status !== "done") return;
    const openButton = document.createElement("button");
    openButton.type = "button";
    openButton.className = "secondary";
    openButton.textContent = "GOAL2で開く";
    openButton.addEventListener("click", () => openInGoal2(page));
    cell.appendChild(openButton);

    const copyButton = document.createElement("button");
    copyButton.type = "button";
    copyButton.textContent = "HTMLコピー";
    copyButton.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(page.finalHtml || "");
      } catch {
        // clipboard permission denied — silently ignore, matching goal2/goal3's existing copy buttons.
      }
    });
    cell.appendChild(copyButton);
  }

  function openInGoal2(page) {
    localStorage.setItem(
      "goal3.toGoal2",
      JSON.stringify({
        html: page.extractedHtml,
        pageTitle: page.pageTitle,
        oldUrl: page.url,
        autoAcceptSafe: true,
      })
    );
    window.location.href = "/";
  }

  function escapeHtml(text) {
    return String(text ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
  }

  function showError(message) {
    els.inputErrorMessage.textContent = message;
    els.inputErrorMessage.hidden = false;
  }

  function hideError() {
    els.inputErrorMessage.hidden = true;
    els.inputErrorMessage.textContent = "";
  }

  // ---- CSV / JSON outputs -------------------------------------------------------------------

  function downloadEvidenceCsv() {
    if (!state.batch) return;
    const header = [
      "移行管理ID",
      "ページ名",
      "URL",
      "カテゴリ",
      "candidate_id",
      "rule_id",
      "category",
      "processing_class",
      "status",
      "confidence",
      "requires_human_review",
      "decision_reason",
      "actor",
    ];
    const rows = [header];
    state.batch.pages.forEach((page) => {
      (page.evidence?.candidates || []).forEach((candidate) => {
        rows.push([
          page.id,
          page.pageTitle,
          page.url,
          page.category,
          candidate.candidate_id,
          candidate.rule_id,
          candidate.category,
          candidate.processing_class,
          candidate.status,
          candidate.confidence,
          candidate.requires_human_review ? "1" : "0",
          candidate.decision_reason || "",
          candidate.actor || "",
        ]);
      });
    });
    downloadCsv(rows, `${state.batch.batchId}-evidence.csv`);
  }

  function downloadSummaryCsv() {
    if (!state.batch) return;
    const header = ["移行管理ID", "ページ名", "URL", "カテゴリ", "状態", "候補総数", "自動採用数", "要確認残数", "LLM概算コスト(USD)", "エラー"];
    const rows = [header];
    state.batch.pages.forEach((page) => {
      rows.push([
        page.id,
        page.pageTitle,
        page.url,
        page.category,
        STATUS_LABELS[page.status] || page.status,
        page.evidence ? String(page.evidence.candidates.length) : "",
        String(page.autoAcceptedCount || 0),
        String(page.remainingCount || 0),
        page.llmUsage ? page.llmUsage.estimatedCostUsd.toFixed(4) : "",
        page.errorMessage || "",
      ]);
    });
    downloadCsv(rows, `${state.batch.batchId}-summary.csv`);
  }

  function downloadCsv(rows, filename) {
    const csvText = rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
    // UTF-8 BOM so Excel doesn't mojibake the Japanese headers/content on open.
    const blob = new Blob(["﻿" + csvText], { type: "text/csv;charset=utf-8" });
    triggerDownload(blob, filename);
  }

  function csvCell(value) {
    const text = value == null ? "" : String(value);
    return `"${text.replace(/"/g, '""')}"`;
  }

  function downloadBatchJson() {
    if (!state.batch) return;
    const blob = new Blob([JSON.stringify(state.batch, null, 2)], { type: "application/json" });
    triggerDownload(blob, `${state.batch.batchId}.json`);
  }

  async function loadBatchJsonFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const batch = JSON.parse(text);
      if (!batch || !Array.isArray(batch.pages)) {
        throw new Error("バッチJSONの形式が正しくありません。");
      }
      state.batch = batch;
      els.runBatchButton.disabled = false;
      els.downloadEvidenceCsvButton.disabled = false;
      els.downloadSummaryCsvButton.disabled = false;
      els.downloadBatchJsonButton.disabled = false;
      await saveBatch();
      render();
    } catch (error) {
      showError(`バッチJSONの読み込みに失敗しました: ${error.message}`);
    } finally {
      event.target.value = "";
    }
  }

  function triggerDownload(blob, filename) {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  // ---- IndexedDB persistence ----------------------------------------------------------------

  function openDb() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(STORE_NAME)) {
          request.result.createObjectStore(STORE_NAME, { keyPath: "batchId" });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async function saveBatch() {
    if (!state.batch) return;
    try {
      const db = await openDb();
      // Original full-page HTML is never persisted (only the extracted/final HTML), per
      // the design in GOAL1_BUILD_INSTRUCTIONS.md — keeps IndexedDB usage bounded even for
      // large batches. rawHtml (kept in-memory for html-file sources) is stripped here too.
      const persistable = {
        ...state.batch,
        pages: state.batch.pages.map(({ rawHtml, ...rest }) => rest),
      };
      await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readwrite");
        tx.objectStore(STORE_NAME).put(persistable);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
      db.close();
    } catch (error) {
      console.error("goal1: failed to save batch to IndexedDB", error);
    }
  }

  async function restoreLatestBatch() {
    try {
      const db = await openDb();
      const batches = await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readonly");
        const request = tx.objectStore(STORE_NAME).getAll();
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
      });
      db.close();
      if (!batches.length) return;
      batches.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
      state.batch = batches[0];
      state.pendingHtmlBySourceId = new Map();
      els.runBatchButton.disabled = false;
      const hasResults = state.batch.pages.some((p) => p.status === "done");
      els.downloadEvidenceCsvButton.disabled = !hasResults;
      els.downloadSummaryCsvButton.disabled = !hasResults;
      els.downloadBatchJsonButton.disabled = false;
      els.queueStatus.textContent = `前回のバッチ(${state.batch.pages.length}件)を復元しました。`;
    } catch (error) {
      console.error("goal1: failed to restore batch from IndexedDB", error);
    }
  }
})();

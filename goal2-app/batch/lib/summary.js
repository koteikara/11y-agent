// 案件の集計: project/summary.json と project/status.csv(「AI 修正」タブへ写す一覧)。
// ページごとのファイルを読み直して作るので、どのコマンドのあとに呼んでも同じ結果になる。
const DEPTH_LABELS = { thorough: "しっかり確認", quick: "さっと確認", none: "確認不要" };

function pageState(fetchLedger, candidates) {
  if (!fetchLedger) return "未処理";
  if (!fetchLedger.ok) return "取得できない";
  if (!candidates) return "未処理";
  return "未確認";
}

function csvCell(value) {
  const text = value == null ? "" : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function writeSummary(project) {
  const input = project.readInput();
  const counts = { pages: input.pages.length, fetched: 0, fetchFailed: 0, processed: 0, depth: { thorough: 0, quick: 0, none: 0 } };
  const fetchReasons = {};
  const oldPageChanged = [];
  const pages = {};
  const rows = [
    [
      "移行管理ID",
      "取込回",
      "確認の深さ",
      "状態",
      "取り込めない理由",
      "指示の数",
      "採用",
      "却下",
      "残る指摘",
      "質問の下書き",
      "旧ページの更新",
      "旧URL",
      "FTP上のURL",
      "確定日",
      "証跡の場所",
    ],
  ];

  for (const page of input.pages) {
    const ledger = project.readPageJson(page.id, "fetch.json");
    const candidates = project.readPageJson(page.id, "candidates.json");
    if (ledger?.ok) counts.fetched += 1;
    if (ledger && !ledger.ok) {
      counts.fetchFailed += 1;
      fetchReasons[ledger.reason] = (fetchReasons[ledger.reason] || 0) + 1;
    }
    if (ledger?.oldPageChanged) oldPageChanged.push(page.id);
    if (candidates) {
      counts.processed += 1;
      counts.depth[candidates.depth] = (counts.depth[candidates.depth] || 0) + 1;
    }
    pages[page.id] = {
      fetch: ledger ? (ledger.ok ? "ok" : ledger.reason) : null,
      structureHash: ledger?.structureHash || null,
      depth: candidates?.depth || null,
    };
    rows.push([
      page.id,
      page.round ?? "",
      candidates ? DEPTH_LABELS[candidates.depth] : "",
      pageState(ledger, candidates),
      ledger && !ledger.ok ? ledger.reason : "",
      candidates ? candidates.counts.candidates : "",
      candidates ? candidates.counts.autoAccepted : "",
      "",
      candidates?.residual ? candidates.residual.count : "",
      "",
      "",
      page.oldUrl,
      "",
      "",
      `pages/${page.id}/`,
    ]);
  }

  project.writeJson(project.paths.summary, {
    generatedAt: new Date().toISOString(),
    counts,
    fetchReasons,
    oldPageChanged,
    pages,
  });
  // GAS が読む。Excel で開いても化けないよう、UTF-8 の BOM を付ける。
  project.writeFileAtomic(project.paths.status, `\uFEFF${rows.map((row) => row.map(csvCell).join(",")).join("\r\n")}\r\n`);
  return counts;
}

module.exports = { writeSummary, DEPTH_LABELS };

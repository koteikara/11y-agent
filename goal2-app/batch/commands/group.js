// 型のまとめ: 取得したページを構造のハッシュで「構造の型」にまとめ、型ごとの本文の範囲の案を出す
// (docs/renewal/ARCHITECTURE.md の「構造の型と本文の範囲」)。結果は project/templates.json に書く。
// 範囲の承認はディレクターが行う(校正台、それまでは approve のコマンド)。
const { writeSummary } = require("../lib/summary");

function mostCommon(values) {
  const counts = new Map();
  for (const value of values) {
    if (!value) continue;
    counts.set(value, (counts.get(value) || 0) + 1);
  }
  let best = null;
  for (const [value, count] of counts) {
    if (!best || count > best.count) best = { value, count };
  }
  return best;
}

async function runGroup(project, { engine, log, report }) {
  const input = project.readInput();
  const settings = project.readSettings();
  const groups = new Map();
  let fetched = 0;

  for (const page of input.pages) {
    const ledger = project.readPageJson(page.id, "fetch.json");
    if (!ledger?.ok || !ledger.structureHash) continue;
    fetched += 1;
    if (!groups.has(ledger.structureHash)) groups.set(ledger.structureHash, []);
    groups.get(ledger.structureHash).push({ page, ledger });
  }

  const templates = [];
  const smallTemplates = [];
  let genericPages = 0;
  for (const [structureHash, members] of groups) {
    const approved = settings.templates.approved[structureHash] || null;
    const proposal = mostCommon(members.map((member) => member.ledger.genericSelector));
    if (members.length < settings.templates.minPages && !approved) {
      // 承認には回さないが、approve --selector で手で承認できるよう、型と範囲の案は残す。
      genericPages += members.length;
      smallTemplates.push({
        structureHash,
        pageCount: members.length,
        pageIds: members.map(({ page }) => page.id),
        proposedSelector: proposal?.value || null,
        belowMinPages: true,
      });
      continue;
    }
    const selector = approved?.selector || proposal?.value || null;
    const representative = members.find((member) => member.ledger.genericSelector === selector) || members[0];

    // 型の範囲で抜いた本文と、汎用の判定で抜いた本文を比べ、食い違うページを数える。
    let mismatches = 0;
    let notFound = 0;
    if (selector) {
      for (const { page, ledger } of members) {
        const html = project.readPageText(page.id, "source.html");
        if (!html) continue;
        const result = await engine.evaluate((arg) => window.batchTools.compareWithGeneric(arg), {
          html,
          pageTitle: page.pageTitle || "",
          url: ledger.finalUrl,
          selector,
        });
        if (!result.templateFound) notFound += 1;
        else if (!result.matched) mismatches += 1;
      }
    }

    const templateNos = {};
    for (const { page } of members) {
      const key = page.templateNo == null ? "(なし)" : String(page.templateNo);
      templateNos[key] = (templateNos[key] || 0) + 1;
    }

    templates.push({
      structureHash,
      pageCount: members.length,
      pageIds: members.map(({ page }) => page.id),
      proposedSelector: proposal?.value || null,
      proposalAgreement: proposal ? proposal.count : 0,
      // ID かクラスで書けず、要素の並びの順(nth-of-type)に頼る案は、兄弟の数が変わると外れるので印を付ける。
      proposalKind: /nth-of-type/.test(proposal?.value || "") ? "path" : "id-or-class",
      approvedSelector: approved?.selector || null,
      representative: representative.page.id,
      mismatches,
      notFound,
      // シートのテンプレートの番号が型の中で割れていたら、ディレクターに知らせる。
      templateNos,
      templateNoSplit: Object.keys(templateNos).length > 1,
    });
    log.write({ structureHash, pages: members.length, mismatches, notFound });
  }

  templates.sort((a, b) => b.pageCount - a.pageCount);
  project.writeJson(project.paths.templates, {
    generatedAt: new Date().toISOString(),
    minPages: settings.templates.minPages,
    fetchedPages: fetched,
    genericPages,
    templates,
    smallTemplates,
  });
  writeSummary(project);

  report(`型のまとめ: 取得できた ${fetched} ページを ${groups.size} の構造にまとめた`);
  report(`  承認に回す型 ${templates.length}(${templates.reduce((n, t) => n + t.pageCount, 0)} ページ)、汎用の判定に回すページ ${genericPages}`);
  for (const t of templates) {
    const state = t.approvedSelector ? "承認済み" : "未承認";
    const notes = [
      t.mismatches ? `食い違い ${t.mismatches}` : null,
      t.notFound ? `範囲が無い ${t.notFound}` : null,
      t.templateNoSplit ? "テンプレートの番号が割れている" : null,
    ].filter(Boolean);
    report(`  ${t.structureHash} ${t.pageCount} ページ ${state} 代表 ${t.representative}${notes.length ? `(${notes.join("、")})` : ""}`);
  }
  return { templates: templates.length, genericPages };
}

module.exports = { runGroup };

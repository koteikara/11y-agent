// 型のまとめ: 取得したページを、構造の似ている度合いで「構造の型」にまとめ、型ごとの本文の範囲の案を出す
// (docs/renewal/ARCHITECTURE.md の「構造の型と本文の範囲」)。結果は project/templates.json に書く。
// 範囲の承認はディレクターが行う(校正台、それまでは approve のコマンド)。
const { writeSummary } = require("../lib/summary");
const { clusterByStructure, jaccard, usableApproved } = require("../lib/structure");

// 範囲の案を選ぶときに試すページの数と、選んだ案で数えるページの数の上限。
// 1万ページの案件で、型のまとめが半日かからないようにする。上限を超えた型は、抜き取りで数える。
const PROPOSAL_SAMPLE = 40;
const COUNT_SAMPLE = 200;
const MAX_PROPOSALS = 6;
// 型の抜き取りのページのうち、この割合以上に出てくる文字のかたまりを、テンプレートの部分とみなす。
const SHARED_RATIO = 0.5;

function sample(items, limit) {
  if (items.length <= limit) return items;
  const step = items.length / limit;
  return Array.from({ length: limit }, (_, i) => items[Math.floor(i * step)]);
}

function rankSelectors(members) {
  const counts = new Map();
  for (const { ledger } of members) {
    if (!ledger.genericSelector) continue;
    counts.set(ledger.genericSelector, (counts.get(ledger.genericSelector) || 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([selector, count]) => ({ selector, count }));
}

async function measureSelector(project, engine, members, selector) {
  let found = 0;
  let matched = 0;
  let textLength = 0;
  for (const { page, ledger } of members) {
    const html = project.readPageText(page.id, "source.html");
    if (!html) continue;
    const result = await engine.evaluate((arg) => window.batchTools.compareWithGeneric(arg), {
      html,
      pageTitle: page.pageTitle || "",
      url: ledger.finalUrl,
      selector,
    });
    if (result.templateFound) {
      found += 1;
      textLength += result.textLength;
    }
    if (result.matched) matched += 1;
  }
  return { checked: members.length, found, matched, averageTextLength: found ? Math.round(textLength / found) : 0 };
}

// 候補の要素ごとに、ページごとの「本文らしさ」を測る。recall はページごとに違う文字のうち要素に入る割合、
// precision は要素の文字のうちページごとに違う文字の割合。
async function scoreSelectors(project, engine, members, candidates) {
  const pages = [];
  for (const { page } of members) {
    const html = project.readPageText(page.id, "source.html");
    if (!html) continue;
    pages.push(await engine.evaluate((arg) => window.batchTools.textBlocks(arg), { html, selectors: candidates }));
  }
  const frequency = new Map();
  for (const { body } of pages) {
    for (const hash of new Set((body || []).map((block) => block.hash))) frequency.set(hash, (frequency.get(hash) || 0) + 1);
  }
  const threshold = Math.max(2, Math.ceil(pages.length * SHARED_RATIO));
  const isShared = (hash) => (frequency.get(hash) || 0) >= threshold;
  const sum = (blocks, shared) => blocks.filter((block) => isShared(block.hash) === shared).reduce((n, block) => n + block.length, 0);

  const results = candidates.map((selector) => {
    let f1Total = 0;
    let recallTotal = 0;
    let precisionTotal = 0;
    let found = 0;
    let scored = 0;
    for (const { body, perSelector } of pages) {
      const pageUnique = sum(body || [], false);
      if (!pageUnique) continue;
      scored += 1;
      const blocks = perSelector[selector];
      if (!blocks) continue;
      found += 1;
      const unique = sum(blocks, false);
      const shared = sum(blocks, true);
      const recall = unique / pageUnique;
      const precision = unique + shared ? unique / (unique + shared) : 0;
      recallTotal += recall;
      precisionTotal += precision;
      f1Total += recall + precision ? (2 * recall * precision) / (recall + precision) : 0;
    }
    const round = (value) => Number((scored ? value / scored : 0).toFixed(3));
    return { selector, checked: scored, found, recall: round(recallTotal), precision: round(precisionTotal), score: round(f1Total) };
  });
  return results.sort((a, b) => b.score - a.score);
}

async function runGroup(project, { engine, log, report }) {
  const input = project.readInput();
  const settings = project.readSettings();
  const similarity = settings.templates.similarity;

  const items = [];
  for (const page of input.pages) {
    const ledger = project.readPageJson(page.id, "fetch.json");
    if (!ledger?.ok || !Array.isArray(ledger.structurePaths)) continue;
    items.push({ id: page.id, paths: ledger.structurePaths, page, ledger });
  }
  items.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  // 承認した型を先に置き、承認した型の番号が実行のたびに変わらないようにする。
  // 構造の取り方の版は、取得したページの版に合わせる(ページの版がそろっていないときは、多い方)。
  const versions = new Map();
  for (const item of items) versions.set(item.ledger.structureVersion, (versions.get(item.ledger.structureVersion) || 0) + 1);
  const structureVersion = [...versions.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  const staleApproved = Object.keys(settings.templates.approved).length - usableApproved(settings.templates.approved, structureVersion).length;
  const approvedSeeds = usableApproved(settings.templates.approved, structureVersion)
    .map(([templateId, template]) => ({ id: `approved:${templateId}`, templateId, paths: template.paths, seed: true }));
  const clusters = clusterByStructure([...approvedSeeds, ...items], similarity).map((cluster) => ({
    templateId: cluster.rep.seed ? cluster.rep.templateId : cluster.rep.ledger.structureHash,
    approved: cluster.rep.seed ? settings.templates.approved[cluster.rep.templateId] : null,
    members: cluster.members.filter((member) => !member.seed),
    repPaths: cluster.rep.paths,
  }));

  const templates = [];
  const smallTemplates = [];
  let genericPages = 0;
  for (const cluster of clusters) {
    const { templateId, approved, members } = cluster;
    if (!members.length) continue;
    const ranked = rankSelectors(members);
    if (members.length < settings.templates.minPages && !approved) {
      // 承認には回さないが、approve --selector で手で承認できるよう、型と範囲の案は残す。
      genericPages += members.length;
      smallTemplates.push({
        templateId,
        pageCount: members.length,
        pageIds: members.map(({ page }) => page.id),
        paths: cluster.repPaths,
        proposedSelector: ranked[0]?.selector || null,
        belowMinPages: true,
      });
      continue;
    }

    // 範囲の案は、汎用の判定が選んだ要素の中から、型の文字の比べ合わせで選ぶ。型の多くのページに
    // 共通する文字のかたまり(ヘッダー、メニュー、フッター)をテンプレートの部分とみなし、ページごとに
    // 違う文字を多く含み、共通の文字をあまり含まない要素を案にする(ページごとの F 値の平均がいちばん高いもの)。
    // 汎用の判定は、同じ型の中でもページごとに違う要素を選び、ときにフッターを選ぶ。選ばれた回数や、
    // 見つかる数と本文の短さだけで選ぶと、ページ全体やフッターが案になった(遠野市と5市の試走)。
    const candidates = ranked.slice(0, MAX_PROPOSALS).map((entry) => entry.selector);
    const tried = await scoreSelectors(project, engine, sample(members, PROPOSAL_SAMPLE), candidates);
    const proposal = tried[0] || null;
    const selector = approved?.selector || proposal?.selector || null;

    // 選んだ範囲を型のページに当て、範囲が見つからないページと、汎用の判定と食い違うページを数える。
    const counted = selector ? await measureSelector(project, engine, sample(members, COUNT_SAMPLE), selector) : null;
    const representative = members.reduce(
      (best, member) => (jaccard(member.paths, cluster.repPaths) > jaccard(best.paths, cluster.repPaths) ? member : best),
      members[0]
    );

    const templateNos = {};
    for (const { page } of members) {
      const key = page.templateNo == null ? "(なし)" : String(page.templateNo);
      templateNos[key] = (templateNos[key] || 0) + 1;
    }

    templates.push({
      templateId,
      pageCount: members.length,
      pageIds: members.map(({ page }) => page.id),
      paths: cluster.repPaths,
      proposedSelector: proposal?.selector || null,
      // ID かクラスで書けず、要素の並びの順(nth-of-type)に頼る案は、兄弟の数が変わると外れるので印を付ける。
      proposalKind: /nth-of-type/.test(proposal?.selector || "") ? "path" : "id-or-class",
      proposalsTried: tried,
      approvedSelector: approved?.selector || null,
      representative: representative.page.id,
      checkedPages: counted?.checked || 0,
      notFound: counted ? counted.checked - counted.found : 0,
      mismatches: counted ? counted.found - counted.matched : 0,
      // シートのテンプレートの番号が型の中で割れていたら、ディレクターに知らせる。
      templateNos,
      templateNoSplit: Object.keys(templateNos).length > 1,
    });
    log.write({ templateId, pages: members.length, checked: counted?.checked || 0, notFound: counted ? counted.checked - counted.found : 0 });
  }

  templates.sort((a, b) => b.pageCount - a.pageCount);
  project.writeJson(project.paths.templates, {
    generatedAt: new Date().toISOString(),
    similarity,
    structureVersion,
    minPages: settings.templates.minPages,
    fetchedPages: items.length,
    genericPages,
    templates,
    smallTemplates,
  });
  writeSummary(project);

  report(`型のまとめ: 取得できた ${items.length} ページを ${templates.length + smallTemplates.length} の型にまとめた(似ている度合い ${similarity} 以上を同じ型とする)`);
  if (staleApproved) report(`  構造の取り方が変わったため、使えない承認が ${staleApproved} 件ある。型を承認し直す`);
  report(`  承認に回す型 ${templates.length}(${templates.reduce((n, t) => n + t.pageCount, 0)} ページ)、汎用の判定に回すページ ${genericPages}`);
  for (const t of templates) {
    const state = t.approvedSelector ? "承認済み" : "未承認";
    const notes = [
      `範囲が見つかった ${t.checkedPages - t.notFound}/${t.checkedPages}`,
      t.mismatches ? `汎用の判定と食い違い ${t.mismatches}` : null,
      t.proposalKind === "path" ? "案が要素の並びの順に頼る" : null,
      t.templateNoSplit ? "テンプレートの番号が割れている" : null,
    ].filter(Boolean);
    report(`  ${t.templateId} ${t.pageCount} ページ ${state} 代表 ${t.representative}(${notes.join("、")})`);
  }
  return { templates: templates.length, genericPages };
}

module.exports = { runGroup };

// カテゴリ割当の案(移行作業の手順書「カテゴリ割当」)。カテゴリ設計書の新しいカテゴリの木と、移行管理シートの
// 下書き(sheet)のパンくず(旧カテゴリ構成)とグループから、ショートカット1 とオリジナルの案を出す。
//
// ページを1件ずつ割り当てる代わりに、旧カテゴリの木の節ごとに割当先を決め、下のページは引き継ぐ形にする。
// 遠野市の割当済みのシート(1,922 ページ)では、旧カテゴリの親の道ごとに決めると 538 回で 84% のページが人の割当と
// 合い、木の上で決めて下が引き継ぐ形なら 183 回で 70%、373 回で 80% が合った(どこで決めるかを答えから選んだ
// ときの数なので、実際はこれより少し多くかかる)。
//
// 流れ: (1) category を動かすと、crawl/category-draft.xlsx の「旧カテゴリ」に節の一覧(ページ数と、名前で合わせた案)が
// 出る。(2) ディレクターは「割当先(決める)」の列に、節ごとの割当先(ショートカット1 の道)を書く。ページごとに
// 直したいときは「ページ」の「割当先を直す」の列に書く。(3) もう一度 category を動かすと、書いた割当先を読み直し、
// 下のページに引き継いで、オリジナルの案と確かめを出し直す(書いた値は消さない)。
// オリジナルの案は「ホーム/組織から探す/<部>/<課>」に、ショートカット1 の2階層目から下をつないだもの
// (遠野市では 87% がこの形だった)。課はページのグループの案で引く。
const fs = require("fs");
const path = require("path");
const { buildXlsx } = require("../lib/xlsx");
const { readXlsx } = require("../lib/xlsx-read");

const SEP = "/";
const norm = (text) => String(text || "").replace(/\s+/g, "").replace(/[･]/g, "・");
// 道の書き方の揺れ(空白、全角の「／」、「･」)を吸収して比べるための鍵。
const pathKey = (value) =>
  String(value || "")
    .split(/[/／]/)
    .map(norm)
    .filter(Boolean)
    .join(SEP);

// 前の下書きの見出し。ディレクターが書く列が見つからなければ、書いた値を消さないよう止める。
const NODE_SHEET = "旧カテゴリ";
const PAGE_SHEET = "ページ";
const NODE_KEY = "旧カテゴリ";
const NODE_DECIDE = "割当先(決める)";
const PAGE_URL = "移行元 URL";
const PAGE_FIX = "割当先を直す";

// カテゴリ設計書のシートから、カテゴリの道の集まりを読む。見出しの行(1列目がホーム、次が「1階層目」)の下の行を、
// 階層の列の値を左からつないだ道として読む。
function readDesign(file, sheetName, home) {
  const sheets = readXlsx(file);
  const rows = sheets.get(sheetName);
  // シートの名前の一覧は出さない(顧客の資料の作りを画面に出さないため)。
  if (!rows) throw new Error(`カテゴリ設計書に「${sheetName}」のシートがありません(シートは ${sheets.size} 枚。設定 category.designSheet を確かめる)`);
  const headerIndex = rows.findIndex((row) => row && norm(row[0]) === norm(home) && /1階層目/.test(row[1] || ""));
  if (headerIndex < 0) throw new Error(`「${sheetName}」のシートに、「${home}」「1階層目」の見出しの行がありません`);
  const header = rows[headerIndex];
  let levels = 0;
  while (levels < header.length && (levels === 0 || /階層目/.test(header[levels] || ""))) levels += 1;
  const paths = [];
  for (const row of rows.slice(headerIndex + 1)) {
    if (!row || norm(row[0]) !== norm(home)) continue;
    const items = [];
    for (let i = 0; i < levels && row[i]; i += 1) items.push(String(row[i]).trim());
    paths.push(items);
  }
  return paths;
}

// 前に出した下書きから、ディレクターが書いた割当先を読む(無ければ空)。下書きがあるのに、シートか見出しが
// 見つからない(ディレクターが見出しやシートの名前を変えた)ときは、書いた値を黙って捨てて上書きしないよう止める。
function readDecisions(file) {
  const byNode = new Map();
  const byPage = new Map();
  if (!fs.existsSync(file)) return { byNode, byPage };
  const sheets = readXlsx(file);
  const columns = (sheetName, names) => {
    const rows = sheets.get(sheetName);
    const header = rows?.[0] || [];
    const found = names.map((name) => header.indexOf(name));
    if (!rows || found.some((index) => index < 0)) {
      throw new Error(
        `前の下書き(${path.basename(file)})の「${sheetName}」のシートに、見出し ${names.map((n) => `「${n}」`).join("、")} が見つからない。` +
          "書いた割当先を消さないよう止めた。見出しとシートの名前を元に戻すか、ファイルを別の名前に移してから動かす"
      );
    }
    return { rows, found };
  };
  const nodes = columns(NODE_SHEET, [NODE_KEY, NODE_DECIDE]);
  for (const row of nodes.rows.slice(1)) {
    const [keyCol, decideCol] = nodes.found;
    if (row && row[keyCol] && row[decideCol]) byNode.set(row[keyCol], String(row[decideCol]).trim());
  }
  const pages = columns(PAGE_SHEET, [PAGE_URL, PAGE_FIX]);
  for (const row of pages.rows.slice(1)) {
    const [urlCol, fixCol] = pages.found;
    if (row && row[urlCol] && row[fixCol]) byPage.set(row[urlCol], String(row[fixCol]).trim());
  }
  return { byNode, byPage };
}

// 旧カテゴリの道(パンくずの、サイトのトップと今のページを除いた項目)。トップの語は案件の設定 category.topNames。
function oldCategoryOf(page, topNames = DEFAULT_TOP_NAMES) {
  const items = [...(page.breadcrumb || [])];
  if (items.length && topNames.some((name) => norm(name).toLowerCase() === norm(items[0]).toLowerCase())) items.shift();
  if (items.length && page.breadcrumbLastIsCurrent !== false) items.pop();
  return items;
}
const DEFAULT_TOP_NAMES = ["ホーム", "トップ", "トップページ", "TOP", "HOME"];

async function runCategory(project, { log, report }) {
  const settings = project.readSettings();
  const config = settings.category;
  if (!config.designFile) throw new Error("案件の設定 category.designFile に、カテゴリ設計書(xlsx)の場所を書いてください");
  const designFile = path.isAbsolute(config.designFile) ? config.designFile : path.join(project.root, config.designFile);
  const draftFile = path.join(project.root, "crawl", "sheet-draft.json");
  if (!fs.existsSync(draftFile)) throw new Error("移行管理シートの下書きがありません。先に sheet を動かしてください。");
  const draft = JSON.parse(fs.readFileSync(draftFile, "utf8"));
  const home = config.home;

  // 新しいカテゴリの木。組織から探すの下(オリジナル用)と、それ以外(ショートカット用)に分ける。
  const design = readDesign(designFile, config.designSheet, home);
  const exists = new Set(design.map((items) => pathKey(items.join(SEP))));
  const topical = design.filter((items) => items[1] && norm(items[1]) !== norm(config.orgRoot));
  const byName = new Map();
  for (const items of topical) {
    if (items.length < 2) continue;
    const name = norm(items[items.length - 1]);
    if (!byName.has(name)) byName.set(name, []);
    byName.get(name).push(items.join(SEP));
  }
  // 組織から探すの下の、課などの節(名前 → 道)。同じ名前が2つあれば、使わない(取り違えを防ぐ。遠野市では、係の名前が
  // 課をまたいで重なっていた)。
  const orgByName = new Map();
  for (const items of design) {
    if (norm(items[1]) !== norm(config.orgRoot) || items.length < 3) continue;
    const name = norm(items[items.length - 1]);
    orgByName.set(name, orgByName.has(name) ? null : items.join(SEP));
  }
  if (!orgByName.size) report(`  カテゴリ設計書に「${config.orgRoot}」の下のカテゴリが無いので、オリジナルの案は出さない(設定 category.orgRoot を確かめる)`);
  report(`カテゴリ割当の案: カテゴリ設計書のカテゴリ ${design.length}(ショートカット用 ${topical.length})、ページ ${draft.pages.length}`);

  const outFile = path.join(project.root, "crawl", "category-draft.xlsx");
  // 下書きを Excel で開いたままだと、書き直せずに長く待ってから失敗する。書けるかを先に確かめる。
  if (fs.existsSync(outFile)) {
    try {
      fs.closeSync(fs.openSync(outFile, "r+"));
    } catch (error) {
      throw new Error(`下書き(${path.basename(outFile)})を書き直せない(${error.code})。Excel などで開いていれば閉じてから動かす`);
    }
  }
  const decisions = readDecisions(outFile);
  // 書き直す前の下書きを1つ残す(読み込みに不具合があっても、書いた値を手で戻せるように)。
  const backupFile = path.join(project.root, "crawl", "category-draft.prev.xlsx");
  if (decisions.byNode.size || decisions.byPage.size) report(`  前の下書きに書かれた割当先: 旧カテゴリ ${decisions.byNode.size}、ページ ${decisions.byPage.size}`);

  // 旧カテゴリの木の節(道の途中まで)ごとに、下のページの数と、名前で合わせた案。
  const nodes = new Map();
  const pageOld = draft.pages.map((page) => oldCategoryOf(page, config.topNames || DEFAULT_TOP_NAMES));
  for (const items of pageOld) {
    for (let n = 1; n <= items.length; n += 1) {
      const key = items.slice(0, n).join(" > ");
      if (!nodes.has(key)) nodes.set(key, { items: items.slice(0, n), below: 0, direct: 0 });
      nodes.get(key).below += 1;
      if (n === items.length) nodes.get(key).direct += 1;
    }
  }
  const nameMatch = (items) => {
    for (let i = items.length - 1; i >= 0; i -= 1) {
      const found = byName.get(norm(items[i]));
      if (found) return { path: found[0], others: found.length - 1, from: items[i] };
    }
    return null;
  };
  const check = (value) => {
    if (!value) return "";
    const items = value.split(/[/／]/).map((item) => item.trim()).filter(Boolean);
    if (norm(items[0]) !== norm(home)) return `「${home}」から始まっていない`;
    if (!exists.has(pathKey(value))) return "カテゴリ設計書に無い";
    return "";
  };

  // ページごとの割当先。ページで直した値 > 旧カテゴリの節で決めた値(深い節を優先) > 名前で合わせた案。
  const pageRows = [];
  const counts = { decidedPage: 0, decidedNode: 0, nameMatch: 0, none: 0, original: 0, problems: 0 };
  draft.pages.forEach((page, index) => {
    const items = pageOld[index];
    let target = null;
    let source = "";
    if (decisions.byPage.has(page.url)) {
      target = decisions.byPage.get(page.url);
      source = "ページで直した";
      counts.decidedPage += 1;
    }
    for (let n = items.length; n >= 1 && !target; n -= 1) {
      const key = items.slice(0, n).join(" > ");
      if (decisions.byNode.has(key)) {
        target = decisions.byNode.get(key);
        source = `旧カテゴリ「${key}」で決めた`;
        counts.decidedNode += 1;
      }
    }
    if (!target) {
      const match = nameMatch(items);
      if (match) {
        target = match.path;
        source = `案: 旧カテゴリの「${match.from}」と同じ名前${match.others ? `(ほかに同じ名前が ${match.others})` : ""}`;
        counts.nameMatch += 1;
      } else counts.none += 1;
    }
    // オリジナル: 組織から探すの、グループの課の道に、ショートカット1 の2階層目から下をつなぐ。ショートカット1 が
    // 1階層目まで(ホーム/市政)なら、課の道そのものになる(課の直下に置く)。
    let original = "";
    const org = page.group ? orgByName.get(norm(page.group)) : null;
    if (org && target) {
      const tail = target.split(/[/／]/).map((item) => item.trim()).filter(Boolean).slice(2);
      original = [org, ...tail].join(SEP);
      counts.original += 1;
    }
    const problem = [check(target) && `ショートカット1: ${check(target)}`, check(original) && `オリジナル: ${check(original)}`, page.group && !org ? (orgByName.has(norm(page.group)) ? "グループの課と同じ名前が組織から探すに複数ある(部を確かめる)" : "グループの課が組織から探すに無い") : ""]
      .filter(Boolean)
      .join("、");
    if (problem) counts.problems += 1;
    pageRows.push([
      page.id,
      page.type || "",
      page.duplicateOf ? `重複(${page.duplicateOf})` : "",
      page.newTitle || page.title || "",
      page.url,
      items.join(" > "),
      target || "",
      source,
      original,
      page.group || "",
      problem,
      decisions.byPage.get(page.url) || "",
    ]);
  });

  const nodeRows = [[NODE_KEY, "階層", "下のページ", "直下のページ", "名前で合わせた案", "同じ名前のほかの候補", NODE_DECIDE, "確かめ"]];
  for (const [key, node] of [...nodes.entries()].sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))) {
    const match = nameMatch(node.items);
    const decided = decisions.byNode.get(key) || "";
    const others = match ? (byName.get(norm(match.from)) || []).slice(1).join("、") : "";
    nodeRows.push([key, node.items.length, node.below, node.direct, match ? match.path : "", others, decided, decided ? check(decided) : ""]);
  }
  // 3. 書いた割当先のうち、節やページが無くなって使えなかったもの(sheet を動かし直してパンくずが変わったなど)。
  const lostNodes = [...decisions.byNode.keys()].filter((key) => !nodes.has(key)).length;
  const pageUrls = new Set(draft.pages.map((page) => page.url));
  const lostPages = [...decisions.byPage.keys()].filter((url) => !pageUrls.has(url)).length;
  if (lostNodes || lostPages) report(`  書いた割当先のうち、節かページが無くなって使えなかったもの: 旧カテゴリ ${lostNodes}、ページ ${lostPages}(前の下書きを ${path.basename(backupFile)} に残した)`);
  const header = ["移行管理 ID", "ページ種別(案)", "重複", "ページタイトル", PAGE_URL, "旧カテゴリ", "ショートカット1(案)", "案の出どころ", "オリジナル(案)", "グループ(案)", "確かめ", PAGE_FIX];
  const guide = [
    ["シート", "使い方"],
    ["旧カテゴリ", "見出しとシートの名前は変えない(変えると、書いた割当先を読めずに止まる)。書き直す前の下書きは category-draft.prev.xlsx に残す。旧サイトのカテゴリ(パンくず)の節ごとの一覧。「割当先(決める)」に、その節のページのショートカット1 の道(例: ホーム/市政/広報・広聴)を書くと、下のページに引き継ぐ。深い節に書いた値が優先する。書いたあと、category をもう一度動かす"],
    ["ページ", "ページごとの案。「割当先を直す」に書いた値は、旧カテゴリで決めた値より優先する。「確かめ」は、カテゴリ設計書に無い道や、ホームの抜け"],
    ["名前で合わせた案", "旧カテゴリの名前と同じ名前のカテゴリが新しい木にあれば、その道。遠野市では、案の半分ほどが人の割当と合った。決める前の手がかりとして見る"],
    ["オリジナル(案)", "組織から探すの、グループの課の道に、ショートカット1 の2階層目から下をつないだもの。グループの課が組織から探すに無ければ空"],
  ];
  if (fs.existsSync(outFile)) fs.copyFileSync(outFile, backupFile);
  project.writeFileAtomic(
    outFile,
    buildXlsx([
      { name: NODE_SHEET, rows: nodeRows, widths: [60, 6, 10, 10, 50, 40, 50, 24] },
      { name: PAGE_SHEET, rows: [header, ...pageRows], widths: [16, 12, 16, 40, 60, 50, 50, 40, 60, 16, 30, 40] },
      { name: "説明", rows: guide, widths: [18, 110] },
    ])
  );
  await project.flush();
  log.write({ result: "ok", pages: draft.pages.length, nodes: nodes.size, ...counts });
  report(`  旧カテゴリの節 ${nodes.size}`);
  report(`  ショートカット1: ページで直した ${counts.decidedPage}、旧カテゴリで決めた ${counts.decidedNode}、名前で合わせた案 ${counts.nameMatch}、案なし ${counts.none}`);
  report(`  オリジナルの案 ${counts.original}、確かめで引っかかったページ ${counts.problems}`);
  report(`  一覧: ${path.relative(project.root, outFile)}`);
}

module.exports = { runCategory, readDesign, oldCategoryOf };

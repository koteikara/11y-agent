// 移行管理シートの下書き: 巡回の結果から、移行管理シート作成(手順書 1-1)で埋める列の案を、1回で出す。
// 旧ページタイトル、移行元 URL、h1、旧カテゴリ構成(パンくず)、グループの案(問い合わせ先の部署)、
// ページ種別の案と理由、重複の案、新ページタイトルの案と直した点、パターン(レイアウトをそろえる群)の案。
// どれも案で、ディレクターが確かめてからシートへ写す。理由の列を付け、なぜその案かを追えるようにする。
//
// 旧ページは、巡回で取った写し(crawl/pages/<鍵>/source.html)を読む。旧サイトへは取りに行かない。
// ページごとに調べた結果は crawl/pages/<鍵>/sheet.json に残し、次からは使い回す(セレクターを変えたら作り直す)。
const fs = require("fs");
const path = require("path");
const { buildXlsx } = require("../lib/xlsx");
const { normalizeTitle } = require("../lib/titles");
const { urlKey, isPrintPage } = require("./crawl");

// 調べた結果(sheet.json)の版。取り出し方を変えたら上げ、作り直させる。
const SHEET_VERSION = 4;
const READ_CONCURRENCY = 8;

// ページ種別の案を、URL と本文のリンクの割合から決める。理由も返す。
// 1文字のディレクトリ(/k/、/i/)は携帯用とは限らないので入れない。/sp/ は手順書(1-1)にスマートフォン用の手がかりとしてある。
const MOBILE_URL = /\/(mobile|keitai|sp|smartphone|phone)\//i;
const SPECIAL_URL = [
  [/sitemap/i, "サイトマップ"],
  [/(news_?list|shinchaku|whatsnew|new_?list)/i, "新着の一覧"],
  [/(^|[/_.-])(search|kensaku)([/_.?-]|$)/i, "検索"],
  [/\/(reiki|reiki_int|reikishu)\//i, "例規集"],
  [/(calendar|event_?cal)/i, "カレンダー"],
  [/\/(map|maps)\//i, "地図"],
  [/\.(xml|rss)(\?|$)|\/rss\//i, "RSS"],
  [/cgi-bin\//i, "CGI"],
];

// ページ種別の案。カテゴリかどうかは、まずパンくずで決める。ほかのページのパンくずの途中に、このページの
// パンくずの道が出てくれば、下にページを持つカテゴリとみなす(遠野市のシートとの比べ合わせで、本文のリンクの
// 割合で決めるより当たった。詳細の96%が詳細になった)。パンくずが取れないページだけ、リンクの割合で決める。
// カテゴリのうち、リンクでない文字が categoryContentChars 字以上あれば「内容有」とする(本文の範囲に
// メニューが混じることがあり、ここは当たりにくい。理由の列で字数を見せる)。
function classifyPage({ url, depth, facts, labels, thresholds, children = null }) {
  const { pathname } = new URL(url);
  if (depth === 0) return { type: labels.special, reason: "巡回の始まり(サイトのトップ)" };
  if (MOBILE_URL.test(pathname)) return { type: labels.mobile, reason: "URL が携帯・スマートフォン用の道" };
  for (const [pattern, name] of SPECIAL_URL) if (pattern.test(url)) return { type: labels.special, reason: `URL が${name}の形` };
  const body = facts.body || {};
  const ratio = body.textLength ? body.linkTextLength / body.textLength : 0;
  const ownText = Math.max(0, (body.textLength || 0) - (body.linkTextLength || 0));
  if (children != null) {
    if (children > 0) {
      return ownText < thresholds.categoryContentChars
        ? { type: labels.category, reason: `パンくずの下に ${children} ページ。リンクでない文字が ${ownText} 字` }
        : { type: labels.categoryContent, reason: `パンくずの下に ${children} ページ。リンクでない文字も ${ownText} 字ある` };
    }
    return { type: labels.detail, reason: `パンくずの下にページが無い。本文 ${body.textLength || 0} 字` };
  }
  if (body.links >= thresholds.categoryMinLinks && ratio >= thresholds.categoryLinkRatio) {
    if (ownText < thresholds.categoryContentChars) {
      return { type: labels.category, reason: `本文の ${Math.round(ratio * 100)}% がリンク(${body.links} 件)で、ほかの文字が ${ownText} 字` };
    }
    return { type: labels.categoryContent, reason: `本文の ${Math.round(ratio * 100)}% がリンク(${body.links} 件)で、ほかの文字も ${ownText} 字ある` };
  }
  return { type: labels.detail, reason: `パンくずが取れない。本文 ${body.textLength || 0} 字、リンク ${body.links || 0} 件` };
}

// パンくずの道(項目の並び)の、途中までの道ごとに、その下にあるページの数を数える。
const crumbKey = (items) => items.map((item) => item.replace(/\s+/g, "")).join(">");
function countCrumbChildren(allFacts, skip = () => false) {
  const below = new Map();
  allFacts.forEach((fact, index) => {
    if (skip(index)) return;
    const items = fact?.breadcrumb?.items || [];
    for (let n = 1; n < items.length; n += 1) {
      const key = crumbKey(items.slice(0, n));
      below.set(key, (below.get(key) || 0) + 1);
    }
  });
  return below;
}

// 題名の末尾の、多くのページに共通する部分(区切りの文字から後ろ)を見つける。半分以上のページにあれば返す。
const TITLE_SEPARATOR = /\s*[｜|]\s*|\s+[-－–—:：]\s+/g;
function detectTitleSuffix(titles) {
  const counts = new Map();
  for (const title of titles) {
    const matches = [...title.matchAll(TITLE_SEPARATOR)];
    if (!matches.length) continue;
    const last = matches[matches.length - 1];
    const suffix = title.slice(last.index);
    counts.set(suffix, (counts.get(suffix) || 0) + 1);
  }
  const [best, n] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0] || [null, 0];
  return best && n >= titles.length / 2 ? best : null;
}

// 問い合わせ先の部署の文字から、グループの案(いちばん下の課や室)を取る。CMS のグループは課の単位が
// 多い(遠野市のシートでは、問い合わせ先の「総務企画部 経営企画課」に対し、グループは「経営企画課」)。
const UNIT = /(課|室|局|係|班|担当|センター|館|所|園|校|事務局|委員会)$/;
function groupFrom(department) {
  if (!department) return "";
  const parts = department.split(/[\s・]+/).filter(Boolean);
  for (let i = parts.length - 1; i >= 0; i -= 1) if (UNIT.test(parts[i])) return parts[i];
  // 単位の語が無いもの(住所や本文の文が混じったもの)は、グループの案にしない。
  return "";
}

function readLatestRecords(project) {
  const file = path.join(project.root, "crawl", "records.jsonl");
  if (!fs.existsSync(file)) throw new Error("巡回の結果がありません。先に crawl を動かしてください。");
  const latest = new Map();
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    if (!line.trim()) continue;
    try {
      const record = JSON.parse(line);
      latest.set(record.url, record);
    } catch {
      // 途中で止まって書きかけの行は飛ばす。
    }
  }
  return latest;
}

async function runSheet(project, { engine, log, report }) {
  const settings = project.readSettings();
  const sheet = settings.sheet;
  const latest = readLatestRecords(project);
  // 階層の浅い順、同じ階層では URL の順に並べる(Website Explorer の一覧に近い並び)。
  const pages = [...latest.values()]
    .filter((record) => record.kind === "page" && record.ok)
    .filter((record) => !(settings.crawl.excludePrintPages && isPrintPage(new URL(record.url))))
    .sort((a, b) => (a.depth ?? 0) - (b.depth ?? 0) || (a.url < b.url ? -1 : a.url > b.url ? 1 : 0));
  if (!pages.length) throw new Error("巡回で取れたページがありません。");
  report(`移行管理シートの下書き: 巡回で取れたページ ${pages.length} を調べる`);

  // ページごとの事実(題名、h1、パンくず、問い合わせ先、本文のリンクの割合)。
  const selectors = { breadcrumbSelector: sheet.breadcrumbSelector || null, contactSelector: sheet.contactSelector || null };
  const facts = new Array(pages.length);
  const problems = new Array(pages.length);
  let analyzed = 0;
  let missing = 0;
  let failed = 0;
  let next = 0;
  const lanes = Array.from({ length: READ_CONCURRENCY }, async () => {
    while (next < pages.length) {
      const index = next;
      next += 1;
      const page = pages[index];
      const dir = path.join(project.root, "crawl", "pages", urlKey(page.url));
      const cacheFile = path.join(dir, "sheet.json");
      let cached = null;
      let sourceTime = null;
      try {
        sourceTime = (await fs.promises.stat(path.join(dir, "source.html"))).mtimeMs;
      } catch {
        sourceTime = null;
      }
      try {
        cached = JSON.parse(await fs.promises.readFile(cacheFile, "utf8"));
      } catch {
        cached = null;
      }
      const usable =
        cached &&
        cached.sheetVersion === SHEET_VERSION &&
        cached.breadcrumbSelector === selectors.breadcrumbSelector &&
        cached.contactSelector === selectors.contactSelector &&
        cached.sourceTime === sourceTime;
      if (!usable) {
        let html;
        try {
          html = await fs.promises.readFile(path.join(dir, "source.html"), "utf8");
        } catch {
          missing += 1;
          problems[index] = "旧ページの写しが無い(巡回を再開すると取り直す)";
          continue;
        }
        try {
          const result = await engine.evaluate((arg) => window.batchTools.sheetFacts(arg), { html, url: page.finalUrl || page.url, ...selectors });
          cached = { sheetVersion: SHEET_VERSION, ...selectors, sourceTime, ...result };
        } catch {
          failed += 1;
          problems[index] = "旧ページを調べられなかった";
          continue;
        }
        project.queueWrite(cacheFile, JSON.stringify(cached));
        analyzed += 1;
      }
      facts[index] = cached;
    }
  });
  await Promise.all(lanes);
  if (analyzed) report(`  ページを調べた: ${analyzed}(ほかは前の結果を使った)`);
  if (missing) report(`  旧ページの写しが無いページ: ${missing}(巡回を再開すると取り直す)`);
  if (failed) report(`  調べられなかったページ: ${failed}`);

  // 移行管理 ID の案。頭の文字と桁と末尾は案件の設定で決める(遠野市のシートは tono00001_0701 の形)。
  const idOf = new Map();
  pages.forEach((page, index) => idOf.set(page.url, `${sheet.idPrefix}${String(index + 1).padStart(sheet.idDigits, "0")}${sheet.idSuffix}`));

  // パターン(レイアウトをそろえる群)の案は、コンテンツパターンの抽出の結果から引く。抽出していなければ空。
  const patternsFile = path.join(project.root, "crawl", "patterns.json");
  const patternPagesFile = path.join(project.root, "crawl", "patterns-pages.json");
  const patternOf = new Map();
  if (fs.existsSync(patternsFile) && fs.existsSync(patternPagesFile)) {
    const patterns = JSON.parse(fs.readFileSync(patternsFile, "utf8"));
    const byRank = new Map(patterns.candidates.map((candidate) => [candidate.rank, candidate]));
    for (const [url, entry] of Object.entries(JSON.parse(fs.readFileSync(patternPagesFile, "utf8")))) {
      const candidate = entry.candidate != null ? byRank.get(entry.candidate) : null;
      if (candidate) patternOf.set(url, `候補${candidate.rank} ${candidate.kind}(${candidate.pages} ページ)`);
    }
  } else {
    report("  コンテンツパターンの抽出の結果が無いので、パターンの列は空にする(patterns を動かすと入る)");
  }

  const crumbBelow = countCrumbChildren(facts, (index) => Boolean(pages[index].duplicateOf));

  // 題名の末尾のサイト名(「…｜遠野市」)。多くのページに共通する末尾を外してから、新ページタイトルの案を作る
  // (遠野市では 2,728 件中 2,722 件に付いていた)。案件の設定 sheet.titleSuffix で決めることもできる。
  const titleSuffix = sheet.titleSuffix ?? detectTitleSuffix(pages.map((page, index) => facts[index]?.title || page.title || ""));
  if (titleSuffix) report(`  題名の末尾の共通の文字を外して新ページタイトルの案を作る(${titleSuffix.length} 字)`);

  // 同じ題名のページの数(重複の手がかり。中身が同じページは、巡回が重複として見つけている)。
  const titleCount = new Map();
  pages.forEach((page, index) => {
    const title = facts[index]?.title || page.title || "";
    if (title) titleCount.set(title, (titleCount.get(title) || 0) + 1);
  });

  const header = [
    "移行管理 ID(案)",
    "ページ種別(案)",
    "種別の理由",
    "移行有無(案)",
    "重複の元",
    "グループ(案)",
    "問い合わせ先(部署)",
    "旧ページタイトル",
    "新ページタイトル(案)",
    "タイトルの直し",
    "タイトルの要確認",
    "h1",
    "パターン(案)",
    "移行元 URL",
    "旧カテゴリ構成(案)",
    "パンくずの見つけ方",
    "階層",
    "同じ題名",
  ];
  const rows = [header];
  const counts = { types: {}, duplicate: 0, sameTitle: 0, breadcrumb: 0, contact: 0, titleChanged: 0, titleChecks: 0, h1Differs: 0, pattern: 0 };
  pages.forEach((page, index) => {
    const fact = facts[index] || {};
    const title = fact.title || page.title || "";
    const classified = facts[index]
      ? classifyPage({
          url: page.url,
          depth: page.depth,
          facts: fact,
          labels: sheet.pageTypes,
          thresholds: sheet.thresholds,
          children: fact.breadcrumb ? crumbBelow.get(crumbKey(fact.breadcrumb.items)) || 0 : null,
        })
      : { type: "", reason: problems[index] || "旧ページを調べられなかった" };
    const base = titleSuffix && title.endsWith(titleSuffix) && title.length > titleSuffix.length ? title.slice(0, -titleSuffix.length).trim() : title;
    const normalized = normalizeTitle(base, { halfwidthAlnum: sheet.halfwidthAlnum !== false });
    if (base !== title) normalized.changes.unshift("末尾のサイト名を外す");
    const duplicateOf = page.duplicateOf ? idOf.get(page.duplicateOf) || page.duplicateOf : "";
    const sameTitle = titleCount.get(title) || 0;
    counts.types[classified.type || "(無し)"] = (counts.types[classified.type || "(無し)"] || 0) + 1;
    if (duplicateOf) counts.duplicate += 1;
    if (sameTitle > 1) counts.sameTitle += 1;
    if (fact.breadcrumb) counts.breadcrumb += 1;
    if (fact.contact) counts.contact += 1;
    if (normalized.changes.length) counts.titleChanged += 1;
    if (normalized.checks.length) counts.titleChecks += 1;
    if (fact.h1 && title && !title.includes(fact.h1)) counts.h1Differs += 1;
    if (patternOf.has(page.url)) counts.pattern += 1;
    rows.push([
      idOf.get(page.url),
      classified.type,
      classified.reason,
      duplicateOf ? sheet.duplicateLabel : "",
      duplicateOf ? `${duplicateOf} と中身が同じ` : "",
      groupFrom(fact.contact?.department),
      fact.contact ? `${fact.contact.department}(${fact.contact.found})` : "",
      title,
      normalized.changes.length ? normalized.title : "",
      normalized.changes.join("、"),
      normalized.checks.join("、"),
      fact.h1 || "",
      patternOf.get(page.url) || "",
      page.url,
      fact.breadcrumb ? fact.breadcrumb.items.join(" > ") : "",
      fact.breadcrumb ? `${fact.breadcrumb.found}${fact.breadcrumb.lastIsCurrent === false ? "(最後の項目が題名と違う。今のページが抜けているかもしれない)" : ""}` : "",
      page.depth ?? "",
      sameTitle > 1 ? `${sameTitle} 件` : "",
    ]);
  });

  const guide = [
    ["列", "中身", "シートの列"],
    ["移行管理 ID(案)", "案件の設定 sheet.idPrefix、idDigits、idSuffix で作った連番", "移行管理 ID"],
    ["ページ種別(案)", "URL の形と、パンくずの下にページがあるか(無ければ詳細)で決めた案。パンくずが取れないページは本文のリンクの割合で決める。理由の列を見て確かめる", "ページ種別"],
    ["移行有無(案)", "巡回が中身の同じページを見つけたときだけ「重複」を入れる。移行する、移行しないは顧客が決める", "移行有無"],
    ["グループ(案)", "ページの問い合わせ先の部署のうち、いちばん下の課や室。運用設計書のグループの名前とは照らしていない", "グループ"],
    ["問い合わせ先(部署)", "問い合わせ先から取った部署の文字と、見つけた要素", ""],
    ["旧ページタイトル", "title 要素の文字", "旧ページタイトル"],
    ["新ページタイトル(案)", "題名の末尾のサイト名(多くのページに共通する「｜○○市」など)を外し、規則で直したもの。直す所が無ければ空(旧タイトルのまま)", "新ページタイトル"],
    ["タイトルの要確認", "規則では決めきれない書き方(8/4 の形、h26 の形など)。人が見て直す", ""],
    ["h1", "ページの最初の h1。題名と違うときは、目で見たページの名前はこちらかもしれない", ""],
    ["パターン(案)", "コンテンツパターンの抽出で、そのページが入った候補", "パターン"],
    ["旧カテゴリ構成(案)", "パンくずの項目を > でつないだもの", "旧カテゴリ構成"],
  ];
  const outDir = path.join(project.root, "crawl");
  const xlsxFile = path.join(outDir, "sheet-draft.xlsx");
  project.writeFileAtomic(
    xlsxFile,
    buildXlsx([
      { name: "下書き", rows, widths: [16, 14, 36, 10, 22, 24, 24, 40, 40, 30, 30, 40, 30, 60, 50, 24, 6, 8] },
      { name: "説明", rows: guide, widths: [22, 80, 18] },
    ])
  );
  await project.flush();
  log.write({ result: "ok", pages: pages.length, ...counts, types: undefined, typeCounts: counts.types });

  report(`  ページ種別の案: ${Object.entries(counts.types).map(([type, n]) => `${type} ${n}`).join("、")}`);
  report(`  重複の案 ${counts.duplicate}、同じ題名のページ ${counts.sameTitle}`);
  report(`  パンくずが取れた ${counts.breadcrumb}、問い合わせ先が取れた ${counts.contact}、パターンの案 ${counts.pattern}`);
  report(`  新ページタイトルの案 ${counts.titleChanged}、要確認 ${counts.titleChecks}、題名と h1 が違う ${counts.h1Differs}`);
  report(`  一覧: ${path.relative(project.root, xlsxFile)}`);
}

module.exports = { runSheet, classifyPage, groupFrom, countCrumbChildren, crumbKey, detectTitleSuffix };

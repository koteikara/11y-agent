// 巡回: 旧サイトをリンクと sitemap.xml でたどり、ページの一覧(URL、タイトル)を作る。
// 移行管理シートの「ページ一覧」(FLOW.md の 2-1)の元にする。今は Website Explorer で作り、うまく取れない
// サイトでは WebCopy を使っている(2026-10-07 ユーザー)。2つのツールのよいところを取り入れた。
//   - リンクを探す場所を広く取る(WebCopy): 要素のリンクに加え、meta refresh、onclick などとスクリプトの中の
//     location.href や window.open、選ぶメニューの URL。
//   - スクリプトでメニューを描くページは、Chromium で開いてからリンクを拾う(2つのツールとも苦手なところ)。
//   - Cookie を引き継ぎ、名乗り(ユーザーエージェント)を案件の設定で変えられる(WebCopy)。
//   - セッションの番号や広告の印など、外してよい URL の項目を外してから、同じページかを決める(WebCopy)。
//   - 一覧にディレクトリの列を付け、ファイルの大きさと更新日を聞ける(Website Explorer)。外のサイトへの
//     リンクも一覧にする(Website Explorer)。
//
// 取りに行くのは案件の設定の fetch.allowedHosts のサーバーだけで、間隔と同時数も取得と同じ設定に従う。
// robots.txt で止められた URL は取りに行かない。PDF や画像などのファイルは中身を取らない。
// 取ったページは crawl/pages/ に保存し、あとの取得(fetch)は、同じ URL ならこれを使って旧サイトへ取りに行かない。
//
// 書くもの(案件のフォルダの crawl/):
//   state.json     巡回の途中の状態(止めても続きから再開する)
//   records.jsonl  1 URL 1 行の記録
//   pages/<鍵>/    source.html と meta.json
//   list.csv       ページの一覧
//   files.csv      ファイルの一覧
//   external.csv   外のサイトへのリンクの一覧(サーバーごと。URL はサーバーごとに200件まで)
//   capped.csv     同じ形の URL が多く、上限で打ち切った形の一覧
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { fetchPage, headFile, assertAllowed, createCookieJar, isHtmlType } = require("../lib/fetcher");
const { parseRobots, isAllowedByRobots, parseSitemap } = require("../lib/robots");

const FILE_EXTENSION = /\.(pdf|docx?|xlsx?|pptx?|csv|zip|lzh|txt|jtd|odt|ods|odp|rtf|jpe?g|png|gif|bmp|svg|webp|ico|tiff?|mp3|mp4|m4a|wav|wmv|avi|mov|flv|exe|ics|kml|kmz)$/i;
const STATE_SAVE_EVERY = 25;
const EXTERNAL_URLS_PER_HOST = 200;

const DISCOVERY_LABELS = {
  start: "始まり",
  sitemap: "sitemap.xml",
  link: "リンク",
  script: "スクリプトの中",
  render: "Chromium で開いて",
};

function urlKey(url) {
  return crypto.createHash("sha256").update(url).digest("hex").slice(0, 20);
}

// URL を整える。# 以降と、外してよい項目(ignoreParams。大文字と小文字は区別しない)を落とす。
// パスの中の ;jsessionid=… も落とす。
function normalizeUrl(value, ignoreParams = []) {
  try {
    const url = new URL(value);
    url.hash = "";
    url.pathname = url.pathname.replace(/;jsessionid=[^/?]*/i, "");
    if (ignoreParams.length) {
      const ignore = new Set(ignoreParams.map((name) => name.toLowerCase()));
      for (const name of [...url.searchParams.keys()]) {
        if (ignore.has(name.toLowerCase())) url.searchParams.delete(name);
      }
    }
    return url.href;
  } catch {
    return null;
  }
}

function csvCell(value) {
  const text = value == null ? "" : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function writeCsv(project, file, rows) {
  // Excel で開いても化けないよう、UTF-8 の BOM を付ける。
  project.writeFileAtomic(file, `﻿${rows.map((row) => row.map(csvCell).join(",")).join("\r\n")}\r\n`);
}

function crawlPaths(project) {
  const dir = path.join(project.root, "crawl");
  return {
    dir,
    state: path.join(dir, "state.json"),
    records: path.join(dir, "records.jsonl"),
    pages: path.join(dir, "pages"),
    list: path.join(dir, "list.csv"),
    files: path.join(dir, "files.csv"),
    external: path.join(dir, "external.csv"),
  };
}

// 取得(fetch)が使う。巡回で取ったページのうち、URL が同じで、新しさの上限(日)に収まるものを返す。
function readCrawledPage(project, url, maxAgeDays, ignoreParams = []) {
  const normalized = normalizeUrl(url, ignoreParams);
  if (!normalized) return null;
  const dir = path.join(crawlPaths(project).pages, urlKey(normalized));
  let meta;
  try {
    meta = JSON.parse(fs.readFileSync(path.join(dir, "meta.json"), "utf8"));
  } catch {
    return null;
  }
  if (meta.url !== normalized || !meta.ok) return null;
  if (Date.now() - Date.parse(meta.fetchedAt) > maxAgeDays * 86400000) return null;
  try {
    return { ...meta, html: fs.readFileSync(path.join(dir, "source.html"), "utf8") };
  } catch {
    return null;
  }
}

function isAllowedHost(target, settings) {
  const hosts = settings.fetch.allowedHosts.map((host) => host.toLowerCase());
  return hosts.includes(target.hostname.toLowerCase()) || hosts.includes(target.host.toLowerCase());
}

const excludeCache = new WeakMap();
function excludePatterns(settings) {
  if (!excludeCache.has(settings)) excludeCache.set(settings, settings.crawl.exclude.map((pattern) => new RegExp(pattern)));
  return excludeCache.get(settings);
}

// 印刷用ページの URL か。道の名前と URL の項目で見る(遠野市の /handlers/printcontent.cfm?…、
// /print/…、print.html、?print=1、?mode=print など)。
// 本文のページを外さないよう、狭く取る。insatsu(印刷製本の入札、印刷業の支援)や printer(3D プリンターの
// 案内)は、自治体サイトでは本文のページの名前に使われるので、印刷用ページとはみなさない。
const PRINT_PATH = /(^|[/_.-])print(content|page|out|view|able|friendly|er-friendly)?(\.[a-z0-9]+)?(\/|$)/i;
const PRINT_PARAMS = /^(print|printable|printmode)$/i;
const PRINT_VALUE_PARAMS = /^(mode|view|type|format|style|tmpl|template|layout|output|media|display|action)$/i;
const PRINT_VALUES = /^print(able|_?view|_?page|out)?$/i;
const OFF_VALUES = /^(0|false|no|off)$/i;
function isPrintPage(target) {
  let pathname = target.pathname;
  try {
    pathname = decodeURIComponent(pathname);
  } catch {
    // そのまま見る。
  }
  if (PRINT_PATH.test(pathname)) return true;
  for (const [name, value] of target.searchParams) {
    if (PRINT_PARAMS.test(name) && !OFF_VALUES.test(value)) return true;
    if (PRINT_VALUE_PARAMS.test(name) && PRINT_VALUES.test(value)) return true;
  }
  return false;
}

// URL の項目(? のあと)を持つ URL の「形」。道の数字を伏せ、項目の名前を並べたもの。ブログやカレンダーは、
// 項目の組み合わせの数だけ URL が増え、巡回が終わらない(椎葉村のブログの itemid、page、catid、トラックバック)。
// 同じ形の URL は crawl.maxPerQueryPattern 件までにする(項目が2つ以上の形だけ。下の説明)。項目の無い URL は数えない(記事を道で分けるサイトの、
// 大きな欄を打ち切らないため)。道の中に項目を書くブログ(椎葉村の /blog/index-itemid=12&page=2)も、道に = を
// 含むものは項目を持つ URL として数える。
function queryPatternKey(url) {
  let target;
  try {
    target = new URL(url);
  } catch {
    return null;
  }
  // 項目の名前は、? のあとと、道の中の「名前=値」(椎葉村の /blog/index-itemid=12&page=2)から集める。
  const pathNames = [...target.pathname.matchAll(/(?:^|[&;/\-])([A-Za-z_]\w*)=/g)].map((m) => m[1]);
  const names = [...new Set([...target.searchParams.keys(), ...pathNames])].sort();
  // 項目が1つだけの形(記事の番号の ?id=N、/blog/index-itemid=N)は、本文のページそのものなので数えない。
  // 組み合わせで増えるのは、項目が2つ以上の形(記事 × ページ番号、分類 × 月など)である。
  if (names.length < 2) return null;
  return `${target.origin}${target.pathname.replace(/[0-9]+/g, "N")}?${names.join("&")}`;
}

function inScope(url, settings) {
  let target;
  try {
    target = new URL(url);
  } catch {
    return false;
  }
  if (!isAllowedHost(target, settings)) return false;
  if (settings.crawl.excludePrintPages && isPrintPage(target)) return false;
  const { include, exclude } = settings.crawl;
  if (include.length && !include.some((prefix) => url.startsWith(prefix))) return false;
  if (exclude.length && excludePatterns(settings).some((pattern) => pattern.test(url))) return false;
  return true;
}

function directoryOf(url) {
  try {
    const { pathname } = new URL(url);
    return pathname.endsWith("/") ? pathname : pathname.replace(/[^/]*$/, "");
  } catch {
    return "";
  }
}

const pause = (settings) => new Promise((resolve) => setTimeout(resolve, settings.fetch.intervalMs));

async function loadRobots(settings, cookies, report) {
  const robotsByHost = {};
  const sitemaps = [];
  for (const host of settings.fetch.allowedHosts) {
    for (const scheme of ["https", "http"]) {
      const key = new URL(`${scheme}://${host}/`).host;
      // robots.txt とサイトマップも、ページと同じ間隔を空けて取る。
      await pause(settings);
      try {
        const result = await fetchPage(`${scheme}://${host}/robots.txt`, settings.fetch, { accept: () => true, cookies });
        const parsed = parseRobots(result.html);
        robotsByHost[key] = parsed;
        sitemaps.push(...parsed.sitemaps);
        break;
      } catch (error) {
        if (error.reason === "http-status") {
          robotsByHost[key] = { rules: [], sitemaps: [] };
          break;
        }
      }
    }
  }
  const disallowCount = Object.values(robotsByHost).reduce((n, robots) => n + robots.rules.filter((rule) => !rule.allow).length, 0);
  report(`  robots.txt: ${Object.keys(robotsByHost).length} サーバー、止める道 ${disallowCount}、サイトマップ ${sitemaps.length}`);
  return { robotsByHost, sitemaps };
}

async function loadSitemapUrls(settings, sitemaps, cookies, report) {
  const queue = [...new Set(sitemaps)];
  for (const host of settings.fetch.allowedHosts) queue.push(`https://${host}/sitemap.xml`, `http://${host}/sitemap.xml`);
  const seen = new Set();
  const urls = new Set();
  while (queue.length && seen.size < 50) {
    const sitemapUrl = queue.shift();
    if (seen.has(sitemapUrl)) continue;
    seen.add(sitemapUrl);
    await pause(settings);
    try {
      const result = await fetchPage(sitemapUrl, settings.fetch, { accept: (type) => /xml|text\/plain/i.test(type), cookies });
      const parsed = parseSitemap(result.html);
      parsed.urls.forEach((url) => urls.add(url));
      queue.push(...parsed.children);
    } catch {
      // サイトマップが無いサイトは多い。無ければリンクだけでたどる。
    }
  }
  if (urls.size) report(`  sitemap.xml: ${urls.size} URL`);
  return [...urls];
}

async function runCrawl(project, { engine, startUrls, restart = false, log, report }) {
  const settings = project.readSettings();
  const paths = crawlPaths(project);
  const limits = settings.crawl;
  const rules = settings.fetch;
  const ignoreParams = limits.ignoreParams;
  // 外す項目には、巡回の中で見つけた「値が変わっても中身が同じになる項目」も足す(state.learnedIgnoreParams)。
  let state = null;
  const normalize = (value) => normalizeUrl(value, [...ignoreParams, ...(state?.learnedIgnoreParams || [])]);
  if (!rules.allowedHosts.length) throw new Error("案件の設定の fetch.allowedHosts に、旧サイトのサーバーを入れてください。");
  const starts = (startUrls && startUrls.length ? startUrls : limits.startUrls).map(normalize).filter(Boolean);
  if (!starts.length) throw new Error("始まりの URL を、--start か案件の設定の crawl.startUrls で指定してください。");

  // Cookie は巡回のあいだだけ持つ(state.json には書かない)。再開したときは、新しく受け取り直す。
  const cookies = limits.cookies ? createCookieJar() : null;

  fs.mkdirSync(paths.pages, { recursive: true });
  state = restart ? null : project.readJson(paths.state);
  // 終わった巡回かどうかは、取り直すページを数えたあとで、まとめて画面に出す。
  const wasFinished = Boolean(state?.finished);
  const resumeNotes = [];
  // 待ち行列の中の項目(URL から引く)。同時に2ページ以上をたどると、深い道から先に同じページに
  // 着くことがあるので、まだ取りに行っていなければ、浅い方の階層と見つけた元に直す。
  let queued = new Map();
  const enqueue = (url, depth, from, via) => {
    const normalized = normalize(url);
    if (!normalized) return;
    if (state.seen[normalized]) {
      const waiting = queued.get(normalized);
      if (waiting && depth < waiting.depth) Object.assign(waiting, { depth, from, via });
      return;
    }
    state.seen[normalized] = true;
    state.seenCount = (state.seenCount || 0) + 1;
    const item = { url: normalized, depth, from, via };
    state.queue.push(item);
    queued.set(normalized, item);
  };
  if (!state) {
    if (restart) fs.rmSync(paths.records, { force: true });
    const { robotsByHost, sitemaps } = await loadRobots(settings, cookies, report);
    const sitemapUrls = limits.useSitemap ? await loadSitemapUrls(settings, sitemaps, cookies, report) : [];
    state = {
      startedAt: new Date().toISOString(),
      finished: false,
      robotsByHost,
      queue: [],
      seen: {},
      bodyHashes: {},
      files: {},
      externalHosts: {},
      pages: 0,
      rendered: 0,
      learnedIgnoreParams: [],
      paramObservations: {},
      excludedPrint: {},
      queryPatternVisits: {},
      cappedPatterns: {},
      seenCount: 0,
    };
    starts.forEach((url) => enqueue(url, 0, "", "start"));
    sitemapUrls.forEach((url) => inScope(normalize(url) || "", settings) && enqueue(url, 1, "", "sitemap"));
  }

  queued = new Map(state.queue.map((item) => [item.url, item]));
  // 前の版の巡回の状態には、あとで足した項目が無い。
  state.learnedIgnoreParams = state.learnedIgnoreParams || [];
  state.paramObservations = state.paramObservations || {};
  state.seenCount = state.seenCount || Object.keys(state.seen).length;
  // 外のサイトへのリンクは、サーバーごとにまとめて数える。URL を1件ずつ持つと、翻訳のボタン(翻訳サイトの
  // URL にページの URL が入る)などで数が膨らみ、相模原市の巡回では状態のファイルが約500MBになった。
  // URL はサーバーごとに EXTERNAL_URLS_PER_HOST 件までだけ残す。前の版の状態(1件ずつの external)は、ここで移す。
  state.externalHosts = state.externalHosts || {};
  let migratedExternal = false;
  if (state.external) {
    migratedExternal = true;
    for (const [link, entry] of Object.entries(state.external)) {
      let target;
      try {
        target = new URL(link);
      } catch {
        continue;
      }
      noteExternal(target, link, entry.from, entry.count);
    }
    delete state.external;
  }
  state.rendered = state.rendered || 0;
  state.excludedPrint = state.excludedPrint || {};
  state.stampObservations = state.stampObservations || {};
  state.cappedPatterns = state.cappedPatterns || {};

  // 前の実行で、ネットワークの切断や時間切れで取れなかったページは、待ち行列に戻して取り直す。
  // 巡回の途中で PC がネットワークから外れても、再開すればそのあいだのページを取り直せる。
  const TRANSIENT_REASONS = new Set(["network", "timeout", "dns"]);
  if (fs.existsSync(paths.records)) {
    const latest = new Map();
    for (const line of fs.readFileSync(paths.records, "utf8").split("\n")) {
      if (!line.trim()) continue;
      try {
        const record = JSON.parse(line);
        latest.set(record.url, record);
      } catch {
        // 途中で止まって書きかけの行は飛ばす。
      }
    }
    // URL の形ごとの取った数を、記録から数え直す(前の版の状態には無いため)。
    // 数え方を変えても合うよう、再開のたびに記録から数え直す。
    {
      state.queryPatternVisits = {};
      for (const record of latest.values()) {
        const key = record.kind === "page" && record.ok ? queryPatternKey(record.url) : null;
        if (key) state.queryPatternVisits[key] = (state.queryPatternVisits[key] || 0) + 1;
      }
      // 打ち切った URL のうち、上限を上げたなどで、まだ取れる分は待ち行列に戻す。
      const room = {};
      let revivedCapped = 0;
      for (const record of latest.values()) {
        if (record.status !== "capped" || queued.has(record.url) || !inScope(record.url, settings)) continue;
        const key = queryPatternKey(record.url);
        const used = (state.queryPatternVisits[key] || 0) + (room[key] || 0);
        if (key && used >= limits.maxPerQueryPattern) continue;
        room[key] = (room[key] || 0) + 1;
        const item = { url: record.url, depth: record.depth, from: record.from, via: record.via };
        state.queue.push(item);
        queued.set(record.url, item);
        revivedCapped += 1;
      }
      if (revivedCapped) resumeNotes.push(`同じ形が多く打ち切っていたページ ${revivedCapped} 件を取りに行く`);
    }
    // 設定を変えて範囲の外になった URL は、取り直さない。
    const retry = [...latest.values()].filter(
      (record) => !record.ok && TRANSIENT_REASONS.has(record.reason) && !queued.has(record.url) && inScope(record.url, settings)
    );
    if (retry.length) {
      for (const record of retry) {
        const item = { url: record.url, depth: record.depth, from: record.from, via: record.via };
        state.queue.push(item);
        queued.set(record.url, item);
      }
      resumeNotes.push(`ネットワークの切断や時間切れで取れなかったページ ${retry.length} 件を取り直す`);
    }
  }

  state.queryPatternVisits = state.queryPatternVisits || {};
  // 印刷用ページとして外した URL のうち、判定や設定を変えて印刷用でなくなったものは、待ち行列に戻す。
  let revived = 0;
  for (const [link, entry] of Object.entries(state.excludedPrint)) {
    if (settings.crawl.excludePrintPages && isPrintPage(new URL(link))) continue;
    delete state.excludedPrint[link];
    if (queued.has(link) || !inScope(link, settings)) continue;
    const item = { url: link, depth: entry.depth, from: entry.from, via: "link" };
    state.queue.push(item);
    queued.set(link, item);
    state.seen[link] = true;
    revived += 1;
  }
  if (revived) resumeNotes.push(`印刷用ページとして外していたが、いまの判定では外さないページ ${revived} 件を取りに行く`);

  if (resumeNotes.length) state.finished = false;
  if (wasFinished) {
    report(
      resumeNotes.length
        ? "巡回: 前の巡回は終わっている。次のページだけを取ってから、一覧を書き直す"
        : "巡回: 前の巡回は終わっている。一覧だけを書き直す(やり直すときは --restart)"
    );
  }
  resumeNotes.forEach((note) => report(`  ${note}`));
  // 記録はためて書く(1行ずつ追記すると共有ドライブでは遅い)。状態を保存する前に、ためた記録と裏で書いている
  // ページのファイルを書き終える(状態が「見た」とする URL の記録とページが、先に残るようにする)。
  let recordLines = [];
  const appendRecord = (record) => recordLines.push(`${JSON.stringify(record)}\n`);
  const writeMeta = (file, value) => project.queueWrite(file, `${JSON.stringify(value, null, 2)}\n`);
  const flushRecords = async () => {
    await project.flush();
    if (recordLines.length) {
      fs.appendFileSync(paths.records, recordLines.join(""));
      recordLines = [];
    }
  };
  // 状態の保存。ある時点の状態(見た URL、待ち行列、処理中の項目、同じ階層の残り)とその時点までの記録を、
  // 同期で写し取ってから、ページのファイルを書き終え、記録を追記し、状態を書く。写し取ったあとに他のレーンが
  // 進めた分は、次の保存に回る(途中で止まって再開すると、処理中だった項目は取り直す)。
  const inFlight = new Set();
  let currentBatch = [];
  const saveState = async () => {
    const snapshot = JSON.stringify({ ...state, queue: [...inFlight, ...currentBatch, ...state.queue] }, null, 2);
    const lines = recordLines;
    recordLines = [];
    await project.flush();
    if (lines.length) fs.appendFileSync(paths.records, lines.join(""));
    project.writeFileAtomic(paths.state, `${snapshot}\n`);
  };
  let sinceSave = 0;
  let lastStart = 0;
  const gate = async () => {
    const wait = lastStart + rules.intervalMs - Date.now();
    lastStart = Math.max(Date.now(), lastStart + rules.intervalMs);
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
  };

  // 外のサイトへのリンクを、サーバーごとに数える(上の state.externalHosts の説明を参照)。
  function noteExternal(target, link, from, count = 1) {
    const host = target.host;
    const entry = (state.externalHosts[host] = state.externalHosts[host] || { links: 0, urls: {}, urlCount: 0, from });
    entry.links += count;
    if (entry.urls[link]) {
      entry.urls[link].count += count;
    } else if (entry.urlCount < EXTERNAL_URLS_PER_HOST) {
      entry.urls[link] = { from, count };
      entry.urlCount += 1;
    }
  }

  // 値が変わっても中身が同じになる URL の項目を、巡回の中で見つけて外す。
  // 開いた時刻や乱数を URL に付けるサイト(遠野市の印刷用ページへのリンクの EntryCode)では、開くたびに
  // リンク先の URL が変わり、巡回が終わらない。
  //
  // ある項目だけが違い、ほかの道と項目が同じ URL の組を見るたびに、中身が同じか違うかを数える。
  // 中身が同じ組が VOLATILE_REPEATS 通り以上の道(別のページ)で見つかり、違う組が一度も無いときだけ外す。
  // 記事の番号のような項目は、1つの道(一覧のページなど)で「該当なし」が続いても、別のページで同じことが
  // 起きない限り外さない。中身の違う組が1つでもあれば、外さない。
  const VOLATILE_REPEATS = 3;
  const observeParams = (url, bodyHash) => {
    if (!bodyHash) return;
    let target;
    try {
      target = new URL(url);
    } catch {
      return;
    }
    const names = [...new Set(target.searchParams.keys())];
    for (const name of names) {
      if (state.learnedIgnoreParams.includes(name)) continue;
      const rest = new URLSearchParams(target.search);
      rest.delete(name);
      rest.sort();
      const signature = `${target.origin}${target.pathname}?${rest.toString()}`;
      const value = target.searchParams.get(name);
      const observation = (state.paramObservations[name] = state.paramObservations[name] || {
        sameSignatures: {},
        different: 0,
        seen: {},
      });
      const earlier = observation.seen[signature];
      if (!earlier) {
        observation.seen[signature] = { value, bodyHash };
        continue;
      }
      if (earlier.value === value) continue;
      if (earlier.bodyHash === bodyHash) observation.sameSignatures[signature] = true;
      else observation.different += 1;
      if (Object.keys(observation.sameSignatures).length >= VOLATILE_REPEATS && observation.different === 0) {
        state.learnedIgnoreParams.push(name);
        report(`  URL の項目 ${name} は値が変わっても中身が同じなので、これから外す`);
        log.write({ result: "learned-ignore-param", param: name });
      }
    }
  };

  // 開いた時刻の印の見つけ方(取りに行く前に分かる手がかり)。上の見つけ方は、同じページを値だけ違えて2回取るまで
  // 働かないので、取りに行く前に待ち行列が時刻違いの URL で埋まることがある。
  // 1つのページの多くのリンク(STAMP_MIN_LINKS 以上)に同じ値で付き、その値が時刻や乱数のような長い値で、
  // ページごとに値が変わる(STAMP_MIN_PAGES ページで別の値)項目は、開いた時刻の印とみなして外す。
  // 見つけたら、待ち行列の URL を整え直し、同じ URL になったものを除く。
  const STAMP_MIN_LINKS = 5;
  const STAMP_MIN_PAGES = 3;
  const STAMP_VALUE = /^(?:[0-9]{10,}|[0-9a-f]{16,}|[A-Za-z0-9_-]{20,})$/;
  const observeStamps = (pageLinks) => {
    const perName = new Map();
    for (const link of pageLinks) {
      let target;
      try {
        target = new URL(link);
      } catch {
        continue;
      }
      if (!isAllowedHost(target, settings)) continue;
      for (const [name, value] of target.searchParams) {
        if (state.learnedIgnoreParams.includes(name) || !STAMP_VALUE.test(value)) continue;
        if (!perName.has(name)) perName.set(name, new Map());
        const values = perName.get(name);
        values.set(value, (values.get(value) || 0) + 1);
      }
    }
    for (const [name, values] of perName) {
      const [value, count] = [...values.entries()].sort((a, b) => b[1] - a[1])[0];
      if (count < STAMP_MIN_LINKS) continue;
      const seenValues = (state.stampObservations[name] = state.stampObservations[name] || []);
      if (!seenValues.includes(value)) seenValues.push(value);
      if (seenValues.length >= STAMP_MIN_PAGES) {
        state.learnedIgnoreParams.push(name);
        delete state.stampObservations[name];
        report(`  URL の項目 ${name} はページを開くたびに値が変わる印なので、これから外す`);
        log.write({ result: "learned-ignore-param", param: name, by: "stamp" });
        renormalizeQueue();
      }
    }
  };
  // 外す項目が増えたときに、待ち行列の URL を整え直す。整えた URL がもう見たものなら除く。
  const renormalizeQueue = () => {
    const kept = [];
    for (const item of state.queue) {
      const normalized = normalize(item.url) || item.url;
      if (normalized !== item.url) {
        queued.delete(item.url);
        if (state.seen[normalized]) continue;
        state.seen[normalized] = true;
        item.url = normalized;
        queued.set(normalized, item);
      }
      kept.push(item);
    }
    state.queue = kept;
    if (currentBatch.length) {
      const batchKept = [];
      for (const item of currentBatch) {
        const normalized = normalize(item.url) || item.url;
        if (normalized !== item.url) {
          if (state.seen[normalized]) continue;
          state.seen[normalized] = true;
          item.url = normalized;
        }
        batchKept.push(item);
      }
      currentBatch.splice(0, currentBatch.length, ...batchKept);
    }
  };

  const noteFile = (url, type, from) => {
    state.files[url] = state.files[url] || { type, from, count: 0 };
    state.files[url].count += 1;
  };

  const visit = async (item) => {
    const { depth, from, via } = item;
    // 待っているあいだに外す項目が増えたら、整え直す。整えた URL をもう見ていれば飛ばす。
    const url = normalize(item.url) || item.url;
    if (url !== item.url) {
      if (state.seen[url]) return;
      state.seen[url] = true;
      state.seenCount += 1;
    }
    // 同じ形の URL が上限に達したら、取りに行かずに数だけ残す。
    // 始まりと sitemap.xml の URL(サイトが示した有限の一覧)は、上限の外にする。打ち切った URL は記録に残し、
    // 一覧に「同じ形が多く打ち切った」と書く。上限を上げて再開すると、取りに行く。
    const patternKey = via === "start" || via === "sitemap" ? null : queryPatternKey(url);
    if (patternKey) {
      if ((state.queryPatternVisits[patternKey] || 0) >= limits.maxPerQueryPattern) {
        appendRecord({ url, depth, from, via, kind: "page", status: "capped", pattern: patternKey, ok: false });
        return;
      }
      state.queryPatternVisits[patternKey] = (state.queryPatternVisits[patternKey] || 0) + 1;
    }
    // robots.txt はサーバー(ポートを含む)ごとに読んである。
    const host = new URL(url).host;
    if (limits.useRobots && !isAllowedByRobots(state.robotsByHost[host], url)) {
      appendRecord({ url, depth, from, via, kind: "page", status: "robots", ok: false });
      log.write({ result: "skipped", reason: "robots" });
      return;
    }
    await gate();
    const fetchedAt = new Date().toISOString();
    let result;
    try {
      result = await fetchPage(url, rules, { cookies });
    } catch (error) {
      if (error.reason === "not-html") {
        // 拡張子からは分からなかったファイル(index.cfm がファイルを返すなど)。
        noteFile(url, (error.meta?.contentType || "").split(";")[0].trim(), from);
        appendRecord({ url, depth, from, via, kind: "file", status: error.meta?.status ?? null, ok: true });
        return;
      }
      const failedFinal = error.meta?.finalUrl && normalize(error.meta.finalUrl) !== url ? normalize(error.meta.finalUrl) : null;
      appendRecord({ url, depth, from, via, kind: "page", status: error.meta?.status ?? null, reason: error.reason || "error", finalUrl: failedFinal, ok: false });
      log.write({ result: "failed", reason: error.reason || "error", status: error.meta?.status ?? null });
      return;
    }
    let info;
    try {
      info = await engine.evaluate((arg) => window.batchTools.pageLinks(arg), { html: result.html, url: result.finalUrl });
    } catch {
      appendRecord({ url, depth, from, via, kind: "page", status: result.status, reason: "inspect-error", ok: false });
      return;
    }

    const links = new Map(info.links.map((link) => [link, info.scriptLinks.includes(link) ? "script" : "link"]));
    // スクリプトでメニューを描くページは、Chromium で開いてからリンクを拾う。始まりのページと、
    // スクリプトがあるのに巡回の範囲のリンクが少ないページだけを開く(開くと旧サイトへの要求が増えるため)。
    const inScopeCount = info.links.filter((link) => inScope(link, settings)).length;
    const shouldRender =
      limits.render === "always" ||
      (limits.render === "auto" && (depth === 0 || (info.hasScripts && inScopeCount < limits.renderMinLinks)));
    let renderedExtra = 0;
    if (shouldRender && typeof engine.renderLinks === "function") {
      try {
        await assertAllowed(new URL(result.finalUrl), rules);
        await gate();
        const rendered = await engine.renderLinks(result.finalUrl, {
          allowedHosts: rules.allowedHosts,
          timeoutMs: rules.timeoutMs,
          userAgent: rules.userAgent || undefined,
        });
        for (const link of rendered.links) {
          if (!links.has(link)) {
            links.set(link, "render");
            renderedExtra += 1;
          }
        }
        state.rendered += 1;
      } catch {
        // 開けなかったページは、HTML から拾ったリンクだけで進める。
      }
    }

    const finalUrl = normalize(result.finalUrl);
    const duplicateOf = info.bodyHash && state.bodyHashes[info.bodyHash] ? state.bodyHashes[info.bodyHash] : null;
    observeParams(url, info.bodyHash);
    observeStamps(links.keys());
    if (info.bodyHash && !duplicateOf) state.bodyHashes[info.bodyHash] = url;
    const dir = path.join(paths.pages, urlKey(url));
    project.queueWrite(path.join(dir, "source.html"), result.html);
    writeMeta(path.join(dir, "meta.json"), {
      url,
      finalUrl,
      ok: true,
      status: result.status,
      fetchedAt,
      contentType: result.contentType,
      charset: result.charset,
      bytes: result.bytes,
      lastModified: result.lastModified,
      etag: result.etag,
      title: info.title,
      bodyHash: info.bodyHash,
    });
    appendRecord({
      url,
      depth,
      from,
      via,
      kind: "page",
      status: result.status,
      finalUrl: finalUrl !== url ? finalUrl : null,
      title: info.title,
      duplicateOf,
      lastModified: result.lastModified,
      renderedExtra,
      ok: true,
    });
    state.pages += 1;
    log.write({ result: "ok", status: result.status, depth, renderedExtra });

    // 転送先も「見た」ことにする(同じページを2回取らないため)。
    if (finalUrl && finalUrl !== url) state.seen[finalUrl] = true;
    if (info.robotsNoFollow || depth >= limits.maxDepth) return;
    for (const [rawLink, linkVia] of links) {
      const link = normalize(rawLink);
      if (!link) continue;
      if (!inScope(link, settings)) {
        const linkTarget = new URL(link);
        // 印刷用ページとして外した URL は、あとで確かめられるよう、状態に残して一覧に書く。
        if (settings.crawl.excludePrintPages && isAllowedHost(linkTarget, settings) && isPrintPage(linkTarget)) {
          if (!state.excludedPrint[link]) state.excludedPrint[link] = { from: url, depth: depth + 1 };
          continue;
        }
        // 外のサイトへのリンク(巡回の範囲の外にある、許可したサーバーのリンクは数えない)。
        if (!isAllowedHost(linkTarget, settings)) {
          noteExternal(linkTarget, link, url);
        }
        continue;
      }
      const pathname = new URL(link).pathname;
      if (FILE_EXTENSION.test(pathname)) {
        noteFile(link, path.extname(pathname).slice(1).toLowerCase(), url);
        continue;
      }
      // 上限は、取ったページと待っている URL の数で見る(外した項目で整え直した URL を数えないため)。
      if (state.pages + state.queue.length >= limits.maxPages) continue;
      enqueue(link, depth + 1, url, linkVia);
    }
  };

  if (!state.finished) {
    report(`巡回: 始まり ${starts.length} URL、残り ${state.queue.length} URL(上限 ${limits.maxPages} URL、深さ ${limits.maxDepth} まで)`);
    // 階層ごとに順にたどる(浅い階層を取り終えてから、次の階層へ進む)。同時に2ページ以上をたどっても、
    // 階層が「始まりから最も少ない手数」になり、Website Explorer の階層と比べられる。
    while (state.queue.length) {
      const level = Math.min(...state.queue.map((item) => item.depth));
      const batch = state.queue.filter((item) => item.depth === level);
      state.queue = state.queue.filter((item) => item.depth !== level);
      batch.forEach((item) => queued.delete(item.url));
      currentBatch = batch;
      const lanes = Array.from({ length: Math.max(1, rules.concurrency) }, async () => {
        while (batch.length) {
          const item = batch.shift();
          inFlight.add(item);
          try {
            await visit(item);
          } finally {
            inFlight.delete(item);
          }
          sinceSave += 1;
          if (sinceSave >= STATE_SAVE_EVERY) {
            sinceSave = 0;
            await saveState();
          }
        }
      });
      await Promise.all(lanes);
    }

    // ファイルの大きさと更新日を聞く(中身は取らない)。設定で有効にしたときだけ。
    if (limits.fileHead) {
      for (const [url, file] of Object.entries(state.files)) {
        if (file.headAt) continue;
        await gate();
        const head = await headFile(url, rules, { cookies });
        Object.assign(file, { headAt: new Date().toISOString(), bytes: head?.bytes ?? null, lastModified: head?.lastModified ?? null, status: head?.status ?? null });
      }
    }
    state.finished = true;
    state.finishedAt = new Date().toISOString();
    await saveState();
  }
  await flushRecords();

  // 前の版の状態を移したときは、終わった巡回でも状態を書き直す(大きな状態のファイルを小さくする)。
  if (migratedExternal && wasFinished && !resumeNotes.length) {
    await saveState();
    report("  状態のファイルを新しい形で書き直した");
  }
  const counts = writeCrawlLists(project, state, settings);
  report(
    `巡回: ページ ${counts.pages}(取れた ${counts.ok}、取れない ${counts.failed}、重複 ${counts.duplicates}、robots.txt で止めた ${counts.robots})、印刷用として外した ${counts.printExcluded}、同じ形の URL が多く打ち切った ${counts.capped}、ファイル ${counts.files}、外のサイト ${counts.external} サーバー`
  );
  report(
    `  見つけ方: ${Object.entries(counts.via)
      .map(([via, n]) => `${DISCOVERY_LABELS[via] || via} ${n}`)
      .join("、")}。Chromium で開いたページ ${state.rendered}`
  );
  if (state.learnedIgnoreParams.length) report(`  外した URL の項目(巡回の中で見つけたもの): ${state.learnedIgnoreParams.join("、")}`);
  report(`  一覧: ${path.relative(project.root, paths.list)}、${path.relative(project.root, paths.files)}、${path.relative(project.root, paths.external)}`);
  return counts;
}

// records.jsonl から一覧を書く。同じ URL の記録が2つあれば、あとの方を使う(再開したとき)。
function writeCrawlLists(project, state, settings) {
  const paths = crawlPaths(project);
  const records = new Map();
  if (fs.existsSync(paths.records)) {
    for (const line of fs.readFileSync(paths.records, "utf8").split("\n")) {
      if (!line.trim()) continue;
      const record = JSON.parse(line);
      records.set(record.url, record);
    }
  }
  const byUrl = (a, b) => (a.url < b.url ? -1 : a.url > b.url ? 1 : 0);
  // 印刷用ページを外す設定なら、設定を入れる前に取っていた印刷用ページも一覧から外す。
  const dropPrint = settings?.crawl.excludePrintPages;
  const pages = [...records.values()]
    .filter((record) => record.kind === "page" && !(dropPrint && isPrintPage(new URL(record.url))))
    .sort(byUrl);
  const statusLabel = (record) => {
    if (record.ok) return record.duplicateOf ? "重複" : "取れた";
    if (record.status === "robots") return "robots.txt で止めた";
    if (record.status === "capped") return "同じ形が多く打ち切った";
    return `取れない(${record.reason}${record.status ? ` ${record.status}` : ""})`;
  };
  const rows = [["URL", "タイトル", "ディレクトリ", "階層", "状態", "転送先", "重複先", "更新日", "見つけ方", "見つけた元"]];
  const via = {};
  for (const record of pages) {
    via[record.via] = (via[record.via] || 0) + 1;
    rows.push([
      record.url,
      record.title || "",
      directoryOf(record.url),
      record.depth,
      statusLabel(record),
      record.finalUrl || "",
      record.duplicateOf || "",
      record.lastModified || "",
      DISCOVERY_LABELS[record.via] || record.via || "",
      record.from || "",
    ]);
  }
  // 印刷用ページとして外した URL も、一覧に「印刷用として外した」と書く(何を外したかを後から確かめられるように)。
  const excludedPrint = Object.entries(state.excludedPrint || {}).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  for (const [url, entry] of excludedPrint) {
    rows.push([url, "", directoryOf(url), entry.depth ?? "", "印刷用として外した", "", "", "", "", entry.from || ""]);
  }
  writeCsv(project, paths.list, rows);

  const sortedEntries = (object) => Object.entries(object).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  const fileRows = [["URL", "種類", "ディレクトリ", "大きさ(バイト)", "更新日", "リンク元の数", "見つけた元"]];
  for (const [url, file] of sortedEntries(state.files)) {
    fileRows.push([url, file.type, directoryOf(url), file.bytes ?? "", file.lastModified || "", file.count, file.from]);
  }
  writeCsv(project, paths.files, fileRows);

  // サーバーごとに、リンクの数と、残した URL(サーバーごとに EXTERNAL_URLS_PER_HOST 件まで)を書く。
  const externalRows = [["サーバー", "そのサーバーへのリンクの数", "URL", "リンク元の数", "見つけた元"]];
  const hosts = Object.entries(state.externalHosts || {}).sort((a, b) => b[1].links - a[1].links);
  for (const [host, entry] of hosts) {
    const urls = Object.entries(entry.urls).sort((a, b) => b[1].count - a[1].count);
    if (!urls.length) externalRows.push([host, entry.links, "", "", entry.from || ""]);
    for (const [link, item] of urls) externalRows.push([host, entry.links, link, item.count, item.from || ""]);
  }
  writeCsv(project, paths.external, externalRows);

  // 同じ形の URL が多く、上限で打ち切った形の一覧。
  const cappedByPattern = {};
  for (const record of pages) if (record.status === "capped") cappedByPattern[record.pattern] = (cappedByPattern[record.pattern] || 0) + 1;
  const cappedRows = [["URL の形", "取ったページ", "打ち切った URL"]];
  for (const [key, skipped] of sortedEntries(cappedByPattern)) cappedRows.push([key, state.queryPatternVisits?.[key] || 0, skipped]);
  writeCsv(project, path.join(paths.dir, "capped.csv"), cappedRows);

  return {
    pages: pages.length,
    ok: pages.filter((record) => record.ok && !record.duplicateOf).length,
    duplicates: pages.filter((record) => record.duplicateOf).length,
    failed: pages.filter((record) => !record.ok && record.status !== "robots" && record.status !== "capped").length,
    robots: pages.filter((record) => record.status === "robots").length,
    files: Object.keys(state.files).length,
    external: Object.keys(state.externalHosts || {}).length,
    printExcluded: excludedPrint.length,
    capped: pages.filter((record) => record.status === "capped").length,
    via,
  };
}

module.exports = { runCrawl, readCrawledPage, normalizeUrl, urlKey, isHtmlType, isPrintPage };

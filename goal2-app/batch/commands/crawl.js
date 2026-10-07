// 巡回: 旧サイトをリンクと sitemap.xml でたどり、ページの一覧(URL、タイトル)を作る。
// 移行管理シートの「ページ一覧」(FLOW.md の 2-1)の元にする。今は Website Explorer で作っている。
//
// 取りに行くのは案件の設定の fetch.allowedHosts のサーバーだけで、間隔と同時数も取得と同じ設定に従う。
// robots.txt で止められた URL は取りに行かない。PDF や画像などのファイルは中身を取らず、別の一覧に URL だけを書く。
// 取ったページは crawl/pages/ に保存し、あとの取得(fetch)は、同じ URL ならこれを使って旧サイトへ取りに行かない。
//
// 書くもの(案件のフォルダの crawl/):
//   state.json     巡回の途中の状態(止めても続きから再開する)
//   records.jsonl  1 URL 1 行の記録
//   pages/<鍵>/    source.html と meta.json
//   list.csv       ページの一覧(URL、タイトル、階層、状態、種類、転送先、重複先、見つけた元)
//   files.csv      ファイルの一覧(URL、種類、リンク元の数、見つけた元)
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { fetchPage, isHtmlType } = require("../lib/fetcher");
const { parseRobots, isAllowedByRobots, parseSitemap } = require("../lib/robots");

const FILE_EXTENSION = /\.(pdf|docx?|xlsx?|pptx?|csv|zip|lzh|txt|jtd|odt|ods|odp|rtf|jpe?g|png|gif|bmp|svg|webp|ico|tiff?|mp3|mp4|m4a|wav|wmv|avi|mov|flv|exe|ics|kml|kmz)$/i;
const STATE_SAVE_EVERY = 25;

function urlKey(url) {
  return crypto.createHash("sha256").update(url).digest("hex").slice(0, 20);
}

function normalizeUrl(value) {
  try {
    const url = new URL(value);
    url.hash = "";
    return url.href;
  } catch {
    return null;
  }
}

function csvCell(value) {
  const text = value == null ? "" : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
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
  };
}

// 取得(fetch)が使う。巡回で取ったページのうち、URL が同じで、新しさの上限(日)に収まるものを返す。
function readCrawledPage(project, url, maxAgeDays) {
  const normalized = normalizeUrl(url);
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

function inScope(url, settings) {
  let target;
  try {
    target = new URL(url);
  } catch {
    return false;
  }
  const hosts = settings.fetch.allowedHosts.map((host) => host.toLowerCase());
  if (!hosts.includes(target.hostname.toLowerCase()) && !hosts.includes(target.host.toLowerCase())) return false;
  const { include, exclude } = settings.crawl;
  if (include.length && !include.some((prefix) => url.startsWith(prefix))) return false;
  if (exclude.some((pattern) => new RegExp(pattern).test(url))) return false;
  return true;
}

async function loadRobots(settings, report) {
  const robotsByHost = {};
  const sitemaps = [];
  for (const host of settings.fetch.allowedHosts) {
    for (const scheme of ["https", "http"]) {
      try {
        const result = await fetchPage(`${scheme}://${host}/robots.txt`, settings.fetch, { accept: () => true });
        const parsed = parseRobots(result.html);
        robotsByHost[new URL(`${scheme}://${host}/`).host] = parsed;
        sitemaps.push(...parsed.sitemaps);
        break;
      } catch (error) {
        if (error.reason === "http-status") {
          robotsByHost[new URL(`${scheme}://${host}/`).host] = { rules: [], sitemaps: [] };
          break;
        }
      }
    }
  }
  const disallowCount = Object.values(robotsByHost).reduce((n, robots) => n + robots.rules.filter((rule) => !rule.allow).length, 0);
  report(`  robots.txt: ${Object.keys(robotsByHost).length} サーバー、止める道 ${disallowCount}、サイトマップ ${sitemaps.length}`);
  return { robotsByHost, sitemaps };
}

async function loadSitemapUrls(settings, sitemaps, report) {
  const queue = [...new Set(sitemaps)];
  for (const host of settings.fetch.allowedHosts) queue.push(`https://${host}/sitemap.xml`);
  const seen = new Set();
  const urls = new Set();
  while (queue.length && seen.size < 50) {
    const sitemapUrl = queue.shift();
    if (seen.has(sitemapUrl)) continue;
    seen.add(sitemapUrl);
    try {
      const result = await fetchPage(sitemapUrl, settings.fetch, { accept: (type) => /xml|text\/plain/i.test(type) });
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
  if (!settings.fetch.allowedHosts.length) throw new Error("案件の設定の fetch.allowedHosts に、旧サイトのサーバーを入れてください。");
  const starts = (startUrls && startUrls.length ? startUrls : settings.crawl.startUrls).map(normalizeUrl).filter(Boolean);
  if (!starts.length) throw new Error("始まりの URL を、--start か案件の設定の crawl.startUrls で指定してください。");

  fs.mkdirSync(paths.pages, { recursive: true });
  let state = restart ? null : project.readJson(paths.state);
  if (state?.finished) {
    report("巡回: 前の巡回は終わっている。一覧だけを書き直す(やり直すときは --restart)");
  }
  if (!state) {
    if (restart) fs.rmSync(paths.records, { force: true });
    const { robotsByHost, sitemaps } = await loadRobots(settings, report);
    const sitemapUrls = settings.crawl.useSitemap ? await loadSitemapUrls(settings, sitemaps, report) : [];
    state = { startedAt: new Date().toISOString(), finished: false, robotsByHost, queue: [], seen: {}, bodyHashes: {}, files: {}, pages: 0 };
    const enqueue = (url, depth, from) => {
      const normalized = normalizeUrl(url);
      if (!normalized || state.seen[normalized]) return;
      state.seen[normalized] = true;
      state.queue.push({ url: normalized, depth, from });
    };
    starts.forEach((url) => enqueue(url, 0, "始まり"));
    sitemapUrls.forEach((url) => inScope(normalizeUrl(url) || "", settings) && enqueue(url, 1, "sitemap.xml"));
  }

  const enqueue = (url, depth, from) => {
    const normalized = normalizeUrl(url);
    if (!normalized || state.seen[normalized]) return;
    state.seen[normalized] = true;
    state.queue.push({ url: normalized, depth, from });
  };
  const saveState = () => project.writeJson(paths.state, state);
  const appendRecord = (record) => fs.appendFileSync(paths.records, `${JSON.stringify(record)}\n`);

  const rules = settings.fetch;
  const limits = settings.crawl;
  let sinceSave = 0;
  let lastStart = 0;
  const gate = async () => {
    const wait = lastStart + rules.intervalMs - Date.now();
    lastStart = Math.max(Date.now(), lastStart + rules.intervalMs);
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
  };

  const visit = async (item) => {
    const { url, depth, from } = item;
    // robots.txt はサーバー(ポートを含む)ごとに読んである。
    const host = new URL(url).host;
    if (settings.crawl.useRobots && !isAllowedByRobots(state.robotsByHost[host], url)) {
      appendRecord({ url, depth, from, kind: "page", status: "robots", ok: false });
      log.write({ result: "skipped", reason: "robots" });
      return;
    }
    await gate();
    const fetchedAt = new Date().toISOString();
    let result;
    try {
      result = await fetchPage(url, rules);
    } catch (error) {
      if (error.reason === "not-html") {
        // 拡張子からは分からなかったファイル(index.cfm がファイルを返すなど)。
        state.files[url] = state.files[url] || { type: error.meta?.contentType || "", from, count: 0 };
        state.files[url].count += 1;
        appendRecord({ url, depth, from, kind: "file", status: error.meta?.status ?? null, contentType: error.meta?.contentType || "", ok: true });
        return;
      }
      const failedFinal = error.meta?.finalUrl && normalizeUrl(error.meta.finalUrl) !== url ? normalizeUrl(error.meta.finalUrl) : null;
      appendRecord({ url, depth, from, kind: "page", status: error.meta?.status ?? null, reason: error.reason || "error", finalUrl: failedFinal, ok: false });
      log.write({ result: "failed", reason: error.reason || "error", status: error.meta?.status ?? null });
      return;
    }
    let info;
    try {
      info = await engine.evaluate((arg) => window.batchTools.pageLinks(arg), { html: result.html, url: result.finalUrl });
    } catch {
      appendRecord({ url, depth, from, kind: "page", status: result.status, reason: "inspect-error", ok: false });
      return;
    }
    const finalUrl = normalizeUrl(result.finalUrl);
    const duplicateOf = info.bodyHash && state.bodyHashes[info.bodyHash] ? state.bodyHashes[info.bodyHash] : null;
    if (info.bodyHash && !duplicateOf) state.bodyHashes[info.bodyHash] = url;
    const dir = path.join(paths.pages, urlKey(url));
    const meta = {
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
    };
    project.writeFileAtomic(path.join(dir, "source.html"), result.html);
    project.writeJson(path.join(dir, "meta.json"), meta);
    appendRecord({ url, depth, from, kind: "page", status: result.status, finalUrl: finalUrl !== url ? finalUrl : null, title: info.title, duplicateOf, ok: true });
    state.pages += 1;
    log.write({ result: "ok", status: result.status, depth });

    // 転送先も「見た」ことにする(同じページを2回取らないため)。
    if (finalUrl && finalUrl !== url) state.seen[finalUrl] = true;
    if (info.robotsNoFollow || depth >= limits.maxDepth) return;
    for (const link of info.links) {
      if (!inScope(link, settings)) continue;
      const pathname = new URL(link).pathname;
      if (FILE_EXTENSION.test(pathname)) {
        state.files[link] = state.files[link] || { type: path.extname(pathname).slice(1).toLowerCase(), from: url, count: 0 };
        state.files[link].count += 1;
        continue;
      }
      if (Object.keys(state.seen).length >= limits.maxPages) continue;
      enqueue(link, depth + 1, url);
    }
  };

  if (!state.finished) {
    report(`巡回: 始まり ${starts.length} URL、残り ${state.queue.length} URL(上限 ${limits.maxPages} URL、深さ ${limits.maxDepth} まで)`);
    const lanes = Array.from({ length: Math.max(1, rules.concurrency) }, async () => {
      while (state.queue.length) {
        const item = state.queue.shift();
        await visit(item);
        sinceSave += 1;
        if (sinceSave >= STATE_SAVE_EVERY) {
          sinceSave = 0;
          saveState();
        }
      }
    });
    await Promise.all(lanes);
    state.finished = true;
    state.finishedAt = new Date().toISOString();
    saveState();
  }

  const counts = writeCrawlLists(project, state);
  report(`巡回: ページ ${counts.pages}(取れた ${counts.ok}、取れない ${counts.failed}、重複 ${counts.duplicates}、robots.txt で止めた ${counts.robots})、ファイル ${counts.files}`);
  report(`  一覧: ${path.relative(project.root, paths.list)}、${path.relative(project.root, paths.files)}`);
  return counts;
}

// records.jsonl から一覧を書く。同じ URL の記録が2つあれば、あとの方を使う(再開したとき)。
function writeCrawlLists(project, state) {
  const paths = crawlPaths(project);
  const records = new Map();
  if (fs.existsSync(paths.records)) {
    for (const line of fs.readFileSync(paths.records, "utf8").split("\n")) {
      if (!line.trim()) continue;
      const record = JSON.parse(line);
      records.set(record.url, record);
    }
  }
  const pages = [...records.values()].filter((record) => record.kind === "page").sort((a, b) => (a.url < b.url ? -1 : a.url > b.url ? 1 : 0));
  const statusLabel = (record) => {
    if (record.ok) return record.duplicateOf ? "重複" : "取れた";
    if (record.status === "robots") return "robots.txt で止めた";
    return `取れない(${record.reason}${record.status ? ` ${record.status}` : ""})`;
  };
  const rows = [["URL", "タイトル", "階層", "状態", "転送先", "重複先", "見つけた元"]];
  for (const record of pages) {
    rows.push([record.url, record.title || "", record.depth, statusLabel(record), record.finalUrl || "", record.duplicateOf || "", record.from || ""]);
  }
  project.writeFileAtomic(paths.list, `﻿${rows.map((row) => row.map(csvCell).join(",")).join("\r\n")}\r\n`);

  const fileRows = [["URL", "種類", "リンク元の数", "見つけた元"]];
  for (const [url, file] of Object.entries(state.files).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) {
    fileRows.push([url, file.type, file.count, file.from]);
  }
  project.writeFileAtomic(paths.files, `﻿${fileRows.map((row) => row.map(csvCell).join(",")).join("\r\n")}\r\n`);

  return {
    pages: pages.length,
    ok: pages.filter((record) => record.ok && !record.duplicateOf).length,
    duplicates: pages.filter((record) => record.duplicateOf).length,
    failed: pages.filter((record) => !record.ok && record.status !== "robots").length,
    robots: pages.filter((record) => record.status === "robots").length,
    files: Object.keys(state.files).length,
  };
}

module.exports = { runCrawl, readCrawledPage, normalizeUrl, urlKey, isHtmlType };

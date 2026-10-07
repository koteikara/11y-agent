// 取得: 対象のページをすべて取り、ページの台帳(pages/<ID>/fetch.json)を書く。
// 取得できたページは、本文のハッシュと構造のハッシュも台帳に入れる(型のまとめと取り直しに使う)。
// もう一度動かすと、取得できていないページだけを取り直す。
const { fetchPage, runPaced } = require("../lib/fetcher");
const { writeSummary } = require("../lib/summary");
const { readCrawledPage } = require("./crawl");

// 取り直さずに、保存した旧ページ(source.html)を調べ直し、台帳の構造と本文の項目を書き直す。
// 調べ方(構造の取り方など)を変えたときに、旧サイトへ取りに行かずに済ませるため。
async function reinspect(project, { engine, ids, log, report }) {
  const input = project.readInput();
  const counts = { ok: 0, failed: 0 };
  for (const page of input.pages) {
    if (ids && !ids.includes(page.id)) continue;
    const ledger = project.readPageJson(page.id, "fetch.json");
    const html = project.readPageText(page.id, "source.html");
    if (!ledger || !html || ["blocked", "not-allowed-host", "http-status", "not-html"].includes(ledger.reason)) continue;
    try {
      const inspection = await engine.evaluate((arg) => window.batchTools.inspectPage(arg), {
        html,
        pageTitle: page.pageTitle || "",
        url: ledger.finalUrl,
      });
      project.writePageJson(page.id, "fetch.json", {
        ...ledger,
        ok: Boolean(inspection.bodyHash),
        reason: inspection.bodyHash ? null : "empty-body",
        pageTitle: inspection.pageTitle,
        structureHash: inspection.structureHash,
        structurePaths: inspection.structurePaths,
        structureVersion: inspection.structureVersion,
        bodyHash: inspection.bodyHash,
        bodyTextLength: inspection.bodyTextLength,
        genericSelector: inspection.contentSelector,
        references: inspection.references,
        inspectedAt: new Date().toISOString(),
      });
      counts.ok += 1;
      log.write({ id: page.id, result: "reinspected" });
    } catch {
      counts.failed += 1;
      log.write({ id: page.id, result: "failed", reason: "inspect-error" });
    }
  }
  writeSummary(project);
  report(`調べ直し: ${counts.ok} 件を調べ直した(失敗 ${counts.failed} 件)`);
  return counts;
}

async function runFetch(project, { engine, ids, reinspect: onlyReinspect = false, retryFailed = true, log, report }) {
  if (onlyReinspect) return reinspect(project, { engine, ids, log, report });
  const input = project.readInput();
  const settings = project.readSettings();
  const rules = settings.fetch;
  if (!rules.allowedHosts.length) {
    throw new Error("案件の設定の fetch.allowedHosts に、旧サイトのサーバーを入れてください。");
  }

  const targets = input.pages.filter((page) => {
    if (ids && !ids.includes(page.id)) return false;
    const ledger = project.readPageJson(page.id, "fetch.json");
    if (!ledger) return true;
    return retryFailed && !ledger.ok;
  });

  const counts = { target: targets.length, ok: 0, failed: 0, reasons: {} };
  report(`取得: ${targets.length} 件(全 ${input.pages.length} 件のうち、まだ取得できていないもの)`);

  // 取得は Node で並べて行い、ページの調べ(Chromium)は1件ずつ行う。
  // 調べを待つあいだも取得を続ける。ただし、取った HTML をためすぎないよう、待ちが上限を超えたら取得も待つ。
  // 遠野市の全件の取得で、取得が毎回調べを待ち、1ページ約2.7秒かかった(旧サイトへの間隔は1秒)。
  let inspectQueue = Promise.resolve();
  let pendingInspections = 0;
  const MAX_PENDING_INSPECTIONS = 8;

  // 巡回(crawl)で取ったページがあれば、それを使い、旧サイトへ取りに行かない。
  const crawled = new Map();
  for (const page of targets) {
    const cached = readCrawledPage(project, page.oldUrl, settings.crawl.reuseDays);
    if (cached) crawled.set(page.id, cached);
  }
  if (crawled.size) report(`  巡回で取ったページを使う: ${crawled.size} 件`);

  const handle = async (page) => {
    const cached = crawled.get(page.id);
    const fetchedAt = cached ? cached.fetchedAt : new Date().toISOString();
    let result = cached
      ? {
          status: cached.status,
          finalUrl: cached.finalUrl || cached.url,
          contentType: cached.contentType,
          lastModified: cached.lastModified,
          etag: cached.etag,
          html: cached.html,
          charset: cached.charset,
          bytes: cached.bytes,
        }
      : null;
    let failure = null;
    for (let attempt = 0; !cached && attempt <= rules.retries; attempt += 1) {
      try {
        result = await fetchPage(page.oldUrl, rules);
        failure = null;
        break;
      } catch (error) {
        failure = error;
        // 一時的でない失敗は、やり直さない。
        if (!["timeout", "network"].includes(error.reason)) break;
      }
    }

    if (failure) {
      const ledger = {
        id: page.id,
        oldUrl: page.oldUrl,
        fetchedAt,
        ok: false,
        reason: failure.reason || "error",
        message: failure.message,
        status: failure.meta?.status ?? null,
        finalUrl: failure.meta?.finalUrl ?? null,
      };
      project.writePageJson(page.id, "fetch.json", ledger);
      counts.failed += 1;
      counts.reasons[ledger.reason] = (counts.reasons[ledger.reason] || 0) + 1;
      log.write({
        id: page.id,
        result: "failed",
        reason: ledger.reason,
        status: ledger.status,
      });
      return;
    }

    pendingInspections += 1;
    inspectQueue = inspectQueue.then(async () => {
      try {
        await inspectOneFor(page, result, fetchedAt, cached);
      } finally {
        pendingInspections -= 1;
      }
    });
    if (pendingInspections >= MAX_PENDING_INSPECTIONS) await inspectQueue;
  };

  // 取ったページを調べて、台帳を書く(Chromium で1件ずつ)。
  async function inspectOneFor(page, result, fetchedAt, cached) {
    let inspection;
    try {
      inspection = await engine.evaluate((arg) => window.batchTools.inspectPage(arg), {
        html: result.html,
        pageTitle: page.pageTitle || "",
        url: result.finalUrl,
      });
    } catch {
      // 1ページの調べの失敗で取得全体を止めない。エラーの文言はページの中の文言を含むことが
      // あるので、台帳と記録には理由だけを書く。
      project.writePageText(page.id, "source.html", result.html);
      project.writePageJson(page.id, "fetch.json", {
        id: page.id,
        oldUrl: page.oldUrl,
        fetchedAt,
        ok: false,
        reason: "inspect-error",
        status: result.status,
        finalUrl: result.finalUrl,
      });
      counts.failed += 1;
      counts.reasons["inspect-error"] = (counts.reasons["inspect-error"] || 0) + 1;
      log.write({ id: page.id, result: "failed", reason: "inspect-error" });
      return;
    }
    project.writePageText(page.id, "source.html", result.html);
    const ledger = {
      id: page.id,
      oldUrl: page.oldUrl,
      fetchedAt,
      ok: Boolean(inspection.bodyHash),
      reason: inspection.bodyHash ? null : "empty-body",
      status: result.status,
      finalUrl: result.finalUrl,
      contentType: result.contentType,
      charset: result.charset,
      bytes: result.bytes,
      lastModified: result.lastModified,
      etag: result.etag,
      pageTitle: inspection.pageTitle,
      structureHash: inspection.structureHash,
      structurePaths: inspection.structurePaths,
      structureVersion: inspection.structureVersion,
      bodyHash: inspection.bodyHash,
      bodyTextLength: inspection.bodyTextLength,
      genericSelector: inspection.contentSelector,
      references: inspection.references,
      templateNo: page.templateNo ?? null,
      source: cached ? "crawl" : "network",
      oldPageChanged: false,
    };
    project.writePageJson(page.id, "fetch.json", ledger);
    if (ledger.ok) {
      counts.ok += 1;
      log.write({ id: page.id, result: "ok", status: result.status });
    } else {
      counts.failed += 1;
      counts.reasons["empty-body"] = (counts.reasons["empty-body"] || 0) + 1;
      log.write({ id: page.id, result: "failed", reason: "empty-body" });
    }
  }

  // 巡回で取ったページは間隔を空けずに処理し、旧サイトへ取りに行くページだけを間隔と同時数に従わせる。
  for (const page of targets.filter((target) => crawled.has(target.id))) await handle(page);
  await runPaced(
    targets.filter((target) => !crawled.has(target.id)),
    rules,
    handle,
  );
  await inspectQueue;

  writeSummary(project);
  const reasons = Object.entries(counts.reasons)
    .map(([reason, n]) => `${reason} ${n}`)
    .join("、");
  report(`取得: 取得できた ${counts.ok} 件、取得できなかった ${counts.failed} 件${reasons ? `(${reasons})` : ""}`);
  return counts;
}

module.exports = { runFetch };

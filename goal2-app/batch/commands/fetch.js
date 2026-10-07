// 取得: 対象のページをすべて取り、ページの台帳(pages/<ID>/fetch.json)を書く。
// 取得できたページは、本文のハッシュと構造のハッシュも台帳に入れる(型のまとめと取り直しに使う)。
// もう一度動かすと、取得できていないページだけを取り直す。
const { fetchPage, runPaced } = require("../lib/fetcher");
const { writeSummary } = require("../lib/summary");

async function runFetch(project, { engine, ids, retryFailed = true, log, report }) {
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
  let inspectQueue = Promise.resolve();

  await runPaced(targets, rules, async (page) => {
    const fetchedAt = new Date().toISOString();
    let result = null;
    let failure = null;
    for (let attempt = 0; attempt <= rules.retries; attempt += 1) {
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
      log.write({ id: page.id, result: "failed", reason: ledger.reason, status: ledger.status });
      return;
    }

    inspectQueue = inspectQueue.then(async () => {
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
        bodyHash: inspection.bodyHash,
        bodyTextLength: inspection.bodyTextLength,
        genericSelector: inspection.contentSelector,
        references: inspection.references,
        templateNo: page.templateNo ?? null,
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
    });
    await inspectQueue;
  });

  writeSummary(project);
  const reasons = Object.entries(counts.reasons)
    .map(([reason, n]) => `${reason} ${n}`)
    .join("、");
  report(`取得: 取得できた ${counts.ok} 件、取得できなかった ${counts.failed} 件${reasons ? `(${reasons})` : ""}`);
  return counts;
}

module.exports = { runFetch };

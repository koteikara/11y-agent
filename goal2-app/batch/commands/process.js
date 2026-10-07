// 本処理: ページごとに、本文の抽出、候補、安全な候補の採用、残る指摘、確認の深さを行い、
// pages/<ID>/candidates.json に書く(docs/renewal/ARCHITECTURE.md の「本処理」「確認の深さの決め方」)。
// candidates.json はすべての段が終わってから書くので、途中で止まったページは、もう一度動かせばやり直される。
// 取り込みの事前の確かめ(段5)は、まだ入れていない。
const { writeSummary, DEPTH_LABELS } = require("../lib/summary");
const { matchApprovedTemplate } = require("../lib/structure");
const { writeMetrics, estimateReviewMinutes } = require("../lib/metrics");

// 構造を変える候補(表、見出し、リスト)か。確認の深さと自動の採用の両方で使う。ページの中でも
// 動かすので、外の変数を使わない。
function isStructuralCandidate(candidate, fact) {
  const STRUCTURAL_PATCH_TYPES = ["rebuild", "shift-headings", "replace-with-list", "replace-paragraph-sequence"];
  const STRUCTURAL_TAG = /^\s*<(h[1-6]|ul|ol|dl|li|table|caption|thead|tbody|tfoot|tr|th|td)\b/i;
  const ruleId = candidate.rule_id || "";
  const patchType = candidate.proposal?.patch?.type || "";
  if (fact?.table_structural) return true;
  if (STRUCTURAL_PATCH_TYPES.includes(patchType)) return true;
  if (/^html-structure\.heading-(order|required)$/.test(ruleId) || ruleId === "text.list") return true;
  // 要素を差し替える、外す、消す候補は、前後のどちらかが表、見出し、リストの要素なら構造を変える。
  if (["rename-element", "unwrap-element", "remove-element", "replace-html"].includes(patchType)) {
    return STRUCTURAL_TAG.test(candidate.proposal?.before_html || "") || STRUCTURAL_TAG.test(candidate.proposal?.after_html || "");
  }
  return false;
}

// ページの中で動かす。本文を抜き、候補を作り、案件の設定で「自動で採用」にしたルールの候補だけを採用する。
async function processInPage({ html, pageTitle, url, selector, autoAcceptRules, disabledRules, ruleScopeMode, isStructuralSource }) {
  const isStructural = new Function(`return (${isStructuralSource})`)();
  const body = await window.batchTools.extractBody({ html, pageTitle, url, selector });
  if (!body.html) return { body, analysis: null };
  const analysis = await window.goal2Engine.analyze({ html: body.html, pageTitle: body.pageTitle, oldUrl: url, ruleScopeMode });
  const disabled = new Set(disabledRules);
  const candidates = analysis.candidates.filter((candidate) => !disabled.has(candidate.rule_id));
  const allowed = new Set(autoAcceptRules);
  // autoAcceptSafe は、渡した候補のうち一括採用してよいものだけを採用する。渡すのは、自動で採用に
  // したルールの候補のうち、構造を変えないものだけにする。autoAcceptSafe が外すのは見出しの一括の
  // 繰り上げと表の構造だけで、リストや見出しの差し替えは通ってしまうため、ここで外す。
  const autoAccepted = window.goal2Engine.autoAcceptSafe(
    candidates.filter(
      (candidate) =>
        allowed.has(candidate.rule_id) &&
        !isStructural(candidate, window.goal2Engine.decisionLog.candidateFacts(candidate))
    )
  );
  const finalHtml = window.goal2Engine.buildFinalHtml(body.html, candidates);
  const residual = window.goal2Engine.checkResidual(finalHtml);
  const facts = candidates.map((candidate) => window.goal2Engine.decisionLog.candidateFacts(candidate));
  return {
    body,
    analysis: {
      candidates,
      notices: analysis.notices,
      llmUsage: analysis.llmUsage,
      autoAccepted,
      finalHtml,
      facts,
      residual: residual
        ? { count: residual.problems.length, byCheckId: countBy(residual.problems.map((p) => p.checkId)) }
        : null,
    },
  };

  function countBy(values) {
    return values.reduce((acc, value) => {
      acc[value] = (acc[value] || 0) + 1;
      return acc;
    }, {});
  }
}

// 確認の深さ。いちばん重い理由で決まる。
function decideDepth({ extractionMethod, candidates, facts, ruleClasses }) {
  const reasons = [];
  if (extractionMethod !== "template") {
    reasons.push(extractionMethod === "generic-fallback" ? "型の範囲が見つからず汎用の判定に戻った" : "承認した型に当たらない(汎用の判定)");
  }
  candidates.forEach((candidate, index) => {
    if (candidate.decision?.status) return;
    const fact = facts[index] || {};
    const ruleClass = ruleClasses.get(candidate.rule_id);
    const structural = isStructuralCandidate(candidate, fact);
    const meaning =
      ruleClass === "ai" ||
      ruleClass === "escalation" ||
      candidate.origin === "llm" ||
      Boolean(candidate.proposal?.requires_human_review);
    if (structural) reasons.push(`構造を変える候補(${candidate.rule_id})`);
    else if (meaning) reasons.push(`意味に関わる候補(${candidate.rule_id})`);
  });
  const unresolved = candidates.filter((candidate) => !candidate.decision?.status).length;
  if (reasons.length) return { depth: "thorough", reasons: [...new Set(reasons)] };
  if (unresolved) return { depth: "quick", reasons: [`小さな直しだけ(${unresolved} 件)`] };
  return { depth: "none", reasons: ["未判断の候補が無い"] };
}

async function runProcess(project, { engine, ids, force = false, log, report, ruleClasses }) {
  const input = project.readInput();
  const settings = project.readSettings();
  const counts = { target: 0, processed: 0, skipped: 0, failed: 0, depth: { thorough: 0, quick: 0, none: 0 } };

  for (const page of input.pages) {
    if (ids && !ids.includes(page.id)) continue;
    const ledger = project.readPageJson(page.id, "fetch.json");
    if (!ledger?.ok) continue;
    const existing = project.readPageJson(page.id, "candidates.json");
    // 旧ページが変わったページ(取り直しで印が付いたもの、または本文のハッシュが違うもの)はやり直す。
    if (existing && !force && !ledger.oldPageChanged && existing.sourceFetchedAt === ledger.fetchedAt && existing.sourceBodyHash === ledger.bodyHash) {
      counts.skipped += 1;
      continue;
    }
    counts.target += 1;

    const html = project.readPageText(page.id, "source.html");
    const match = matchApprovedTemplate(ledger.structurePaths, settings.templates.approved, settings.templates.similarity, ledger.structureVersion);
    const approved = match?.template || null;
    let result;
    try {
      result = await engine.evaluate(processInPage, {
        html,
        pageTitle: page.pageTitle || "",
        url: ledger.finalUrl,
        selector: approved?.selector || null,
        autoAcceptRules: settings.rules.autoAccept,
        disabledRules: settings.rules.disabled,
        ruleScopeMode: settings.ruleScopeMode,
        isStructuralSource: isStructuralCandidate.toString(),
      });
    } catch {
      // エラーの文言はページの中の文言を含むことがあるので、記録には理由だけを書く。
      counts.failed += 1;
      log.write({ id: page.id, result: "error", reason: "engine-error" });
      continue;
    }
    if (!result.analysis) {
      counts.failed += 1;
      log.write({ id: page.id, result: "failed", reason: "no-body" });
      continue;
    }

    const { body, analysis } = result;
    const { depth, reasons } = decideDepth({
      extractionMethod: body.method,
      candidates: analysis.candidates,
      facts: analysis.facts,
      ruleClasses,
    });
    const unresolved = analysis.candidates.filter((candidate) => !candidate.decision?.status).length;
    const estimate = estimateReviewMinutes({
      depth,
      candidates: analysis.candidates,
      facts: analysis.facts,
      ruleClasses,
      costs: settings.review.costs,
      isStructuralCandidate,
    });
    project.writePageJson(page.id, "candidates.json", {
      id: page.id,
      processedAt: new Date().toISOString(),
      sourceFetchedAt: ledger.fetchedAt,
      sourceBodyHash: ledger.bodyHash,
      extraction: {
        method: body.method,
        selector: body.selector,
        templateId: match?.templateId || null,
        templateSimilarity: match ? Number(match.score.toFixed(3)) : null,
        bodyHash: body.bodyHash,
      },
      pageTitle: body.pageTitle,
      sourceHtml: body.html,
      candidates: analysis.candidates,
      notices: analysis.notices,
      autoAcceptedHtml: analysis.finalHtml,
      counts: {
        candidates: analysis.candidates.length,
        autoAccepted: analysis.autoAccepted,
        unresolved,
        notices: analysis.notices.length,
      },
      residual: analysis.residual,
      depth,
      depthReasons: reasons,
      estimate,
      llmUsage: analysis.llmUsage,
      settings: { autoAccept: settings.rules.autoAccept, disabled: settings.rules.disabled, ruleScopeMode: settings.ruleScopeMode, ai: settings.ai.enabled },
    });
    counts.processed += 1;
    counts.depth[depth] += 1;
    log.write({ id: page.id, result: "ok", depth, candidates: analysis.candidates.length, unresolved });
  }

  writeSummary(project);
  const metrics = writeMetrics(project, { reviewHoursPerDay: settings.review.hoursPerDay, availableDays: settings.review.availableDays });
  report(`本処理: ${counts.processed} 件を処理した(済みで飛ばした ${counts.skipped} 件、失敗 ${counts.failed} 件)`);
  report(
    `  ${Object.entries(counts.depth)
      .map(([depth, n]) => `${DEPTH_LABELS[depth]} ${n}`)
      .join("、")}`
  );
  const e = metrics.estimate;
  report(
    `  確認の見積もり: 処理したページで ${Math.round(e.minutesProcessed / 60)} 時間。「移行する」全体に広げると ${Math.round(e.projectedMinutes / 60)} 時間、1日 ${e.reviewHoursPerDay} 時間で ${e.projectedDays} 日(使える日数 ${e.availableDays} 日に${e.fits ? "収まる" : "収まらない"})`
  );
  return counts;
}

module.exports = { runProcess, decideDepth, isStructuralCandidate };

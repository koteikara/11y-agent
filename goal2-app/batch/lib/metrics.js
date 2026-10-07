// 精度の指標(project/metrics.json)と、確認にかかる時間の見積もり。
// 指標の考え方は docs/renewal/ARCHITECTURE.md の「目標と測り方」。
//
// 本処理の時点で数えられるもの(ルールごとの候補の数、確認の深さを上げた回数、残る指摘)は、
// candidates.json から数える。採用率、害のある候補、見逃し、実際の確認の時間は、校正台(段3)が書く
// decision.json があれば数える。decision.json の形は段3で決めるので、ここでは次の項目だけを読む。
//   { confirmedAt, reviewSeconds, decisions: [{ candidate_id, rule_id, status, rejectReason }], manualEdits: [...] }
//   status: accepted | edited | rejected | deferred
//   rejectReason: meaning-changed | inaccurate | project-policy | unnecessary | other

const HARMFUL_REASONS = new Set(["meaning-changed", "inaccurate"]);

// 確認にかかる時間は、ページを開いて全体を見る時間に、未判断の候補ごとの時間を足して見積もる。
// 候補ごとの時間は候補の重さで分ける。値は案件の設定の review.costs(分)で、段3で実測に置き換える。
function candidateWeight(candidate, fact, ruleClass, isStructuralCandidate) {
  if (isStructuralCandidate(candidate, fact)) return "structural";
  if (
    ruleClass === "ai" ||
    ruleClass === "escalation" ||
    candidate.origin === "llm" ||
    Boolean(candidate.proposal?.requires_human_review)
  ) {
    return "meaning";
  }
  return "small";
}

// ページの確認にかかる時間の見積もり(分)と、その内訳。
function estimateReviewMinutes({ depth, candidates, facts, ruleClasses, costs, isStructuralCandidate }) {
  const breakdown = { structural: 0, meaning: 0, small: 0 };
  candidates.forEach((candidate, index) => {
    if (candidate.decision?.status) return;
    breakdown[candidateWeight(candidate, facts?.[index], ruleClasses.get(candidate.rule_id), isStructuralCandidate)] += 1;
  });
  if (depth === "none") return { minutes: 0, breakdown };
  const minutes =
    (costs.page[depth] || 0) +
    breakdown.structural * costs.candidate.structural +
    breakdown.meaning * costs.candidate.meaning +
    breakdown.small * costs.candidate.small;
  return { minutes: Number(minutes.toFixed(2)), breakdown };
}

function emptyRule() {
  return {
    candidates: 0,
    pages: 0,
    unresolved: 0,
    autoAccepted: 0,
    thoroughPages: 0,
    decided: 0,
    accepted: 0,
    edited: 0,
    rejected: 0,
    harmful: 0,
    rejectReasons: {},
  };
}

// 案件のページを読み直して指標を作り、project/metrics.json に書く。
function writeMetrics(project, { reviewHoursPerDay = 5, availableDays = 50 } = {}) {
  const input = project.readInput();
  const settings = project.readSettings();
  const rules = new Map();
  const rule = (id) => {
    if (!rules.has(id)) rules.set(id, emptyRule());
    return rules.get(id);
  };
  const pages = { processed: 0, depth: { thorough: 0, quick: 0, none: 0 }, confirmed: 0 };
  let estimatedMinutes = 0;
  const estimatedByDepth = { thorough: 0, quick: 0, none: 0 };
  let measuredSeconds = 0;
  let measuredPages = 0;
  let manualEdits = 0;
  const residualByCheckId = {};
  let residualTotal = 0;

  for (const page of input.pages) {
    const candidates = project.readPageJson(page.id, "candidates.json");
    if (!candidates) continue;
    pages.processed += 1;
    pages.depth[candidates.depth] = (pages.depth[candidates.depth] || 0) + 1;
    if (candidates.estimate) {
      estimatedMinutes += candidates.estimate.minutes;
      estimatedByDepth[candidates.depth] += candidates.estimate.minutes;
    }
    if (candidates.residual) {
      residualTotal += candidates.residual.count;
      for (const [checkId, n] of Object.entries(candidates.residual.byCheckId || {})) {
        residualByCheckId[checkId] = (residualByCheckId[checkId] || 0) + n;
      }
    }
    const seenRules = new Set();
    for (const candidate of candidates.candidates) {
      const r = rule(candidate.rule_id);
      r.candidates += 1;
      if (candidate.decision?.status === "accepted") r.autoAccepted += 1;
      else r.unresolved += 1;
      seenRules.add(candidate.rule_id);
    }
    for (const id of seenRules) rule(id).pages += 1;
    // しっかり確認の理由になったルール(理由の括弧の中のルールの ID)。
    for (const reason of candidates.depthReasons || []) {
      const match = /\(([a-z0-9-]+\.[a-z0-9.-]+)\)$/.exec(reason);
      if (match && candidates.depth === "thorough") rule(match[1]).thoroughPages += 1;
    }

    const decision = project.readPageJson(page.id, "decision.json");
    if (!decision) continue;
    if (decision.confirmedAt) pages.confirmed += 1;
    if (typeof decision.reviewSeconds === "number") {
      measuredSeconds += decision.reviewSeconds;
      measuredPages += 1;
    }
    manualEdits += Array.isArray(decision.manualEdits) ? decision.manualEdits.length : 0;
    for (const entry of decision.decisions || []) {
      const r = rule(entry.rule_id);
      if (!["accepted", "edited", "rejected"].includes(entry.status)) continue;
      r.decided += 1;
      r[entry.status] += 1;
      if (entry.status === "rejected") {
        const reason = entry.rejectReason || "other";
        r.rejectReasons[reason] = (r.rejectReasons[reason] || 0) + 1;
        if (HARMFUL_REASONS.has(reason)) r.harmful += 1;
      }
    }
  }

  const ruleRows = [...rules.entries()]
    .map(([id, r]) => ({
      id,
      ...r,
      adoptionRate: r.decided ? Number(((r.accepted + r.edited) / r.decided).toFixed(3)) : null,
      plainAcceptRate: r.decided ? Number((r.accepted / r.decided).toFixed(3)) : null,
    }))
    .sort((a, b) => b.thoroughPages - a.thoroughPages || b.candidates - a.candidates);

  // 害のある候補が出たルールのうち、確認不要に入れているもの。校正台で外すことを確定する(一括処理は設定を書かない)。
  const removeFromAutoAccept = ruleRows.filter((r) => r.harmful > 0 && settings.rules.autoAccept.includes(r.id)).map((r) => r.id);

  // 日程: 全ページを処理した割合で、見積もりを案件の「移行する」全体に広げる。
  const scale = pages.processed ? input.pages.length / pages.processed : 0;
  const projectedMinutes = estimatedMinutes * scale;
  const projectedDays = projectedMinutes / 60 / reviewHoursPerDay;

  const metrics = {
    generatedAt: new Date().toISOString(),
    pages: { total: input.pages.length, ...pages },
    estimate: {
      note: "確認の時間は案件の設定の review.costs(仮の値)で見積もる。段3で実測に置き換える。全体の見積もりは、処理したページの見積もりを、処理した割合で全件に伸ばしたもの(--ids で一部だけ処理したときは偏る)",
      costs: settings.review.costs,
      minutesProcessed: Number(estimatedMinutes.toFixed(1)),
      minutesByDepth: Object.fromEntries(Object.entries(estimatedByDepth).map(([k, v]) => [k, Number(v.toFixed(1))])),
      projectedMinutes: Number(projectedMinutes.toFixed(0)),
      projectedDays: Number(projectedDays.toFixed(1)),
      reviewHoursPerDay,
      availableDays,
      fits: projectedDays <= availableDays,
    },
    measured: measuredPages
      ? { pages: measuredPages, averageMinutes: Number((measuredSeconds / measuredPages / 60).toFixed(2)) }
      : null,
    manualEdits,
    residual: { total: residualTotal, byCheckId: residualByCheckId },
    removeFromAutoAccept,
    rules: ruleRows,
  };
  project.writeJson(project.paths.metrics, metrics);
  return metrics;
}

module.exports = { writeMetrics, estimateReviewMinutes, HARMFUL_REASONS };

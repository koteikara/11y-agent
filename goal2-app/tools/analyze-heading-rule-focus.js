#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");
const HEADING_METRICS = ["h2", "h3", "h4"];

const RULE_CANDIDATES = [
  {
    id: "heading-add-missing-nested-depth",
    label: "Add missing h3/h4 nested depth",
    triggers: ["h3_shortage", "h4_shortage"],
    patterns: ["missing_nested_depth"],
    implementation:
      "When gold has more h3/h4, convert or retain child group labels as h3/h4 under the nearest parent heading instead of leaving them as plain text.",
    human_check:
      "Confirm the parent-child relationship exists; do not create h4 unless there is a preceding h3 branch.",
  },
  {
    id: "heading-promote-lower-levels-when-h2-shortage",
    label: "Promote lower-level headings when h2 is short",
    triggers: ["h2_shortage", "h3_excess", "h4_excess"],
    patterns: ["lower_levels_need_promotion", "h4_needs_promotion"],
    implementation:
      "When gold has more h2 and current has surplus h3/h4, promote content headings one level at a time instead of leaving visual subheads at h3/h4.",
    human_check:
      "Confirm the promoted heading is a real section title and not a caption, navigation label, or repeated decorative label.",
  },
  {
    id: "heading-convert-decorative-text-to-headings",
    label: "Convert decorative heading text to h2/h3/h4",
    triggers: ["h2_shortage", "h3_shortage", "h4_shortage"],
    patterns: ["missing_semantic_headings", "mixed_shortage"],
    implementation:
      "Treat short standalone strong/bold/div/p text, colon-ended labels, and table-adjacent group labels as heading candidates when gold has more headings.",
    human_check:
      "Do not change administrative wording; only add semantic heading tags around text that is already functioning as a heading.",
  },
  {
    id: "heading-preserve-nested-subsections",
    label: "Preserve nested h3/h4 sections instead of flattening",
    triggers: ["h2_excess", "h3_shortage", "h4_shortage"],
    patterns: ["flattened_too_much"],
    implementation:
      "When current has too many h2 and too few h3/h4, keep child sections as h3/h4 under the nearest h2 instead of converting every strong block to h2.",
    human_check:
      "Check whether the text is a subsection under the preceding section, especially for contact, related links, procedures, and grouped notices.",
  },
  {
    id: "heading-demote-overpromoted-headings",
    label: "Demote over-promoted decorative or repeated headings",
    triggers: ["h2_excess", "h3_excess", "h4_excess"],
    patterns: ["heading_excess", "mixed_excess"],
    implementation:
      "Remove heading semantics from labels that are captions, repeated link-list labels, page furniture, or small decorative callouts.",
    human_check:
      "If the text names a data table, prefer caption. If it belongs to the template or side menu, keep it out of content extraction.",
  },
  {
    id: "heading-exclude-template-navigation",
    label: "Exclude template navigation headings from content scope",
    triggers: ["h2_excess", "h3_excess", "h4_excess"],
    patterns: ["template_or_navigation_likely"],
    implementation:
      "Before heading normalization, remove old-site template headings such as menu, page top, side navigation, language navigation, and footer headings from the content fragment.",
    human_check:
      "Record the selector or extraction reason when a heading is excluded as old-site-template scope.",
  },
  {
    id: "heading-content-snapshot-review",
    label: "Separate gold-only or time-sensitive content updates",
    triggers: ["h2_shortage", "h3_excess"],
    patterns: ["gold_only_content_update", "date_snapshot_mismatch", "stale_section_scope_mismatch"],
    implementation:
      "Do not invent headings or delete dated sections only to match gold. Re-fetch the old page, compare publication dates, or send the case to human confirmation.",
    human_check:
      "Confirm whether gold contains newer content, a different date range, or an intentionally removed section before changing administrative content.",
  },
  {
    id: "heading-cms-componentization-review",
    label: "Separate CMS componentization from heading-tag fixes",
    triggers: ["h2_excess", "h3_shortage", "h4_shortage"],
    patterns: ["cms_componentization_required"],
    implementation:
      "Treat card/link/video blocks as CMS components first; heading levels should be derived after component boundaries are known.",
    human_check:
      "Check the CMS parts expected for promotional cards, videos, and related-link blocks before adjusting heading levels.",
  },
];

function parseArgs(argv) {
  const args = {
    grade: path.join(rootDir, "agents-cli", "results", "saga-a11y-local-grade.json"),
    outputDir: path.join(rootDir, "agents-cli", "results"),
    top: 12,
    json: false,
  };

  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--grade") {
      args.grade = path.resolve(argv[++index]);
    } else if (arg === "--output-dir") {
      args.outputDir = path.resolve(argv[++index]);
    } else if (arg === "--top") {
      args.top = Number(argv[++index]);
    } else if (arg === "--json") {
      args.json = true;
    } else if (arg === "--help" || arg === "-h") {
      args.help = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return args;
}

function usage() {
  return [
    "Usage: node tools/analyze-heading-rule-focus.js [options]",
    "",
    "Options:",
    "  --grade <file>       Grade JSON from agents:local-eval",
    "  --output-dir <dir>   Directory for heading analysis outputs",
    "  --top <n>            Number of cases to show in reports",
    "  --json               Print JSON summary",
  ].join("\n");
}

function loadGrade(filePath) {
  const payload = JSON.parse(fs.readFileSync(filePath, "utf8"));
  if (!Array.isArray(payload.results)) {
    throw new Error(`Grade file does not contain results: ${filePath}`);
  }
  return payload;
}

function analyzeHeadingRules(payload, args) {
  const failures = [];
  const cases = [];
  const metricSummary = Object.fromEntries(
    HEADING_METRICS.map((metric) => [
      metric,
      {
        total: 0,
        shortage: 0,
        excess: 0,
        mismatch: 0,
        regressed: 0,
        improved: 0,
        unchanged: 0,
        cases: [],
      },
    ])
  );
  const triggerCounts = {};
  const patternSummary = {};

  for (const result of payload.results) {
    const headingFailures = (result.failures || []).filter((failure) => HEADING_METRICS.includes(failure.metric));
    if (!headingFailures.length) {
      continue;
    }

    const caseItem = {
      id: result.id,
      score: result.score,
      differs_from_gold: result.comparison?.differs_from_gold || 0,
      regressed_metrics: result.comparison?.regressed_metrics || 0,
      old: selectMetrics(result.metrics?.old),
      current: selectMetrics(result.metrics?.current),
      gold: selectMetrics(result.metrics?.gold),
      all_metrics: result.metrics || {},
      output_html: result.output_html || "",
      text_lengths: result.text_lengths || {},
      failure_keys: [],
      pattern: null,
      diagnosis: "",
    };

    for (const failure of headingFailures) {
      const direction = directionForFailure(failure);
      const key = `${failure.metric}_${direction}`;
      triggerCounts[key] = (triggerCounts[key] || 0) + 1;
      caseItem.failure_keys.push(key);

      const summary = metricSummary[failure.metric];
      summary.total += 1;
      summary[direction] = (summary[direction] || 0) + 1;
      summary[failure.status] = (summary[failure.status] || 0) + 1;
      const record = caseFailure(result, failure, direction, key);
      summary.cases.push(record);
      failures.push(record);
    }

    caseItem.failure_keys = [...new Set(caseItem.failure_keys)];
    caseItem.pattern = classifyCase(caseItem);
    caseItem.diagnosis = caseItem.pattern.diagnosis;
    patternSummary[caseItem.pattern.id] = patternSummary[caseItem.pattern.id] || {
      id: caseItem.pattern.id,
      label: caseItem.pattern.label,
      count: 0,
      cases: [],
    };
    patternSummary[caseItem.pattern.id].count += 1;
    patternSummary[caseItem.pattern.id].cases.push({
      id: caseItem.id,
      score: caseItem.score,
      failure_keys: caseItem.failure_keys,
      current: caseItem.current,
      gold: caseItem.gold,
    });
    cases.push(caseItem);
  }

  const ruleFocus = RULE_CANDIDATES.map((candidate) => {
    const matchingCases = cases.filter((item) => caseMatchesRule(candidate, item));
    const triggerEvidence = candidate.triggers.reduce((sum, trigger) => sum + (triggerCounts[trigger] || 0), 0);
    return {
      ...candidate,
      evidence_count: matchingCases.length,
      trigger_evidence: triggerEvidence,
      pattern_evidence: matchingCases.length,
      case_count: matchingCases.length,
      example_cases: matchingCases
        .sort((a, b) => b.differs_from_gold - a.differs_from_gold || b.regressed_metrics - a.regressed_metrics || a.score - b.score)
        .slice(0, args.top)
        .map((item) => ({
          id: item.id,
          score: item.score,
          diagnosis: item.diagnosis,
          failure_keys: item.failure_keys,
          current: item.current,
          gold: item.gold,
        })),
    };
  })
    .filter((candidate) => candidate.evidence_count > 0)
    .sort((a, b) => b.evidence_count - a.evidence_count || b.case_count - a.case_count);

  return {
    source_grade: args.grade,
    generated_at: new Date().toISOString(),
    totals: {
      heading_failure_cases: cases.length,
      heading_failure_instances: failures.length,
      regressed_instances: failures.filter((failure) => failure.status === "regressed").length,
      improved_instances: failures.filter((failure) => failure.status === "improved").length,
      unchanged_instances: failures.filter((failure) => failure.status === "unchanged").length,
      shortage_instances: failures.filter((failure) => failure.direction === "shortage").length,
      excess_instances: failures.filter((failure) => failure.direction === "excess").length,
    },
    metric_summary: mapMetricSummary(metricSummary, args.top),
    trigger_counts: sortObjectByValue(triggerCounts),
    pattern_summary: mapPatternSummary(patternSummary, args.top),
    rule_focus: ruleFocus,
    priority_cases: cases
      .sort((a, b) => b.differs_from_gold - a.differs_from_gold || b.regressed_metrics - a.regressed_metrics || a.score - b.score)
      .slice(0, args.top),
  };
}

function selectMetrics(metrics = {}) {
  return Object.fromEntries(HEADING_METRICS.map((metric) => [metric, metrics[metric] || 0]));
}

function directionForFailure(failure) {
  if ((failure.current || 0) < (failure.gold || 0)) {
    return "shortage";
  }
  if ((failure.current || 0) > (failure.gold || 0)) {
    return "excess";
  }
  return "mismatch";
}

function caseFailure(result, failure, direction, key) {
  return {
    id: result.id,
    score: result.score,
    metric: failure.metric,
    status: failure.status,
    direction,
    key,
    baseline: failure.baseline,
    current: failure.current,
    gold: failure.gold,
    differs_from_gold: result.comparison?.differs_from_gold || 0,
    regressed_metrics: result.comparison?.regressed_metrics || 0,
  };
}

function classifyCase(item) {
  const keys = new Set(item.failure_keys);
  const shortageCount = item.failure_keys.filter((key) => key.endsWith("_shortage")).length;
  const excessCount = item.failure_keys.filter((key) => key.endsWith("_excess")).length;

  if (isDateSnapshotMismatch(item)) {
    return {
      id: "date_snapshot_mismatch",
      label: "Date-range content snapshot differs",
      diagnosis:
        "Current and gold contain different dated schedule ranges; re-fetch or confirm the target period instead of trimming date headings automatically.",
    };
  }

  if (isGoldOnlyContentUpdate(item)) {
    return {
      id: "gold_only_content_update",
      label: "Gold-only content update likely",
      diagnosis:
        "Gold has more body text/headings than old/current; do not create administrative content from nothing. Re-fetch the source or escalate as content update.",
    };
  }

  if (isCmsComponentizationRequired(item)) {
    return {
      id: "cms_componentization_required",
      label: "CMS componentization likely required first",
      diagnosis:
        "Gold appears to split cards, video/link blocks, or promotional modules into components; decide component boundaries before heading-level fixes.",
    };
  }

  if (isStaleSectionScopeMismatch(item)) {
    return {
      id: "stale_section_scope_mismatch",
      label: "Stale or out-of-scope section likely remains",
      diagnosis:
        "Current keeps a section that gold likely removed or moved. Do not delete it automatically; confirm page scope or content freshness first.",
    };
  }

  if (keys.has("h2_shortage") && (keys.has("h3_excess") || keys.has("h4_excess"))) {
    return {
      id: "lower_levels_need_promotion",
      label: "Lower-level headings likely need promotion",
      diagnosis: "Current has too few h2 and surplus lower headings; promote real section headings toward h2/h3.",
    };
  }

  if (keys.has("h4_excess") && (keys.has("h2_shortage") || keys.has("h3_shortage"))) {
    return {
      id: "h4_needs_promotion",
      label: "h4 headings likely need promotion",
      diagnosis: "Current keeps too many h4 while gold needs higher levels; promote selected h4 groups after checking hierarchy.",
    };
  }

  if (keys.has("h2_excess") && (keys.has("h3_shortage") || keys.has("h4_shortage"))) {
    return {
      id: "flattened_too_much",
      label: "Headings likely flattened to h2",
      diagnosis: "Current has surplus h2 and missing nested headings; preserve h3/h4 depth under parent sections.",
    };
  }

  if (shortageCount === item.failure_keys.length) {
    if (keys.has("h2_shortage") && (keys.has("h3_shortage") || keys.has("h4_shortage"))) {
      return {
        id: "missing_semantic_headings",
        label: "Semantic headings are missing",
        diagnosis: "Current has fewer section headings than gold; detect visual heading text that remains plain markup.",
      };
    }
    if (keys.has("h2_shortage")) {
      return {
        id: "missing_semantic_headings",
        label: "Semantic headings are missing",
        diagnosis: "Current has fewer h2 headings than gold; detect visual section titles that remain plain markup.",
      };
    }
  }

  if (keys.has("h3_shortage") || keys.has("h4_shortage")) {
    return {
      id: "missing_nested_depth",
      label: "Nested heading depth is missing",
      diagnosis: "Gold uses deeper heading levels; convert or retain child group labels as h3/h4 where hierarchy exists.",
    };
  }

  if (shortageCount === item.failure_keys.length) {
    return {
      id: "missing_semantic_headings",
      label: "Semantic headings are missing",
      diagnosis: "Current has fewer semantic headings than gold; detect visual heading text that remains plain markup.",
    };
  }

  if (excessCount === item.failure_keys.length) {
    const templateLikely = item.old.h2 + item.old.h3 + item.old.h4 >= 12 || item.current.h2 + item.current.h3 + item.current.h4 >= 12;
    return {
      id: templateLikely ? "template_or_navigation_likely" : "heading_excess",
      label: templateLikely ? "Template or navigation headings likely remain" : "Heading excess",
      diagnosis: templateLikely
        ? "Current has many excess headings; verify content extraction excludes menu, side navigation, page top, and footer headings."
        : "Current has more headings than gold; demote decorative, repeated, or caption-like labels.",
    };
  }

  if (shortageCount > 0 && excessCount > 0) {
    return {
      id: "mixed_shortage",
      label: "Mixed heading shortage and excess",
      diagnosis: "Heading levels are redistributed incorrectly; compare nearby headings and adjust each branch instead of applying one global shift.",
    };
  }

  return {
    id: "mixed_excess",
    label: "Mixed heading excess",
    diagnosis: "Heading counts differ from gold; inspect this page before choosing promotion or demotion.",
  };
}

function isDateSnapshotMismatch(item) {
  const keys = new Set(item.failure_keys);
  if (!keys.has("h3_excess") || item.failure_keys.length !== 1) {
    return false;
  }
  const dateHeadingCount = countDateHeadings(item.output_html);
  return dateHeadingCount >= 8 && (item.text_lengths.current || 0) > (item.text_lengths.gold || 0) + 500;
}

function isGoldOnlyContentUpdate(item) {
  const keys = new Set(item.failure_keys);
  if (!keys.has("h2_shortage") || item.failure_keys.length !== 1) {
    return false;
  }
  return (item.text_lengths.gold || 0) > (item.text_lengths.current || 0) + 120;
}

function isCmsComponentizationRequired(item) {
  const keys = new Set(item.failure_keys);
  const goldIframe = item.all_metrics?.gold?.iframe || 0;
  const currentIframe = item.all_metrics?.current?.iframe || 0;
  return goldIframe > currentIframe && (keys.has("h3_shortage") || keys.has("h4_shortage"));
}

function isStaleSectionScopeMismatch(item) {
  const keys = new Set(item.failure_keys);
  return (
    keys.has("h2_shortage") &&
    keys.has("h3_excess") &&
    (item.text_lengths.current || 0) > (item.text_lengths.gold || 0) + 350
  );
}

function countDateHeadings(html) {
  return (String(html || "").match(/<h[1-6]\b[^>]*>\s*(?:令和|平成|昭和)?[0-9０-９]+年[0-9０-９]+月[0-9０-９]+日/g) || []).length;
}

function caseMatchesRule(candidate, item) {
  return candidate.patterns.includes(item.pattern.id);
}

function mapMetricSummary(metricSummary, top) {
  return Object.fromEntries(
    Object.entries(metricSummary).map(([metric, summary]) => [
      metric,
      {
        ...summary,
        cases: summary.cases
          .sort((a, b) => statusWeight(b.status) - statusWeight(a.status) || b.differs_from_gold - a.differs_from_gold || a.score - b.score)
          .slice(0, top),
      },
    ])
  );
}

function mapPatternSummary(patternSummary, top) {
  return Object.values(patternSummary)
    .sort((a, b) => b.count - a.count || a.id.localeCompare(b.id))
    .map((pattern) => ({
      ...pattern,
      cases: pattern.cases
        .sort((a, b) => b.score - a.score)
        .slice(0, top),
    }));
}

function statusWeight(status) {
  return {
    regressed: 4,
    unchanged: 3,
    improved: 2,
  }[status] || 1;
}

function sortObjectByValue(value) {
  return Object.fromEntries(Object.entries(value).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])));
}

function writeOutputs(analysis, args) {
  fs.mkdirSync(args.outputDir, { recursive: true });
  const jsonPath = path.join(args.outputDir, "saga-a11y-heading-rule-focus.json");
  const markdownPath = path.join(args.outputDir, "saga-a11y-heading-rule-focus.md");
  fs.writeFileSync(jsonPath, JSON.stringify(analysis, null, 2), "utf8");
  fs.writeFileSync(markdownPath, renderMarkdown(analysis), "utf8");
  return { jsonPath, markdownPath };
}

function renderMarkdown(analysis) {
  const lines = [
    "# Heading Rule Focus",
    "",
    `- Source grade: \`${analysis.source_grade}\``,
    `- Heading failure cases: ${analysis.totals.heading_failure_cases}`,
    `- Heading failure instances: ${analysis.totals.heading_failure_instances}`,
    `- Shortage instances: ${analysis.totals.shortage_instances}`,
    `- Excess instances: ${analysis.totals.excess_instances}`,
    `- Regressed instances: ${analysis.totals.regressed_instances}`,
    "",
    "## Metric Breakdown",
    "",
    "| Metric | Total | Shortage | Excess | Regressed | Improved | Unchanged |",
    "|---|---:|---:|---:|---:|---:|---:|",
  ];

  for (const metric of HEADING_METRICS) {
    const item = analysis.metric_summary[metric];
    lines.push(
      `| ${metric} | ${item.total} | ${item.shortage} | ${item.excess} | ${item.regressed || 0} | ${item.improved || 0} | ${item.unchanged || 0} |`
    );
  }

  lines.push("", "## Pattern Breakdown", "");
  lines.push("| Pattern | Cases |");
  lines.push("|---|---:|");
  for (const pattern of analysis.pattern_summary) {
    lines.push(`| ${pattern.label} | ${pattern.count} |`);
  }

  lines.push("", "## Focused Rule Candidates", "");
  for (const item of analysis.rule_focus) {
    lines.push(`### ${item.label}`);
    lines.push("");
    lines.push(`- Rule id: \`${item.id}\``);
    lines.push(`- Evidence count: ${item.evidence_count}`);
    lines.push(`- Case count: ${item.case_count}`);
    lines.push(`- Implementation: ${item.implementation}`);
    lines.push(`- Human check: ${item.human_check}`);
    lines.push("");
    lines.push("| Example case | Score | Diagnosis | Current | Gold | Failure keys |");
    lines.push("|---|---:|---|---|---|---|");
    for (const example of item.example_cases) {
      lines.push(
        `| ${example.id} | ${example.score} | ${example.diagnosis} | ${formatMetricSet(example.current)} | ${formatMetricSet(example.gold)} | ${example.failure_keys.join(", ")} |`
      );
    }
    lines.push("");
  }

  lines.push("## Priority Cases", "");
  lines.push("| Case | Score | Diagnosis | Old | Current | Gold |");
  lines.push("|---|---:|---|---|---|---|");
  for (const item of analysis.priority_cases) {
    lines.push(
      `| ${item.id} | ${item.score} | ${item.diagnosis} | ${formatMetricSet(item.old)} | ${formatMetricSet(item.current)} | ${formatMetricSet(item.gold)} |`
    );
  }

  return `${lines.join("\n")}\n`;
}

function formatMetricSet(metrics) {
  return HEADING_METRICS.map((metric) => `${metric}:${metrics[metric]}`).join("<br>");
}

function printText(analysis, outputPaths) {
  console.log(`Heading failure cases: ${analysis.totals.heading_failure_cases}`);
  console.log(`Heading failure instances: ${analysis.totals.heading_failure_instances}`);
  console.log(`Shortage instances: ${analysis.totals.shortage_instances}`);
  console.log(`Excess instances: ${analysis.totals.excess_instances}`);
  for (const metric of HEADING_METRICS) {
    const item = analysis.metric_summary[metric];
    console.log(`${metric}: total=${item.total}, shortage=${item.shortage}, excess=${item.excess}`);
  }
  analysis.rule_focus.slice(0, 5).forEach((item, index) => {
    console.log(`${index + 1}. ${item.label}: evidence=${item.evidence_count}, cases=${item.case_count}`);
  });
  console.log(`Heading focus JSON: ${outputPaths.jsonPath}`);
  console.log(`Heading focus report: ${outputPaths.markdownPath}`);
}

function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    console.log(usage());
    return;
  }
  const payload = loadGrade(args.grade);
  const analysis = analyzeHeadingRules(payload, args);
  const outputPaths = writeOutputs(analysis, args);
  if (args.json) {
    console.log(JSON.stringify({ analysis, outputPaths }, null, 2));
  } else {
    printText(analysis, outputPaths);
  }
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  }
}

module.exports = {
  analyzeHeadingRules,
};

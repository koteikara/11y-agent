#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");

const CATEGORIES = [
  {
    id: "heading_structure",
    label: "見出し構造",
    metrics: ["h2", "h3", "h4"],
    action: "h2/h3/h4の段階補正ルールを確認し、本文先頭見出しとページ内見出しのgold差分を分類する。",
  },
  {
    id: "table_semantics",
    label: "表構造",
    metrics: ["table", "thead", "caption", "th", "scopeCol", "scopeRow"],
    action: "データ表、レイアウト表、セル結合、caption/scope付与のどれがgoldと違うかを切り分ける。",
  },
  {
    id: "image_media",
    label: "画像・埋め込み",
    metrics: ["img", "emptyAlt", "iframe"],
    action: "画像alt、複雑画像、iframeのCMS注意/修正候補の分類を確認する。",
  },
  {
    id: "link_text",
    label: "リンク文言",
    metrics: ["weakLink"],
    action: "弱いリンク文言が残るページを確認し、リンク先ページ名推定または人間確認候補へ回す。",
  },
  {
    id: "other",
    label: "その他",
    metrics: [],
    action: "個別にgold差分を確認する。",
  },
];

function parseArgs(argv) {
  const args = {
    grade: path.join(rootDir, "agents-cli", "results", "saga-a11y-local-grade.json"),
    outputDir: path.join(rootDir, "agents-cli", "results"),
    json: false,
    top: 10,
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
    "Usage: node tools/analyze-agents-cli-results.js [options]",
    "",
    "Options:",
    "  --grade <file>       Grade JSON from agents:local-eval",
    "  --output-dir <dir>   Directory for analysis outputs",
    "  --top <n>            Number of cases to show per group",
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

function analyzeGrade(payload, args) {
  const metricMap = new Map();
  const categoryMap = new Map(CATEGORIES.map((category) => [category.id, initCategory(category)]));
  const caseMap = new Map();

  for (const result of payload.results) {
    const failures = Array.isArray(result.failures) ? result.failures : [];
    const caseSummary = {
      id: result.id,
      score: result.score,
      current_similarity: result.comparison?.current_similarity || 0,
      similarity_delta: result.comparison?.similarity_delta || 0,
      differs_from_gold: result.comparison?.differs_from_gold || failures.length,
      regressed_metrics: result.comparison?.regressed_metrics || 0,
      categories: new Set(),
      failures: [],
      recommended_next_step: "",
    };

    for (const failure of failures) {
      const metric = failure.metric;
      const category = categoryForMetric(metric);
      const metricSummary = ensureMetric(metricMap, metric);
      metricSummary.total += 1;
      metricSummary.statuses[failure.status] = (metricSummary.statuses[failure.status] || 0) + 1;
      metricSummary.cases.push(caseFailureRecord(result, failure, category));

      const categorySummary = categoryMap.get(category.id);
      categorySummary.total += 1;
      categorySummary.metrics[metric] = (categorySummary.metrics[metric] || 0) + 1;
      categorySummary.statuses[failure.status] = (categorySummary.statuses[failure.status] || 0) + 1;
      categorySummary.cases.push(caseFailureRecord(result, failure, category));

      caseSummary.categories.add(category.id);
      caseSummary.failures.push({
        metric,
        status: failure.status,
        category: category.id,
        baseline: failure.baseline,
        current: failure.current,
        gold: failure.gold,
      });
    }

    if (caseSummary.failures.length) {
      caseSummary.categories = [...caseSummary.categories];
      caseSummary.recommended_next_step = recommendationForCase(caseSummary);
      caseMap.set(caseSummary.id, caseSummary);
    }
  }

  const metrics = [...metricMap.values()].map((item) => finalizeGroup(item, args.top));
  const categories = [...categoryMap.values()]
    .filter((item) => item.total > 0)
    .map((item) => finalizeGroup(item, args.top));
  const cases = [...caseMap.values()]
    .sort((a, b) => b.differs_from_gold - a.differs_from_gold || b.regressed_metrics - a.regressed_metrics || a.score - b.score)
    .slice(0, args.top);

  return {
    source_grade: args.grade,
    generated_at: new Date().toISOString(),
    totals: {
      cases: payload.summary?.totals?.cases || payload.results.length,
      failing_cases: caseMap.size,
      failure_instances: metrics.reduce((sum, item) => sum + item.total, 0),
      average_score: payload.summary?.totals?.average_score || null,
      average_current_similarity: payload.summary?.totals?.average_current_similarity || null,
    },
    categories,
    metrics,
    priority_cases: cases,
    recommended_actions: recommendedActions(categories),
  };
}

function initCategory(category) {
  return {
    id: category.id,
    label: category.label,
    action: category.action,
    total: 0,
    metrics: {},
    statuses: {},
    cases: [],
  };
}

function ensureMetric(metricMap, metric) {
  if (!metricMap.has(metric)) {
    const category = categoryForMetric(metric);
    metricMap.set(metric, {
      id: metric,
      label: metric,
      category: category.id,
      total: 0,
      statuses: {},
      cases: [],
    });
  }
  return metricMap.get(metric);
}

function categoryForMetric(metric) {
  return CATEGORIES.find((category) => category.metrics.includes(metric)) || CATEGORIES.find((category) => category.id === "other");
}

function caseFailureRecord(result, failure, category) {
  return {
    id: result.id,
    score: result.score,
    metric: failure.metric,
    category: category.id,
    status: failure.status,
    baseline: failure.baseline,
    current: failure.current,
    gold: failure.gold,
    differs_from_gold: result.comparison?.differs_from_gold || 0,
    regressed_metrics: result.comparison?.regressed_metrics || 0,
  };
}

function finalizeGroup(group, top) {
  return {
    ...group,
    cases: group.cases
      .sort((a, b) => statusWeight(b.status) - statusWeight(a.status) || b.differs_from_gold - a.differs_from_gold || a.score - b.score)
      .slice(0, top),
  };
}

function statusWeight(status) {
  return {
    regressed: 4,
    unchanged: 3,
    improved: 2,
  }[status] || 1;
}

function recommendationForCase(caseSummary) {
  if (caseSummary.categories.includes("table_semantics")) {
    return "表構造のgold差分を優先確認し、表解体/データ表維持/caption/scopeのどれを修正するか決める。";
  }
  if (caseSummary.categories.includes("heading_structure")) {
    return "見出し階層の基準を確認し、h2/h3/h4の段階補正を調整する。";
  }
  if (caseSummary.categories.includes("link_text")) {
    return "弱いリンク文言のリンク先ページ名推定または人間確認候補を強化する。";
  }
  if (caseSummary.categories.includes("image_media")) {
    return "画像/iframeのCMS操作注意とHTML修正候補の分離を確認する。";
  }
  return "gold差分を個別確認する。";
}

function recommendedActions(categories) {
  return [...categories]
    .sort((a, b) => b.total - a.total)
    .map((category, index) => ({
      priority: index + 1,
      category: category.id,
      label: category.label,
      failure_instances: category.total,
      top_metrics: Object.entries(category.metrics)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 4)
        .map(([metric, count]) => ({ metric, count })),
      action: category.action,
    }));
}

function writeOutputs(analysis, args) {
  fs.mkdirSync(args.outputDir, { recursive: true });
  const jsonPath = path.join(args.outputDir, "saga-a11y-local-analysis.json");
  const markdownPath = path.join(args.outputDir, "saga-a11y-local-analysis.md");
  fs.writeFileSync(jsonPath, JSON.stringify(analysis, null, 2), "utf8");
  fs.writeFileSync(markdownPath, renderMarkdown(analysis), "utf8");
  return { jsonPath, markdownPath };
}

function renderMarkdown(analysis) {
  const lines = [
    "# agents-cli Failure Analysis",
    "",
    `- Source grade: \`${analysis.source_grade}\``,
    `- Cases: ${analysis.totals.cases}`,
    `- Failing cases: ${analysis.totals.failing_cases}`,
    `- Failure instances: ${analysis.totals.failure_instances}`,
    `- Average score: ${analysis.totals.average_score}`,
    "",
    "## Recommended Actions",
    "",
  ];

  for (const action of analysis.recommended_actions) {
    lines.push(
      `${action.priority}. ${action.label}: ${action.failure_instances}件。${action.action}`
    );
    if (action.top_metrics.length) {
      lines.push(`   - Top metrics: ${action.top_metrics.map((item) => `${item.metric}=${item.count}`).join(", ")}`);
    }
  }

  lines.push("", "## Categories", "");
  for (const category of analysis.categories) {
    lines.push(`### ${category.label}`);
    lines.push("");
    lines.push(`- Failure instances: ${category.total}`);
    lines.push(`- Statuses: ${formatObject(category.statuses)}`);
    lines.push(`- Metrics: ${formatObject(category.metrics)}`);
    lines.push(`- Action: ${category.action}`);
    lines.push("");
    lines.push("| Case | Metric | Status | Current | Gold | Score |");
    lines.push("|---|---|---|---:|---:|---:|");
    for (const item of category.cases) {
      lines.push(`| ${item.id} | ${item.metric} | ${item.status} | ${item.current} | ${item.gold} | ${item.score} |`);
    }
    lines.push("");
  }

  lines.push("## Priority Cases", "");
  for (const item of analysis.priority_cases) {
    lines.push(`- ${item.id}: score=${item.score}, differs=${item.differs_from_gold}, categories=${item.categories.join(", ")}`);
    lines.push(`  - ${item.recommended_next_step}`);
  }

  return `${lines.join("\n")}\n`;
}

function formatObject(value) {
  return Object.entries(value)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([key, count]) => `${key}=${count}`)
    .join(", ");
}

function printText(analysis, outputPaths) {
  console.log(`Failing cases: ${analysis.totals.failing_cases}/${analysis.totals.cases}`);
  console.log(`Failure instances: ${analysis.totals.failure_instances}`);
  for (const action of analysis.recommended_actions.slice(0, 4)) {
    console.log(`${action.priority}. ${action.label}: ${action.failure_instances} failures`);
  }
  console.log(`Analysis JSON: ${outputPaths.jsonPath}`);
  console.log(`Analysis report: ${outputPaths.markdownPath}`);
}

function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    console.log(usage());
    return;
  }
  const payload = loadGrade(args.grade);
  const analysis = analyzeGrade(payload, args);
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
  analyzeGrade,
};

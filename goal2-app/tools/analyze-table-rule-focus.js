#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");
const TABLE_METRICS = ["table", "caption", "thead", "th", "scopeCol", "scopeRow"];

const RULE_CANDIDATES = [
  {
    id: "table-preserve-data-table-before-decompose",
    label: "データ表維持判定を先に行う",
    triggers: ["table_shortage", "thead_shortage", "caption_shortage", "th_shortage", "scopeCol_shortage", "scopeRow_shortage"],
    implementation:
      "レイアウト表解体より前に、行列数、既存th、数値/項目ペア、caption候補を見てデータ表維持候補を固定する。",
  },
  {
    id: "table-upgrade-large-pages-per-table",
    label: "ページ全体の表数ではなく表単位でthead/caption/scopeを付ける",
    triggers: ["thead_shortage", "caption_shortage", "th_shortage", "scopeCol_shortage"],
    implementation:
      "現在の一括抑制(tableCount <= 8)を弱め、各表の形がデータ表なら多表ページでも個別に構造化する。",
  },
  {
    id: "table-avoid-over-upgrade-layout-groups",
    label: "見出し/リンク集/部署一覧の過剰thead化を止める",
    triggers: ["thead_excess", "caption_excess", "th_excess", "scopeRow_excess", "scopeCol_excess"],
    implementation:
      "表内にリンクだけの列、メール送信画像、部署一覧、カテゴリ見出し的な塊がある場合は、データ表化ではなく見出し+リスト/段落候補にする。",
  },
  {
    id: "table-caption-from-near-heading",
    label: "caption候補を近接見出しから安定生成する",
    triggers: ["caption_shortage"],
    implementation:
      "直前のh2/h3/h4、表直前の強調テキスト、最初の結合セルをcaption候補として採用し、汎用文言を避ける。",
  },
  {
    id: "table-scope-distribution-refinement",
    label: "scope=row/colの配分を表形状で分ける",
    triggers: ["scopeRow_excess", "scopeRow_shortage", "scopeCol_excess", "scopeCol_shortage"],
    implementation:
      "左端列が項目名ならscope=row、最上行が列見出しならscope=col。両方ある表だけ左上セルの扱いを個別調整する。",
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
    "Usage: node tools/analyze-table-rule-focus.js [options]",
    "",
    "Options:",
    "  --grade <file>       Grade JSON from agents:local-eval",
    "  --output-dir <dir>   Directory for table analysis outputs",
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

function analyzeTableRules(payload, args) {
  const failures = [];
  const cases = [];
  const metricSummary = Object.fromEntries(
    TABLE_METRICS.map((metric) => [
      metric,
      {
        total: 0,
        shortage: 0,
        excess: 0,
        regressed: 0,
        improved: 0,
        unchanged: 0,
        cases: [],
      },
    ])
  );
  const triggerCounts = {};

  for (const result of payload.results) {
    const tableFailures = (result.failures || []).filter((failure) => TABLE_METRICS.includes(failure.metric));
    if (!tableFailures.length) {
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
      failure_keys: [],
      diagnosis: "",
    };

    for (const failure of tableFailures) {
      const direction = directionForFailure(failure);
      const key = `${failure.metric}_${direction}`;
      triggerCounts[key] = (triggerCounts[key] || 0) + 1;
      caseItem.failure_keys.push(key);

      const summary = metricSummary[failure.metric];
      summary.total += 1;
      summary[direction] += 1;
      summary[failure.status] = (summary[failure.status] || 0) + 1;
      summary.cases.push(caseFailure(result, failure, direction, key));
      failures.push(caseFailure(result, failure, direction, key));
    }

    caseItem.failure_keys = [...new Set(caseItem.failure_keys)];
    caseItem.diagnosis = diagnoseCase(caseItem);
    cases.push(caseItem);
  }

  const ruleFocus = RULE_CANDIDATES.map((candidate) => {
    const triggerTotal = candidate.triggers.reduce((sum, trigger) => sum + (triggerCounts[trigger] || 0), 0);
    const matchingCases = cases.filter((item) => item.failure_keys.some((key) => candidate.triggers.includes(key)));
    return {
      ...candidate,
      trigger_total: triggerTotal,
      case_count: matchingCases.length,
      example_cases: matchingCases
        .sort((a, b) => b.differs_from_gold - a.differs_from_gold || b.regressed_metrics - a.regressed_metrics || a.score - b.score)
        .slice(0, args.top)
        .map((item) => ({
          id: item.id,
          score: item.score,
          diagnosis: item.diagnosis,
          failure_keys: item.failure_keys,
        })),
    };
  })
    .filter((candidate) => candidate.trigger_total > 0)
    .sort((a, b) => b.trigger_total - a.trigger_total || b.case_count - a.case_count);

  return {
    source_grade: args.grade,
    generated_at: new Date().toISOString(),
    totals: {
      table_failure_cases: cases.length,
      table_failure_instances: failures.length,
      regressed_instances: failures.filter((failure) => failure.status === "regressed").length,
      shortage_instances: failures.filter((failure) => failure.direction === "shortage").length,
      excess_instances: failures.filter((failure) => failure.direction === "excess").length,
    },
    metric_summary: mapMetricSummary(metricSummary, args.top),
    trigger_counts: sortObjectByValue(triggerCounts),
    rule_focus: ruleFocus,
    priority_cases: cases
      .sort((a, b) => b.differs_from_gold - a.differs_from_gold || b.regressed_metrics - a.regressed_metrics || a.score - b.score)
      .slice(0, args.top),
  };
}

function selectMetrics(metrics = {}) {
  return Object.fromEntries(TABLE_METRICS.map((metric) => [metric, metrics[metric] || 0]));
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

function diagnoseCase(item) {
  const keys = new Set(item.failure_keys);
  if (keys.has("table_excess")) {
    return "goldより表が多く残っています。レイアウト表またはグループ表を解体する候補です。";
  }
  if (keys.has("table_shortage")) {
    return "goldより表が少ない状態です。データ表を解体しすぎた可能性、または表として再構成すべき箇所があります。";
  }
  if ([...keys].some((key) => key.endsWith("_excess"))) {
    return "thead/caption/th/scopeを付けすぎています。データ表化の対象を絞る必要があります。";
  }
  if ([...keys].some((key) => key.endsWith("_shortage"))) {
    return "thead/caption/th/scopeが不足しています。データ表として構造化する表を増やす必要があります。";
  }
  return "表構造の差分を個別確認します。";
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
  const jsonPath = path.join(args.outputDir, "saga-a11y-table-rule-focus.json");
  const markdownPath = path.join(args.outputDir, "saga-a11y-table-rule-focus.md");
  fs.writeFileSync(jsonPath, JSON.stringify(analysis, null, 2), "utf8");
  fs.writeFileSync(markdownPath, renderMarkdown(analysis), "utf8");
  return { jsonPath, markdownPath };
}

function renderMarkdown(analysis) {
  const lines = [
    "# Table Rule Focus",
    "",
    `- Source grade: \`${analysis.source_grade}\``,
    `- Table failure cases: ${analysis.totals.table_failure_cases}`,
    `- Table failure instances: ${analysis.totals.table_failure_instances}`,
    `- Shortage instances: ${analysis.totals.shortage_instances}`,
    `- Excess instances: ${analysis.totals.excess_instances}`,
    `- Regressed instances: ${analysis.totals.regressed_instances}`,
    "",
    "## Rule Candidates",
    "",
  ];

  for (const item of analysis.rule_focus) {
    lines.push(`### ${item.label}`);
    lines.push("");
    lines.push(`- Rule id: \`${item.id}\``);
    lines.push(`- Trigger total: ${item.trigger_total}`);
    lines.push(`- Case count: ${item.case_count}`);
    lines.push(`- Implementation: ${item.implementation}`);
    lines.push("");
    lines.push("| Example case | Score | Diagnosis | Failure keys |");
    lines.push("|---|---:|---|---|");
    for (const example of item.example_cases) {
      lines.push(`| ${example.id} | ${example.score} | ${example.diagnosis} | ${example.failure_keys.join(", ")} |`);
    }
    lines.push("");
  }

  lines.push("## Metric Breakdown", "");
  lines.push("| Metric | Total | Shortage | Excess | Regressed | Improved | Unchanged |");
  lines.push("|---|---:|---:|---:|---:|---:|---:|");
  for (const metric of TABLE_METRICS) {
    const item = analysis.metric_summary[metric];
    lines.push(
      `| ${metric} | ${item.total} | ${item.shortage} | ${item.excess} | ${item.regressed || 0} | ${item.improved || 0} | ${item.unchanged || 0} |`
    );
  }

  lines.push("", "## Priority Cases", "");
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
  return TABLE_METRICS.map((metric) => `${metric}:${metrics[metric]}`).join("<br>");
}

function printText(analysis, outputPaths) {
  console.log(`Table failure cases: ${analysis.totals.table_failure_cases}`);
  console.log(`Table failure instances: ${analysis.totals.table_failure_instances}`);
  console.log(`Shortage instances: ${analysis.totals.shortage_instances}`);
  console.log(`Excess instances: ${analysis.totals.excess_instances}`);
  analysis.rule_focus.slice(0, 5).forEach((item, index) => {
    console.log(`${index + 1}. ${item.label}: triggers=${item.trigger_total}, cases=${item.case_count}`);
  });
  console.log(`Table focus JSON: ${outputPaths.jsonPath}`);
  console.log(`Table focus report: ${outputPaths.markdownPath}`);
}

function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    console.log(usage());
    return;
  }
  const payload = loadGrade(args.grade);
  const analysis = analyzeTableRules(payload, args);
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
  analyzeTableRules,
};

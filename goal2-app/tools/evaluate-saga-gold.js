#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const {
  STRUCTURAL_KEYS,
  autoFixHtml,
  collectMetrics,
  compareHtml,
  defaultSagaFixtureRoot,
} = require("../lib/sagaAutoFix");

const rootDir = path.resolve(__dirname, "..");

function parseArgs(argv) {
  const args = {
    fixtureRoot: defaultSagaFixtureRoot(rootDir),
    outputDir: path.join(rootDir, "tmp", "saga-gold-output"),
    writeOutput: false,
    json: false,
  };

  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--fixture-root") {
      args.fixtureRoot = path.resolve(argv[++index]);
    } else if (arg === "--output-dir") {
      args.outputDir = path.resolve(argv[++index]);
    } else if (arg === "--write-output") {
      args.writeOutput = true;
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
    "Usage: node tools/evaluate-saga-gold.js [options]",
    "",
    "Options:",
    "  --fixture-root <dir>  Directory with old/ and gold/ fixtures",
    "  --write-output        Write transformed HTML files to tmp/saga-gold-output",
    "  --output-dir <dir>    Output directory when --write-output is set",
    "  --json                Print JSON instead of a text summary",
  ].join("\n");
}

function readText(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function htmlFiles(directory) {
  return fs
    .readdirSync(directory)
    .filter((name) => name.toLowerCase().endsWith(".html"))
    .sort();
}

function evaluateFixture(fixtureRoot, options = {}) {
  const oldDir = path.join(fixtureRoot, "old");
  const goldDir = path.join(fixtureRoot, "gold");
  const files = htmlFiles(oldDir).filter((name) => fs.existsSync(path.join(goldDir, name)));
  const results = [];
  const totals = {
    files: files.length,
    baselineSimilarity: 0,
    currentSimilarity: 0,
    improvedMetrics: 0,
    regressedMetrics: 0,
    matchesGold: 0,
    differsFromGold: 0,
    improvedFiles: 0,
    regressedFiles: 0,
    exactStructuralMatches: 0,
  };
  const metricSummary = Object.fromEntries(
    STRUCTURAL_KEYS.map((key) => [key, { matchesGold: 0, improved: 0, regressed: 0, differsFromGold: 0 }])
  );

  if (options.writeOutput) {
    fs.mkdirSync(options.outputDir, { recursive: true });
  }

  for (const file of files) {
    const oldHtml = readText(path.join(oldDir, file));
    const goldHtml = readText(path.join(goldDir, file));
    const currentHtml = autoFixHtml(oldHtml);
    const comparison = compareHtml(currentHtml, goldHtml, oldHtml);
    const oldMetrics = collectMetrics(oldHtml);
    const currentMetrics = collectMetrics(currentHtml);
    const goldMetrics = collectMetrics(goldHtml);

    if (options.writeOutput) {
      fs.writeFileSync(path.join(options.outputDir, file), currentHtml, "utf8");
    }

    totals.baselineSimilarity += comparison.baselineSimilarity;
    totals.currentSimilarity += comparison.currentSimilarity;
    totals.improvedMetrics += comparison.improved;
    totals.regressedMetrics += comparison.regressed;
    totals.matchesGold += comparison.matchesGold;
    totals.differsFromGold += comparison.differsFromGold;
    if (comparison.similarityDelta > 0.0001 || comparison.improved > comparison.regressed) totals.improvedFiles += 1;
    if (comparison.similarityDelta < -0.0001 || comparison.regressed > comparison.improved) totals.regressedFiles += 1;
    if (comparison.differsFromGold === 0) totals.exactStructuralMatches += 1;

    for (const key of STRUCTURAL_KEYS) {
      const status = comparison.metrics[key].status;
      if (status === "matches_gold") metricSummary[key].matchesGold += 1;
      if (status === "improved") metricSummary[key].improved += 1;
      if (status === "regressed") metricSummary[key].regressed += 1;
      if (status !== "matches_gold") metricSummary[key].differsFromGold += 1;
    }

    results.push({
      file,
      baselineSimilarity: round(comparison.baselineSimilarity),
      currentSimilarity: round(comparison.currentSimilarity),
      similarityDelta: round(comparison.similarityDelta),
      improved: comparison.improved,
      regressed: comparison.regressed,
      matchesGold: comparison.matchesGold,
      differsFromGold: comparison.differsFromGold,
      oldMetrics,
      currentMetrics,
      goldMetrics,
      metrics: comparison.metrics,
    });
  }

  return {
    fixtureRoot,
    outputDir: options.writeOutput ? options.outputDir : null,
    totals: {
      ...totals,
      averageBaselineSimilarity: round(totals.baselineSimilarity / Math.max(1, totals.files)),
      averageCurrentSimilarity: round(totals.currentSimilarity / Math.max(1, totals.files)),
      averageSimilarityDelta: round(
        (totals.currentSimilarity - totals.baselineSimilarity) / Math.max(1, totals.files)
      ),
    },
    metricSummary,
    worstFiles: [...results].sort((a, b) => b.differsFromGold - a.differsFromGold || a.currentSimilarity - b.currentSimilarity).slice(0, 10),
    results,
  };
}

function round(value) {
  return Math.round(Number(value || 0) * 10000) / 10000;
}

function printTextReport(report) {
  const { totals } = report;
  console.log(`Saga fixture root: ${report.fixtureRoot}`);
  console.log(`Files: ${totals.files}`);
  console.log(`Average text similarity: ${totals.averageBaselineSimilarity} -> ${totals.averageCurrentSimilarity} (${formatDelta(totals.averageSimilarityDelta)})`);
  console.log(`Structural metric matches: ${totals.matchesGold}`);
  console.log(`Structural metric differs: ${totals.differsFromGold}`);
  console.log(`Improved metric cases: ${totals.improvedMetrics}`);
  console.log(`Regressed metric cases: ${totals.regressedMetrics}`);
  console.log(`Improved files: ${totals.improvedFiles}`);
  console.log(`Regressed files: ${totals.regressedFiles}`);
  console.log(`Exact structural matches: ${totals.exactStructuralMatches}`);
  if (report.outputDir) {
    console.log(`Output: ${report.outputDir}`);
  }

  console.log("\nMetric summary:");
  for (const key of STRUCTURAL_KEYS) {
    const metric = report.metricSummary[key];
    console.log(
      `  ${key.padEnd(10)} matches=${String(metric.matchesGold).padStart(2)} improved=${String(metric.improved).padStart(2)} regressed=${String(metric.regressed).padStart(2)} differs=${String(metric.differsFromGold).padStart(2)}`
    );
  }

  console.log("\nWorst files:");
  for (const result of report.worstFiles) {
    console.log(
      `  ${result.file} similarity=${result.currentSimilarity} delta=${formatDelta(result.similarityDelta)} differs=${result.differsFromGold} improved=${result.improved} regressed=${result.regressed}`
    );
  }
}

function formatDelta(value) {
  return value >= 0 ? `+${round(value)}` : String(round(value));
}

function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    console.log(usage());
    return;
  }
  const report = evaluateFixture(args.fixtureRoot, args);
  if (args.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    printTextReport(report);
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
  evaluateFixture,
};

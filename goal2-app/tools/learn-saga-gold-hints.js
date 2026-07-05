#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const {
  formatMarkdownReport,
  formatTextReport,
  learnSagaGoldHints,
} = require("../lib/sagaGoldHints");
const { defaultSagaFixtureRoot } = require("../lib/sagaAutoFix");

const rootDir = path.resolve(__dirname, "..");

function parseArgs(argv) {
  const args = {
    fixtureRoot: defaultSagaFixtureRoot(rootDir),
    json: false,
    writeOutput: false,
    outputDir: path.join(rootDir, "tmp"),
    limit: 24,
  };

  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--fixture-root") {
      args.fixtureRoot = path.resolve(argv[++index]);
    } else if (arg === "--json") {
      args.json = true;
    } else if (arg === "--write-output") {
      args.writeOutput = true;
    } else if (arg === "--output-dir") {
      args.outputDir = path.resolve(argv[++index]);
    } else if (arg === "--limit") {
      args.limit = Number(argv[++index] || args.limit);
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
    "Usage: node tools/learn-saga-gold-hints.js [options]",
    "",
    "Options:",
    "  --fixture-root <dir>  Directory with old/ and gold/ fixtures",
    "  --json                Print JSON instead of a text summary",
    "  --write-output        Write JSON and Markdown reports to tmp/",
    "  --output-dir <dir>    Output directory when --write-output is set",
    "  --limit <number>      Number of examples to print/write",
  ].join("\n");
}

function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    console.log(usage());
    return;
  }

  const report = learnSagaGoldHints(args.fixtureRoot, { limit: args.limit });
  if (args.writeOutput) {
    fs.mkdirSync(args.outputDir, { recursive: true });
    fs.writeFileSync(path.join(args.outputDir, "saga-gold-hints.json"), JSON.stringify(report, null, 2), "utf8");
    fs.writeFileSync(
      path.join(args.outputDir, "saga-gold-hints.md"),
      formatMarkdownReport(report, { limit: args.limit }),
      "utf8"
    );
  }

  if (args.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(formatTextReport(report, { limit: args.limit }));
    if (args.writeOutput) {
      console.log(`Output: ${args.outputDir}`);
    }
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

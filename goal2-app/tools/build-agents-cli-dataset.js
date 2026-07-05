#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const { defaultSagaFixtureRoot, visibleText } = require("../lib/sagaAutoFix");

const rootDir = path.resolve(__dirname, "..");

function parseArgs(argv) {
  const args = {
    fixtureRoot: defaultSagaFixtureRoot(rootDir),
    output: path.join(rootDir, "agents-cli", "datasets", "saga-a11y-eval.jsonl"),
    limit: 0,
    pretty: false,
  };

  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--fixture-root") {
      args.fixtureRoot = path.resolve(argv[++index]);
    } else if (arg === "--output") {
      args.output = path.resolve(argv[++index]);
    } else if (arg === "--limit") {
      args.limit = Number(argv[++index]);
    } else if (arg === "--pretty") {
      args.pretty = true;
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
    "Usage: node tools/build-agents-cli-dataset.js [options]",
    "",
    "Options:",
    "  --fixture-root <dir>  Directory with old/ and gold/ fixtures",
    "  --output <file>       Output JSONL file",
    "  --limit <n>           Limit number of cases",
    "  --pretty              Also write a formatted .json preview",
  ].join("\n");
}

function htmlFiles(directory) {
  return fs
    .readdirSync(directory)
    .filter((name) => name.toLowerCase().endsWith(".html"))
    .sort();
}

function readText(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function buildCase(file, oldHtml, goldHtml) {
  return {
    id: `saga-city/${file}`,
    task: "a11y_content_migration_html_rewrite",
    prompt: [
      "旧CMS由来の本文HTMLを、公共団体CMS移行用のアクセシビリティ修正済みHTMLへ変換してください。",
      "ヘッダー、ナビゲーション、フッターなどテンプレート共通部品は対象外です。",
      "行政情報の意味、固有名詞、数値、問い合わせ先を不用意に変更しないでください。",
      "判断が必要な内容は確定せず、証跡で人間確認に回してください。",
    ].join("\n"),
    input: {
      old_html: oldHtml,
    },
    expected: {
      gold_html: goldHtml,
    },
    metadata: {
      municipality: "saga-city",
      source_file: file,
      content_scope: "cms-body",
      old_text_length: visibleText(oldHtml).length,
      gold_text_length: visibleText(goldHtml).length,
      evaluation_focus: [
        "heading_structure",
        "table_semantics",
        "image_alt",
        "weak_link_text",
        "pseudo_list",
        "date_weekday_unit_notation",
      ],
    },
  };
}

function buildDataset(args) {
  const oldDir = path.join(args.fixtureRoot, "old");
  const goldDir = path.join(args.fixtureRoot, "gold");
  const files = htmlFiles(oldDir).filter((name) => fs.existsSync(path.join(goldDir, name)));
  const selectedFiles = args.limit > 0 ? files.slice(0, args.limit) : files;
  return selectedFiles.map((file) => buildCase(file, readText(path.join(oldDir, file)), readText(path.join(goldDir, file))));
}

function writeDataset(cases, args) {
  fs.mkdirSync(path.dirname(args.output), { recursive: true });
  const jsonl = cases.map((item) => JSON.stringify(item)).join("\n");
  fs.writeFileSync(args.output, `${jsonl}\n`, "utf8");
  if (args.pretty) {
    fs.writeFileSync(args.output.replace(/\.jsonl$/i, ".json"), JSON.stringify(cases, null, 2), "utf8");
  }
}

function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    console.log(usage());
    return;
  }
  const cases = buildDataset(args);
  writeDataset(cases, args);
  console.log(`Wrote ${cases.length} eval cases to ${args.output}`);
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
  buildDataset,
};

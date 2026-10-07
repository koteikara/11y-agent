#!/usr/bin/env node
// 一括処理。ディレクターの PC で、Claude Code に頼んで動かす(docs/renewal/ARCHITECTURE.md)。
//
//   node batch/cli.js crawl   <案件のフォルダ> [--start URL,URL] [--restart]  巡回(ページの一覧づくり)
//   node batch/cli.js fetch   <案件のフォルダ> [--ids ID,ID] [--reinspect]  取得(ページの台帳を書く)
//                                                                  --reinspect: 取り直さずに、保存した旧ページを調べ直す
//   node batch/cli.js group   <案件のフォルダ>                      型のまとめ(本文の範囲の案)
//   node batch/cli.js approve <案件のフォルダ> <型の番号> --by <名前> [--selector <CSS>]
//                                                                  型の本文の範囲を承認する(校正台ができるまでの代わり)
//   node batch/cli.js process <案件のフォルダ> [--ids ID,ID] [--force]  本処理(候補と確認の深さ)
//   node batch/cli.js status  <案件のフォルダ>                      数だけを見せる
//
// 画面と実行の記録には、件数、移行管理 ID、理由だけを出す。旧サイトの本文や HTML は出さない
// (本文を Anthropic に送らないため)。
const fs = require("fs");
const path = require("path");
const { openProject } = require("./lib/project");
const { startEngine } = require("./lib/engine-host");
const { runFetch } = require("./commands/fetch");
const { runCrawl } = require("./commands/crawl");
const { runGroup } = require("./commands/group");
const { runProcess } = require("./commands/process");
const { writeSummary, DEPTH_LABELS } = require("./lib/summary");
const { writeMetrics } = require("./lib/metrics");

const RULES_JSONL = path.resolve(__dirname, "..", "data", "rules.jsonl");

function parseArgs(argv) {
  const positional = [];
  const options = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith("--")) {
        options[key] = next;
        i += 1;
      } else {
        options[key] = true;
      }
    } else {
      positional.push(arg);
    }
  }
  return { positional, options };
}

function loadRuleClasses() {
  const classes = new Map();
  for (const line of fs.readFileSync(RULES_JSONL, "utf8").split(/\r?\n/)) {
    if (!line.trim()) continue;
    const rule = JSON.parse(line);
    classes.set(rule.id, rule.processing_class);
  }
  return classes;
}

function usage() {
  return fs
    .readFileSync(__filename, "utf8")
    .split(/\r?\n/)
    .filter((line) => line.startsWith("//   "))
    .map((line) => line.slice(2))
    .join("\n");
}

async function main() {
  const { positional, options } = parseArgs(process.argv.slice(2));
  const [command, projectDir, ...rest] = positional;
  if (!command || !projectDir) {
    console.error(usage());
    process.exit(2);
  }
  const project = openProject(projectDir);
  const report = (line) => console.log(line);
  const ids = typeof options.ids === "string" ? options.ids.split(",").map((id) => id.trim()).filter(Boolean) : null;

  if (command === "status") {
    const counts = writeSummary(project);
    const statusSettings = project.readSettings();
    writeMetrics(project, { reviewHoursPerDay: statusSettings.review.hoursPerDay, availableDays: statusSettings.review.availableDays });
    report(`ページ ${counts.pages}、取得できた ${counts.fetched}、取得できない ${counts.fetchFailed}、本処理済み ${counts.processed}`);
    report(`  ${Object.entries(counts.depth).map(([depth, n]) => `${DEPTH_LABELS[depth]} ${n}`).join("、")}`);
    return;
  }

  if (command === "approve") {
    const [templateId] = rest;
    if (!templateId || typeof options.by !== "string") {
      console.error("approve には、型の番号と --by <名前> が要る");
      process.exit(2);
    }
    const templates = project.readJson(project.paths.templates);
    const template = [...(templates?.templates || []), ...(templates?.smallTemplates || [])].find((t) => t.templateId === templateId);
    if (!template) throw new Error(`型のまとめの結果に無い型の番号: ${templateId}`);
    const selector = typeof options.selector === "string" ? options.selector : template.approvedSelector || template.proposedSelector;
    if (!selector) throw new Error("本文の範囲の案が無いので、--selector で指定する");
    if (!Array.isArray(template.paths) || templates.structureVersion == null) {
      throw new Error("型のまとめの結果が古い(代表の構造が無い)。group を動かし直してから承認する");
    }
    // 代表の構造も一緒に入れる。本処理は、ページの構造をこれと比べて、承認した型に当たるかを決める。
    project.updateSettings(
      (settings) => {
        settings.templates.approved[templateId] = {
          selector,
          paths: template.paths,
          structureVersion: templates.structureVersion,
          approvedAt: new Date().toISOString(),
          approvedBy: options.by,
        };
      },
      { actor: options.by, tool: "batch approve", note: `型 ${templateId} の本文の範囲を承認(${template.pageCount} ページ)` }
    );
    report(`承認した: 型 ${templateId}(${template.pageCount} ページ)`);
    return;
  }

  if (!["crawl", "fetch", "group", "process"].includes(command)) {
    console.error(`知らないコマンド: ${command}\n${usage()}`);
    process.exit(2);
  }
  const settings = project.readSettings();
  const log = project.openLog(command);
  const engine = await startEngine({ ai: settings.ai.enabled });
  try {
    if (command === "crawl") {
      const startUrls = typeof options.start === "string" ? options.start.split(",").map((url) => url.trim()).filter(Boolean) : null;
      await runCrawl(project, { engine, startUrls, restart: Boolean(options.restart), log, report });
    } else if (command === "fetch") {
      await runFetch(project, { engine, ids, reinspect: Boolean(options.reinspect), log, report });
    } else if (command === "group") {
      await runGroup(project, { engine, log, report });
    } else if (command === "process") {
      await runProcess(project, { engine, ids, force: Boolean(options.force), log, report, ruleClasses: loadRuleClasses() });
      if (engine.usage.aiCalls || engine.usage.aiBlocked) {
        report(`  AI の呼び出し ${engine.usage.aiCalls} 回${engine.usage.aiBlocked ? `(設定で止めた ${engine.usage.aiBlocked} 回)` : ""}`);
      }
    }
  } finally {
    await engine.close();
  }
  report(`実行の記録: ${path.relative(project.root, log.file)}`);
}

main().catch((error) => {
  console.error(`止まった: ${error.message}`);
  process.exit(1);
});

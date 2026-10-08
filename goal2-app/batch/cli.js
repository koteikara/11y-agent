#!/usr/bin/env node
// 一括処理。ディレクターの PC で、Claude Code に頼んで動かす(docs/renewal/ARCHITECTURE.md)。
//
//   node batch/cli.js crawl   <案件のフォルダ> [--start URL,URL] [--restart]  巡回(ページの一覧づくり)
//   node batch/cli.js patterns <案件のフォルダ> [--under URL]       コンテンツパターン(サブサイトの候補)を xlsx に出す
//                                                                  --under: その URL の下のページだけで見る(patterns-<名前>.xlsx)。
//                                                                  末尾の / やホスト名の大文字は問わない
//   node batch/cli.js sheet   <案件のフォルダ>                      移行管理シートの下書きを xlsx に出す(巡回の結果から)
//   node batch/cli.js category <案件のフォルダ>                     カテゴリ割当の案を xlsx に出す(sheet のあと)
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
// Node はファイルの読み書きと DNS の問い合わせを、同じ裏の作業の枠(既定は4本)で処理する。共有ドライブへの
// 書き込みが多いと枠がふさがり、DNS の問い合わせが時間切れになるので、枠を増やす(最初の非同期の処理より前に決める)。
process.env.UV_THREADPOOL_SIZE = process.env.UV_THREADPOOL_SIZE || "16";
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");
const { openProject, withWriteRetry, sleepSync } = require("./lib/project");
const { startEngine } = require("./lib/engine-host");
const { runFetch } = require("./commands/fetch");
const { runCrawl, normalizeUrl } = require("./commands/crawl");
const { runPatterns } = require("./commands/patterns");
const { runSheet } = require("./commands/sheet");
const { runCategory } = require("./commands/category");
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

// 巡回の記録から、URL と題名の対応を作る(転送先の URL でも引けるようにする)。巡回していなければ空。
function loadCrawlTitles(project) {
  const titles = new Map();
  const file = path.join(project.root, "crawl", "records.jsonl");
  if (!fs.existsSync(file)) return titles;
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    if (!line.trim()) continue;
    const record = JSON.parse(line);
    if (record.kind !== "page" || !record.ok || !record.title) continue;
    titles.set(record.url, record.title);
    if (record.finalUrl) titles.set(record.finalUrl, record.title);
  }
  return titles;
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

  if (!["crawl", "patterns", "sheet", "category", "fetch", "group", "process"].includes(command)) {
    console.error(`知らないコマンド: ${command}\n${usage()}`);
    process.exit(2);
  }
  const releaseLock = acquireLock(project, command);
  try {
    await runCommand(project, command, options, ids, report);
  } finally {
    releaseLock();
  }
}

// 同じ案件のフォルダで、書き込むコマンドを2つ同時に動かさない。ログインし直したあとに巡回が2つ重なり、
// 同じファイルに書いて止まった(大阪市の学校のサイト)。印のファイルに、この PC の名前と動いているプロセスの
// 番号を書く。その番号のプロセスがもう無ければ、前の実行が途中で終わったものとみなし、印を消して作り直す。
// 作るのも消すのも1つのプロセスしか勝てない操作なので、2つが同時に引き継ぐことはない。
const LOCK_ATTEMPTS = 5;
const LOCK_READ_WAIT_MS = 1000;

function acquireLock(project, command) {
  const lockFile = path.join(project.root, "run.lock");
  const mine = JSON.stringify({ pid: process.pid, host: os.hostname(), command, startedAt: new Date().toISOString() });
  const shown = path.relative(process.cwd(), lockFile);
  for (let attempt = 0; attempt < LOCK_ATTEMPTS; attempt += 1) {
    try {
      withWriteRetry(() => fs.writeFileSync(lockFile, mine, { flag: "wx" }));
      return () => releaseLock(lockFile);
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
    }
    const other = readLock(lockFile);
    if (other === undefined) continue; // 読むあいだに消えた。もう一度作る。
    if (other?.host && other.host !== os.hostname()) {
      throw new Error(`この案件のフォルダには、別の PC(${other.host})のコマンドの印がある。そちらが終わっていれば ${shown} を消す`);
    }
    if (other?.pid && other.pid !== process.pid && isRunningNode(other.pid)) {
      throw new Error(
        `この案件のフォルダでは、ほかのコマンド(${other.command}、プロセス ${other.pid})が動いている。終わってから動かす` +
          `(動いていないのが確かなら ${shown} を消す)`
      );
    }
    try {
      withWriteRetry(() => fs.unlinkSync(lockFile));
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }
  throw new Error(`この案件のフォルダの印(${shown})を作れなかった。ほかのコマンドが同時に始まったかもしれない`);
}

// 印を読む。消えていれば undefined。中身が空や書きかけなら、作った直後で書き途中のこともあるので、
// 少し待って読み直す。それでも読めなければ、前の実行が書きかけで終わったものとみなす(null)。
function readLock(lockFile) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    let text;
    try {
      text = fs.readFileSync(lockFile, "utf8");
    } catch (error) {
      if (error.code === "ENOENT") return undefined;
      throw error;
    }
    try {
      return JSON.parse(text);
    } catch {
      sleepSync(LOCK_READ_WAIT_MS);
    }
  }
  return null;
}

function releaseLock(lockFile) {
  try {
    if (JSON.parse(fs.readFileSync(lockFile, "utf8")).pid === process.pid) fs.unlinkSync(lockFile);
  } catch {
    // 消せなくても、次の実行がプロセスの番号で引き継ぐ。
  }
}

// そのプロセスが動いていて、Node のプロセスかを見る。Windows はプロセスの番号をすぐ使い回すので、
// 番号が生きているだけでは、前のコマンドとは限らない(ほかのアプリが同じ番号を取ることがある)。
function isRunningNode(pid) {
  try {
    process.kill(pid, 0);
  } catch (error) {
    if (error.code !== "EPERM") return false;
  }
  if (process.platform !== "win32") return true;
  try {
    const out = execFileSync("tasklist", ["/FI", `PID eq ${pid}`, "/FO", "CSV", "/NH"], { encoding: "utf8", windowsHide: true });
    return /"node(.exe)?"/i.test(out);
  } catch {
    return true;
  }
}

async function runCommand(project, command, options, ids, report) {
  const settings = project.readSettings();
  const log = project.openLog(command);
  // 本処理は、リンク先の題名を、巡回で取ったページの題名から引く。無いものだけを、間隔を空けて取りに行く。
  const crawlTitles = command === "process" ? loadCrawlTitles(project) : null;
  // 巡回の中で見つけた外す項目(?tm= など)も使って、URL を整えてから引く。
  const crawlState = project.readJson(path.join(project.root, "crawl", "state.json"), {}) || {};
  const titleIgnoreParams = [...settings.crawl.ignoreParams, ...(crawlState.learnedIgnoreParams || [])];
  const engine = await startEngine({
    ai: settings.ai.enabled,
    lookupTitle: crawlTitles ? (url) => crawlTitles.get(normalizeUrl(url, titleIgnoreParams) || url) || null : null,
    linkTitleIntervalMs: settings.fetch.intervalMs,
    // 旧サイトへ取りに行かず、手元の写しを調べるだけのコマンドは、エンジンのページを増やして並べる。
    workers: ["sheet", "patterns"].includes(command) ? Math.max(1, Math.min(4, os.cpus().length - 1)) : 1,
  });
  try {
    if (command === "crawl") {
      const startUrls = typeof options.start === "string" ? options.start.split(",").map((url) => url.trim()).filter(Boolean) : null;
      await runCrawl(project, { engine, startUrls, restart: Boolean(options.restart), log, report });
    } else if (command === "patterns") {
      // --under の URL を書き忘れたときに、全体の一覧を書き換えないよう止める。
      if (options.under === true) throw new Error("--under には URL を書く(例: --under https://example.jp/school1/)");
      await runPatterns(project, { engine, log, report, under: typeof options.under === "string" ? options.under : null });
    } else if (command === "sheet") {
      await runSheet(project, { engine, log, report });
    } else if (command === "category") {
      await runCategory(project, { log, report });
    } else if (command === "fetch") {
      await runFetch(project, { engine, ids, reinspect: Boolean(options.reinspect), log, report });
    } else if (command === "group") {
      await runGroup(project, { engine, log, report });
    } else if (command === "process") {
      await runProcess(project, { engine, ids, force: Boolean(options.force), log, report, ruleClasses: loadRuleClasses() });
      if (engine.usage.linkTitleLookups || engine.usage.linkTitleFromCrawl) {
        report(`  リンク先の題名: 巡回の結果から ${engine.usage.linkTitleFromCrawl} 件、取りに行った ${engine.usage.linkTitleLookups} 件`);
      }
      if (engine.usage.aiCalls || engine.usage.aiBlocked) {
        report(`  AI の呼び出し ${engine.usage.aiCalls} 回${engine.usage.aiBlocked ? `(設定で止めた ${engine.usage.aiBlocked} 回)` : ""}`);
      }
    }
  } finally {
    await engine.close();
    // 裏で書いているファイルと、ためている実行の記録を書き終える。書き終えられなくても、
    // コマンドが投げたエラーを隠さないよう、ここでは画面に出すだけにする。
    try {
      await project.flush();
    } catch (error) {
      console.error(`書き終えられなかった: ${error.message}`);
      process.exitCode = 1;
    }
  }
  report(`実行の記録: ${path.relative(project.root, log.file)}`);
}

main().catch((error) => {
  console.error(`止まった: ${error.message}`);
  process.exit(1);
});

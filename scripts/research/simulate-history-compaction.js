#!/usr/bin/env node
// Claude Code の会話記録（~/.claude/projects/<project>/<session>.jsonl）に、
// 「エージェント履歴を関連度スコアで圧縮する」の保持規則を当てはめ、削減量と入力費用を試算する。
//
// - 関連度の判定器（Jev など）は呼ばない。代わりに規則ベースの判定で 3 段階
//   （keep／call-only／drop）に振り分ける。判定器を入れた場合の上限の目安として使う。
// - 費用は、プロンプトキャッシュを前提に、ベース単価を 1 とした相対値で出す
//   （キャッシュ読み 0.1、キャッシュ書き 1.25）。
// - トークン数は文字数からの概算である（ASCII 4 文字で 1、ASCII 以外は 1 文字で 1）。
//
// 使い方:
//   node scripts/research/simulate-history-compaction.js <session.jsonl> [--keep-last 10]
//     [--trigger 60000] [--min-reduction 20] [--json]
//   node scripts/research/simulate-history-compaction.js --scenario
"use strict";

const fs = require("fs");

const args = process.argv.slice(2);
const opts = { keepLast: 10, trigger: 60000, minReductionPct: 20, json: false, files: [] };
for (let i = 0; i < args.length; i += 1) {
  if (args[i] === "--keep-last") opts.keepLast = Number(args[++i]);
  else if (args[i] === "--trigger") opts.trigger = Number(args[++i]);
  else if (args[i] === "--min-reduction") opts.minReductionPct = Number(args[++i]);
  else if (args[i] === "--json") opts.json = true;
  else if (args[i] === "--scenario") opts.scenario = true;
  else opts.files.push(args[i]);
}
if (opts.files.length === 0 && !args.includes("--scenario")) {
  console.error("usage: simulate-history-compaction.js <session.jsonl>... [--keep-last N] [--trigger TOKENS] [--json]");
  process.exit(2);
}

const PRICE = { base: 1, cacheRead: 0.1, cacheWrite: 1.25 };
const TRUNCATED_RESULT_CHARS = 300;

function estimateTokens(text) {
  let ascii = 0;
  let other = 0;
  for (const ch of text) {
    if (ch.charCodeAt(0) < 128) ascii += 1;
    else other += 1;
  }
  return Math.ceil(ascii / 4) + other;
}

function blockText(block) {
  if (typeof block === "string") return block;
  if (block.type === "text") return block.text || "";
  if (block.type === "thinking") return ""; // 過去ターンの thinking は API 側で落ちるので数えない
  if (block.type === "tool_use") return `${block.name} ${JSON.stringify(block.input || {})}`;
  if (block.type === "tool_result") {
    const c = block.content;
    if (typeof c === "string") return c;
    if (Array.isArray(c)) return c.map((x) => (x.type === "text" ? x.text : "[image]")).join("\n");
    return "";
  }
  return "";
}

// 会話記録を API に送る順のメッセージ列に直す。attachment などは数えない。
function loadMessages(file) {
  const messages = [];
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    if (!line.trim()) continue;
    let d;
    try {
      d = JSON.parse(line);
    } catch {
      continue;
    }
    if (d.type !== "user" && d.type !== "assistant") continue;
    const m = d.message;
    if (!m) continue;
    const blocks = typeof m.content === "string" ? [{ type: "text", text: m.content }] : m.content || [];
    messages.push({ role: d.type, blocks });
  }
  return messages;
}

const IRREVERSIBLE = /\bgit\s+push\b|\bgit\s+commit\b|\brm\s+-|create_pull_request|add_issue_comment|pull_request_review_write|merge_pull_request|create_or_update_file|push_files|delete_file|Artifact|send_message/i;
const SEARCH_TOOLS = new Set(["Grep", "Glob", "WebSearch", "WebFetch", "ToolSearch"]);

function isErrorResult(block, text) {
  return block.is_error === true || /^Exit code [1-9]/m.test(text) || /<tool_use_error>/.test(text);
}

// 1 つの tool_use／tool_result の組を、keep／call-only／drop のどれにするか決める。
function judgePair(pair, later) {
  const { use, result, resultText } = pair;
  const input = use.input || {};
  const callText = JSON.stringify(input);
  if (IRREVERSIBLE.test(`${use.name} ${callText}`)) return { level: "keep", reason: "irreversible" };
  if (result && isErrorResult(result, resultText)) return { level: "keep", reason: "error" };
  if (use.name === "Read" && input.file_path) {
    const reread = later.some((p) => ["Read", "Edit", "Write"].includes(p.use.name) && (p.use.input || {}).file_path === input.file_path);
    if (reread) return { level: "call-only", reason: "superseded-read" };
  }
  if (use.name === "Edit" || use.name === "Write") return { level: "call-only", reason: "edit-ack" };
  if (SEARCH_TOOLS.has(use.name)) return { level: "call-only", reason: "search-result" };
  if (use.name === "Bash" && resultText.length > 2000) return { level: "call-only", reason: "long-log" };
  if (use.name === "Agent") return { level: "keep", reason: "subagent-report" };
  if (resultText.length <= TRUNCATED_RESULT_CHARS) return { level: "keep", reason: "short" };
  return { level: "keep", reason: "default" };
}

function compact(messages, keepLast) {
  const pairs = new Map();
  messages.forEach((m, mi) => {
    for (const b of m.blocks) {
      if (b.type === "tool_use") pairs.set(b.id, { use: b, useIndex: mi, result: null, resultText: "", resultIndex: -1 });
    }
  });
  messages.forEach((m, mi) => {
    for (const b of m.blocks) {
      if (b.type === "tool_result" && pairs.has(b.tool_use_id)) {
        const p = pairs.get(b.tool_use_id);
        p.result = b;
        p.resultText = blockText(b);
        p.resultIndex = mi;
      }
    }
  });
  const pinnedFrom = Math.max(1, messages.length - keepLast);
  const ordered = [...pairs.values()].sort((a, b) => a.useIndex - b.useIndex);
  const decisions = new Map();
  const counts = { keep: 0, "call-only": 0, drop: 0, pinned: 0 };
  const reasons = {};
  ordered.forEach((p, i) => {
    // 最初のメッセージと直近 keepLast 件にかかる組は判定しない（固定）。
    if (p.useIndex === 0 || p.useIndex >= pinnedFrom || p.resultIndex >= pinnedFrom || p.resultIndex < 0) {
      counts.pinned += 1;
      return;
    }
    const d = judgePair(p, ordered.slice(i + 1));
    decisions.set(p.use.id, d.level);
    counts[d.level] += 1;
    reasons[d.reason] = (reasons[d.reason] || 0) + 1;
  });
  // call-only は結果を先頭 300 文字と省略の印に置き換える。drop は組ごと外す。
  // 利用者とアシスタントの文章は変えず、順序も保つ。
  const out = messages.map((m) => ({
    role: m.role,
    blocks: m.blocks
      .filter((b) => !((b.type === "tool_use" && decisions.get(b.id) === "drop") || (b.type === "tool_result" && decisions.get(b.tool_use_id) === "drop")))
      .map((b) => {
        if (b.type === "tool_result" && decisions.get(b.tool_use_id) === "call-only") {
          const t = blockText(b);
          if (t.length <= TRUNCATED_RESULT_CHARS) return b;
          return { type: "tool_result", tool_use_id: b.tool_use_id, content: `${t.slice(0, TRUNCATED_RESULT_CHARS)}\n[…${t.length - TRUNCATED_RESULT_CHARS} 文字を省略。必要なら同じ条件で取り直す]` };
        }
        return b;
      }),
  }));
  return { messages: out, counts, reasons, judged: decisions.size };
}

function messageTokens(m) {
  return m.blocks.reduce((s, b) => s + estimateTokens(blockText(b)), 0);
}

// アシスタントの 1 ターン = API 呼び出し 1 回として、入力費用を足し上げる。
// ベースライン: 前回までの履歴はキャッシュ読み、新しく増えた分はキャッシュ書き。
// 圧縮あり: 履歴が trigger を超えた最初の呼び出しで一度だけ圧縮し、その回は全体をキャッシュ書きする。
function simulateCost(messages, keepLast, trigger, minReductionPct) {
  const tok = messages.map(messageTokens);
  const callPoints = [];
  messages.forEach((m, i) => {
    if (m.role === "assistant" && (i === 0 || messages[i - 1].role !== "assistant")) callPoints.push(i);
  });
  let baseline = 0;
  let prev = 0;
  const prefix = (n) => tok.slice(0, n).reduce((a, b) => a + b, 0);
  for (const i of callPoints) {
    const ctx = prefix(i);
    baseline += prev * PRICE.cacheRead + (ctx - prev) * PRICE.cacheWrite;
    prev = ctx;
  }
  let pruned = 0;
  prev = 0;
  let compactedAt = -1;
  let savedTokens = 0;
  let compactStats = null;
  let keptTokens = 0;
  let rejected = 0;
  for (const i of callPoints) {
    let ctx = prefix(i);
    if (compactedAt < 0 && ctx > trigger) {
      const r = compact(messages.slice(0, i), keepLast);
      const newCtx = r.messages.reduce((s, m) => s + messageTokens(m), 0);
      // 削減が小さいときは圧縮結果を採らず元の履歴で続ける（キャッシュも壊さない）。次の呼び出しで再判定する。
      if (100 * (1 - newCtx / ctx) < minReductionPct) {
        rejected += 1;
        pruned += prev * PRICE.cacheRead + (ctx - prev) * PRICE.cacheWrite;
        prev = ctx;
        continue;
      }
      savedTokens = ctx - newCtx;
      keptTokens = newCtx;
      compactedAt = i;
      compactStats = r;
      pruned += newCtx * PRICE.cacheWrite; // 接頭辞が変わるのでキャッシュは全部書き直し
      prev = newCtx;
      continue;
    }
    if (compactedAt >= 0) ctx -= savedTokens;
    pruned += prev * PRICE.cacheRead + (ctx - prev) * PRICE.cacheWrite;
    prev = ctx;
  }
  const callsAfter = compactedAt < 0 ? 0 : callPoints.filter((i) => i > compactedAt).length;
  return { calls: callPoints.length, baseline, pruned, compactedAt, savedTokens, keptTokens, callsAfter, rejected, compactStats };
}

function report(file) {
  const messages = loadMessages(file);
  const before = messages.reduce((s, m) => s + messageTokens(m), 0);
  const whole = compact(messages, opts.keepLast);
  const after = whole.messages.reduce((s, m) => s + messageTokens(m), 0);
  const cost = simulateCost(messages, opts.keepLast, opts.trigger, opts.minReductionPct);
  // 圧縮 1 回で失う分（書き直し）を、以後 1 呼び出しごとの節約（削った量 × キャッシュ読み単価）で割る。
  // 圧縮しなければその回は (残した量 + 削った量) × 0.1 で済んだので、差し引いた損を取り戻す回数を出す。
  const oneTimeLoss = cost.keptTokens * PRICE.cacheWrite - (cost.keptTokens + cost.savedTokens) * PRICE.cacheRead;
  const breakEvenCalls = cost.savedTokens > 0 ? Math.ceil(oneTimeLoss / (cost.savedTokens * PRICE.cacheRead)) : null;
  const result = {
    file,
    messages: messages.length,
    tokensBefore: before,
    tokensAfterWholeHistory: after,
    reductionPct: before ? +(100 * (1 - after / before)).toFixed(1) : 0,
    pairs: whole.counts,
    reasons: whole.reasons,
    apiCalls: cost.calls,
    trigger: opts.trigger,
    compactionRejectedForSmallReduction: cost.rejected,
    compactedAtMessage: cost.compactedAt,
    tokensRemovedAtCompaction: cost.savedTokens,
    callsAfterCompaction: cost.callsAfter,
    inputCostBaseline: +cost.baseline.toFixed(0),
    inputCostWithCompaction: +cost.pruned.toFixed(0),
    costChangePct: cost.baseline ? +(100 * (cost.pruned / cost.baseline - 1)).toFixed(1) : 0,
    breakEvenCallsApprox: breakEvenCalls,
  };
  return result;
}


// --scenario: 会話記録を使わず、圧縮が必ず起きる長い作業を想定して 3 方式の入力費用と待ち時間を比べる。
// 圧縮の時点で履歴は ctx トークン。以後 calls 回の呼び出しがあり、1 回ごとに growth トークン増える。
//   none     : 圧縮しない（上限に届かない前提の参考値）
//   summary  : 組み込みの要約。要約呼び出し 1 回（履歴はキャッシュ読み、出力 summaryTokens）→ 以後は要約から積み直す
//   select   : 関連度の選別。判定器は入力 judgePricePerMTokRel（ベース単価比）で履歴を 1 回読む → 残った keepRatio 分から積み直す
function scenario(p) {
  const OUTPUT = 5; // 出力単価はベース入力単価の 5 倍（Claude の現行モデルの比）
  function run(startCtx, oneTime) {
    let cost = oneTime + startCtx * PRICE.cacheWrite;
    let prev = startCtx;
    for (let k = 1; k <= p.calls; k += 1) {
      const ctx = startCtx + k * p.growth;
      cost += prev * PRICE.cacheRead + (ctx - prev) * PRICE.cacheWrite;
      prev = ctx;
    }
    return cost;
  }
  const none = run(p.ctx, -p.ctx * (PRICE.cacheWrite - PRICE.cacheRead)); // 圧縮しなければ最初もキャッシュ読みで済む
  const summary = run(p.summaryTokens, p.ctx * PRICE.cacheRead + p.summaryTokens * OUTPUT);
  const select = run(Math.round(p.ctx * p.keepRatio), p.ctx * p.judgeRel);
  return {
    params: p,
    inputCostRelative: { none: Math.round(none), summary: Math.round(summary), select: Math.round(select) },
    compactionWaitSec: { summary: +(p.summaryTokens / p.outputTokPerSec).toFixed(1), select: p.judgeSec },
  };
}

if (opts.scenario) {
  const base = { ctx: 120000, calls: 40, growth: 2500, summaryTokens: 6000, keepRatio: 0.5, outputTokPerSec: 60, judgeSec: 0.5 };
  // Jev は 100 万入力トークンあたり 0.042 ドル。Opus 5.5 の入力 4 ドルに対する比で置く。判定には履歴の縮約版（最大 25k）を数回送る。
  base.judgeRel = (0.042 / 4) * (4 * 30000) / 120000;
  const rows = [];
  for (const keepRatio of [0.3, 0.5, 0.7]) {
    for (const calls of [5, 20, 60]) rows.push(scenario({ ...base, keepRatio, calls }));
  }
  console.log(JSON.stringify(rows, null, 2));
  process.exit(0);
}
const results = opts.files.map(report);
if (opts.json) {
  console.log(JSON.stringify(results, null, 2));
} else {
  for (const r of results) {
    console.log(`# ${r.file}`);
    console.log(`messages=${r.messages} apiCalls=${r.apiCalls} tokens(est)=${r.tokensBefore} -> ${r.tokensAfterWholeHistory} (-${r.reductionPct}%)`);
    console.log(`pairs: ${JSON.stringify(r.pairs)} reasons: ${JSON.stringify(r.reasons)}`);
    if (r.compactedAtMessage < 0) {
      console.log(`no compaction adopted (trigger ${r.trigger} tokens; rejected for small reduction: ${r.compactionRejectedForSmallReduction})`);
    } else {
      console.log(`compaction at message ${r.compactedAtMessage}: removed ${r.tokensRemovedAtCompaction} tokens, ${r.callsAfterCompaction} calls after`);
    }
    console.log(`input cost (relative, cache-aware): baseline=${r.inputCostBaseline} with-compaction=${r.inputCostWithCompaction} (${r.costChangePct}%) break-even≈${r.breakEvenCallsApprox} calls`);
    console.log("");
  }
}

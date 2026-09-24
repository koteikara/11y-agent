#!/usr/bin/env node
"use strict";

// L2 evaluation of the LLM provider switch (LLM_PROVIDER_SWITCH_INSTRUCTIONS.md, 4章 L2).
//
//   capture  Start server.js with LLM_RECORD_DIR and no provider configured, drive the Goal 2
//            screen with Playwright (paste body HTML -> 候補生成) for each page, and write the
//            deduplicated requests to <dir>/requests.jsonl (+ images/, image-urls.json).
//   run      Replay requests.jsonl through lib/llm.js callLlm() for one configuration (A-D) or
//            all of them, one request at a time. Writes <dir>/results-<config>.jsonl.
//   report   Aggregate the results: JSON validity, latency, cost, agreement with A, machine
//            pass/fail, and the CSVs for human judgement of generated wording.
//
// <dir> holds page HTML, images and raw responses, so keep it outside the repository (the
// scratchpad) and never commit it. API keys are read from the environment only and are
// never written anywhere by this tool.

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { spawn, spawnSync } = require("child_process");

const appRoot = path.resolve(__dirname, "..");

const CONFIGS = {
  A: {
    label: "Gemini gemini-2.5-flash",
    env: { LLM_TEXT_PROVIDER: "gemini", LLM_VISION_PROVIDER: "gemini", GEMINI_MODEL: "gemini-2.5-flash" },
  },
  // Same settings as A, run a second time: how often A disagrees with itself.
  A2: {
    label: "A の再実行（揺れの基準）",
    env: { LLM_TEXT_PROVIDER: "gemini", LLM_VISION_PROVIDER: "gemini", GEMINI_MODEL: "gemini-2.5-flash" },
  },
  B: {
    label: "Gemini gemini-3.5-flash (temperature 1)",
    // Price: the Vertex AI Tokyo rate used in 3.8 of the design doc (USD per 1M tokens).
    env: {
      LLM_TEXT_PROVIDER: "gemini",
      LLM_VISION_PROVIDER: "gemini",
      GEMINI_MODEL: "gemini-3.5-flash",
      GEMINI_TEMPERATURE: "1",
      GEMINI_INPUT_PRICE_PER_1M_TOKENS: "1.65",
      GEMINI_OUTPUT_PRICE_PER_1M_TOKENS: "9.9",
    },
  },
  C: {
    label: "さくら gpt-oss-120b / preview/Qwen3-VL-30B-A3B-Instruct",
    env: {
      LLM_TEXT_PROVIDER: "sakura",
      LLM_VISION_PROVIDER: "sakura",
      SAKURA_AI_TEXT_MODEL: "gpt-oss-120b",
      SAKURA_AI_VISION_MODEL: "preview/Qwen3-VL-30B-A3B-Instruct",
    },
  },
  D: {
    label: "さくら preview/gemma-4-31B-it（画像のみ）",
    visionOnly: true,
    env: {
      LLM_TEXT_PROVIDER: "sakura",
      LLM_VISION_PROVIDER: "sakura",
      SAKURA_AI_TEXT_MODEL: "gpt-oss-120b",
      SAKURA_AI_VISION_MODEL: "preview/gemma-4-31B-it",
      // Published rate for gemma-4-31B-it on 2026-09-24 (0.24 / 0.96 yen per 10,000 tokens).
      SAKURA_AI_VISION_INPUT_PRICE_PER_1M_JPY: "24",
      SAKURA_AI_VISION_OUTPUT_PRICE_PER_1M_JPY: "96",
    },
  },
};

// Env vars that would change which provider answers; cleared before applying a config.
const PROVIDER_ENV = [
  "LLM_TEXT_PROVIDER",
  "LLM_VISION_PROVIDER",
  "LLM_FALLBACK_PROVIDER",
  "LLM_RECORD_DIR",
  "GEMINI_MODEL",
  "GEMINI_AUTH_MODE",
  "GEMINI_TEMPERATURE",
  "GEMINI_THINKING_LEVEL",
  "GEMINI_INPUT_PRICE_PER_1M_TOKENS",
  "GEMINI_OUTPUT_PRICE_PER_1M_TOKENS",
  "SAKURA_AI_TEXT_MODEL",
  "SAKURA_AI_VISION_MODEL",
  "SAKURA_AI_VISION_INPUT_PRICE_PER_1M_JPY",
  "SAKURA_AI_VISION_OUTPUT_PRICE_PER_1M_JPY",
];

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const value = argv[i];
    if (value.startsWith("--")) {
      const key = value.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith("--")) args[key] = true;
      else {
        args[key] = next;
        i += 1;
      }
    } else args._.push(value);
  }
  return args;
}

function readJsonl(file) {
  if (!fs.existsSync(file)) return [];
  return fs
    .readFileSync(file, "utf8")
    .split("\n")
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line));
}

function sha256(text) {
  return crypto.createHash("sha256").update(text).digest("hex");
}

function requestKey(record) {
  return sha256(`${record.task}\u0000${record.userText}\u0000${record.image_sha256 || ""}`).slice(0, 16);
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ---------------------------------------------------------------------------------------
// capture

function loadSagaPages() {
  const dataset = JSON.parse(fs.readFileSync(path.join(appRoot, "agents-cli", "datasets", "saga-a11y-eval.json"), "utf8"));
  return dataset.map((entry) => {
    const html = entry.input.old_html;
    const number = Number((entry.metadata?.source_file || "").replace(/\D/g, ""));
    const heading = html.match(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/i);
    const title = heading ? heading[1].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim() : entry.id;
    return { id: entry.id, title: title || entry.id, url: `https://www.city.saga.lg.jp/main/${number}.html`, html };
  });
}

function loadPlaywright() {
  try {
    return require("playwright");
  } catch {
    const globalRoot = spawnSync("npm", ["root", "-g"], { encoding: "utf8" }).stdout.trim();
    return require(path.join(globalRoot, "playwright"));
  }
}

async function waitForServer(url, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // not up yet
    }
    await sleep(300);
  }
  throw new Error(`server did not start: ${url}`);
}

async function capture(args) {
  const dir = path.resolve(args.dir);
  const rawDir = path.join(dir, "raw");
  fs.mkdirSync(rawDir, { recursive: true });
  const pages = [];
  if (args.saga) pages.push(...loadSagaPages());
  for (const file of String(args.pages || "").split(",").filter(Boolean)) {
    pages.push(...JSON.parse(fs.readFileSync(file, "utf8")));
  }
  if (!pages.length) throw new Error("no pages: pass --saga and/or --pages <json>");
  // --image-map <json>: { originalUrl: replacementUrl }. Used when the original images are
  // gone (佐賀市's absolute image URLs all returned 404 on 2026-09-24) and a copy exists elsewhere.
  if (args["image-map"]) {
    const imageMap = JSON.parse(fs.readFileSync(args["image-map"], "utf8"));
    for (const entry of pages) {
      entry.html = entry.html.replace(/(<img\b[^>]*\bsrc=")([^"]+)(")/gi, (match, head, src, tail) => (imageMap[src] ? `${head}${imageMap[src]}${tail}` : match));
    }
  }

  // No provider configured: requests are recorded and callLlm() returns llm_not_configured.
  const port = Number(args.port || 8791);
  const serverEnv = { ...process.env, PORT: String(port), LLM_RECORD_DIR: rawDir };
  for (const name of [...PROVIDER_ENV, "GEMINI_API_KEY", "SAKURA_AI_API_KEY"]) {
    if (name !== "LLM_RECORD_DIR") delete serverEnv[name];
  }
  const server = spawn(process.execPath, ["server.js"], { cwd: appRoot, env: serverEnv, stdio: ["ignore", "pipe", "pipe"] });
  server.stderr.on("data", (chunk) => process.stderr.write(`[server] ${chunk}`));
  const baseUrl = `http://127.0.0.1:${port}`;
  const requestsFile = path.join(rawDir, "requests.jsonl");
  const pageIndex = [];
  const imageUrls = new Set();
  let browser;
  try {
    await waitForServer(`${baseUrl}/api/llm/status`, 15000);
    const status = await (await fetch(`${baseUrl}/api/llm/status`)).json();
    if (status.configured) throw new Error("a provider is configured on the capture server; refusing to call a real LLM");

    const { chromium } = loadPlaywright();
    browser = await chromium.launch({ executablePath: args.chromium || "/opt/pw-browsers/chromium" });
    const page = await browser.newPage();
    let pageImageUrls = [];
    page.on("request", (request) => {
      if (request.url().endsWith("/api/llm/image-alt") && request.method() === "POST") {
        try {
          pageImageUrls.push(JSON.parse(request.postData() || "{}").imageUrl);
        } catch {
          // ignore
        }
      }
    });
    await page.goto(`${baseUrl}/index.html`);
    for (const [index, entry] of pages.entries()) {
      pageImageUrls = [];
      const before = readJsonl(requestsFile).length;
      const started = Date.now();
      await page.goto(`${baseUrl}/index.html`);
      await page.waitForFunction(() => document.querySelector("#analyzeButton") && !document.querySelector("#analyzeButton").disabled);
      await page.fill("#pageTitleInput", entry.title);
      await page.fill("#oldUrlInput", entry.url);
      await page.fill("#htmlInput", entry.html);
      await page.click("#analyzeButton");
      await page.waitForFunction(
        () => {
          const button = document.querySelector("#analyzeButton");
          return button && !button.disabled && button.textContent.trim() === "候補生成";
        },
        null,
        { timeout: 300000 }
      );
      const summary = await page.textContent("#candidateSummary");
      const after = readJsonl(requestsFile).length;
      pageIndex.push({ id: entry.id, url: entry.url, title: entry.title, first: before, last: after });
      pageImageUrls.filter(Boolean).forEach((url) => imageUrls.add(url));
      console.log(
        `[${index + 1}/${pages.length}] ${entry.id} requests=${after - before} images=${pageImageUrls.length} ${Date.now() - started}ms ${String(summary || "").slice(0, 40)}`
      );
    }
  } finally {
    if (browser) await browser.close();
    server.kill();
  }

  // Map image hashes back to their URLs so the human-judgement CSV can link the image.
  const urlBySha = {};
  for (const url of imageUrls) {
    try {
      const response = await fetch(url, { headers: { "user-agent": "goal2-a11y-review/0.1 (+image-alt-preview)" } });
      const bytes = Buffer.from(await response.arrayBuffer());
      urlBySha[crypto.createHash("sha256").update(bytes).digest("hex")] = url;
    } catch (error) {
      console.warn(`image re-fetch failed: ${url} ${error.message}`);
    }
  }

  // Deduplicate: same task, userText and image hash -> one request, with the pages it came from.
  const records = readJsonl(requestsFile);
  const byKey = new Map();
  for (const pageEntry of pageIndex) {
    for (let line = pageEntry.first; line < pageEntry.last; line += 1) {
      const record = records[line];
      const key = requestKey(record);
      if (!byKey.has(key)) byKey.set(key, { key, ...record, image_url: urlBySha[record.image_sha256] || null, pages: [] });
      const merged = byKey.get(key);
      if (!merged.pages.includes(pageEntry.id)) merged.pages.push(pageEntry.id);
    }
  }
  const deduped = [...byKey.values()];
  fs.writeFileSync(path.join(dir, "requests.jsonl"), deduped.map((record) => JSON.stringify(record)).join("\n") + "\n");
  fs.writeFileSync(path.join(dir, "pages.json"), JSON.stringify(pageIndex, null, 1));
  const byTask = {};
  deduped.forEach((record) => {
    byTask[record.task] = (byTask[record.task] || 0) + 1;
  });
  console.log(`raw=${records.length} deduped=${deduped.length}`, byTask);
}

// ---------------------------------------------------------------------------------------
// run

function applyConfigEnv(config) {
  for (const name of PROVIDER_ENV) delete process.env[name];
  Object.assign(process.env, CONFIGS[config].env, {
    // A fallback would hide which provider answered.
    LLM_FALLBACK_PROVIDER: "none",
    // Pacing is done here (one request at a time with a gap), not by the per-minute budget.
    LLM_MAX_CALLS_PER_MINUTE: "100000",
    // Measure the real latency instead of cutting it at the production 45s (reported separately).
    LLM_REQUEST_TIMEOUT_MS: process.env.EVAL_REQUEST_TIMEOUT_MS || "180000",
  });
}

// Pull the model's text out of a raw provider response (for the STRING-number check).
function rawContent(body) {
  try {
    const json = JSON.parse(body);
    if (json.choices) return json.choices[0]?.message?.content || "";
    if (json.candidates) return (json.candidates[0]?.content?.parts || []).map((part) => part.text || "").join("");
  } catch {
    // not JSON
  }
  return null;
}

async function runConfig(args, config) {
  const dir = path.resolve(args.dir);
  applyConfigEnv(config);
  const llm = require(path.join(appRoot, "lib", "llm.js"));
  const status = llm.getStatus();
  const requests = readJsonl(path.join(dir, "requests.jsonl")).filter((record) => !CONFIGS[config].visionOnly || record.kind === "vision");
  const outFile = path.join(dir, `results-${config}.jsonl`);
  const done = new Set(readJsonl(outFile).map((row) => row.key));
  const gapMs = Number(args["gap-ms"] || 1500);
  const limit = Number(args.limit || Infinity);

  let calls = [];
  const realFetch = globalThis.fetch;
  llm.__setTestHooks({
    fetch: async (url, init) => {
      const started = Date.now();
      try {
        const response = await realFetch(url, init);
        const body = await response.clone().text();
        calls.push({ status: response.status, ms: Date.now() - started, content: rawContent(body), body: response.ok ? undefined : body.slice(0, 300) });
        return response;
      } catch (error) {
        calls.push({ status: 0, ms: Date.now() - started, error: error.name });
        throw error;
      }
    },
  });

  console.log(`config ${config}: ${CONFIGS[config].label} status=${JSON.stringify(status)} todo=${requests.length - done.size}`);
  let processed = 0;
  for (const record of requests) {
    if (done.has(record.key)) continue;
    if (processed >= limit) break;
    processed += 1;
    let image;
    if (record.image_sha256) {
      const ext = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif" }[record.image_mime] || "bin";
      image = { base64: fs.readFileSync(path.join(dir, "raw", "images", `${record.image_sha256}.${ext}`)).toString("base64"), mimeType: record.image_mime };
    }
    const row = { key: record.key, config, task: record.task, kind: record.kind, pages: record.pages };
    let rateLimitWaits = 0;
    for (;;) {
      calls = [];
      const started = Date.now();
      try {
        const result = await llm.callLlm({
          kind: record.kind,
          task: record.task,
          systemPrompt: record.systemPrompt,
          userText: record.userText,
          image,
          responseSchema: record.responseSchema,
        });
        Object.assign(row, { ok: true, error_code: null, provider: result.provider, model: result.model, usage: result.usage, json: result.json });
      } catch (error) {
        const rateLimited = error.code === "llm_rate_limited" || error.httpStatus === 429;
        if (rateLimited && rateLimitWaits < 5) {
          const wait = 30000 * 2 ** rateLimitWaits;
          rateLimitWaits += 1;
          console.log(`  429 on ${record.key}, waiting ${wait / 1000}s`);
          await sleep(wait);
          continue;
        }
        Object.assign(row, { ok: false, error_code: error.code || "error", error_message: String(error.message || "").slice(0, 300), usage: null, json: null });
      }
      Object.assign(row, {
        latency_ms: Date.now() - started,
        calls: calls.length,
        http_statuses: calls.map((call) => call.status),
        call_ms: calls.map((call) => call.ms),
        raw_contents: calls.map((call) => call.content),
        error_bodies: calls.map((call) => call.body).filter(Boolean),
        rate_limit_waits: rateLimitWaits,
      });
      break;
    }
    // Usage is only returned on success; failed attempts' tokens are recovered from raw bodies in report.
    fs.appendFileSync(outFile, `${JSON.stringify(row)}\n`);
    console.log(`  ${config} ${record.task} ${record.key} ok=${row.ok} ${row.error_code || ""} calls=${row.calls} ${row.latency_ms}ms`);
    await sleep(gapMs);
  }
}

async function run(args) {
  const configs = args.config === "all" || !args.config ? ["A", "B", "C", "D"] : String(args.config).split(",");
  if (configs.length === 1) {
    await runConfig(args, configs[0]);
    return;
  }
  // One child process per config: lib/llm.js reads GEMINI_MODEL and prices at load time.
  for (const config of configs) {
    const forwarded = process.argv.slice(3).filter((value, index, all) => value !== "--config" && all[index - 1] !== "--config");
    const child = spawnSync(process.execPath, [__filename, "run", ...forwarded, "--config", config], { stdio: "inherit" });
    if (child.status !== 0) throw new Error(`config ${config} exited with ${child.status}`);
  }
}

// ---------------------------------------------------------------------------------------
// report

// Classification fields compared with A (booleans: missing = false; strings: trimmed, lower-cased).
// The pass/fail line (一致率 ≥90%) uses the primary fields only. Reference fields are shown but
// not counted: link-text confidence is not read by the screen, and the heading-review block-id
// sets are an open-ended judgement rather than a yes/no field.
const CLASS_FIELDS = {
  "foreign-language": ["is_foreign", "lang_code"],
  "sensory-characteristics": ["is_issue"],
  "th-scope": ["scope"],
  "ascii-art": ["is_ascii_art", "kind"],
  "heritage-check": ["is_individual_subject_page", "target_image_id"],
  "image-alt": ["is_decorative", "is_complex"],
  "avoid-text-as-image": ["has_embedded_text"],
};
const REFERENCE_FIELDS = {
  "link-text": ["confidence"],
  "heading-review": ["vague_block_ids", "missing_before_block_ids", "level_fix_block_ids"],
};
const BOOLEAN_FIELDS = new Set(["is_foreign", "is_issue", "is_ascii_art", "is_individual_subject_page", "is_decorative", "is_complex", "has_embedded_text"]);

// Wording fields put side by side for human judgement: [csv name, task, field getter, sample size].
const WORDING = [
  ["image-alt_alt_text", "image-alt", (item) => item.alt_text, 30],
  ["image-alt_complex_detail", "image-alt", (item) => item.complex_detail, 20],
  ["avoid-text-as-image_extracted_text", "avoid-text-as-image", (item) => item.extracted_text, 20],
  ["link-text_suggested_text", "link-text", (item) => item.suggested_text, 20],
  ["mail-link_suggested_text", "mail-link", (item) => item.suggested_text, 20],
  ["toppage-link_suggested_text", "toppage-link", (item) => item.suggested_text, 20],
  ["table-caption_suggested_caption", "table-caption", (item) => item.suggested_caption, 20],
  ["cell-merge_explanation", "cell-merge", (item) => item.explanation, 20],
  ["sensory-characteristics_explanation", "sensory-characteristics", (item) => item.explanation, 20],
  ["ascii-art_suggested_text", "ascii-art", (item) => item.suggested_text, 20],
  [
    "heading-review_missing_headings",
    "heading-review",
    (item) => (item.missing_headings || []).map((entry) => `${entry.before_block_id}: h${entry.level} ${entry.suggested_text}`).join(" / "),
    20,
  ],
  ["heritage-check_subject_name", "heritage-check", (item) => item.subject_name, 20],
];

function itemsOf(row) {
  if (!row || !row.ok) return null;
  if (row.kind === "vision") return new Map([["_", row.json]]);
  return new Map((row.json || []).map((item) => [String(item.id), item]));
}

function classValue(task, field, item) {
  if (task === "heading-review") {
    const pick = { vague_block_ids: ["vague_headings", "block_id"], missing_before_block_ids: ["missing_headings", "before_block_id"], level_fix_block_ids: ["heading_level_fixes", "block_id"] }[field];
    return (item[pick[0]] || []).map((entry) => entry[pick[1]]).sort().join(",");
  }
  if (BOOLEAN_FIELDS.has(field)) return item[field] === true;
  return String(item[field] ?? "").trim().toLowerCase();
}

function inputItems(record) {
  if (record.kind === "vision") return new Map([["_", JSON.parse(record.userText || "{}")]]);
  try {
    return new Map(JSON.parse(record.userText).map((item) => [String(item.id), item]));
  } catch {
    return new Map();
  }
}

function percentile(values, p) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, index)];
}

const pct = (num, den) => (den ? `${((num / den) * 100).toFixed(1)}%` : "-");
const sec = (ms) => (ms === null || ms === undefined ? "-" : (ms / 1000).toFixed(1));

// Deterministic shuffle so re-running report picks the same sample.
function seededSample(list, count, seed) {
  const scored = list.map((value, index) => ({ value, score: sha256(`${seed}:${index}:${JSON.stringify(value.sortKey)}`) }));
  scored.sort((a, b) => (a.score < b.score ? -1 : 1));
  return scored.slice(0, count).map((entry) => entry.value);
}

function csvCell(value) {
  const text = value === undefined || value === null ? "" : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

// Did a STRING field in the schema come back as a number in the raw reply? (L1 review point)
function stringFieldsWithNumbers(schema, value, found = []) {
  if (!schema || value === null || value === undefined) return found;
  const type = String(schema.type || "").toUpperCase();
  if (type === "STRING" && typeof value === "number") found.push(value);
  if (type === "ARRAY" && Array.isArray(value)) value.forEach((item) => stringFieldsWithNumbers(schema.items, item, found));
  if (type === "OBJECT" && value && typeof value === "object") {
    for (const [name, child] of Object.entries(schema.properties || {})) stringFieldsWithNumbers(child, value[name], found);
  }
  return found;
}

function parseLoose(text) {
  if (typeof text !== "string") return null;
  let body = text.trim();
  const fenced = body.match(/^```[A-Za-z]*\s*([\s\S]*?)\s*```$/);
  if (fenced) body = fenced[1].trim();
  try {
    return JSON.parse(body);
  } catch {
    return null;
  }
}

function report(args) {
  const dir = path.resolve(args.dir);
  const requests = readJsonl(path.join(dir, "requests.jsonl"));
  const requestByKey = new Map(requests.map((record) => [record.key, record]));
  const pages = JSON.parse(fs.readFileSync(path.join(dir, "pages.json"), "utf8"));
  const results = {};
  for (const config of Object.keys(CONFIGS)) {
    results[config] = new Map(readJsonl(path.join(dir, `results-${config}.jsonl`)).map((row) => [row.key, row]));
  }
  const tasks = [...new Set(requests.map((record) => record.task))];
  const pageUrlById = Object.fromEntries(pages.map((entry) => [entry.id, entry.url]));
  const out = [];
  const summary = { configs: {}, tasks: {} };

  out.push(`対象: ${pages.length}ページ、要求 ${requests.length}件（重複をまとめたあと）`);
  out.push("");
  out.push("### タスクごとの JSON の妥当率と応答時間");
  out.push("");
  out.push("| タスク | 構成 | 件数 | 妥当（1回目） | 妥当（やり直し後） | 失敗の内訳 | 中央値(秒) | p95(秒) | 45秒超 |");
  out.push("|---|---|---|---|---|---|---|---|---|");
  for (const task of tasks) {
    for (const config of Object.keys(CONFIGS)) {
      const rows = [...results[config].values()].filter((row) => row.task === task);
      if (!rows.length) continue;
      const okFirst = rows.filter((row) => row.ok && row.calls === 1).length;
      const ok = rows.filter((row) => row.ok).length;
      const errors = {};
      rows.filter((row) => !row.ok).forEach((row) => {
        errors[row.error_code] = (errors[row.error_code] || 0) + 1;
      });
      const latencies = rows.map((row) => row.latency_ms);
      const over45 = latencies.filter((ms) => ms > 45000).length;
      summary.tasks[`${task}|${config}`] = { n: rows.length, okFirst, ok, median: percentile(latencies, 50), p95: percentile(latencies, 95) };
      out.push(
        `| ${task} | ${config} | ${rows.length} | ${pct(okFirst, rows.length)} | ${pct(ok, rows.length)} | ${Object.entries(errors).map(([code, n]) => `${code} ${n}`).join("、") || "-"} | ${sec(percentile(latencies, 50))} | ${sec(percentile(latencies, 95))} | ${over45} |`
      );
    }
  }

  // Cost: successful rows carry usage; failed rows' tokens are not returned by callLlm, so the
  // cost below is a lower bound for configs with failures (noted in the output).
  out.push("");
  out.push("### 構成ごとのまとめ");
  out.push("");
  out.push("| 構成 | 要求 | 妥当（1回目） | 妥当（やり直し後） | 入力トークン | 出力トークン | 費用（円） | 1ページあたり（円） | 1ページあたり、共有分もページごとに数えた場合（円） | 文字の費用 | 画像の費用 |");
  out.push("|---|---|---|---|---|---|---|---|---|---|---|");
  for (const config of Object.keys(CONFIGS)) {
    const rows = [...results[config].values()];
    if (!rows.length) continue;
    const cost = { text: 0, vision: 0 };
    let inputTokens = 0;
    let outputTokens = 0;
    let perPageCounted = 0;
    rows.forEach((row) => {
      if (!row.usage) return;
      cost[row.kind] += row.usage.estimatedCostJpy || 0;
      perPageCounted += (row.usage.estimatedCostJpy || 0) * (row.pages || []).length;
      inputTokens += row.usage.inputTokens || 0;
      outputTokens += row.usage.outputTokens || 0;
    });
    const okFirst = rows.filter((row) => row.ok && row.calls === 1).length;
    const ok = rows.filter((row) => row.ok).length;
    const total = cost.text + cost.vision;
    summary.configs[config] = { n: rows.length, ok, okFirst, total, perPage: total / pages.length, text: cost.text, vision: cost.vision };
    out.push(
      `| ${config} | ${rows.length} | ${pct(okFirst, rows.length)} | ${pct(ok, rows.length)} | ${inputTokens} | ${outputTokens} | ${total.toFixed(2)} | ${(total / pages.length).toFixed(3)} | ${(perPageCounted / pages.length).toFixed(3)} | ${cost.text.toFixed(2)} | ${cost.vision.toFixed(2)} |`
    );
  }

  // Agreement with A on classification fields.
  out.push("");
  out.push("### 真偽と分類の項目の A との一致率");
  out.push("");
  out.push("比べたのは、A と比べる構成の両方が妥当な JSON を返し、同じ id の項目が両方にあるものだけである。");
  out.push("");
  out.push("| タスク | 項目 | 構成 | 比べた数 | 一致 | 一致率 | 項目の欠け（A にあって無い） |");
  out.push("|---|---|---|---|---|---|---|");
  const agreementTotals = {};
  const referenceTotals = {};
  const disagreements = [];
  const fieldGroups = [
    ...Object.entries(CLASS_FIELDS).map(([task, fields]) => [task, fields, agreementTotals, ""]),
    ...Object.entries(REFERENCE_FIELDS).map(([task, fields]) => [task, fields, referenceTotals, "（参考）"]),
  ];
  for (const [task, fields, totals, note] of fieldGroups) {
    for (const config of ["A2", "B", "C", "D"]) {
      if (CONFIGS[config].visionOnly && !["image-alt", "avoid-text-as-image"].includes(task)) continue;
      if (!results[config].size) continue;
      for (const field of fields) {
        let compared = 0;
        let agreed = 0;
        let missing = 0;
        for (const record of requests.filter((entry) => entry.task === task)) {
          const itemsA = itemsOf(results.A.get(record.key));
          const itemsX = itemsOf(results[config].get(record.key));
          if (!itemsA || !itemsX) continue;
          for (const [id, itemA] of itemsA) {
            const itemX = itemsX.get(id);
            if (!itemX) {
              missing += 1;
              continue;
            }
            compared += 1;
            const valueA = classValue(task, field, itemA);
            const valueX = classValue(task, field, itemX);
            if (valueA === valueX) agreed += 1;
            else disagreements.push({ task, field, config, key: record.key, id, A: valueA, X: valueX });
          }
        }
        if (!compared && !missing) continue;
        totals[config] = totals[config] || { compared: 0, agreed: 0 };
        totals[config].compared += compared;
        totals[config].agreed += agreed;
        out.push(`| ${task} | ${field}${note} | ${config} | ${compared} | ${agreed} | ${pct(agreed, compared)} | ${missing} |`);
      }
    }
  }
  out.push("");
  out.push("| 構成 | 比べた数（参考を除く） | 一致率（参考を除く） | 比べた数（参考） | 一致率（参考） |");
  out.push("|---|---|---|---|---|");
  for (const [config, total] of Object.entries(agreementTotals)) {
    const reference = referenceTotals[config] || { compared: 0, agreed: 0 };
    out.push(`| ${config} | ${total.compared} | ${pct(total.agreed, total.compared)} | ${reference.compared} | ${pct(reference.agreed, reference.compared)} |`);
  }

  // Machine-checkable pass/fail (4章 L2 合格の目安).
  out.push("");
  out.push("### 機械で判定できる合格の目安");
  out.push("");
  out.push("| 構成 | JSON 妥当率（やり直し後）≥99% | 分類の一致率 ≥90% | p95 ≤45秒（見出しの見直しを除く） | 見出しの見直し p95 ≤90秒 |");
  out.push("|---|---|---|---|---|");
  for (const config of Object.keys(CONFIGS)) {
    const rows = [...results[config].values()];
    if (!rows.length) continue;
    const okRate = rows.filter((row) => row.ok).length / rows.length;
    const agreement = agreementTotals[config] ? agreementTotals[config].agreed / agreementTotals[config].compared : null;
    const other = rows.filter((row) => row.task !== "heading-review").map((row) => row.latency_ms);
    const heading = rows.filter((row) => row.task === "heading-review").map((row) => row.latency_ms);
    const p95Other = percentile(other, 95);
    const p95Heading = percentile(heading, 95);
    const mark = (passed, detail) => `${passed ? "合格" : "不合格"}（${detail}）`;
    out.push(
      `| ${config} | ${mark(okRate >= 0.99, pct(okRate, 1))} | ${agreement === null ? "基準（A）" : mark(agreement >= 0.9, pct(agreement, 1))} | ${mark(p95Other !== null && p95Other <= 45000, `${sec(p95Other)}秒`)} | ${heading.length ? mark(p95Heading <= 90000, `${sec(p95Heading)}秒`) : "対象なし"} |`
    );
  }

  // L1 review follow-ups that can be observed from the raw calls.
  out.push("");
  out.push("### L1 のレビューの任意4点の観測");
  out.push("");
  for (const config of Object.keys(CONFIGS)) {
    const rows = [...results[config].values()];
    if (!rows.length) continue;
    let numbersInString = 0;
    const numberExamples = [];
    let retried4xx = 0;
    let notConfigured = 0;
    rows.forEach((row) => {
      const record = requestByKey.get(row.key);
      (row.raw_contents || []).forEach((content) => {
        let parsed = parseLoose(content);
        if (parsed && !Array.isArray(parsed) && Array.isArray(parsed.results) && String(record.responseSchema?.type).toUpperCase() === "ARRAY") parsed = parsed.results;
        const found = stringFieldsWithNumbers(record.responseSchema, parsed);
        if (found.length) {
          numbersInString += 1;
          if (numberExamples.length < 3) numberExamples.push(`${row.task}: ${found.slice(0, 3).join(", ")}`);
        }
      });
      const statuses = row.http_statuses || [];
      statuses.forEach((status, index) => {
        if (status >= 400 && status < 500 && status !== 429 && index < statuses.length - 1) retried4xx += 1;
      });
      if (row.error_code === "llm_not_configured") notConfigured += 1;
    });
    out.push(
      `- ${config}: STRING の項目に数が来た応答 ${numbersInString}件${numberExamples.length ? `（例: ${numberExamples.join("、")}）` : ""}。4xx（429以外）のあとにやり直した呼び出し ${retried4xx}件。llm_not_configured ${notConfigured}件。`
    );
  }

  if (args.md) fs.writeFileSync(path.resolve(args.md), `${out.join("\n")}\n`);
  else console.log(out.join("\n"));
  fs.writeFileSync(path.join(dir, "summary.json"), JSON.stringify({ summary, disagreements }, null, 1));

  // Human-judgement CSVs.
  if (args["csv-dir"]) {
    const csvDir = path.resolve(args["csv-dir"]);
    fs.mkdirSync(csvDir, { recursive: true });
    for (const [name, task, getter, count] of WORDING) {
      const vision = ["image-alt", "avoid-text-as-image"].includes(task);
      const configs = vision ? ["A", "B", "C", "D"] : ["A", "B", "C"];
      const pool = [];
      for (const record of requests.filter((entry) => entry.task === task)) {
        const inputs = inputItems(record);
        const itemsByConfig = Object.fromEntries(configs.map((config) => [config, itemsOf(results[config].get(record.key))]));
        if (!itemsByConfig.A || !itemsByConfig.C) continue;
        for (const [id, itemA] of itemsByConfig.A) {
          const values = Object.fromEntries(configs.map((config) => [config, itemsByConfig[config]?.get(id) ? getter(itemsByConfig[config].get(id)) || "" : "(応答なし)"]));
          if (!getter(itemA) && !values.C) continue;
          pool.push({ sortKey: [record.key, id], record, id, input: inputs.get(id), values, itemA });
        }
      }
      if (!pool.length) continue;
      const sample = seededSample(pool, count, name);
      const header = ["no", "task", "request_key", "item_id", "pages", vision ? "image_url" : "input", ...configs.map((config) => `${config}_${CONFIGS[config].label}`)];
      header.push(...(vision ? ["判定_C（さくらが良い/同等/Geminiが良い）", "判定_D（さくらが良い/同等/Geminiが良い）"] : ["判定_C（さくらが良い/同等/Geminiが良い）"]), "メモ");
      const lines = [header.map(csvCell).join(",")];
      sample.forEach((entry, index) => {
        let input = entry.record.image_url || "";
        if (!vision) input = JSON.stringify(entry.input || {}).slice(0, 600);
        else if (entry.input?.caption) input += ` （caption: ${entry.input.caption}）`;
        const cells = [index + 1, task, entry.record.key, entry.id, entry.record.pages.map((id) => pageUrlById[id] || id).join(" "), input, ...configs.map((config) => entry.values[config])];
        cells.push(...(vision ? ["", ""] : [""]), "");
        lines.push(cells.map(csvCell).join(","));
      });
      fs.writeFileSync(path.join(csvDir, `${name}.csv`), `\ufeff${lines.join("\r\n")}\r\n`);
      console.error(`csv ${name}: ${sample.length}/${pool.length}`);
    }

    // Every primary-field disagreement between A and C (and D for images), so a person can
    // check whether さくら's mistakes outnumber Gemini's (4章 L2: 食い違った分は抜き取りで人が見る).
    const header = ["no", "task", "field", "config", "request_key", "item_id", "pages", "input_or_image", "A の値", "比べた構成の値", "A の文言", "比べた構成の文言", "正しいのは（A/比べた構成/両方誤り/判断できない）", "メモ"];
    const lines = [header.map(csvCell).join(",")];
    const primary = disagreements.filter((entry) => ["C", "D"].includes(entry.config) && (CLASS_FIELDS[entry.task] || []).includes(entry.field));
    const wording = (item) => (item ? item.alt_text || item.extracted_text || item.explanation || item.reason || item.suggested_text || "" : "");
    primary.forEach((entry, index) => {
      const record = requestByKey.get(entry.key);
      const itemA = itemsOf(results.A.get(entry.key))?.get(entry.id);
      const itemX = itemsOf(results[entry.config].get(entry.key))?.get(entry.id);
      const input = record.kind === "vision" ? record.image_url || record.image_sha256 : JSON.stringify(inputItems(record).get(entry.id) || {}).slice(0, 400);
      lines.push(
        [index + 1, entry.task, entry.field, entry.config, entry.key, entry.id, record.pages.map((id) => pageUrlById[id] || id).join(" "), input, entry.A, entry.X, wording(itemA), wording(itemX), "", ""]
          .map(csvCell)
          .join(",")
      );
    });
    fs.writeFileSync(path.join(csvDir, "disagreements.csv"), `\ufeff${lines.join("\r\n")}\r\n`);
    console.error(`csv disagreements: ${primary.length}`);
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const command = args._[0];
  if (!args.dir) throw new Error("--dir <work dir outside the repository> is required");
  if (command === "capture") await capture(args);
  else if (command === "run") await run(args);
  else if (command === "report") report(args);
  else throw new Error("usage: llm-provider-eval.js capture|run|report --dir <dir> [...]");
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});

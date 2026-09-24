// LLM の呼び出し(lib/llm.js と server.js の /api/llm/*)の回帰テスト。
//
// 実際の提供元には接続しない。Node の http で提供元をまねたモックのサーバーを立て、
// GEMINI_API_BASE_URL と SAKURA_AI_BASE_URL をそこへ向ける。Vertex AI 経由(GEMINI_AUTH_MODE=adc)はメタデータサーバーが
// 要るので、lib/llm.js の __setTestHooks() でトークンの取得と fetch を差し替えて試す。
// 設計: goal2-app/LLM_PROVIDER_SWITCH_INSTRUCTIONS.md 3.1〜3.10
// 実行: node test/llm/run-llm-tests.js
const path = require("path");
const http = require("http");
const fs = require("fs");
const os = require("os");
const { spawn } = require("child_process");

const rootDir = path.resolve(__dirname, "../..");
const llmPath = path.join(rootDir, "lib/llm.js");
const { getTaskConfig, TASKS } = require(path.join(rootDir, "lib/llm-prompts.js"));
const baseline = require("./fixtures/gemini-api-key-baseline.json");

const TEST_GEMINI_KEY = "TEST_GEMINI_KEY";
const TEST_SAKURA_KEY = "00000000-1111-2222-3333-444444444444:TEST_SAKURA_SECRET";
const SERVER_PORT = Number(process.env.LLM_TEST_PORT || 8131);

// テストの外から入った LLM 関係の環境変数が結果を変えないように、毎回まっさらにする。
const LLM_ENV_PREFIXES = ["GEMINI_", "LLM_", "SAKURA_AI_", "USD_JPY_RATE"];
function cleanEnv(extra) {
  const env = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (!LLM_ENV_PREFIXES.some((prefix) => key.startsWith(prefix))) env[key] = value;
  }
  return { ...env, LLM_MAX_CALLS_PER_MINUTE: "1000", ...extra };
}

// 指定の環境変数で lib/llm.js を読み直す(定数の一部は読み込み時に環境変数を見るため)。
function loadLlm(extraEnv) {
  const saved = process.env;
  process.env = cleanEnv(extraEnv);
  delete require.cache[require.resolve(llmPath)];
  const llm = require(llmPath);
  llm.__setTestHooks({});
  return {
    llm,
    restore() {
      process.env = saved;
    },
  };
}

// 提供元をまねたモックのサーバー。受けた要求を記録し、respond() が返す応答を返す。
// 既定の respond() は、宛先で Gemini とさくらを分けて gemini / sakura の応答を返す。
function startMockProvider() {
  const requests = [];
  const routes = { gemini: () => geminiReply("[]"), sakura: () => sakuraReply("[]") };
  const byRoute = (record, count) => (record.url.includes("/chat/completions") ? routes.sakura : routes.gemini)(record, count);
  let respond = byRoute;
  const server = http.createServer((req, res) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => {
      const record = { method: req.method, url: req.url, headers: req.headers, body: Buffer.concat(chunks).toString("utf8") };
      requests.push(record);
      const reply = respond(record, requests.length);
      res.writeHead(reply.status, { "content-type": "application/json" });
      res.end(typeof reply.raw === "string" ? reply.raw : JSON.stringify(reply.json));
    });
  });
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      resolve({
        baseUrl: `http://127.0.0.1:${server.address().port}`,
        requests,
        setResponder(fn) {
          respond = fn;
        },
        setRoutes({ gemini, sakura }) {
          routes.gemini = gemini || (() => geminiReply("[]"));
          routes.sakura = sakura || (() => sakuraReply("[]"));
          respond = byRoute;
        },
        reset() {
          requests.length = 0;
        },
        of(route) {
          return requests.filter((r) => (route === "sakura") === r.url.includes("/chat/completions"));
        },
        close: () => new Promise((done) => server.close(done)),
      });
    });
  });
}

function geminiReply(text, usageMetadata = { promptTokenCount: 1000, candidatesTokenCount: 200, totalTokenCount: 1200 }) {
  return { status: 200, json: { candidates: [{ content: { parts: [{ text }] } }], usageMetadata } };
}

function sakuraReply(content, { finishReason = "stop", usage = { prompt_tokens: 1000, completion_tokens: 200, total_tokens: 1200 } } = {}) {
  return {
    status: 200,
    json: { choices: [{ index: 0, message: { role: "assistant", content }, finish_reason: finishReason }], usage },
  };
}

const results = [];
async function test(name, fn) {
  try {
    await fn();
    results.push({ name, pass: true });
  } catch (error) {
    results.push({ name, pass: false, detail: error && error.stack ? error.stack.split("\n").slice(0, 3).join("\n       ") : String(error) });
  }
}
function assert(condition, message) {
  if (!condition) throw new Error(message);
}
function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message}\n         expected: ${String(expected).slice(0, 300)}\n         actual:   ${String(actual).slice(0, 300)}`);
  }
}

// 基準(fixtures/gemini-api-key-baseline.json)を作ったときと同じ入力。
const textTask = getTaskConfig("foreign-language");
const imageTask = getTaskConfig("image-alt");
const BASELINE_TEXT_INPUT = {
  kind: "text",
  task: "foreign-language",
  systemPrompt: textTask.systemPrompt,
  userText: textTask.buildUserText([
    { id: "c1", text: "Hello world です" },
    { id: "c2", text: "ごみの出し方" },
  ]),
  responseSchema: textTask.responseSchema,
};
const BASELINE_IMAGE_INPUT = {
  kind: "vision",
  task: "image-alt",
  systemPrompt: imageTask.systemPrompt,
  userText: imageTask.buildUserText({ caption: "市役所の外観" }),
  image: { base64: "iVBORw0KGgo=", mimeType: "image/png" },
  responseSchema: imageTask.responseSchema,
};

const FOREIGN_OK = '[{"id":"c1","is_foreign":true,"lang_code":"en","language_name_ja":"英語"},{"id":"c2","is_foreign":false}]';

function sakuraEnv(extra) {
  return { LLM_TEXT_PROVIDER: "sakura", SAKURA_AI_API_KEY: TEST_SAKURA_KEY, SAKURA_AI_BASE_URL: `${mockBaseUrl}/v1`, ...extra };
}
function geminiEnv(extra) {
  return { GEMINI_API_KEY: TEST_GEMINI_KEY, GEMINI_API_BASE_URL: `${mockBaseUrl}/v1beta/models`, ...extra };
}
let mockBaseUrl = "";

async function withLlm(env, fn) {
  const { llm, restore } = loadLlm(env);
  try {
    return await fn(llm);
  } finally {
    restore();
  }
}

async function expectError(promise) {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error("エラーになるはずが成功した");
}

function pathAndQuery(url) {
  const parsed = new URL(url);
  return parsed.pathname.replace(/^.*\/models\//, "/models/") + parsed.search;
}

// server.js を別のプロセスで立てる。LLM の環境変数は extraEnv の分だけにする。
async function startAppServer(extraEnv) {
  const child = spawn(process.execPath, ["server.js"], {
    cwd: rootDir,
    env: cleanEnv({ PORT: String(SERVER_PORT), ...extraEnv }),
    stdio: ["ignore", "pipe", "pipe"],
  });
  let stderr = "";
  child.stderr.on("data", (chunk) => {
    stderr += chunk;
  });
  const base = `http://127.0.0.1:${SERVER_PORT}`;
  for (let i = 0; i < 100; i += 1) {
    try {
      const res = await fetch(`${base}/api/llm/status`);
      if (res.ok) return { base, stop: () => new Promise((done) => (child.once("exit", done), child.kill())) };
    } catch {
      // まだ起動していない
    }
    await new Promise((done) => setTimeout(done, 100));
  }
  child.kill();
  throw new Error(`server.js が起動しませんでした: ${stderr}`);
}

async function postJson(url, body) {
  const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  return { status: res.status, json: await res.json() };
}

async function main() {
  const mock = await startMockProvider();
  mockBaseUrl = mock.baseUrl;

  // --- 何も設定しないとき(いまと同じ) ---
  await test("設定なし: /api/llm/status は configured: false、/api/llm/enrich は 503 と llm_not_configured", async () => {
    const app = await startAppServer({});
    try {
      const status = await (await fetch(`${app.base}/api/llm/status`)).json();
      assertEqual(status.configured, false, "configured");
      const enrich = await postJson(`${app.base}/api/llm/enrich`, { task: "foreign-language", items: [{ id: "c1", text: "Hello" }] });
      assertEqual(enrich.status, 503, "status code");
      assertEqual(enrich.json.error, "llm_not_configured", "error code");
    } finally {
      await app.stop();
    }
  });

  // --- GEMINI_API_KEY だけのとき、送る本文が変更前と1バイトも変わらない ---
  await test("GEMINI_API_KEY だけ: 文字のタスクの宛先と本文が変更前と同じ", async () => {
    const { llm, restore } = loadLlm({ GEMINI_API_KEY: TEST_GEMINI_KEY, GEMINI_API_BASE_URL: `${mock.baseUrl}/v1beta/models` });
    mock.reset();
    mock.setResponder(() => geminiReply("[]"));
    try {
      await llm.callLlm(BASELINE_TEXT_INPUT);
    } finally {
      restore();
    }
    assertEqual(mock.requests.length, 1, "呼び出し回数");
    assertEqual(mock.requests[0].url, pathAndQuery(baseline.requests[0].url).replace(/^\/models/, "/v1beta/models"), "宛先");
    assertEqual(mock.requests[0].body, baseline.requests[0].body, "本文");
  });

  await test("GEMINI_API_KEY だけ: 画像のタスクの本文が変更前と同じ", async () => {
    const { llm, restore } = loadLlm({ GEMINI_API_KEY: TEST_GEMINI_KEY, GEMINI_API_BASE_URL: `${mock.baseUrl}/v1beta/models` });
    mock.reset();
    mock.setResponder(() => geminiReply('{"alt_text":"市役所"}'));
    try {
      await llm.callLlm(BASELINE_IMAGE_INPUT);
    } finally {
      restore();
    }
    assertEqual(mock.requests[0].body, baseline.requests[1].body, "本文");
  });

  await test("GEMINI_API_KEY だけ: /api/llm/enrich を通しても本文が変更前と同じで、応答の形も同じ", async () => {
    mock.reset();
    mock.setResponder(() => geminiReply('[{"id":"c1","is_foreign":true,"lang_code":"en","language_name_ja":"英語"},{"id":"c2","is_foreign":false}]'));
    const app = await startAppServer({ GEMINI_API_KEY: TEST_GEMINI_KEY, GEMINI_API_BASE_URL: `${mock.baseUrl}/v1beta/models` });
    let res;
    try {
      res = await postJson(`${app.base}/api/llm/enrich`, {
        task: "foreign-language",
        items: [
          { id: "c1", text: "Hello world です" },
          { id: "c2", text: "ごみの出し方" },
        ],
      });
    } finally {
      await app.stop();
    }
    assertEqual(mock.requests[0].body, baseline.requests[0].body, "本文");
    assertEqual(res.status, 200, "status code");
    assertEqual(res.json.ok, true, "ok");
    assertEqual(res.json.results.length, 2, "results");
    assertEqual(res.json.results[0].lang_code, "en", "results[0]");
    assert(typeof res.json.usage.estimatedCostUsd === "number" && typeof res.json.usage.estimatedCostJpy === "number", "usage");
  });

  // --- L0: 温度、考える量、global の宛先 ---
  await test("L0: GEMINI_TEMPERATURE=1 で温度 1 を送る。数でない値は 0 のまま", async () => {
    for (const [value, expected] of [
      ["1", 1],
      ["0.5", 0.5],
      ["abc", 0],
      ["", 0],
    ]) {
      const { llm, restore } = loadLlm({ GEMINI_API_KEY: TEST_GEMINI_KEY, GEMINI_API_BASE_URL: mock.baseUrl, GEMINI_TEMPERATURE: value });
      mock.reset();
      mock.setResponder(() => geminiReply("[]"));
      try {
        await llm.callLlm(BASELINE_TEXT_INPUT);
      } finally {
        restore();
      }
      assertEqual(JSON.parse(mock.requests[0].body).generationConfig.temperature, expected, `GEMINI_TEMPERATURE=${value}`);
    }
  });

  await test("L0: GEMINI_THINKING_LEVEL を thinkingConfig.thinkingLevel で送る。未設定と不正な値では送らない", async () => {
    for (const [value, expected] of [
      ["low", "LOW"],
      ["MINIMAL", "MINIMAL"],
      ["", undefined],
      ["extreme", undefined],
    ]) {
      const { llm, restore } = loadLlm({ GEMINI_API_KEY: TEST_GEMINI_KEY, GEMINI_API_BASE_URL: mock.baseUrl, GEMINI_THINKING_LEVEL: value });
      mock.reset();
      mock.setResponder(() => geminiReply("[]"));
      try {
        await llm.callLlm(BASELINE_TEXT_INPUT);
      } finally {
        restore();
      }
      const config = JSON.parse(mock.requests[0].body).generationConfig;
      assertEqual(config.thinkingConfig?.thinkingLevel, expected, `GEMINI_THINKING_LEVEL=${value}`);
      if (expected === undefined) assert(!("thinkingConfig" in config), "thinkingConfig が無いこと");
    }
  });

  await test("L0: Vertex AI の宛先。global は aiplatform.googleapis.com、地域は {地域}-aiplatform.googleapis.com", async () => {
    for (const [location, expectedHost] of [
      ["global", "aiplatform.googleapis.com"],
      ["asia-northeast1", "asia-northeast1-aiplatform.googleapis.com"],
      [undefined, "us-central1-aiplatform.googleapis.com"],
    ]) {
      const env = { GEMINI_AUTH_MODE: "adc", GEMINI_MODEL: "gemini-3.5-flash" };
      if (location) env.GEMINI_VERTEX_LOCATION = location;
      const { llm, restore } = loadLlm(env);
      const captured = [];
      llm.__setTestHooks({
        getAccessToken: async () => "TEST_ACCESS_TOKEN",
        getVertexProjectId: async () => "test-project",
        fetch: async (url, init) => {
          captured.push({ url, init });
          return new Response(JSON.stringify(geminiReply("[]").json), { status: 200 });
        },
      });
      try {
        await llm.callLlm(BASELINE_TEXT_INPUT);
      } finally {
        restore();
      }
      const expectedLocation = location || "us-central1";
      assertEqual(
        captured[0].url,
        `https://${expectedHost}/v1/projects/test-project/locations/${expectedLocation}/publishers/google/models/gemini-3.5-flash:generateContent`,
        `宛先(${expectedLocation})`
      );
      assertEqual(captured[0].init.headers.authorization, "Bearer TEST_ACCESS_TOKEN", "認証ヘッダー");
    }
  });

  await test("L0: 案 A の設定(東京、gemini-3.5-flash、温度 1)で本文に反映される", async () => {
    const { llm, restore } = loadLlm({
      GEMINI_AUTH_MODE: "adc",
      GEMINI_VERTEX_LOCATION: "asia-northeast1",
      GEMINI_MODEL: "gemini-3.5-flash",
      GEMINI_TEMPERATURE: "1",
      GEMINI_THINKING_LEVEL: "low",
    });
    const captured = [];
    llm.__setTestHooks({
      getAccessToken: async () => "TEST_ACCESS_TOKEN",
      getVertexProjectId: async () => "test-project",
      fetch: async (url, init) => {
        captured.push({ url, body: JSON.parse(init.body) });
        return new Response(JSON.stringify(geminiReply("[]").json), { status: 200 });
      },
    });
    try {
      await llm.callLlm(BASELINE_TEXT_INPUT);
    } finally {
      restore();
    }
    assert(captured[0].url.includes("/locations/asia-northeast1/publishers/google/models/gemini-3.5-flash:"), "宛先");
    assertEqual(captured[0].body.generationConfig.temperature, 1, "温度");
    assertEqual(captured[0].body.generationConfig.thinkingConfig.thinkingLevel, "LOW", "考える量");
    assertEqual(captured[0].body.generationConfig.responseSchema.type, "ARRAY", "スキーマはそのまま");
  });

  // --- L1: 提供元の切り替え ---
  await test("L1: 設定なしの /api/llm/status は提供元とモデルを足し、configured の意味は変えない", async () => {
    const app = await startAppServer({});
    try {
      const status = await (await fetch(`${app.base}/api/llm/status`)).json();
      assertEqual(
        JSON.stringify(status),
        JSON.stringify({
          configured: false,
          text: { provider: "gemini", model: "gemini-2.5-flash" },
          vision: { provider: "gemini", model: "gemini-2.5-flash" },
        }),
        "status"
      );
    } finally {
      await app.stop();
    }
    await withLlm(sakuraEnv(), async (llm) => {
      const status = llm.getStatus();
      assertEqual(status.configured, true, "sakura の文字だけでも configured");
      assertEqual(status.text.provider, "sakura", "text.provider");
      assertEqual(status.text.model, "gpt-oss-120b", "text.model");
      assertEqual(status.vision.provider, "gemini", "vision.provider");
    });
  });

  await test("L1: さくらの文字のタスク。モデル、2つの messages、温度 0、変換後のスキーマを送り、配列の形に戻して円で費用を出す", async () => {
    mock.reset();
    mock.setRoutes({ sakura: () => sakuraReply(JSON.stringify({ results: JSON.parse(FOREIGN_OK) })) });
    const result = await withLlm(sakuraEnv(), (llm) => llm.callLlm(BASELINE_TEXT_INPUT));
    assertEqual(mock.of("gemini").length, 0, "Gemini は呼ばない");
    const sent = mock.of("sakura");
    assertEqual(sent.length, 1, "呼び出し回数");
    assertEqual(sent[0].url, "/v1/chat/completions", "宛先");
    assertEqual(sent[0].headers.authorization, `Bearer ${TEST_SAKURA_KEY}`, "認証");
    const body = JSON.parse(sent[0].body);
    assertEqual(body.model, "gpt-oss-120b", "model");
    assertEqual(body.messages.length, 2, "messages の数");
    assertEqual(body.messages[0].role, "system", "system");
    assert(body.messages[0].content.startsWith(textTask.systemPrompt), "system の先頭は元のシステム指示");
    assert(body.messages[0].content.includes("JSON Schema に従う JSON だけ"), "system の末尾にスキーマの指示");
    assertEqual(body.messages[1].role, "user", "user");
    assertEqual(body.messages[1].content, BASELINE_TEXT_INPUT.userText, "user の本文");
    assertEqual(body.temperature, 0, "temperature");
    assertEqual(body.max_tokens, 16384, "max_tokens");
    assertEqual(body.reasoning_effort, "low", "reasoning_effort");
    const format = body.response_format;
    assertEqual(format.type, "json_schema", "response_format.type");
    assertEqual(format.json_schema.name, "foreign-language", "json_schema.name");
    assertEqual(format.json_schema.strict, true, "strict");
    const schema = format.json_schema.schema;
    assertEqual(schema.type, "object", "包んだ外側は object");
    assertEqual(schema.additionalProperties, false, "外側の additionalProperties");
    assertEqual(JSON.stringify(schema.required), '["results"]', "results が必須");
    assertEqual(schema.properties.results.type, "array", "results は array");
    assertEqual(schema.properties.results.items.type, "object", "items は object");
    assertEqual(schema.properties.results.items.additionalProperties, false, "items の additionalProperties");
    assertEqual(schema.properties.results.items.properties.is_foreign.type, "boolean", "小文字の型");
    assert(body.messages[0].content.includes(JSON.stringify(schema)), "システム指示に変換後のスキーマ");
    assert(Array.isArray(result.json) && result.json.length === 2, "配列の形に戻る");
    assertEqual(result.json[0].lang_code, "en", "中身");
    assertEqual(result.provider, "sakura", "provider");
    assertEqual(result.model, "gpt-oss-120b", "model");
    assertEqual(result.fallback_used, false, "fallback_used");
    // 1000 * 15 / 1M + 200 * 75 / 1M = 0.03 円
    assert(Math.abs(result.usage.estimatedCostJpy - 0.03) < 1e-9, `円の費用 ${result.usage.estimatedCostJpy}`);
    assert(Math.abs(result.usage.estimatedCostUsd - 0.03 / 162) < 1e-12, "ドルは USD_JPY_RATE で割る");
    assertEqual(result.usage.inputTokens, 1000, "inputTokens");
    assertEqual(result.usage.outputTokens, 200, "outputTokens");
  });

  await test("L1: さくらの画像のタスク。image_url を data:<MIME>;base64, で本文の後に置き、画像のモデルと単価を使う", async () => {
    mock.reset();
    mock.setRoutes({ sakura: () => sakuraReply('{"alt_text":"市役所の外観の写真","is_decorative":false}') });
    const result = await withLlm(sakuraEnv({ LLM_VISION_PROVIDER: "sakura" }), (llm) => llm.callLlm(BASELINE_IMAGE_INPUT));
    const body = JSON.parse(mock.of("sakura")[0].body);
    assertEqual(body.model, "preview/Qwen3-VL-30B-A3B-Instruct", "model");
    assert(!("reasoning_effort" in body), "画像のモデルには reasoning_effort を送らない");
    const content = body.messages[1].content;
    assertEqual(content[0].type, "text", "本文が先");
    assertEqual(content[0].text, BASELINE_IMAGE_INPUT.userText, "本文");
    assertEqual(content[1].type, "image_url", "画像が後");
    assertEqual(content[1].image_url.url, "data:image/png;base64,iVBORw0KGgo=", "data URL");
    assertEqual(body.response_format.json_schema.schema.type, "object", "外側が object のスキーマは包まない");
    assert(!("results" in body.response_format.json_schema.schema.properties), "results で包まない");
    assertEqual(result.json.alt_text, "市役所の外観の写真", "結果");
    // 1000 * 10 / 1M + 200 * 30 / 1M = 0.016 円
    assert(Math.abs(result.usage.estimatedCostJpy - 0.016) < 1e-9, `円の費用 ${result.usage.estimatedCostJpy}`);
  });

  await test("L1: コードブロックで囲まれた応答と、包まずに配列で返った応答を取り出せる", async () => {
    for (const content of ["```json\n" + JSON.stringify({ results: JSON.parse(FOREIGN_OK) }) + "\n```", `  ${FOREIGN_OK}\n`]) {
      mock.reset();
      mock.setRoutes({ sakura: () => sakuraReply(content) });
      const result = await withLlm(sakuraEnv(), (llm) => llm.callLlm(BASELINE_TEXT_INPUT));
      assertEqual(result.json.length, 2, "件数");
      assertEqual(mock.of("sakura").length, 1, "やり直さない");
    }
  });

  await test("L1: 余分な項目は捨てる。任意の項目の null は無いものとして扱う", async () => {
    mock.reset();
    mock.setRoutes({
      sakura: () => sakuraReply(JSON.stringify({ results: [{ id: "c1", is_foreign: false, lang_code: null, extra: "x" }] })),
    });
    const result = await withLlm(sakuraEnv(), (llm) => llm.callLlm(BASELINE_TEXT_INPUT));
    assertEqual(JSON.stringify(result.json), '[{"id":"c1","is_foreign":false}]', "結果");
  });

  for (const [label, reply] of [
    ["中身が空の応答", () => sakuraReply("")],
    ['finish_reason: "length" の応答', () => sakuraReply('{"results":[{"id":"c1"', { finishReason: "length" })],
    ["required が欠けた応答", () => sakuraReply(JSON.stringify({ results: [{ id: "c1" }] }))],
    ["型の違う応答", () => sakuraReply(JSON.stringify({ results: [{ id: "c1", is_foreign: "yes" }] }))],
    ["JSON でない応答", () => sakuraReply("申し訳ありません")],
    ["500 の応答", () => ({ status: 500, json: { error: "internal" } })],
  ]) {
    await test(`L1: ${label}で、同じ提供元で1回やり直し、なお失敗すれば受け皿の Gemini に回る`, async () => {
      mock.reset();
      mock.setRoutes({ sakura: reply, gemini: () => geminiReply(FOREIGN_OK) });
      const result = await withLlm(sakuraEnv(geminiEnv({ LLM_FALLBACK_PROVIDER: "gemini" })), (llm) => llm.callLlm(BASELINE_TEXT_INPUT));
      assertEqual(mock.of("sakura").length, 2, "さくらは2回");
      assertEqual(mock.of("gemini").length, 1, "Gemini は1回");
      assertEqual(result.provider, "gemini", "provider");
      assertEqual(result.model, "gemini-2.5-flash", "model");
      assertEqual(result.fallback_used, true, "fallback_used");
      assertEqual(result.json.length, 2, "結果");
    });
  }

  await test("L1: やり直しで直ったときは受け皿に回らない", async () => {
    mock.reset();
    mock.setRoutes({ sakura: (_record, count) => (count === 1 ? sakuraReply("") : sakuraReply(FOREIGN_OK)) });
    const result = await withLlm(sakuraEnv(geminiEnv({ LLM_FALLBACK_PROVIDER: "gemini" })), (llm) => llm.callLlm(BASELINE_TEXT_INPUT));
    assertEqual(mock.of("sakura").length, 2, "さくらは2回");
    assertEqual(mock.of("gemini").length, 0, "Gemini は呼ばない");
    assertEqual(result.provider, "sakura", "provider");
    assertEqual(result.fallback_used, false, "fallback_used");
    assertEqual(result.usage.inputTokens, 2000, "やり直しの分も数える");
  });

  await test("L1: 429 はやり直さずに受け皿に回り、費用は両方の分を数える", async () => {
    mock.reset();
    mock.setRoutes({ sakura: () => ({ status: 429, json: { error: "rate limited" } }), gemini: () => geminiReply(FOREIGN_OK) });
    const result = await withLlm(sakuraEnv(geminiEnv({ LLM_FALLBACK_PROVIDER: "gemini" })), (llm) => llm.callLlm(BASELINE_TEXT_INPUT));
    assertEqual(mock.of("sakura").length, 1, "さくらは1回");
    assertEqual(result.provider, "gemini", "provider");
    assertEqual(result.fallback_used, true, "fallback_used");

    mock.reset();
    mock.setRoutes({ sakura: () => sakuraReply(""), gemini: () => geminiReply(FOREIGN_OK) });
    const summed = await withLlm(sakuraEnv(geminiEnv({ LLM_FALLBACK_PROVIDER: "gemini" })), (llm) => llm.callLlm(BASELINE_TEXT_INPUT));
    // さくら 2回(0.03円 x2) + Gemini 1回(1000*0.3/1M + 200*2.5/1M = 0.0008 ドル = 0.1296 円)
    assert(Math.abs(summed.usage.estimatedCostJpy - (0.06 + 0.0008 * 162)) < 1e-9, `費用の合計 ${summed.usage.estimatedCostJpy}`);
    assertEqual(summed.usage.inputTokens, 3000, "トークンの合計");
  });

  await test("L1: 受け皿が none のときはエラーを返す(/api/llm/enrich は 502 と llm_schema_mismatch)", async () => {
    mock.reset();
    mock.setRoutes({ sakura: () => sakuraReply(JSON.stringify({ results: [{ id: "c1" }] })) });
    const error = await withLlm(sakuraEnv(geminiEnv()), (llm) => expectError(llm.callLlm(BASELINE_TEXT_INPUT)));
    assertEqual(error.code, "llm_schema_mismatch", "code");
    assertEqual(mock.of("sakura").length, 2, "やり直しは1回");
    assertEqual(mock.of("gemini").length, 0, "Gemini は呼ばない");

    mock.reset();
    const app = await startAppServer(sakuraEnv());
    let res;
    try {
      res = await postJson(`${app.base}/api/llm/enrich`, { task: "foreign-language", items: [{ id: "c1", text: "Hello" }] });
    } finally {
      await app.stop();
    }
    assertEqual(res.status, 502, "status code");
    assertEqual(res.json.error, "llm_schema_mismatch", "error");
  });

  await test("L1: 受け皿が主と同じ提供元のときは使わない。受け皿も失敗したら主のエラーを返す", async () => {
    mock.reset();
    mock.setRoutes({ gemini: () => geminiReply("") });
    const same = await withLlm(geminiEnv({ LLM_FALLBACK_PROVIDER: "gemini" }), (llm) => expectError(llm.callLlm(BASELINE_TEXT_INPUT)));
    assertEqual(same.code, "llm_empty_response", "code");
    assertEqual(mock.of("gemini").length, 2, "Gemini はやり直しを含めて2回だけ");

    mock.reset();
    mock.setRoutes({ sakura: () => sakuraReply(""), gemini: () => ({ status: 500, json: {} }) });
    const both = await withLlm(sakuraEnv(geminiEnv({ LLM_FALLBACK_PROVIDER: "gemini" })), (llm) => expectError(llm.callLlm(BASELINE_TEXT_INPUT)));
    assertEqual(both.code, "llm_empty_response", "主のエラー");
    assert(both.message.includes("受け皿 gemini"), "受け皿のエラーも載せる");
    assertEqual(mock.of("gemini").length, 1, "受け皿は1回だけ");
  });

  await test("L1: Gemini の応答も検証する(required の欠けは1回やり直してエラー)", async () => {
    mock.reset();
    mock.setRoutes({ gemini: () => geminiReply('[{"id":"c1"}]') });
    const error = await withLlm(geminiEnv(), (llm) => expectError(llm.callLlm(BASELINE_TEXT_INPUT)));
    assertEqual(error.code, "llm_schema_mismatch", "code");
    assertEqual(mock.of("gemini").length, 2, "やり直しは1回");
  });

  await test("L1: キャッシュの鍵が提供元ごとに分かれる", async () => {
    mock.reset();
    mock.setRoutes({ gemini: () => geminiReply(FOREIGN_OK), sakura: () => sakuraReply(FOREIGN_OK) });
    // モデル名をそろえ、提供元だけが違う状態にする。
    const { llm, restore } = loadLlm(sakuraEnv(geminiEnv({ LLM_TEXT_PROVIDER: "gemini", SAKURA_AI_TEXT_MODEL: "gemini-2.5-flash" })));
    try {
      await llm.callLlm(BASELINE_TEXT_INPUT);
      await llm.callLlm(BASELINE_TEXT_INPUT);
      assertEqual(mock.of("gemini").length, 1, "Gemini の2回目はキャッシュ");
      process.env.LLM_TEXT_PROVIDER = "sakura";
      const fromSakura = await llm.callLlm(BASELINE_TEXT_INPUT);
      assertEqual(mock.of("sakura").length, 1, "提供元を替えるとキャッシュに当たらない");
      assertEqual(fromSakura.provider, "sakura", "provider");
      await llm.callLlm(BASELINE_TEXT_INPUT);
      assertEqual(mock.of("sakura").length, 1, "さくらの2回目はキャッシュ");
    } finally {
      restore();
    }
  });

  await test("L1: エラーのメッセージに API キーが出ない", async () => {
    mock.reset();
    // 受け取った認証ヘッダーをそのまま本文に返す、たちの悪い提供元をまねる。
    mock.setResponder((record) => ({ status: 500, raw: `upstream error: ${record.headers.authorization} ${record.url}` }));
    const sakuraError = await withLlm(sakuraEnv(), (llm) => expectError(llm.callLlm(BASELINE_TEXT_INPUT)));
    assert(sakuraError.message.includes("Sakura AI API error 500"), "エラーの内容");
    assert(!sakuraError.message.includes("TEST_SAKURA_SECRET"), `さくらのキーが出ている: ${sakuraError.message}`);
    const geminiError = await withLlm(geminiEnv(), (llm) => expectError(llm.callLlm(BASELINE_TEXT_INPUT)));
    assert(geminiError.message.includes("Gemini API error 500"), "エラーの内容");
    assert(!geminiError.message.includes(TEST_GEMINI_KEY), `Gemini のキーが出ている: ${geminiError.message}`);
  });

  await test("L1: LLM_RECORD_DIR に要求と画像を書き出す。提供元が無くても書き出し、キーと宛先は書かない", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "llm-record-"));
    try {
      const notConfigured = await withLlm({ LLM_RECORD_DIR: dir }, (llm) => expectError(llm.callLlm(BASELINE_TEXT_INPUT)));
      assertEqual(notConfigured.code, "llm_not_configured", "設定なしはいまと同じエラー");
      assertEqual(notConfigured.statusCode, 503, "503");
      mock.reset();
      mock.setRoutes({ sakura: () => sakuraReply('{"alt_text":"市役所"}') });
      await withLlm(sakuraEnv({ LLM_VISION_PROVIDER: "sakura", LLM_RECORD_DIR: dir }), (llm) => llm.callLlm(BASELINE_IMAGE_INPUT));

      const raw = fs.readFileSync(path.join(dir, "requests.jsonl"), "utf8");
      const lines = raw.trim().split("\n").map((line) => JSON.parse(line));
      assertEqual(lines.length, 2, "2行");
      assertEqual(
        JSON.stringify(Object.keys(lines[0])),
        JSON.stringify(["task", "kind", "systemPrompt", "userText", "responseSchema", "image_sha256", "image_mime"]),
        "項目"
      );
      assertEqual(lines[0].task, "foreign-language", "task");
      assertEqual(lines[0].kind, "text", "kind");
      assertEqual(lines[0].userText, BASELINE_TEXT_INPUT.userText, "userText");
      assertEqual(lines[0].responseSchema.type, "ARRAY", "変換前のスキーマ");
      assertEqual(lines[0].image_sha256, null, "文字のタスクは画像なし");
      assertEqual(lines[1].kind, "vision", "kind");
      assertEqual(lines[1].image_mime, "image/png", "image_mime");
      const imageFile = path.join(dir, "images", `${lines[1].image_sha256}.png`);
      assert(fs.existsSync(imageFile), "画像を保存する");
      assertEqual(fs.readFileSync(imageFile).toString("base64"), "iVBORw0KGgo=", "画像の中身");
      for (const secret of ["TEST_SAKURA_SECRET", TEST_GEMINI_KEY, mockBaseUrl, "api.ai.sakura.ad.jp"]) {
        assert(!raw.includes(secret), `書き出しに ${secret} が含まれる`);
      }
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  await test("L1: /api/llm/enrich をさくらで通すと、応答に provider と model が足される", async () => {
    mock.reset();
    mock.setRoutes({ sakura: () => sakuraReply(JSON.stringify({ results: JSON.parse(FOREIGN_OK) })) });
    const app = await startAppServer(sakuraEnv());
    let res;
    try {
      res = await postJson(`${app.base}/api/llm/enrich`, {
        task: "foreign-language",
        items: [
          { id: "c1", text: "Hello world です" },
          { id: "c2", text: "ごみの出し方" },
        ],
      });
    } finally {
      await app.stop();
    }
    assertEqual(res.status, 200, "status code");
    assertEqual(
      JSON.stringify(Object.keys(res.json)),
      JSON.stringify(["ok", "results", "usage", "provider", "model", "fallback_used"]),
      "応答の項目"
    );
    assertEqual(res.json.provider, "sakura", "provider");
    assertEqual(res.json.model, "gpt-oss-120b", "model");
    assertEqual(res.json.results.length, 2, "results");
    assertEqual(JSON.parse(mock.of("sakura")[0].body).messages[1].content, BASELINE_TEXT_INPUT.userText, "送った本文");
  });

  await test("L1: 13 のタスクのスキーマがすべて変換でき、大文字の型が残らない", async () => {
    const { toOpenAiResponseSchema } = require(llmPath);
    const names = Object.keys(TASKS);
    assertEqual(names.length, 13, "タスクの数");
    const walk = (node, where, check) => {
      if (!node || typeof node !== "object") return;
      check(node, where);
      for (const [key, value] of Object.entries(node)) {
        if (key === "properties") for (const [name, child] of Object.entries(value)) walk(child, `${where}.${name}`, check);
        else if (key === "items") walk(value, `${where}[]`, check);
      }
    };
    for (const name of names) {
      const original = TASKS[name].responseSchema;
      const { wrapped, schema } = toOpenAiResponseSchema(original);
      assertEqual(wrapped, original.type === "ARRAY", `${name}: 配列だけ包む`);
      assertEqual(schema.type, "object", `${name}: 外側は object`);
      walk(schema, name, (node, where) => {
        assert(["object", "array", "string", "boolean"].includes(node.type), `${where}: 型 ${node.type}`);
        if (node.type === "object") {
          assertEqual(node.additionalProperties, false, `${where}: additionalProperties`);
          for (const key of node.required || []) assert(key in node.properties, `${where}: required の ${key} が properties に無い`);
        }
      });
      assert(!/"type":"[A-Z]/.test(JSON.stringify(schema)), `${name}: 大文字の型が残っている`);
      assertEqual(JSON.stringify(TASKS[name].responseSchema), JSON.stringify(original), `${name}: 元のスキーマを書き換えない`);
    }
  });

  await test("L1: 未対応の提供元の値は gemini として扱う(いまと同じ)", async () => {
    mock.reset();
    mock.setRoutes({ gemini: () => geminiReply("[]") });
    const warn = console.warn;
    console.warn = () => {};
    try {
      const result = await withLlm(geminiEnv({ LLM_TEXT_PROVIDER: "openai", LLM_FALLBACK_PROVIDER: "sakura" }), (llm) =>
        llm.callLlm(BASELINE_TEXT_INPUT)
      );
      assertEqual(result.provider, "gemini", "provider");
      assertEqual(mock.of("gemini")[0].body, baseline.requests[0].body, "本文は変更前と同じ");
    } finally {
      console.warn = warn;
    }
  });

  await mock.close();

  let failed = 0;
  results.forEach((r) => {
    if (r.pass) {
      console.log(`  ok   ${r.name}`);
    } else {
      failed += 1;
      console.log(`  FAIL ${r.name}\n       ${r.detail || ""}`);
    }
  });
  console.log(`\n=== ${results.length - failed} passed, ${failed} failed ===`);
  process.exit(failed ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

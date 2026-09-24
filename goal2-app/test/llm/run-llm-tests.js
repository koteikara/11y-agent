// LLM の呼び出し(lib/llm.js と server.js の /api/llm/*)の回帰テスト。
//
// 実際の提供元には接続しない。Node の http で提供元をまねたモックのサーバーを立て、
// GEMINI_API_BASE_URL をそこへ向ける。Vertex AI 経由(GEMINI_AUTH_MODE=adc)はメタデータサーバーが
// 要るので、lib/llm.js の __setTestHooks() でトークンの取得と fetch を差し替えて試す。
// 設計: goal2-app/LLM_PROVIDER_SWITCH_INSTRUCTIONS.md 3.8、3.10
// 実行: node test/llm/run-llm-tests.js
const path = require("path");
const http = require("http");
const { spawn } = require("child_process");

const rootDir = path.resolve(__dirname, "../..");
const llmPath = path.join(rootDir, "lib/llm.js");
const { getTaskConfig } = require(path.join(rootDir, "lib/llm-prompts.js"));
const baseline = require("./fixtures/gemini-api-key-baseline.json");

const TEST_GEMINI_KEY = "TEST_GEMINI_KEY";
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
function startMockProvider() {
  const requests = [];
  let respond = () => ({ status: 200, json: {} });
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
        reset() {
          requests.length = 0;
        },
        close: () => new Promise((done) => server.close(done)),
      });
    });
  });
}

function geminiReply(text, usageMetadata = { promptTokenCount: 1000, candidatesTokenCount: 200, totalTokenCount: 1200 }) {
  return { status: 200, json: { candidates: [{ content: { parts: [{ text }] } }], usageMetadata } };
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
  systemPrompt: textTask.systemPrompt,
  userText: textTask.buildUserText([
    { id: "c1", text: "Hello world です" },
    { id: "c2", text: "ごみの出し方" },
  ]),
  responseSchema: textTask.responseSchema,
};
const BASELINE_IMAGE_INPUT = {
  systemPrompt: imageTask.systemPrompt,
  userText: imageTask.buildUserText({ caption: "市役所の外観" }),
  imageBase64: "iVBORw0KGgo=",
  imageMimeType: "image/png",
  responseSchema: imageTask.responseSchema,
};

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
      await llm.callGemini(BASELINE_TEXT_INPUT);
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
      await llm.callGemini(BASELINE_IMAGE_INPUT);
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
        await llm.callGemini(BASELINE_TEXT_INPUT);
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
        await llm.callGemini(BASELINE_TEXT_INPUT);
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
        await llm.callGemini(BASELINE_TEXT_INPUT);
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
      await llm.callGemini(BASELINE_TEXT_INPUT);
    } finally {
      restore();
    }
    assert(captured[0].url.includes("/locations/asia-northeast1/publishers/google/models/gemini-3.5-flash:"), "宛先");
    assertEqual(captured[0].body.generationConfig.temperature, 1, "温度");
    assertEqual(captured[0].body.generationConfig.thinkingConfig.thinkingLevel, "LOW", "考える量");
    assertEqual(captured[0].body.generationConfig.responseSchema.type, "ARRAY", "スキーマはそのまま");
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

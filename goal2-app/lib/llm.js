// LLM calls for /api/llm/*. callLlm() picks a provider per task kind (text / vision), then
// goes through a provider "adapter": gemini (Gemini API or Vertex AI) or openai-compatible
// (/v1/chat/completions, used for さくらの AI Engine as provider "sakura"). JSON extraction,
// schema validation, one retry on the same provider and an optional fallback provider all
// live here so server.js only sees { json, provider, model, fallback_used, usage }.
// Design: goal2-app/LLM_PROVIDER_SWITCH_INSTRUCTIONS.md (3.1-3.9).
// With no new env vars set, the provider is gemini and the Gemini request body is
// byte-for-byte what it was before this split (test/llm/run-llm-tests.js checks it).
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const DEFAULT_API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const DEFAULT_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const DEFAULT_REQUEST_TIMEOUT_MS = 45000;

const PROVIDERS = new Set(["gemini", "sakura"]);

// Gemini API (api-key) endpoint root. Overridable only so tests can point it at a local mock
// server; production leaves it unset.
function getApiBase() {
  return (process.env.GEMINI_API_BASE_URL || DEFAULT_API_BASE).replace(/\/+$/, "");
}

function getRequestTimeoutMs() {
  const value = Number(process.env.LLM_REQUEST_TIMEOUT_MS);
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_REQUEST_TIMEOUT_MS;
}

// Gemini 3 models are officially recommended to run at the default temperature 1.0 (lower
// values can cause looping), while 2.5 models were tuned here at 0. GEMINI_TEMPERATURE lets
// the stopgap switch to 3.x set 1 without a code change; unset/invalid keeps 0.
function getTemperature() {
  const raw = (process.env.GEMINI_TEMPERATURE || "").trim();
  if (!raw) return 0;
  const value = Number(raw);
  return Number.isFinite(value) ? value : 0;
}

// generationConfig.thinkingConfig.thinkingLevel (Gemini 3+; confirmed against
// ai.google.dev/api/generate-content on 2026-09-24). Sending it to 2.5 models is an error,
// so it is only sent when GEMINI_THINKING_LEVEL is set to one of the documented values.
const THINKING_LEVELS = new Set(["MINIMAL", "LOW", "MEDIUM", "HIGH"]);
function getThinkingLevel() {
  const raw = (process.env.GEMINI_THINKING_LEVEL || "").trim().toUpperCase();
  return THINKING_LEVELS.has(raw) ? raw : "";
}

// Vertex AI regional endpoints are {location}-aiplatform.googleapis.com, but the "global"
// location has no such host and must use aiplatform.googleapis.com instead.
function buildVertexUrl({ location, projectId, model }) {
  const host = location === "global" ? "aiplatform.googleapis.com" : `${location}-aiplatform.googleapis.com`;
  return `https://${host}/v1/projects/${projectId}/locations/${location}/publishers/google/models/${model}:generateContent`;
}

// ADC auth mode (Stage B): when GEMINI_AUTH_MODE=adc, calls go through Vertex AI using an
// access token from the Cloud Run metadata server instead of GEMINI_API_KEY. This only works
// when actually running on GCP infrastructure (Cloud Run/GCE/GKE) — the metadata server is
// unreachable everywhere else, including local dev, so the api-key path remains the only
// option there. Default (unset) stays on the api-key path with zero behavior change.
const METADATA_TOKEN_URL =
  "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token";
const METADATA_PROJECT_URL = "http://metadata.google.internal/computeMetadata/v1/project/project-id";
const METADATA_TIMEOUT_MS = 3000;
let cachedAccessToken = null; // { token, expiresAt }
let cachedProjectId = null;

function getAuthMode() {
  return (process.env.GEMINI_AUTH_MODE || "api-key").trim().toLowerCase();
}

async function fetchFromMetadataServer(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), METADATA_TIMEOUT_MS);
  try {
    const response = await fetch(url, { headers: { "Metadata-Flavor": "Google" }, signal: controller.signal });
    if (!response.ok) {
      throw new Error(`metadata server responded ${response.status}`);
    }
    return response;
  } finally {
    clearTimeout(timeout);
  }
}

async function getAccessToken() {
  const now = Date.now();
  if (cachedAccessToken && cachedAccessToken.expiresAt - now > 60000) {
    return cachedAccessToken.token;
  }
  let response;
  try {
    response = await fetchFromMetadataServer(METADATA_TOKEN_URL);
  } catch (error) {
    const wrapped = new Error(
      `Cloud RunメタデータサーバーからGemini用アクセストークンを取得できませんでした(GEMINI_AUTH_MODE=adc)。` +
        `Cloud Run等のGCP環境で実行されているか、サービスアカウントにVertex AI権限があるか確認してください: ${error.message}`
    );
    wrapped.code = "llm_adc_token_failed";
    wrapped.statusCode = 503;
    throw wrapped;
  }
  const json = await response.json();
  if (!json.access_token) {
    const error = new Error("メタデータサーバーの応答にaccess_tokenが含まれていません。");
    error.code = "llm_adc_token_failed";
    error.statusCode = 503;
    throw error;
  }
  cachedAccessToken = { token: json.access_token, expiresAt: now + Number(json.expires_in || 3600) * 1000 };
  return cachedAccessToken.token;
}

async function getVertexProjectId() {
  if (process.env.GEMINI_VERTEX_PROJECT) {
    return process.env.GEMINI_VERTEX_PROJECT;
  }
  if (cachedProjectId) {
    return cachedProjectId;
  }
  let response;
  try {
    response = await fetchFromMetadataServer(METADATA_PROJECT_URL);
  } catch (error) {
    const wrapped = new Error(
      `Vertex AIのプロジェクトIDを取得できませんでした。GEMINI_VERTEX_PROJECT環境変数を設定するか、Cloud Run等のGCP環境で実行してください: ${error.message}`
    );
    wrapped.code = "llm_adc_project_failed";
    wrapped.statusCode = 503;
    throw wrapped;
  }
  cachedProjectId = (await response.text()).trim();
  return cachedProjectId;
}

// USD-per-1M-token rates for the default model (gemini-2.5-flash, text prompts <=200k
// tokens). Confirmed against ai.google.dev/gemini-api/docs/pricing on 2026-07-10. Gemini
// pricing changes over time and differs by model/tier/prompt size — if DEFAULT_MODEL or
// GEMINI_MODEL is changed, or enough time has passed, re-check the official page and update
// these env vars (or the fallback below) to the current published rate.
const INPUT_PRICE_PER_1M_USD = Number(process.env.GEMINI_INPUT_PRICE_PER_1M_TOKENS || 0.3);
const OUTPUT_PRICE_PER_1M_USD = Number(process.env.GEMINI_OUTPUT_PRICE_PER_1M_TOKENS || 2.5);
// USD/JPY rate for the yen-equivalent shown alongside the USD estimate in the UI. Confirmed
// against Bank of Japan / market data on 2026-07-10 (~161.7). Exchange rates fluctuate daily —
// set USD_JPY_RATE to the current rate for accuracy; this fallback will drift over time.
const USD_JPY_RATE = Number(process.env.USD_JPY_RATE || 162);

// さくらの AI Engine is billed in yen. Defaults are the published per-1M-token rates checked
// on 2026-09-24 (gpt-oss-120b 15/75, Qwen3-VL-30B-A3B 10/30); override when they change.
function sakuraPrices(kind) {
  const prefix = kind === "vision" ? "SAKURA_AI_VISION" : "SAKURA_AI_TEXT";
  const defaults = kind === "vision" ? [10, 30] : [15, 75];
  return {
    input: Number(process.env[`${prefix}_INPUT_PRICE_PER_1M_JPY`] || defaults[0]),
    output: Number(process.env[`${prefix}_OUTPUT_PRICE_PER_1M_JPY`] || defaults[1]),
  };
}

const MAX_CALLS_PER_MINUTE = Number(process.env.LLM_MAX_CALLS_PER_MINUTE || 30);
const callTimestamps = [];

// Process-lifetime response cache. Municipal pages repeat the same boilerplate text/images
// across many pages, so this meaningfully cuts real-world cost on repeated runs.
const responseCache = new Map();

// ---------------------------------------------------------------------------------------
// Provider selection (env vars, read per call so tests and redeploys see the current value)

const warnedEnv = new Set();
function warnOnce(key, message) {
  if (warnedEnv.has(key)) return;
  warnedEnv.add(key);
  console.warn(message);
}

// Unknown values fall back to gemini (today's behavior) rather than disabling the LLM.
function readProvider(name) {
  const raw = (process.env[name] || "").trim().toLowerCase();
  if (!raw) return "gemini";
  if (PROVIDERS.has(raw)) return raw;
  warnOnce(name, `${name}=${raw} は未対応の値です。gemini として扱います。`);
  return "gemini";
}

function getProviderFor(kind) {
  return readProvider(kind === "vision" ? "LLM_VISION_PROVIDER" : "LLM_TEXT_PROVIDER");
}

function getFallbackProvider() {
  const raw = (process.env.LLM_FALLBACK_PROVIDER || "").trim().toLowerCase();
  if (!raw || raw === "none") return "none";
  if (raw === "gemini") return "gemini";
  warnOnce("LLM_FALLBACK_PROVIDER", `LLM_FALLBACK_PROVIDER=${raw} は未対応の値です。受け皿は使いません。`);
  return "none";
}

function isProviderConfigured(provider) {
  if (provider === "sakura") return Boolean(process.env.SAKURA_AI_API_KEY);
  return getAuthMode() === "adc" || Boolean(process.env.GEMINI_API_KEY);
}

function getModelFor(provider, kind) {
  if (provider === "sakura") {
    return kind === "vision"
      ? process.env.SAKURA_AI_VISION_MODEL || "preview/Qwen3-VL-30B-A3B-Instruct"
      : process.env.SAKURA_AI_TEXT_MODEL || "gpt-oss-120b";
  }
  return DEFAULT_MODEL;
}

function isConfigured() {
  return isProviderConfigured(getProviderFor("text")) || isProviderConfigured(getProviderFor("vision"));
}

function getStatus() {
  const describe = (kind) => {
    const provider = getProviderFor(kind);
    return { provider, model: getModelFor(provider, kind) };
  };
  return { configured: isConfigured(), text: describe("text"), vision: describe("vision") };
}

// ---------------------------------------------------------------------------------------
// Shared helpers

function llmError(message, code, statusCode, extra) {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  return Object.assign(error, extra || {});
}

// Error messages go back to the browser, so never let an API key leak into them.
function redactSecrets(text) {
  let result = String(text || "");
  for (const secret of [process.env.GEMINI_API_KEY, process.env.SAKURA_AI_API_KEY]) {
    if (secret) result = result.split(secret).join("***");
  }
  return result;
}

function estimateCostUsd(usage) {
  const inputCost = ((usage.inputTokens || 0) / 1_000_000) * INPUT_PRICE_PER_1M_USD;
  const outputCost = ((usage.outputTokens || 0) / 1_000_000) * OUTPUT_PRICE_PER_1M_USD;
  return inputCost + outputCost;
}

function estimateCostJpy(usage) {
  return estimateCostUsd(usage) * USD_JPY_RATE;
}

function estimateSakuraCost(usage, kind) {
  const prices = sakuraPrices(kind);
  const jpy = ((usage.inputTokens || 0) / 1_000_000) * prices.input + ((usage.outputTokens || 0) / 1_000_000) * prices.output;
  return { estimatedCostUsd: jpy / USD_JPY_RATE, estimatedCostJpy: jpy };
}

function checkBudget() {
  const now = Date.now();
  while (callTimestamps.length && now - callTimestamps[0] > 60000) {
    callTimestamps.shift();
  }
  if (callTimestamps.length >= MAX_CALLS_PER_MINUTE) {
    throw llmError("LLM call budget exceeded (LLM_MAX_CALLS_PER_MINUTE)", "llm_budget_exceeded", 429);
  }
  callTimestamps.push(now);
}

function buildCacheKey({ provider, model, systemPrompt, userText, imageBase64 }) {
  const hash = crypto.createHash("sha256");
  hash.update(provider);
  hash.update(" ");
  hash.update(model);
  hash.update(" ");
  hash.update(systemPrompt || "");
  hash.update(" ");
  hash.update(userText || "");
  hash.update(" ");
  hash.update(imageBase64 || "");
  return hash.digest("hex");
}

async function postJson(url, headers, body, providerLabel) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), getRequestTimeoutMs());
  try {
    return await testHooks.fetch(url, {
      method: "POST",
      headers,
      signal: controller.signal,
      body: JSON.stringify(body),
    });
  } catch (error) {
    throw llmError(redactSecrets(`${providerLabel} request failed: ${error.message}`), "llm_request_failed", 502);
  } finally {
    clearTimeout(timeout);
  }
}

// ---------------------------------------------------------------------------------------
// gemini adapter (Gemini API with GEMINI_API_KEY, or Vertex AI with GEMINI_AUTH_MODE=adc)

async function requestGemini({ systemPrompt, userText, image, responseSchema, model }) {
  const authMode = getAuthMode();
  if (authMode !== "adc" && !process.env.GEMINI_API_KEY) {
    throw llmError("GEMINI_API_KEY is not set", "llm_not_configured", 503);
  }

  const parts = [];
  if (userText) parts.push({ text: userText });
  if (image && image.base64) {
    parts.push({ inlineData: { mimeType: image.mimeType || "image/jpeg", data: image.base64 } });
  }

  const thinkingLevel = getThinkingLevel();
  const body = {
    contents: [{ role: "user", parts }],
    generationConfig: {
      temperature: getTemperature(),
      ...(responseSchema ? { responseMimeType: "application/json", responseSchema } : {}),
      ...(thinkingLevel ? { thinkingConfig: { thinkingLevel } } : {}),
    },
  };
  if (systemPrompt) {
    body.systemInstruction = { parts: [{ text: systemPrompt }] };
  }

  let requestUrl;
  const headers = { "content-type": "application/json" };
  if (authMode === "adc") {
    // Vertex AI's generateContent request/response shape is compatible with the Developer
    // API used below (same contents/generationConfig/usageMetadata fields), so only the
    // endpoint and auth header differ here — everything after this branch is shared.
    const [accessToken, projectId] = await Promise.all([testHooks.getAccessToken(), testHooks.getVertexProjectId()]);
    const location = process.env.GEMINI_VERTEX_LOCATION || "us-central1";
    requestUrl = buildVertexUrl({ location, projectId, model });
    headers.authorization = `Bearer ${accessToken}`;
  } else {
    requestUrl = `${getApiBase()}/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`;
  }

  const response = await postJson(requestUrl, headers, body, "Gemini");
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw llmError(
      redactSecrets(`Gemini API error ${response.status}: ${detail.slice(0, 300)}`),
      "llm_api_error",
      response.status >= 500 ? 502 : 400,
      { httpStatus: response.status }
    );
  }

  const json = await response.json();
  const text = (json.candidates?.[0]?.content?.parts || []).map((part) => part.text || "").join("");
  const usageMetadata = json.usageMetadata || {};
  const usage = {
    inputTokens: usageMetadata.promptTokenCount || 0,
    outputTokens: usageMetadata.candidatesTokenCount || 0,
    totalTokens: usageMetadata.totalTokenCount || 0,
  };
  return {
    text,
    finishReason: json.candidates?.[0]?.finishReason || "",
    usage: { ...usage, estimatedCostUsd: estimateCostUsd(usage), estimatedCostJpy: estimateCostJpy(usage) },
  };
}

// ---------------------------------------------------------------------------------------
// openai-compatible adapter (/v1/chat/completions). Named after the wire format rather than
// the vendor so Azure or a self-hosted server (Ollama, vLLM) can reuse it later.

// Gemini-style schema (upper-case types, no additionalProperties) -> standard JSON Schema.
function toJsonSchema(schema) {
  if (!schema || typeof schema !== "object") return schema;
  const converted = {};
  for (const [key, value] of Object.entries(schema)) {
    if (key === "type") converted.type = String(value).toLowerCase();
    else if (key === "properties") {
      converted.properties = {};
      for (const [name, child] of Object.entries(value)) converted.properties[name] = toJsonSchema(child);
    } else if (key === "items") converted.items = toJsonSchema(value);
    else if (key === "required") converted.required = [...value];
    else converted[key] = value;
  }
  if (converted.type === "object") converted.additionalProperties = false;
  return converted;
}

// Most OpenAI-compatible servers require an object at the top level, so a top-level array
// is wrapped as { results: [...] } and unwrapped again after parsing.
function toOpenAiResponseSchema(schema) {
  const converted = toJsonSchema(schema);
  if (converted && converted.type === "array") {
    return {
      wrapped: true,
      schema: { type: "object", properties: { results: converted }, required: ["results"], additionalProperties: false },
    };
  }
  return { wrapped: false, schema: converted };
}

const SCHEMA_INSTRUCTION = "出力は次の JSON Schema に従う JSON だけにし、説明やコードブロックを付けないでください。";

async function requestOpenAiCompatible({ kind, task, systemPrompt, userText, image, responseSchema, model }) {
  const apiKey = process.env.SAKURA_AI_API_KEY;
  if (!apiKey) {
    throw llmError("SAKURA_AI_API_KEY is not set", "llm_not_configured", 503);
  }
  const baseUrl = (process.env.SAKURA_AI_BASE_URL || "https://api.ai.sakura.ad.jp/v1").replace(/\/+$/, "");
  const converted = responseSchema ? toOpenAiResponseSchema(responseSchema) : null;

  // JSON Schema enforcement is not documented for さくらの AI Engine, so the schema is also
  // spelled out at the end of the system prompt and the reply is validated afterwards.
  let system = systemPrompt || "";
  if (converted) {
    system += `\n\n${SCHEMA_INSTRUCTION}\n${JSON.stringify(converted.schema)}`;
  }
  const messages = [];
  if (system) messages.push({ role: "system", content: system });
  if (image && image.base64) {
    messages.push({
      role: "user",
      content: [
        { type: "text", text: userText || "" },
        { type: "image_url", image_url: { url: `data:${image.mimeType || "image/jpeg"};base64,${image.base64}` } },
      ],
    });
  } else {
    messages.push({ role: "user", content: userText || "" });
  }

  const maxTokens = Number(process.env.SAKURA_AI_MAX_TOKENS) || 16384;
  const body = { model, messages, temperature: 0, max_tokens: maxTokens };
  if (kind !== "vision") {
    const effort = process.env.SAKURA_AI_TEXT_REASONING_EFFORT === undefined ? "low" : process.env.SAKURA_AI_TEXT_REASONING_EFFORT.trim();
    if (effort) body.reasoning_effort = effort;
  }
  if (converted) {
    body.response_format = {
      type: "json_schema",
      json_schema: { name: String(task || "response").replace(/[^A-Za-z0-9_-]/g, "_"), schema: converted.schema, strict: true },
    };
  }

  const response = await postJson(
    `${baseUrl}/chat/completions`,
    { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
    body,
    "Sakura AI"
  );
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    const message = redactSecrets(`Sakura AI API error ${response.status}: ${detail.slice(0, 300)}`);
    if (response.status === 429) throw llmError(message, "llm_rate_limited", 429, { httpStatus: 429 });
    throw llmError(message, "llm_api_error", response.status >= 500 ? 502 : 400, { httpStatus: response.status });
  }

  const json = await response.json();
  const choice = json.choices?.[0] || {};
  const rawUsage = json.usage || {};
  const usage = {
    inputTokens: rawUsage.prompt_tokens || 0,
    outputTokens: rawUsage.completion_tokens || 0,
    totalTokens: rawUsage.total_tokens || (rawUsage.prompt_tokens || 0) + (rawUsage.completion_tokens || 0),
  };
  return {
    text: typeof choice.message?.content === "string" ? choice.message.content : "",
    finishReason: choice.finish_reason || "",
    unwrapResults: Boolean(converted && converted.wrapped),
    usage: { ...usage, ...estimateSakuraCost(usage, kind) },
  };
}

// ---------------------------------------------------------------------------------------
// Response extraction and validation (3.4)

function extractJson(text) {
  let body = String(text || "").trim();
  const fenced = body.match(/^```[A-Za-z]*\s*([\s\S]*?)\s*```$/);
  if (fenced) body = fenced[1].trim();
  try {
    return JSON.parse(body);
  } catch {
    throw llmError("LLMの応答をJSONとして解釈できませんでした。", "llm_invalid_response", 502);
  }
}

function typeMatches(type, value) {
  switch (type) {
    case "OBJECT":
      return value !== null && typeof value === "object" && !Array.isArray(value);
    case "ARRAY":
      return Array.isArray(value);
    case "STRING":
      return typeof value === "string";
    case "BOOLEAN":
      return typeof value === "boolean";
    case "NUMBER":
      return typeof value === "number" && Number.isFinite(value);
    case "INTEGER":
      return Number.isInteger(value);
    default:
      return true;
  }
}

// Small validator for the subset lib/llm-prompts.js uses (type, properties, required, items).
// Unknown properties are dropped rather than rejected; a missing required property or a type
// mismatch is an error. An optional property that comes back as null is treated as absent.
function validateAgainstSchema(schema, value, where = "$") {
  if (!schema || !schema.type) return value;
  const type = String(schema.type).toUpperCase();
  if (!typeMatches(type, value)) {
    throw llmError(`LLMの応答がスキーマに合いません(${where} は ${type} であるべき)。`, "llm_schema_mismatch", 502);
  }
  if (type === "ARRAY") {
    return value.map((item, index) => validateAgainstSchema(schema.items, item, `${where}[${index}]`));
  }
  if (type === "OBJECT") {
    const properties = schema.properties || {};
    const required = new Set(schema.required || []);
    const cleaned = {};
    for (const name of required) {
      if (!(name in value) || value[name] === null || value[name] === undefined) {
        throw llmError(`LLMの応答がスキーマに合いません(${where}.${name} がありません)。`, "llm_schema_mismatch", 502);
      }
    }
    for (const [name, childSchema] of Object.entries(properties)) {
      if (!(name in value) || value[name] === null || value[name] === undefined) continue;
      cleaned[name] = validateAgainstSchema(childSchema, value[name], `${where}.${name}`);
    }
    return cleaned;
  }
  return value;
}

// ---------------------------------------------------------------------------------------
// Evaluation capture (LLM_RECORD_DIR, 3.9). Never set in production.

const IMAGE_EXTENSIONS = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif" };

function recordRequest({ task, kind, systemPrompt, userText, responseSchema, image }) {
  const dir = process.env.LLM_RECORD_DIR;
  if (!dir) return;
  try {
    fs.mkdirSync(dir, { recursive: true });
    let imageSha256 = null;
    let imageMime = null;
    if (image && image.base64) {
      const bytes = Buffer.from(image.base64, "base64");
      imageSha256 = crypto.createHash("sha256").update(bytes).digest("hex");
      imageMime = image.mimeType || "image/jpeg";
      const imageDir = path.join(dir, "images");
      fs.mkdirSync(imageDir, { recursive: true });
      const imagePath = path.join(imageDir, `${imageSha256}.${IMAGE_EXTENSIONS[imageMime] || "bin"}`);
      if (!fs.existsSync(imagePath)) fs.writeFileSync(imagePath, bytes);
    }
    const line = {
      task: task || "",
      kind,
      systemPrompt: systemPrompt || "",
      userText: userText || "",
      responseSchema: responseSchema || null,
      image_sha256: imageSha256,
      image_mime: imageMime,
    };
    fs.appendFileSync(path.join(dir, "requests.jsonl"), `${JSON.stringify(line)}\n`);
  } catch (error) {
    warnOnce("LLM_RECORD_DIR_write", `LLM_RECORD_DIR への書き出しに失敗しました: ${error.message}`);
  }
}

// ---------------------------------------------------------------------------------------
// callLlm (3.1)

const RETRYABLE_CODES = new Set(["llm_api_error", "llm_empty_response", "llm_truncated", "llm_invalid_response", "llm_schema_mismatch"]);

function isRateLimited(error) {
  return error.code === "llm_rate_limited" || error.httpStatus === 429;
}

function isRetryable(error) {
  return RETRYABLE_CODES.has(error.code) && !isRateLimited(error);
}

function isFallbackEligible(error) {
  return isRetryable(error) || isRateLimited(error) || error.code === "llm_request_failed";
}

function addUsage(total, usage) {
  if (!usage) return;
  for (const key of ["inputTokens", "outputTokens", "totalTokens", "estimatedCostUsd", "estimatedCostJpy"]) {
    total[key] += usage[key] || 0;
  }
}

async function attemptOnce(provider, request, usageTotal) {
  checkBudget();
  const reply =
    provider === "sakura" ? await requestOpenAiCompatible(request) : await requestGemini(request);
  addUsage(usageTotal, reply.usage);
  if (!reply.text || !reply.text.trim()) {
    if (reply.finishReason === "length") {
      throw llmError("LLMの応答が出力の上限で打ち切られました。", "llm_truncated", 502);
    }
    throw llmError("LLMの応答が空でした。", "llm_empty_response", 502);
  }
  if (reply.finishReason === "length") {
    throw llmError("LLMの応答が出力の上限で打ち切られました。", "llm_truncated", 502);
  }
  let json = extractJson(reply.text);
  if (reply.unwrapResults && json && !Array.isArray(json) && typeof json === "object" && "results" in json) {
    json = json.results;
  }
  return request.responseSchema ? validateAgainstSchema(request.responseSchema, json) : json;
}

async function callLlm({ kind = "text", task = "", systemPrompt, userText, image, responseSchema }) {
  const resolvedKind = kind === "vision" ? "vision" : "text";
  recordRequest({ task, kind: resolvedKind, systemPrompt, userText, responseSchema, image });

  const primary = getProviderFor(resolvedKind);
  const fallbackSetting = getFallbackProvider();
  const fallback =
    fallbackSetting !== "none" && fallbackSetting !== primary && isProviderConfigured(fallbackSetting) ? fallbackSetting : null;
  const primaryConfigured = isProviderConfigured(primary);
  if (!primaryConfigured && !fallback) {
    // Same error as before the split (requestGemini throws it for the default provider).
    throw primary === "sakura"
      ? llmError("SAKURA_AI_API_KEY is not set", "llm_not_configured", 503)
      : llmError("GEMINI_API_KEY is not set", "llm_not_configured", 503);
  }

  const primaryModel = getModelFor(primary, resolvedKind);
  const cacheKey = buildCacheKey({ provider: primary, model: primaryModel, systemPrompt, userText, imageBase64: image?.base64 });
  if (responseCache.has(cacheKey)) {
    return responseCache.get(cacheKey);
  }

  const usage = { inputTokens: 0, outputTokens: 0, totalTokens: 0, estimatedCostUsd: 0, estimatedCostJpy: 0 };
  const request = { kind: resolvedKind, task, systemPrompt, userText, image, responseSchema };
  let primaryError = null;

  if (primaryConfigured) {
    try {
      let json;
      try {
        json = await attemptOnce(primary, { ...request, model: primaryModel }, usage);
      } catch (error) {
        if (!isRetryable(error)) throw error;
        json = await attemptOnce(primary, { ...request, model: primaryModel }, usage);
      }
      const result = { json, provider: primary, model: primaryModel, fallback_used: false, usage };
      responseCache.set(cacheKey, result);
      return result;
    } catch (error) {
      if (!fallback || !isFallbackEligible(error)) throw error;
      primaryError = error;
    }
  }

  const fallbackModel = getModelFor(fallback, resolvedKind);
  try {
    const json = await attemptOnce(fallback, { ...request, model: fallbackModel }, usage);
    const result = { json, provider: fallback, model: fallbackModel, fallback_used: true, usage };
    responseCache.set(cacheKey, result);
    return result;
  } catch (error) {
    if (!primaryError) throw error;
    primaryError.message = `${primaryError.message} (受け皿 ${fallback}: ${error.message})`;
    throw primaryError;
  }
}

// Tests replace these to exercise the Vertex AI (adc) path without a metadata server.
// Production never touches them.
const defaultTestHooks = {
  getAccessToken: () => getAccessToken(),
  getVertexProjectId: () => getVertexProjectId(),
  fetch: (...args) => fetch(...args),
};
const testHooks = { ...defaultTestHooks };

function setTestHooks(overrides) {
  Object.assign(testHooks, defaultTestHooks, overrides || {});
  responseCache.clear();
  callTimestamps.length = 0;
}

module.exports = {
  callLlm,
  isConfigured,
  getStatus,
  estimateCostUsd,
  estimateCostJpy,
  buildVertexUrl,
  toJsonSchema,
  toOpenAiResponseSchema,
  validateAgainstSchema,
  __setTestHooks: setTestHooks,
};

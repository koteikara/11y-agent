const crypto = require("crypto");

const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const DEFAULT_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const REQUEST_TIMEOUT_MS = 45000;

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

const MAX_CALLS_PER_MINUTE = Number(process.env.LLM_MAX_CALLS_PER_MINUTE || 30);
const callTimestamps = [];

// Process-lifetime response cache. Municipal pages repeat the same boilerplate text/images
// across many pages, so this meaningfully cuts real-world cost on repeated runs.
const responseCache = new Map();

function isConfigured() {
  return getAuthMode() === "adc" || Boolean(process.env.GEMINI_API_KEY);
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

function estimateCostUsd(usage) {
  const inputCost = ((usage.inputTokens || 0) / 1_000_000) * INPUT_PRICE_PER_1M_USD;
  const outputCost = ((usage.outputTokens || 0) / 1_000_000) * OUTPUT_PRICE_PER_1M_USD;
  return inputCost + outputCost;
}

function estimateCostJpy(usage) {
  return estimateCostUsd(usage) * USD_JPY_RATE;
}

function checkBudget() {
  const now = Date.now();
  while (callTimestamps.length && now - callTimestamps[0] > 60000) {
    callTimestamps.shift();
  }
  if (callTimestamps.length >= MAX_CALLS_PER_MINUTE) {
    const error = new Error("LLM call budget exceeded (LLM_MAX_CALLS_PER_MINUTE)");
    error.code = "llm_budget_exceeded";
    error.statusCode = 429;
    throw error;
  }
  callTimestamps.push(now);
}

function buildCacheKey({ model, systemPrompt, userText, imageBase64 }) {
  const hash = crypto.createHash("sha256");
  hash.update(model);
  hash.update(" ");
  hash.update(systemPrompt || "");
  hash.update(" ");
  hash.update(userText || "");
  hash.update(" ");
  hash.update(imageBase64 || "");
  return hash.digest("hex");
}

async function callGemini({ systemPrompt, userText, imageBase64, imageMimeType, model, responseSchema }) {
  const authMode = getAuthMode();
  if (authMode !== "adc" && !process.env.GEMINI_API_KEY) {
    const error = new Error("GEMINI_API_KEY is not set");
    error.code = "llm_not_configured";
    error.statusCode = 503;
    throw error;
  }

  const resolvedModel = model || DEFAULT_MODEL;
  const cacheKey = buildCacheKey({ model: resolvedModel, systemPrompt, userText, imageBase64 });
  if (responseCache.has(cacheKey)) {
    return responseCache.get(cacheKey);
  }

  checkBudget();

  const parts = [];
  if (userText) parts.push({ text: userText });
  if (imageBase64) {
    parts.push({ inlineData: { mimeType: imageMimeType || "image/jpeg", data: imageBase64 } });
  }

  const body = {
    contents: [{ role: "user", parts }],
    generationConfig: {
      temperature: 0,
      ...(responseSchema ? { responseMimeType: "application/json", responseSchema } : {}),
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
    const [accessToken, projectId] = await Promise.all([getAccessToken(), getVertexProjectId()]);
    const location = process.env.GEMINI_VERTEX_LOCATION || "us-central1";
    requestUrl = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/${resolvedModel}:generateContent`;
    headers.authorization = `Bearer ${accessToken}`;
  } else {
    requestUrl = `${API_BASE}/${resolvedModel}:generateContent?key=${process.env.GEMINI_API_KEY}`;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let response;
  try {
    response = await fetch(requestUrl, {
      method: "POST",
      headers,
      signal: controller.signal,
      body: JSON.stringify(body),
    });
  } catch (error) {
    const wrapped = new Error(`Gemini request failed: ${error.message}`);
    wrapped.code = "llm_request_failed";
    wrapped.statusCode = 502;
    throw wrapped;
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    const error = new Error(`Gemini API error ${response.status}: ${detail.slice(0, 300)}`);
    error.code = "llm_api_error";
    error.statusCode = response.status >= 500 ? 502 : 400;
    throw error;
  }

  const json = await response.json();
  const text = (json.candidates?.[0]?.content?.parts || []).map((part) => part.text || "").join("");
  const usageMetadata = json.usageMetadata || {};
  const usage = {
    inputTokens: usageMetadata.promptTokenCount || 0,
    outputTokens: usageMetadata.candidatesTokenCount || 0,
    totalTokens: usageMetadata.totalTokenCount || 0,
  };
  const result = {
    text,
    usage: { ...usage, estimatedCostUsd: estimateCostUsd(usage), estimatedCostJpy: estimateCostJpy(usage) },
  };
  responseCache.set(cacheKey, result);
  return result;
}

module.exports = {
  callGemini,
  isConfigured,
  estimateCostUsd,
  estimateCostJpy,
};

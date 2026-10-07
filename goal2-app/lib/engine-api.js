// 候補のエンジン(public/app.js)が呼ぶ API の中身。
// server.js(今の画面)と一括処理(batch/)の両方が、同じ処理で答える。
// HTTP の読み書きは呼び出し側が行い、ここは { status, payload } を返すだけにする。
const path = require("path");
const { loadRules } = require("./rules");
const { loadCheckitems } = require("./michecker-checkitems");
const { callLlm, getStatus: getLlmStatus } = require("./llm");
const { getTaskConfig } = require("./llm-prompts");
const { fetchLinkTitle, fetchImageAsBase64 } = require("./safe-fetch");

// エンジンが呼ぶ API の道。一括処理は、この道だけを Node に回す。
const ENGINE_API_ROUTES = [
  "GET /api/rules",
  "GET /api/michecker-checkitems",
  "GET /api/link-title",
  "GET /api/llm/status",
  "POST /api/llm/enrich",
  "POST /api/llm/image-alt",
];

function isEngineApiRoute(method, pathname) {
  return ENGINE_API_ROUTES.includes(`${method} ${pathname}`);
}

// method、pathname、searchParams(URLSearchParams)、body(POST の JSON を読んだもの)を受け取る。
// host は、相対の href を絶対にするときの基準が無いときに使う。
async function handleEngineApi({ method, pathname, searchParams, body, rootDir, host = "localhost" }) {
  const route = `${method} ${pathname}`;

  if (route === "GET /api/rules") {
    try {
      const result = loadRules({ rootDir });
      return {
        status: 200,
        payload: { rules: result.rules, summary: result.summary, source: path.relative(rootDir, result.sourcePath) },
      };
    } catch (error) {
      return { status: 500, payload: { error: "rules_not_available", message: error.message } };
    }
  }

  if (route === "GET /api/michecker-checkitems") {
    try {
      const result = loadCheckitems({ rootDir });
      return {
        status: 200,
        payload: { checkitems: result.checkitems, summary: result.summary, source: path.relative(rootDir, result.sourcePath) },
      };
    } catch (error) {
      return { status: 500, payload: { error: "michecker_checkitems_not_available", message: error.message } };
    }
  }

  if (route === "GET /api/link-title") {
    const href = searchParams.get("href") || "";
    const base = searchParams.get("base") || "";
    try {
      const target = new URL(href, base || `http://${host}`);
      const result = await fetchLinkTitle(target.href);
      return { status: 200, payload: { ...result, url: target.href } };
    } catch (error) {
      return { status: error.statusCode || 502, payload: { ok: false, error: "link_title_not_available", message: error.message } };
    }
  }

  if (route === "GET /api/llm/status") {
    return { status: 200, payload: getLlmStatus() };
  }

  if (route === "POST /api/llm/enrich") {
    try {
      const task = typeof body?.task === "string" ? body.task : "";
      const items = Array.isArray(body?.items) ? body.items : [];
      const config = getTaskConfig(task);
      if (!config) {
        return { status: 400, payload: { ok: false, error: "unknown_task", message: `未対応のtaskです: ${task}` } };
      }
      if (!items.length) {
        return { status: 400, payload: { ok: false, error: "empty_items", message: "itemsが空です。" } };
      }
      if (items.length > 50) {
        return { status: 400, payload: { ok: false, error: "too_many_items", message: "1リクエストあたりのitemsは50件までです。" } };
      }
      const userText = config.buildUserText(items);
      // JSONの取り出しと形の検証、やり直し、受け皿はcallLlm()の中で行う。
      const result = await callLlm({
        kind: "text",
        task,
        systemPrompt: config.systemPrompt,
        userText,
        responseSchema: config.responseSchema,
      });
      return {
        status: 200,
        payload: {
          ok: true,
          results: result.json,
          usage: result.usage,
          provider: result.provider,
          model: result.model,
          fallback_used: result.fallback_used,
        },
      };
    } catch (error) {
      return { status: error.statusCode || 500, payload: { ok: false, error: error.code || "llm_enrich_failed", message: error.message } };
    }
  }

  if (route === "POST /api/llm/image-alt") {
    try {
      const imageUrl = typeof body?.imageUrl === "string" ? body.imageUrl : "";
      const caption = typeof body?.caption === "string" ? body.caption : "";
      const task = typeof body?.task === "string" && body.task ? body.task : "image-alt";
      if (!imageUrl) {
        return { status: 400, payload: { ok: false, error: "missing_image_url", message: "imageUrlを指定してください。" } };
      }
      const config = getTaskConfig(task);
      if (!config) {
        return { status: 400, payload: { ok: false, error: "unknown_task", message: `未対応のtaskです: ${task}` } };
      }
      const { base64, mimeType } = await fetchImageAsBase64(imageUrl);
      const result = await callLlm({
        kind: "vision",
        task,
        systemPrompt: config.systemPrompt,
        userText: config.buildUserText({ caption }),
        image: { base64, mimeType },
        responseSchema: config.responseSchema,
      });
      return {
        status: 200,
        payload: {
          ok: true,
          result: result.json,
          usage: result.usage,
          provider: result.provider,
          model: result.model,
          fallback_used: result.fallback_used,
        },
      };
    } catch (error) {
      return { status: error.statusCode || 500, payload: { ok: false, error: error.code || "llm_image_alt_failed", message: error.message } };
    }
  }

  return null;
}

module.exports = { ENGINE_API_ROUTES, isEngineApiRoute, handleEngineApi };

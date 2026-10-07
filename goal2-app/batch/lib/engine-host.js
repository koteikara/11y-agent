// 候補のエンジン(public/app.js)と本文抽出(public/goal3.js)を、Playwright の Chromium の中で動かす。
// エンジンを Node 単体(jsdom など)に移さないのは、DOM の振る舞いの差で miChecker 互換テストと
// 出力テストをやり直すことになるため(docs/renewal/ARCHITECTURE.md の「一括処理」)。
//
// サーバーは立てない。Chromium の要求を Playwright の route で受け、public/ のファイルは手元から返し、
// エンジンが呼ぶ API は lib/engine-api.js(server.js と同じ処理)で Node が答える。
// それ以外の行き先への要求は止める。
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");
const { isEngineApiRoute, handleEngineApi } = require("../../lib/engine-api");

const APP_ROOT = path.resolve(__dirname, "..", "..");
const PUBLIC_DIR = path.join(APP_ROOT, "public");
// エンジンのページの置き場所。実在しないホスト名で、route が受けるので外には出ない。
// https にするのは、ページを安全な文脈にして crypto.subtle(ハッシュ)を使えるようにするため。
const ENGINE_ORIGIN = "https://goal2-engine.invalid";

const CONTENT_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
};

function readPublicFile(pathname) {
  let decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  const relative = path.normalize(decoded).replace(/^([/\\])+/, "");
  const filePath = path.join(PUBLIC_DIR, relative);
  if (!filePath.startsWith(PUBLIC_DIR + path.sep)) return null;
  try {
    return { body: fs.readFileSync(filePath), contentType: CONTENT_TYPES[path.extname(filePath).toLowerCase()] || "application/octet-stream" };
  } catch {
    return null;
  }
}

// ai: false のときは、AI の呼び出しを Node で止める(本文を AI に送る同意が無い案件など)。
// エンジンが AI の鍵の無いときと同じに振る舞うよう、鍵の無いときと同じ答え(llm_not_configured)を返す。
// 別の名前を返すと、エンジンは候補に「AI で解析できなかった」と書き足すため。
// linkTitle: false のときは、リンク先の題名を取りに行かない(テストで、外のサイトに左右されないようにする)。
async function startEngine({ ai = true, linkTitle = true, onAiCall } = {}) {
  const browser = await chromium.launch({
    // CI(Linux)では決まった場所の Chromium を使う。手元では Playwright が入れた Chromium を使う。
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined,
  });
  const context = await browser.newContext();
  const usage = { aiCalls: 0, aiBlocked: 0, linkTitleLookups: 0 };

  await context.route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin !== ENGINE_ORIGIN) {
      await route.abort("blockedbyclient");
      return;
    }
    if (url.pathname.startsWith("/api/")) {
      if (!isEngineApiRoute(request.method(), url.pathname)) {
        await route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ ok: false, error: "not_found" }) });
        return;
      }
      const isAi = url.pathname.startsWith("/api/llm/") && url.pathname !== "/api/llm/status";
      if (url.pathname === "/api/llm/status" && !ai) {
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ configured: false, text: null, vision: null }) });
        return;
      }
      if (isAi && !ai) {
        usage.aiBlocked += 1;
        await route.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({ ok: false, error: "llm_not_configured", message: "この案件では AI を呼ばない設定です。" }),
        });
        return;
      }
      if (isAi) {
        usage.aiCalls += 1;
        onAiCall?.(url.pathname);
      }
      if (url.pathname === "/api/link-title") {
        if (!linkTitle) {
          await route.fulfill({ status: 502, contentType: "application/json", body: JSON.stringify({ ok: false, error: "link_title_not_available" }) });
          return;
        }
        usage.linkTitleLookups += 1;
      }
      let body = null;
      if (request.method() === "POST") {
        try {
          body = request.postDataJSON();
        } catch {
          body = null;
        }
      }
      const result = await handleEngineApi({
        method: request.method(),
        pathname: url.pathname,
        searchParams: url.searchParams,
        body,
        rootDir: APP_ROOT,
      });
      await route.fulfill({ status: result.status, contentType: "application/json; charset=utf-8", body: JSON.stringify(result.payload) });
      return;
    }
    const file = readPublicFile(url.pathname);
    if (!file) {
      await route.fulfill({ status: 404, body: "Not found" });
      return;
    }
    await route.fulfill({ status: 200, contentType: file.contentType, body: file.body });
  });

  const page = await context.newPage();
  await page.goto(`${ENGINE_ORIGIN}/engine.html`, { waitUntil: "load" });
  await page.waitForFunction(() => Boolean(window.goal2Engine && window.goal3Engine), null, { timeout: 15000 });
  // 一括処理の道具(構造のハッシュ、本文の範囲)を足す。route は通さず、中身を直に入れる。
  await page.addScriptTag({ content: fs.readFileSync(path.join(__dirname, "page-tools.browser.js"), "utf8") });
  await page.evaluate(() => window.goal2Engine.init());

  return {
    page,
    usage,
    // ページの中で fn(arg) を動かす。fn はページの中で評価されるので、外の変数は使えない。
    evaluate(fn, arg) {
      return page.evaluate(fn, arg);
    },
    async close() {
      await browser.close();
    },
  };
}

module.exports = { startEngine, ENGINE_ORIGIN };

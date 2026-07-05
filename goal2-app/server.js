const http = require("http");
const fs = require("fs");
const path = require("path");
const net = require("net");
const { loadRules } = require("./lib/rules");
const { defaultSagaFixtureRoot } = require("./lib/sagaAutoFix");
const { learnSagaGoldHints } = require("./lib/sagaGoldHints");
const { listSagaSamples } = require("./lib/sagaSamples");

const rootDir = __dirname;
const publicDir = path.join(rootDir, "public");
const port = Number(process.env.PORT || 8080);

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
};

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  response.end(JSON.stringify(payload));
}

function sendStatic(requestPath, response) {
  const normalizedPath = requestPath === "/" ? "/index.html" : requestPath;
  const safePath = path
    .normalize(decodeURIComponent(normalizedPath))
    .replace(/^(\.\.[/\\])+/, "");
  const filePath = path.join(publicDir, safePath);

  if (!filePath.startsWith(publicDir)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (error, body) => {
    if (error) {
      response.writeHead(404);
      response.end("Not found");
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    response.writeHead(200, {
      "content-type": contentTypes[ext] || "application/octet-stream",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    });
    response.end(body);
  });
}

function isBlockedFetchHost(hostname) {
  const host = String(hostname || "").toLowerCase();
  if (!host || host === "localhost" || host.endsWith(".localhost") || host === "metadata.google.internal") {
    return true;
  }
  const ipVersion = net.isIP(host);
  if (ipVersion === 4) {
    const parts = host.split(".").map(Number);
    return (
      parts[0] === 10 ||
      parts[0] === 127 ||
      (parts[0] === 169 && parts[1] === 254) ||
      (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
      (parts[0] === 192 && parts[1] === 168)
    );
  }
  if (ipVersion === 6) {
    return host === "::1" || host.startsWith("fe80:") || host.startsWith("fc") || host.startsWith("fd");
  }
  return false;
}

function decodeHtmlEntities(text) {
  return String(text || "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_match, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#([0-9]+);/g, (_match, code) => String.fromCodePoint(Number.parseInt(code, 10)));
}

function extractPageTitle(html) {
  const source = String(html || "").replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, "");
  const h1 = source.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i);
  const title = source.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
  const raw = h1?.[1] || title?.[1] || "";
  return decodeHtmlEntities(raw.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
}

async function fetchHtmlPage(targetUrl) {
  const url = new URL(targetUrl);
  if (!["http:", "https:"].includes(url.protocol) || isBlockedFetchHost(url.hostname)) {
    const error = new Error("URL is not allowed");
    error.statusCode = 400;
    throw error;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "user-agent": "goal3-content-extractor/0.1 (+content-scope-preview)",
        accept: "text/html,application/xhtml+xml",
      },
    });
    const contentType = response.headers.get("content-type") || "";
    if (!response.ok || !/text\/html|application\/xhtml\+xml/i.test(contentType)) {
      return { ok: false, status: response.status, html: "", title: "", url: response.url || url.href };
    }
    const html = await response.text();
    return {
      ok: true,
      status: response.status,
      html: html.slice(0, 1500000),
      title: extractPageTitle(html),
      url: response.url || url.href,
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchLinkTitle(targetUrl) {
  const url = new URL(targetUrl);
  if (!["http:", "https:"].includes(url.protocol) || isBlockedFetchHost(url.hostname)) {
    const error = new Error("URL is not allowed");
    error.statusCode = 400;
    throw error;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "user-agent": "goal2-a11y-review/0.1 (+link-title-preview)",
        accept: "text/html,application/xhtml+xml",
      },
    });
    const contentType = response.headers.get("content-type") || "";
    if (!response.ok || !/text\/html|application\/xhtml\+xml/i.test(contentType)) {
      return { ok: false, status: response.status, title: "" };
    }
    const html = await response.text();
    const title = extractPageTitle(html.slice(0, 300000));
    return { ok: Boolean(title), status: response.status, title };
  } finally {
    clearTimeout(timeout);
  }
}

const server = http.createServer(async (request, response) => {
  let url;
  try {
    url = new URL(request.url, `http://${request.headers.host || "localhost"}`);
  } catch {
    response.writeHead(400);
    response.end("Bad request");
    return;
  }

  if (request.method !== "GET") {
    response.writeHead(405, { allow: "GET" });
    response.end("Method not allowed");
    return;
  }

  if (url.pathname === "/api/health") {
    sendJson(response, 200, { ok: true, service: "goal2-a11y-review-poc" });
    return;
  }

  if (url.pathname === "/api/rules") {
    try {
      const result = loadRules({ rootDir });
      sendJson(response, 200, {
        rules: result.rules,
        summary: result.summary,
        source: path.relative(rootDir, result.sourcePath),
      });
    } catch (error) {
      sendJson(response, 500, {
        error: "rules_not_available",
        message: error.message,
      });
    }
    return;
  }

  if (url.pathname === "/api/saga-gold-hints") {
    try {
      const limit = Number(url.searchParams.get("limit") || 24);
      const fixtureRoot = defaultSagaFixtureRoot(rootDir);
      sendJson(response, 200, learnSagaGoldHints(fixtureRoot, { limit }));
    } catch (error) {
      sendJson(response, error.code === "ENOENT" ? 404 : 500, {
        error: "saga_gold_hints_not_available",
        message: error.message,
      });
    }
    return;
  }

  if (url.pathname === "/api/saga-samples") {
    try {
      const limit = Number(url.searchParams.get("limit") || 10);
      const seed = url.searchParams.get("seed") || undefined;
      const fixtureRoot = defaultSagaFixtureRoot(rootDir);
      sendJson(response, 200, listSagaSamples(fixtureRoot, { limit, seed }));
    } catch (error) {
      sendJson(response, error.code === "ENOENT" ? 404 : 500, {
        error: "saga_samples_not_available",
        message: error.message,
      });
    }
    return;
  }

  if (url.pathname === "/api/link-title") {
    const href = url.searchParams.get("href") || "";
    const base = url.searchParams.get("base") || "";
    try {
      const target = new URL(href, base || `http://${request.headers.host || "localhost"}`);
      const result = await fetchLinkTitle(target.href);
      sendJson(response, 200, {
        ...result,
        url: target.href,
      });
    } catch (error) {
      sendJson(response, error.statusCode || 502, {
        ok: false,
        error: "link_title_not_available",
        message: error.message,
      });
    }
    return;
  }

  if (url.pathname === "/api/fetch-html") {
    const targetUrl = url.searchParams.get("url") || "";
    try {
      const result = await fetchHtmlPage(targetUrl);
      sendJson(response, 200, result);
    } catch (error) {
      sendJson(response, error.statusCode || 502, {
        ok: false,
        error: "html_fetch_not_available",
        message: error.message,
      });
    }
    return;
  }

  sendStatic(url.pathname, response);
});

server.listen(port, "0.0.0.0", () => {
  console.log(`Goal2 review PoC listening on port ${port}`);
});

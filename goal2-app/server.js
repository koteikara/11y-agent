const http = require("http");
const fs = require("fs");
const path = require("path");
const net = require("net");
const dns = require("dns");
const os = require("os");
const { execFile } = require("child_process");
const { promisify } = require("util");
const { loadRules } = require("./lib/rules");
const { loadCheckitems } = require("./lib/michecker-checkitems");
const { defaultSagaFixtureRoot } = require("./lib/sagaAutoFix");
const { learnSagaGoldHints } = require("./lib/sagaGoldHints");
const { listSagaSamples } = require("./lib/sagaSamples");
const { callGemini } = require("./lib/llm");
const { getTaskConfig } = require("./lib/llm-prompts");

const execFileAsync = promisify(execFile);

let isSeaBuild = false;
try {
  isSeaBuild = require("node:sea").isSea();
} catch {
  isSeaBuild = false;
}

// SEA(単一実行ファイル)でパッケージ化した場合、埋め込まれたエントリスクリプトの
// __dirnameは.exeの実際の設置場所を指さない(Node内部の仮想パスになる)。
// public/・data/等の同梱ファイルは.exeの隣に置く前提のため、SEA実行時は
// process.execPath(=.exe自身のパス)の親ディレクトリを起点にする。
const rootDir = isSeaBuild ? path.dirname(process.execPath) : __dirname;
const publicDir = path.join(rootDir, "public");
const port = Number(process.env.PORT || 8080);

// パッケージ化した.exe版(SEA)では、htmlchecker.exeのパスを環境変数ではなく
// この設定ファイルに保存し、画面から入力・変更できるようにする(コマンドライン操作をなくすため)。
function getLocalConfigPath() {
  const configDir = process.env.APPDATA ? path.join(process.env.APPDATA, "goal2-app") : path.join(rootDir, ".goal2-app-local");
  return path.join(configDir, "config.json");
}

function readLocalConfig() {
  try {
    return JSON.parse(fs.readFileSync(getLocalConfigPath(), "utf8"));
  } catch {
    return {};
  }
}

function writeLocalConfig(config) {
  const configPath = getLocalConfigPath();
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), "utf8");
}

// 環境変数(パワーユーザー向けの上書き)を優先し、無ければ設定ファイルの値を使う。
function getHtmlCheckerExePath() {
  if (process.env.MICHECKER_HTMLCHECKER_EXE) return process.env.MICHECKER_HTMLCHECKER_EXE;
  return readLocalConfig().htmlCheckerExePath || "";
}

function openBrowser(url) {
  const platform = process.platform;
  const command = platform === "win32" ? "cmd" : platform === "darwin" ? "open" : "xdg-open";
  const args = platform === "win32" ? ["/c", "start", "", url] : [url];
  const child = execFile(command, args, () => {});
  child.on("error", () => {});
}

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

function expandIpv6Groups(address) {
  const host = String(address || "").toLowerCase().replace(/^\[|\]$/g, "");
  if (!host.includes("::")) return host.split(":");
  const [head, tail] = host.split("::");
  const headParts = head ? head.split(":") : [];
  const tailParts = tail ? tail.split(":") : [];
  const missing = 8 - headParts.length - tailParts.length;
  return [...headParts, ...new Array(Math.max(0, missing)).fill("0"), ...tailParts];
}

function extractIpv4MappedAddress(address) {
  if (net.isIP(address) !== 6) return null;
  const groups = expandIpv6Groups(address);
  if (groups.length !== 8) return null;
  const isMapped = groups.slice(0, 5).every((group) => group === "0" || group === "") && groups[5] === "ffff";
  if (!isMapped) return null;
  const high = Number.parseInt(groups[6] || "0", 16);
  const low = Number.parseInt(groups[7] || "0", 16);
  return [(high >> 8) & 0xff, high & 0xff, (low >> 8) & 0xff, low & 0xff].join(".");
}

function normalizeIpAddress(address) {
  const host = String(address || "").toLowerCase();
  const dottedMapped = host.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (dottedMapped) return dottedMapped[1];
  return extractIpv4MappedAddress(host) || host;
}

function isBlockedIpAddress(address) {
  const host = normalizeIpAddress(address);
  const ipVersion = net.isIP(host);
  if (ipVersion === 4) {
    const parts = host.split(".").map(Number);
    return (
      parts[0] === 0 ||
      parts[0] === 10 ||
      parts[0] === 127 ||
      (parts[0] === 169 && parts[1] === 254) ||
      (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
      (parts[0] === 192 && parts[1] === 168) ||
      (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127)
    );
  }
  if (ipVersion === 6) {
    return host === "::1" || host === "::" || host.startsWith("fe80:") || host.startsWith("fc") || host.startsWith("fd");
  }
  return true;
}

function isBlockedHostLiteral(hostname) {
  const host = String(hostname || "").toLowerCase();
  return !host || host === "localhost" || host.endsWith(".localhost") || host === "metadata.google.internal";
}

async function assertFetchUrlAllowed(url) {
  if (!["http:", "https:"].includes(url.protocol) || isBlockedHostLiteral(url.hostname)) {
    const error = new Error("URL is not allowed");
    error.statusCode = 400;
    throw error;
  }
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (net.isIP(host)) {
    if (isBlockedIpAddress(host)) {
      const error = new Error("URL is not allowed");
      error.statusCode = 400;
      throw error;
    }
    return;
  }
  let addresses;
  try {
    addresses = await dns.promises.lookup(host, { all: true, verbatim: true });
  } catch {
    const error = new Error("Host could not be resolved");
    error.statusCode = 400;
    throw error;
  }
  if (!addresses.length || addresses.some((entry) => isBlockedIpAddress(entry.address))) {
    const error = new Error("URL is not allowed");
    error.statusCode = 400;
    throw error;
  }
}

async function fetchWithSafeRedirects(targetUrl, fetchOptions, maxRedirects = 5) {
  let currentUrl = new URL(targetUrl);
  for (let redirectCount = 0; ; redirectCount += 1) {
    await assertFetchUrlAllowed(currentUrl);
    const response = await fetch(currentUrl, { ...fetchOptions, redirect: "manual" });
    if ([301, 302, 303, 307, 308].includes(response.status) && response.headers.get("location")) {
      if (redirectCount >= maxRedirects) {
        const error = new Error("Too many redirects");
        error.statusCode = 400;
        throw error;
      }
      currentUrl = new URL(response.headers.get("location"), currentUrl);
      continue;
    }
    return response;
  }
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
  await assertFetchUrlAllowed(url);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetchWithSafeRedirects(url, {
      signal: controller.signal,
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
  await assertFetchUrlAllowed(url);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetchWithSafeRedirects(url, {
      signal: controller.signal,
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

const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const ALLOWED_IMAGE_CONTENT_TYPES = /^image\/(jpeg|png|webp|gif)/i;

async function fetchImageAsBase64(targetUrl) {
  const url = new URL(targetUrl);
  await assertFetchUrlAllowed(url);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetchWithSafeRedirects(url, {
      signal: controller.signal,
      headers: { "user-agent": "goal2-a11y-review/0.1 (+image-alt-preview)" },
    });
    const contentType = (response.headers.get("content-type") || "").split(";")[0].trim();
    if (!response.ok || !ALLOWED_IMAGE_CONTENT_TYPES.test(contentType)) {
      const error = new Error(`Unsupported or unreachable image (status ${response.status}, content-type ${contentType || "unknown"})`);
      error.statusCode = 400;
      throw error;
    }
    const arrayBuffer = await response.arrayBuffer();
    if (arrayBuffer.byteLength > MAX_IMAGE_BYTES) {
      const error = new Error("Image exceeds the 4MB size limit");
      error.statusCode = 413;
      throw error;
    }
    return { base64: Buffer.from(arrayBuffer).toString("base64"), mimeType: contentType };
  } finally {
    clearTimeout(timeout);
  }
}

function readJsonBody(request, maxBytes = 4 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    request.on("data", (chunk) => {
      size += chunk.length;
      if (size > maxBytes) {
        reject(Object.assign(new Error("Request body too large"), { statusCode: 413 }));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on("end", () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}"));
      } catch {
        reject(Object.assign(new Error("Invalid JSON body"), { statusCode: 400 }));
      }
    });
    request.on("error", reject);
  });
}

async function listResultCsvFiles(resultDir) {
  try {
    const entries = await fs.promises.readdir(resultDir, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".csv"))
      .map((entry) => path.join(resultDir, entry.name));
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
}

async function findNewFiles(resultDir, filesBefore, pattern) {
  const filesAfter = await listResultCsvFiles(resultDir);
  return filesAfter.filter((file) => !filesBefore.has(file) && pattern.test(path.basename(file)));
}

function parseCsvRows(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  let i = 0;
  const len = text.length;
  while (i < len) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += ch;
      i += 1;
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (ch === ",") {
      row.push(field);
      field = "";
      i += 1;
      continue;
    }
    if (ch === "\r" || ch === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      if (ch === "\r" && text[i + 1] === "\n") i += 1;
      i += 1;
      continue;
    }
    field += ch;
    i += 1;
  }
  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((cells) => !(cells.length === 1 && cells[0] === ""));
}

// htmlchecker.exe実行後の"[日付]_[時刻]_list.csv"を解析し、検査対象HTMLファイルのパスから
// 対応する結果CSVファイルのパスへのマップを返す。実機での動作確認済み(2026-07-07、ユーザー提供の
// 実行結果で確認): ヘッダーは"Target HTML file,Result CSV file"で、値は検査に渡した絶対パスと
// 対応する結果CSVの絶対パスがそのまま入っている。
function parseHtmlCheckerListCsv(text) {
  const rows = parseCsvRows(text);
  const map = new Map();
  if (!rows.length) return map;
  const header = rows[0].map((cell) => cell.trim());
  const targetIndex = header.indexOf("Target HTML file");
  const resultIndex = header.indexOf("Result CSV file");
  if (targetIndex === -1 || resultIndex === -1) return map;
  rows.slice(1).forEach((cols) => {
    const target = (cols[targetIndex] || "").trim();
    const result = (cols[resultIndex] || "").trim();
    if (target && result) map.set(target, result);
  });
  return map;
}

async function runHtmlCheckerLocalCompare(beforeHtml, afterHtml) {
  if (process.platform !== "win32") {
    const error = new Error("この機能はWindows上で動作しているgoal2-appでのみ利用できます(現在の実行環境はWindowsではありません)。");
    error.statusCode = 400;
    error.code = "windows_required";
    throw error;
  }
  const htmlCheckerExePath = getHtmlCheckerExePath();
  if (!htmlCheckerExePath) {
    const error = new Error("htmlchecker.exe のパスが設定されていません。設定画面から指定してください。");
    error.statusCode = 400;
    error.code = "htmlchecker_not_configured";
    throw error;
  }
  if (!fs.existsSync(htmlCheckerExePath)) {
    const error = new Error(`指定されたパスに htmlchecker.exe が見つかりません: ${htmlCheckerExePath}`);
    error.statusCode = 400;
    error.code = "htmlchecker_not_found";
    throw error;
  }

  const exeDir = path.dirname(htmlCheckerExePath);
  const resultDir = path.join(exeDir, "result");
  const filesBefore = new Set(await listResultCsvFiles(resultDir));

  const workDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "michecker-compare-"));
  const beforeHtmlPath = path.join(workDir, "before.html");
  const afterHtmlPath = path.join(workDir, "after.html");
  const listPath = path.join(workDir, "htmllist.txt");
  await fs.promises.writeFile(beforeHtmlPath, beforeHtml, "utf8");
  await fs.promises.writeFile(afterHtmlPath, afterHtml, "utf8");
  await fs.promises.writeFile(listPath, `${beforeHtmlPath}\r\n${afterHtmlPath}\r\n`, "utf8");

  try {
    await execFileAsync(htmlCheckerExePath, ["-f", listPath], { cwd: exeDir, timeout: 120000 });
  } catch (error) {
    const wrapped = new Error(`htmlchecker.exe の実行に失敗しました: ${error.message}`);
    wrapped.statusCode = 500;
    wrapped.code = "htmlchecker_execution_failed";
    throw wrapped;
  }

  const newListCsvFiles = await findNewFiles(resultDir, filesBefore, /_list\.csv$/i);
  if (newListCsvFiles.length !== 1) {
    const error = new Error(
      `result フォルダ(${resultDir})から検査結果一覧(*_list.csv)を1件だけ特定できませんでした(見つかった件数: ${newListCsvFiles.length})。result フォルダの内容を確認してください。`
    );
    error.statusCode = 500;
    error.code = "htmlchecker_result_list_not_found";
    error.details = { resultDir, newListCsvFiles };
    throw error;
  }

  const decoder = new TextDecoder("shift_jis");
  const listCsvBuffer = await fs.promises.readFile(newListCsvFiles[0]);
  const listCsvMap = parseHtmlCheckerListCsv(decoder.decode(listCsvBuffer));
  const beforeCsvFile = listCsvMap.get(beforeHtmlPath);
  const afterCsvFile = listCsvMap.get(afterHtmlPath);
  if (!beforeCsvFile || !afterCsvFile) {
    const error = new Error(
      `検査結果一覧(${newListCsvFiles[0]})に移行元・移行後のHTMLファイルへの対応が見つかりませんでした。`
    );
    error.statusCode = 500;
    error.code = "htmlchecker_result_mapping_not_found";
    error.details = { listCsvFile: newListCsvFiles[0], entries: [...listCsvMap.entries()] };
    throw error;
  }

  const [beforeCsvBuffer, afterCsvBuffer] = await Promise.all([
    fs.promises.readFile(beforeCsvFile),
    fs.promises.readFile(afterCsvFile),
  ]);
  return {
    beforeCsvText: decoder.decode(beforeCsvBuffer),
    afterCsvText: decoder.decode(afterCsvBuffer),
    resultDir,
    beforeCsvFile,
    afterCsvFile,
  };
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

  if (request.method === "POST" && url.pathname === "/api/michecker-local-compare") {
    try {
      const body = await readJsonBody(request);
      const { beforeHtml, afterHtml } = body || {};
      if (typeof beforeHtml !== "string" || typeof afterHtml !== "string" || !beforeHtml.trim() || !afterHtml.trim()) {
        sendJson(response, 400, { ok: false, error: "missing_html", message: "移行元・移行後のHTMLを両方指定してください。" });
        return;
      }
      const result = await runHtmlCheckerLocalCompare(beforeHtml, afterHtml);
      sendJson(response, 200, { ok: true, ...result });
    } catch (error) {
      sendJson(response, error.statusCode || 500, {
        ok: false,
        error: error.code || "htmlchecker_local_compare_failed",
        message: error.message,
      });
    }
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/llm/enrich") {
    try {
      const body = await readJsonBody(request);
      const task = typeof body?.task === "string" ? body.task : "";
      const items = Array.isArray(body?.items) ? body.items : [];
      const config = getTaskConfig(task);
      if (!config) {
        sendJson(response, 400, { ok: false, error: "unknown_task", message: `未対応のtaskです: ${task}` });
        return;
      }
      if (!items.length) {
        sendJson(response, 400, { ok: false, error: "empty_items", message: "itemsが空です。" });
        return;
      }
      if (items.length > 50) {
        sendJson(response, 400, { ok: false, error: "too_many_items", message: "1リクエストあたりのitemsは50件までです。" });
        return;
      }
      const userText = config.buildUserText(items);
      const result = await callGemini({
        systemPrompt: config.systemPrompt,
        userText,
        responseSchema: config.responseSchema,
      });
      let results;
      try {
        results = JSON.parse(result.text);
      } catch {
        sendJson(response, 502, { ok: false, error: "llm_invalid_response", message: "LLMの応答をJSONとして解釈できませんでした。" });
        return;
      }
      sendJson(response, 200, { ok: true, results, usage: result.usage });
    } catch (error) {
      sendJson(response, error.statusCode || 500, {
        ok: false,
        error: error.code || "llm_enrich_failed",
        message: error.message,
      });
    }
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/llm/image-alt") {
    try {
      const body = await readJsonBody(request);
      const imageUrl = typeof body?.imageUrl === "string" ? body.imageUrl : "";
      const caption = typeof body?.caption === "string" ? body.caption : "";
      const task = typeof body?.task === "string" && body.task ? body.task : "image-alt";
      if (!imageUrl) {
        sendJson(response, 400, { ok: false, error: "missing_image_url", message: "imageUrlを指定してください。" });
        return;
      }
      const config = getTaskConfig(task);
      if (!config) {
        sendJson(response, 400, { ok: false, error: "unknown_task", message: `未対応のtaskです: ${task}` });
        return;
      }
      const { base64, mimeType } = await fetchImageAsBase64(imageUrl);
      const result = await callGemini({
        systemPrompt: config.systemPrompt,
        userText: config.buildUserText({ caption }),
        imageBase64: base64,
        imageMimeType: mimeType,
        responseSchema: config.responseSchema,
      });
      let parsed;
      try {
        parsed = JSON.parse(result.text);
      } catch {
        sendJson(response, 502, { ok: false, error: "llm_invalid_response", message: "LLMの応答をJSONとして解釈できませんでした。" });
        return;
      }
      sendJson(response, 200, { ok: true, result: parsed, usage: result.usage });
    } catch (error) {
      sendJson(response, error.statusCode || 500, {
        ok: false,
        error: error.code || "llm_image_alt_failed",
        message: error.message,
      });
    }
    return;
  }

  if (url.pathname === "/api/local-settings" && request.method === "GET") {
    sendJson(response, 200, {
      ok: true,
      htmlCheckerExePath: getHtmlCheckerExePath(),
      isWindows: process.platform === "win32",
      envOverride: Boolean(process.env.MICHECKER_HTMLCHECKER_EXE),
    });
    return;
  }

  if (url.pathname === "/api/local-settings" && request.method === "POST") {
    try {
      const body = await readJsonBody(request);
      const htmlCheckerExePath = typeof body?.htmlCheckerExePath === "string" ? body.htmlCheckerExePath.trim() : "";
      writeLocalConfig({ ...readLocalConfig(), htmlCheckerExePath });
      sendJson(response, 200, {
        ok: true,
        htmlCheckerExePath: getHtmlCheckerExePath(),
        isWindows: process.platform === "win32",
        envOverride: Boolean(process.env.MICHECKER_HTMLCHECKER_EXE),
      });
    } catch (error) {
      sendJson(response, error.statusCode || 500, { ok: false, error: "local_settings_save_failed", message: error.message });
    }
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

  if (url.pathname === "/api/michecker-checkitems") {
    try {
      const result = loadCheckitems({ rootDir });
      sendJson(response, 200, {
        checkitems: result.checkitems,
        summary: result.summary,
        source: path.relative(rootDir, result.sourcePath),
      });
    } catch (error) {
      sendJson(response, 500, {
        error: "michecker_checkitems_not_available",
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
  // パッケージ化した.exe版(SEA)で起動した場合のみ、ブラウザを自動で開く。
  // 通常のnode server.js実行(開発・Cloud Runデプロイ)では自動起動しない。
  if (isSeaBuild) {
    openBrowser(`http://localhost:${port}`);
  }
});

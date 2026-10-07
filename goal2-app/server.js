const http = require("http");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { execFile } = require("child_process");
const { promisify } = require("util");
const { defaultSagaFixtureRoot } = require("./lib/sagaAutoFix");
const { learnSagaGoldHints } = require("./lib/sagaGoldHints");
const { listSagaSamples } = require("./lib/sagaSamples");
const { fetchHtmlPage } = require("./lib/safe-fetch");
const { isEngineApiRoute, handleEngineApi } = require("./lib/engine-api");
const {
  resolveListenHost,
  isLoopbackListenHost,
  isAllowedLoopbackHostHeader,
  checkPostRequest,
  validateHtmlCheckerExePath,
} = require("./lib/local-guard");
const { resolveAppAuth, checkAppPassword, checkFetchSite, MIN_APP_PASSWORD_LENGTH } = require("./lib/app-auth");

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
// 待ち受けのアドレス。Windows 版などの手元では 127.0.0.1、Cloud Run では 0.0.0.0(lib/local-guard.js)。
const listenHost = resolveListenHost(process.env);
const checkLoopbackHostHeader = isLoopbackListenHost(listenHost);
const isWindows = process.platform === "win32";
// 共通のパスワード(lib/app-auth.js)。値はログに出さない。
const appAuth = resolveAppAuth(process.env);

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
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
};

function sendJson(response, statusCode, payload, extraHeaders = {}) {
  response.writeHead(statusCode, {
    ...extraHeaders,
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
  if (!isWindows) {
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
  // 設定ファイルの値も環境変数 MICHECKER_HTMLCHECKER_EXE の値も、実行の直前に形を確かめる。
  const pathCheck = validateHtmlCheckerExePath(htmlCheckerExePath);
  if (!pathCheck.ok) {
    const error = new Error(`${pathCheck.message} (現在の設定: ${htmlCheckerExePath})`);
    error.statusCode = 400;
    error.code = "htmlchecker_path_invalid";
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

  // 手元だけで待ち受けるときは、GET も含むすべての要求で Host ヘッダーを確かめる(DNS リバインディング対策)。
  if (checkLoopbackHostHeader && !isAllowedLoopbackHostHeader(request.headers.host, port)) {
    sendJson(response, 403, { ok: false, error: "host_not_allowed", message: "この Host からの要求は受け付けません。" });
    return;
  }

  // 確かめる順は、Host(上)、Sec-Fetch-Site、パスワード、POST の送り元とする。
  // Host を最初にするのは、DNS リバインディングで届いた要求を、ほかの確認の結果を見せずに止めるためである。
  // Sec-Fetch-Site をパスワードより先にするのは、別のサイトから起こされた要求に WWW-Authenticate を返さず、
  // 別のサイトの iframe などでブラウザーがパスワードの入力画面を出さないようにするためである。
  // パスワードを POST の送り元より先にするのは、パスワードを知らない要求には、どこで止まったかを見せず一律に 401 を返すためである。
  const requestInfo = { method: request.method, pathname: url.pathname, headers: request.headers };
  const fetchSiteRejection = checkFetchSite(requestInfo);
  if (fetchSiteRejection) {
    sendJson(response, fetchSiteRejection.statusCode, {
      ok: false,
      error: fetchSiteRejection.error,
      message: fetchSiteRejection.message,
    });
    return;
  }
  const authRejection = checkAppPassword(appAuth, requestInfo);
  if (authRejection) {
    sendJson(
      response,
      authRejection.statusCode,
      { ok: false, error: authRejection.error, message: authRejection.message },
      authRejection.headers
    );
    return;
  }

  // すべての POST で Content-Type と Origin を確かめる。Cloud Run でも行う。
  if (request.method === "POST") {
    const rejection = checkPostRequest(request.headers);
    if (rejection) {
      sendJson(response, rejection.statusCode, { ok: false, error: rejection.error, message: rejection.message });
      return;
    }
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

  // 候補のエンジンが呼ぶ API(ルール、miChecker の項目、リンク先の題名、AI)は、一括処理と同じ処理で答える(lib/engine-api.js)。
  // GOAL1バッチ画面の /api/llm/status は、AI の呼び出しが起きるかを env 変数の有無だけで返し、呼び出しはしない。
  if (isEngineApiRoute(request.method, url.pathname)) {
    let body = null;
    if (request.method === "POST") {
      try {
        body = await readJsonBody(request);
      } catch (error) {
        const fallbackError = url.pathname === "/api/llm/enrich" ? "llm_enrich_failed" : "llm_image_alt_failed";
        sendJson(response, error.statusCode || 500, { ok: false, error: error.code || fallbackError, message: error.message });
        return;
      }
    }
    const result = await handleEngineApi({
      method: request.method,
      pathname: url.pathname,
      searchParams: url.searchParams,
      body,
      rootDir,
      host: request.headers.host || "localhost",
    });
    sendJson(response, result.status, result.payload);
    return;
  }

  // Windows 以外では、画面の説明表示のために GET だけを返す(パスは空、isWindows: false)。
  if (url.pathname === "/api/local-settings" && request.method === "GET") {
    sendJson(response, 200, {
      ok: true,
      htmlCheckerExePath: isWindows ? getHtmlCheckerExePath() : "",
      isWindows,
      envOverride: isWindows && Boolean(process.env.MICHECKER_HTMLCHECKER_EXE),
    });
    return;
  }

  if (url.pathname === "/api/local-settings" && request.method === "POST") {
    if (!isWindows) {
      sendJson(response, 404, {
        ok: false,
        error: "not_found",
        message: "htmlchecker.exe のパスの設定は、Windows 上で動作している goal2-app でのみ保存できます。",
      });
      return;
    }
    try {
      const body = await readJsonBody(request);
      const htmlCheckerExePath = typeof body?.htmlCheckerExePath === "string" ? body.htmlCheckerExePath.trim() : "";
      // 空のときは設定を消すだけなので通す。値があるときは形を確かめてから保存する。
      if (htmlCheckerExePath) {
        const pathCheck = validateHtmlCheckerExePath(htmlCheckerExePath);
        if (!pathCheck.ok) {
          sendJson(response, 400, { ok: false, error: "htmlchecker_path_invalid", message: pathCheck.message });
          return;
        }
      }
      writeLocalConfig({ ...readLocalConfig(), htmlCheckerExePath });
      sendJson(response, 200, {
        ok: true,
        htmlCheckerExePath: getHtmlCheckerExePath(),
        isWindows,
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
    sendJson(response, 200, { ok: true, service: "a11y-migration-app" });
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

server.listen(port, listenHost, () => {
  console.log(`a11y-migration-app listening on ${listenHost}:${port}`);
  if (appAuth.mode === "misconfigured") {
    console.error(
      `ERROR: APP_PASSWORD が設定されていないか、${MIN_APP_PASSWORD_LENGTH}文字より短いため、GET /api/health 以外の要求に 503 を返します。`
    );
  }
  // パッケージ化した.exe版(SEA)で起動した場合のみ、ブラウザを自動で開く。
  // 通常のnode server.js実行(開発・Cloud Runデプロイ)では自動起動しない。
  if (isSeaBuild) {
    openBrowser(`http://localhost:${port}`);
  }
});

// Cloud Run の本番を、全員で共通の1つのパスワードで守る(HTTP の Basic 認証)。
// 設計は PRODUCTION_OPERATIONS_INSTRUCTIONS.md の 3.3 P1 にある。
// server.js から呼ぶ確認を、要求や環境変数を引数に取る純粋な関数として置く。
// パスワードと Authorization ヘッダーは、ログにも応答にも出さない。
const crypto = require("crypto");

const MIN_APP_PASSWORD_LENGTH = 16;
const WWW_AUTHENTICATE = 'Basic realm="a11y-migration-app", charset="UTF-8"';
const ALLOWED_FETCH_SITES = new Set(["same-origin", "none"]);

// パスワードを確かめるかどうかを、起動時の環境変数から決める。
// - "misconfigured": Cloud Run(K_SERVICE がある)で APP_PASSWORD が無いか16文字より短い。GET /api/health 以外に 503 を返す。
// - "required": APP_PASSWORD がある。GET /api/health 以外でパスワードを確かめる。
// - "off": Cloud Run 以外で APP_PASSWORD が無い。パスワードを求めない。
// 前後の空白と改行は除く。PowerShell からシークレットを作ると、末尾に改行が付くためである。
function resolveAppAuth(env = process.env) {
  const password = typeof env.APP_PASSWORD === "string" ? env.APP_PASSWORD.trim() : "";
  if (env.K_SERVICE && password.length < MIN_APP_PASSWORD_LENGTH) {
    return { mode: "misconfigured", password: "" };
  }
  if (password) return { mode: "required", password };
  return { mode: "off", password: "" };
}

// パスワードを求めないのは、メソッドが GET でパスがちょうど /api/health のときだけ。
function isHealthCheckRequest(method, pathname) {
  return method === "GET" && pathname === "/api/health";
}

// Authorization: Basic <Base64("ユーザー名:パスワード")> からパスワードを取り出す。
// 形が崩れているとき(Basic で始まらない、Base64 として読めない、コロンが無い)は null を返し、例外を出さない。
// ユーザー名は確かめないので捨てる。
function parseBasicAuthPassword(header) {
  if (typeof header !== "string") return null;
  const match = /^Basic +([A-Za-z0-9+/]+={0,2}) *$/i.exec(header);
  if (!match || match[1].length % 4 !== 0) return null;
  const decoded = Buffer.from(match[1], "base64").toString("utf8");
  const colon = decoded.indexOf(":");
  if (colon === -1) return null;
  return decoded.slice(colon + 1);
}

// 両方を SHA-256 にしてから比べる。長さをそろえ、比べるのにかかる時間から中身を推し量られないようにする。
function passwordMatches(expected, received) {
  const a = crypto.createHash("sha256").update(String(expected), "utf8").digest();
  const b = crypto.createHash("sha256").update(String(received), "utf8").digest();
  return crypto.timingSafeEqual(a, b);
}

// パスワードを確かめる。通すときは null、止めるときは { statusCode, error, message, headers } を返す。
function checkAppPassword(appAuth, { method, pathname, headers = {} }) {
  if (isHealthCheckRequest(method, pathname)) return null;
  if (appAuth.mode === "off") return null;
  if (appAuth.mode === "misconfigured") {
    return {
      statusCode: 503,
      error: "app_password_not_configured",
      message: "サーバーの設定が済んでいないため、使えません。管理者に連絡してください。",
      headers: {},
    };
  }
  const received = parseBasicAuthPassword(headers.authorization);
  if (received !== null && passwordMatches(appAuth.password, received)) return null;
  return {
    statusCode: 401,
    error: "unauthorized",
    message: "パスワードが必要です。",
    headers: { "www-authenticate": WWW_AUTHENTICATE },
  };
}

// 別のサイトから起こされた API の要求を止める。通すときは null、止めるときは { statusCode, error, message } を返す。
// ブラウザーは覚えたパスワードを、別のサイトの画像や iframe が起こした要求にも付けることがある。
// 画面自身の fetch() は same-origin、アドレス欄に直接打ったときは none になる。same-site も止める。
// ヘッダーが無い要求(ブラウザー以外の道具やテスト)は通す。パスワードの有無にかかわらず行う。
function checkFetchSite({ method, pathname, headers = {} }) {
  if (isHealthCheckRequest(method, pathname)) return null;
  if (!String(pathname || "").startsWith("/api/")) return null;
  const site = headers["sec-fetch-site"];
  if (site === undefined) return null;
  if (ALLOWED_FETCH_SITES.has(String(site).trim().toLowerCase())) return null;
  return {
    statusCode: 403,
    error: "cross_site_request",
    message: "別のサイトから起こされた要求は受け付けません。",
  };
}

module.exports = {
  MIN_APP_PASSWORD_LENGTH,
  WWW_AUTHENTICATE,
  resolveAppAuth,
  isHealthCheckRequest,
  parseBasicAuthPassword,
  passwordMatches,
  checkAppPassword,
  checkFetchSite,
};

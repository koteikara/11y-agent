// 手元(Windows 版)で動くサーバーの守り。
// 設計は PRODUCTION_OPERATIONS_INSTRUCTIONS.md の 3.2 P0 にある。
// server.js から呼ぶ確認を、要求や環境変数を引数に取る純粋な関数として置く。
// CI は Linux で動くので、Windows のパスの確認もここの関数を直接テストする。
const path = require("path");

const LOOPBACK_LISTEN_HOSTS = new Set(["127.0.0.1", "::1", "localhost"]);
const HTMLCHECKER_EXE_NAME = "htmlchecker.exe";

// 待ち受けのアドレス。HOST があればそれを使う。
// 無ければ Cloud Run(K_SERVICE がある)では 0.0.0.0、それ以外では 127.0.0.1 にする。
function resolveListenHost(env = process.env) {
  const host = typeof env.HOST === "string" ? env.HOST.trim() : "";
  if (host) return host;
  return env.K_SERVICE ? "0.0.0.0" : "127.0.0.1";
}

function isLoopbackListenHost(listenHost) {
  return LOOPBACK_LISTEN_HOSTS.has(String(listenHost || "").toLowerCase());
}

// 手元だけで待ち受けるときに受け付ける Host ヘッダー。
// 外部のドメインを 127.0.0.1 に向ける攻撃(DNS リバインディング)では Host が外部のドメインになるので、ここで止まる。
function isAllowedLoopbackHostHeader(hostHeader, port) {
  const host = String(hostHeader || "").trim().toLowerCase();
  if (!host) return false;
  return [`localhost:${port}`, `127.0.0.1:${port}`, `[::1]:${port}`].includes(host);
}

function mediaType(contentType) {
  return String(contentType || "").split(";")[0].trim().toLowerCase();
}

// POST の送り元を確かめる。通すときは null、止めるときは { statusCode, error, message } を返す。
// Content-Type: application/json の要求は、別のサイトからはブラウザーの事前確認(CORS のプリフライト)を
// 経ないと送れない。サーバーは事前確認に許可を返さないので、別のサイトのページからは送られない。
function checkPostRequest(headers = {}) {
  if (mediaType(headers["content-type"]) !== "application/json") {
    return {
      statusCode: 415,
      error: "unsupported_media_type",
      message: "POST の Content-Type は application/json にしてください。",
    };
  }
  const origin = headers.origin;
  if (origin !== undefined) {
    let originHost = "";
    try {
      originHost = new URL(origin).host.toLowerCase();
    } catch {
      originHost = "";
    }
    const hostHeader = String(headers.host || "").trim().toLowerCase();
    if (!originHost || !hostHeader || originHost !== hostHeader) {
      return {
        statusCode: 403,
        error: "origin_not_allowed",
        message: "別のサイトからの要求は受け付けません。",
      };
    }
  }
  return null;
}

// htmlchecker.exe のパスを確かめる。受け付けるのは次の3つをすべて満たすときだけ。
// 1. ドライブ文字から始まる絶対パス(C:\ など)。UNC パス(\\server\share、\\?\ など)は拒む。
// 2. ドライブ文字の後ろにコロンが無い(代替データストリームを指させない)。
// 3. ファイル名が htmlchecker.exe(大文字と小文字を区別しない)。
// 割り当てたネットワークドライブ(Z:\ など)は区別できないので、外部の共有フォルダーを完全には締め出せない。
// 外からの要求そのものは待ち受け・Host・送り元の確認で止め、この確認は実行できるものを絞る役目である。
function validateHtmlCheckerExePath(value) {
  const exePath = typeof value === "string" ? value : "";
  if (!exePath) {
    return { ok: false, reason: "empty", message: "htmlchecker.exe のパスが空です。" };
  }
  if (/[\u0000-\u001f]/.test(exePath)) {
    return { ok: false, reason: "control_character", message: "htmlchecker.exe のパスに使えない文字が含まれています。" };
  }
  if (/^[\\/]{2}/.test(exePath)) {
    return {
      ok: false,
      reason: "unc_path",
      message: "ネットワーク上のパス(\\\\ で始まるパス)は指定できません。C:\\ などのドライブ文字から始まるパスを指定してください。",
    };
  }
  if (!/^[A-Za-z]:[\\/]/.test(exePath)) {
    return {
      ok: false,
      reason: "not_absolute",
      message: "htmlchecker.exe のパスは、C:\\ などのドライブ文字から始まる絶対パスで指定してください。",
    };
  }
  if (exePath.indexOf(":", 2) !== -1) {
    return { ok: false, reason: "invalid_colon", message: "htmlchecker.exe のパスに使えない文字(:)が含まれています。" };
  }
  if (path.win32.basename(exePath).toLowerCase() !== HTMLCHECKER_EXE_NAME) {
    return {
      ok: false,
      reason: "not_htmlchecker",
      message: "ファイル名が htmlchecker.exe のパスだけを指定できます。",
    };
  }
  return { ok: true, reason: "", message: "" };
}

module.exports = {
  resolveListenHost,
  isLoopbackListenHost,
  isAllowedLoopbackHostHeader,
  checkPostRequest,
  validateHtmlCheckerExePath,
};

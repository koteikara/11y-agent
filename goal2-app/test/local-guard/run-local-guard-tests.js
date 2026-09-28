// 手元で動くサーバーの守り(PRODUCTION_OPERATIONS_INSTRUCTIONS.md の 3.2 P0)のテスト。
// 前半は lib/local-guard.js の関数を直接確かめる。CI は Linux で動くので、Windows のパスの確認もここで行う。
// 後半はサーバーを起動し、Host・Content-Type・Origin の確認と、Windows 以外での /api/local-settings を確かめる。
const assert = require("assert");
const http = require("http");
const path = require("path");
const { spawn } = require("child_process");
const {
  resolveListenHost,
  isLoopbackListenHost,
  isAllowedLoopbackHostHeader,
  checkPostRequest,
  validateHtmlCheckerExePath,
} = require("../../lib/local-guard");
const { serverEnv } = require("../server-env");

const rootDir = path.resolve(__dirname, "..", "..");

function testPureFunctions() {
  // 待ち受けのアドレス
  assert.equal(resolveListenHost({}), "127.0.0.1", "HOST も K_SERVICE も無いときは 127.0.0.1");
  assert.equal(resolveListenHost({ K_SERVICE: "a11y-migration-app" }), "0.0.0.0", "Cloud Run では 0.0.0.0");
  assert.equal(resolveListenHost({ HOST: "0.0.0.0" }), "0.0.0.0", "HOST があればそれを使う");
  assert.equal(resolveListenHost({ HOST: "127.0.0.1", K_SERVICE: "x" }), "127.0.0.1", "HOST は K_SERVICE より優先");
  assert.equal(resolveListenHost({ HOST: "  " }), "127.0.0.1", "空白だけの HOST は無いものとして扱う");
  assert.ok(isLoopbackListenHost("127.0.0.1"));
  assert.ok(isLoopbackListenHost("::1"));
  assert.ok(isLoopbackListenHost("localhost"));
  assert.ok(!isLoopbackListenHost("0.0.0.0"));
  assert.ok(!isLoopbackListenHost("192.168.1.10"));

  // Host ヘッダー
  for (const host of ["localhost:8080", "127.0.0.1:8080", "[::1]:8080", "LOCALHOST:8080"]) {
    assert.ok(isAllowedLoopbackHostHeader(host, 8080), `${host} は通す`);
  }
  for (const host of ["evil.example.com:8080", "evil.example.com", "localhost", "localhost:8081", "127.0.0.2:8080", "", undefined]) {
    assert.ok(!isAllowedLoopbackHostHeader(host, 8080), `${host} は拒む`);
  }

  // POST の送り元
  assert.equal(checkPostRequest({ "content-type": "application/json", host: "localhost:8080" }), null);
  assert.equal(checkPostRequest({ "content-type": "application/json; charset=utf-8", host: "localhost:8080" }), null);
  assert.equal(checkPostRequest({ "content-type": "Application/JSON", host: "localhost:8080" }), null);
  assert.equal(
    checkPostRequest({ "content-type": "application/json", host: "localhost:8080", origin: "http://localhost:8080" }),
    null,
    "Origin が同じホストなら通す"
  );
  assert.equal(
    checkPostRequest({ "content-type": "application/json", host: "x.run.app", origin: "https://x.run.app" }),
    null,
    "Cloud Run の同じホストの Origin は通す"
  );
  assert.equal(checkPostRequest({ "content-type": "text/plain", host: "localhost:8080" }).statusCode, 415);
  assert.equal(checkPostRequest({ host: "localhost:8080" }).statusCode, 415, "Content-Type が無い POST は 415");
  assert.equal(checkPostRequest({ "content-type": "application/jsonx", host: "localhost:8080" }).statusCode, 415);
  assert.equal(
    checkPostRequest({ "content-type": "application/x-www-form-urlencoded", host: "localhost:8080" }).statusCode,
    415
  );
  assert.equal(
    checkPostRequest({ "content-type": "application/json", host: "localhost:8080", origin: "https://evil.example.com" }).statusCode,
    403
  );
  assert.equal(
    checkPostRequest({ "content-type": "application/json", host: "localhost:8080", origin: "http://localhost:9999" }).statusCode,
    403,
    "ポートが違う Origin は拒む"
  );
  assert.equal(
    checkPostRequest({ "content-type": "application/json", host: "localhost:8080", origin: "null" }).statusCode,
    403,
    "Origin: null は拒む"
  );

  // htmlchecker.exe のパス
  const accepted = [
    "C:\\tools\\miChecker\\htmlchecker.exe",
    "c:\\tools\\miChecker\\HTMLChecker.EXE",
    "D:/miChecker/htmlchecker.exe",
  ];
  for (const value of accepted) {
    assert.ok(validateHtmlCheckerExePath(value).ok, `${value} は通す`);
  }
  const rejected = [
    ["\\\\server\\share\\htmlchecker.exe", "unc_path"],
    ["//server/share/htmlchecker.exe", "unc_path"],
    ["\\\\?\\C:\\tools\\htmlchecker.exe", "unc_path"],
    ["C:\\Windows\\System32\\cmd.exe", "not_htmlchecker"],
    ["htmlchecker.exe", "not_absolute"],
    ["..\\htmlchecker.exe", "not_absolute"],
    ["\\tools\\htmlchecker.exe", "not_absolute"],
    ["C:htmlchecker.exe", "not_absolute"],
    ["C:\\tools\\htmlchecker.exe:stream", "invalid_colon"],
    ["C:\\tools\\evil.exe:htmlchecker.exe", "invalid_colon"],
    ["C:\\tools\\htmlchecker.exe.bat", "not_htmlchecker"],
    ["C:\\tools\\htmlchecker.exe\n", "control_character"],
    ["", "empty"],
    [undefined, "empty"],
  ];
  for (const [value, reason] of rejected) {
    const result = validateHtmlCheckerExePath(value);
    assert.ok(!result.ok, `${JSON.stringify(value)} は拒む`);
    assert.equal(result.reason, reason, `${JSON.stringify(value)} を拒む理由`);
    assert.ok(result.message, `${JSON.stringify(value)} を拒むときは説明を返す`);
  }
}

function request(port, { method = "GET", pathname, headers = {}, body }) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: "127.0.0.1", port, method, path: pathname, headers }, (res) => {
      let text = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => {
        text += chunk;
      });
      res.on("end", () => {
        let json = null;
        try {
          json = JSON.parse(text);
        } catch {
          json = null;
        }
        resolve({ statusCode: res.statusCode, body: json });
      });
    });
    req.on("error", reject);
    if (body !== undefined) req.write(body);
    req.end();
  });
}

async function startServer(port, extraEnv) {
  const env = serverEnv({ PORT: String(port), ...extraEnv });
  for (const [key, value] of Object.entries(extraEnv)) {
    if (value === undefined) delete env[key];
  }
  const child = spawn(process.execPath, ["server.js"], { cwd: rootDir, env, stdio: ["ignore", "pipe", "pipe"] });
  let stderr = "";
  child.stderr.on("data", (chunk) => {
    stderr += chunk;
  });
  const start = Date.now();
  while (Date.now() - start < 5000) {
    try {
      const res = await request(port, { pathname: "/api/health", headers: { host: `localhost:${port}` } });
      if (res.statusCode === 200) return child;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  child.kill();
  throw new Error(`server did not become ready on port ${port}: ${stderr}`);
}

const JSON_HEADERS = { "content-type": "application/json" };
const UNKNOWN_TASK_BODY = JSON.stringify({ task: "no-such-task", items: [{}] });

async function testLoopbackServer() {
  const port = 9131;
  const self = `localhost:${port}`;
  const child = await startServer(port, { HOST: "127.0.0.1", K_SERVICE: undefined });
  try {
    for (const host of [`localhost:${port}`, `127.0.0.1:${port}`, `[::1]:${port}`]) {
      const res = await request(port, { pathname: "/api/health", headers: { host } });
      assert.equal(res.statusCode, 200, `Host ${host} の GET は通る`);
    }
    for (const host of [`evil.example.com:${port}`, "evil.example.com", `192.168.1.10:${port}`]) {
      const res = await request(port, { pathname: "/api/health", headers: { host } });
      assert.equal(res.statusCode, 403, `Host ${host} の GET は 403`);
      assert.equal(res.body.error, "host_not_allowed");
    }
    {
      const res = await request(port, {
        method: "POST",
        pathname: "/api/llm/enrich",
        headers: { host: `evil.example.com:${port}`, ...JSON_HEADERS },
        body: UNKNOWN_TASK_BODY,
      });
      assert.equal(res.statusCode, 403, "Host が外部のドメインの POST は 403");
    }

    // Content-Type
    for (const contentType of ["text/plain", "text/plain;charset=UTF-8", "application/x-www-form-urlencoded", "multipart/form-data; boundary=x"]) {
      const res = await request(port, {
        method: "POST",
        pathname: "/api/local-settings",
        headers: { host: self, "content-type": contentType },
        body: JSON.stringify({ htmlCheckerExePath: "C:\\Windows\\System32\\cmd.exe" }),
      });
      assert.equal(res.statusCode, 415, `Content-Type: ${contentType} の POST は 415`);
      assert.equal(res.body.error, "unsupported_media_type");
    }

    // Origin
    {
      const res = await request(port, {
        method: "POST",
        pathname: "/api/michecker-local-compare",
        headers: { host: self, origin: "https://evil.example.com", ...JSON_HEADERS },
        body: JSON.stringify({ beforeHtml: "<p>a</p>", afterHtml: "<p>b</p>" }),
      });
      assert.equal(res.statusCode, 403, "Origin が別のホストの POST は 403");
      assert.equal(res.body.error, "origin_not_allowed");
    }
    for (const headers of [
      { host: self, origin: `http://${self}`, ...JSON_HEADERS },
      { host: self, ...JSON_HEADERS },
      { host: self, "content-type": "application/json; charset=utf-8" },
    ]) {
      const res = await request(port, { method: "POST", pathname: "/api/llm/enrich", headers, body: UNKNOWN_TASK_BODY });
      assert.equal(res.statusCode, 400, `守りを通って処理に届く: ${JSON.stringify(headers)}`);
      assert.equal(res.body.error, "unknown_task");
    }

    // Windows 以外での /api/local-settings
    if (process.platform !== "win32") {
      const getRes = await request(port, { pathname: "/api/local-settings", headers: { host: self } });
      assert.equal(getRes.statusCode, 200, "Windows 以外でも GET /api/local-settings は 200");
      assert.equal(getRes.body.ok, true);
      assert.equal(getRes.body.isWindows, false, "Windows 以外では isWindows: false");
      assert.equal(getRes.body.htmlCheckerExePath, "", "Windows 以外ではパスを空で返す");

      for (const headers of [
        { host: self, ...JSON_HEADERS },
        { host: self, origin: `http://${self}`, ...JSON_HEADERS },
      ]) {
        const postRes = await request(port, {
          method: "POST",
          pathname: "/api/local-settings",
          headers,
          body: JSON.stringify({ htmlCheckerExePath: "C:\\tools\\miChecker\\htmlchecker.exe" }),
        });
        assert.equal(postRes.statusCode, 404, "Windows 以外では POST /api/local-settings は 404");
      }
    }
  } finally {
    child.kill();
  }
}

async function testCloudRunServer() {
  // HOST が無く K_SERVICE があるときは 0.0.0.0 で待ち受け、Host は確かめない。POST の確認は行う。
  // Cloud Run では APP_PASSWORD が要るので渡し、要求には合うパスワードを付ける(P1、lib/app-auth.js)。
  const port = 9132;
  const host = "a11y-migration-app-xxxx.a.run.app";
  const password = "local-guard-test-password-0123";
  const auth = { authorization: `Basic ${Buffer.from(`:${password}`).toString("base64")}` };
  const child = await startServer(port, { HOST: undefined, K_SERVICE: "a11y-migration-app", APP_PASSWORD: password });
  try {
    const health = await request(port, { pathname: "/api/health", headers: { host } });
    assert.equal(health.statusCode, 200, "Cloud Run では Host が外部のドメインでも通る");

    const textPlain = await request(port, {
      method: "POST",
      pathname: "/api/llm/enrich",
      headers: { host, ...auth, "content-type": "text/plain" },
      body: UNKNOWN_TASK_BODY,
    });
    assert.equal(textPlain.statusCode, 415, "Cloud Run でも Content-Type: text/plain の POST は 415");

    const crossOrigin = await request(port, {
      method: "POST",
      pathname: "/api/llm/enrich",
      headers: { host, ...auth, origin: "https://evil.example.com", ...JSON_HEADERS },
      body: UNKNOWN_TASK_BODY,
    });
    assert.equal(crossOrigin.statusCode, 403, "Cloud Run でも Origin が別のホストの POST は 403");

    const sameOrigin = await request(port, {
      method: "POST",
      pathname: "/api/llm/enrich",
      headers: { host, ...auth, origin: `https://${host}`, ...JSON_HEADERS },
      body: UNKNOWN_TASK_BODY,
    });
    assert.equal(sameOrigin.statusCode, 400, "Cloud Run で同じホストの Origin の POST は通る");
  } finally {
    child.kill();
  }
}

async function main() {
  testPureFunctions();
  await testLoopbackServer();
  await testCloudRunServer();
  console.log("local-guard tests passed");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

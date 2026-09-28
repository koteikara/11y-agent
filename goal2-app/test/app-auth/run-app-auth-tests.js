// Cloud Run に共通のパスワードを掛ける守り(PRODUCTION_OPERATIONS_INSTRUCTIONS.md の 3.3 P1)のテスト。
// 前半は lib/app-auth.js の関数を直接確かめる。
// 後半はサーバーを起動し、401・503・健康確認の扱い・Sec-Fetch-Site の確認と、パスワードがログと応答に出ないことを確かめる。
const assert = require("assert");
const http = require("http");
const path = require("path");
const { spawn } = require("child_process");
const {
  MIN_APP_PASSWORD_LENGTH,
  WWW_AUTHENTICATE,
  resolveAppAuth,
  isHealthCheckRequest,
  parseBasicAuthPassword,
  passwordMatches,
  checkAppPassword,
  checkFetchSite,
} = require("../../lib/app-auth");
const { serverEnv } = require("../server-env");

const rootDir = path.resolve(__dirname, "..", "..");

const PASSWORD = "Zq7-app-auth-test-password-4821";
const SHORT_PASSWORD = "Short-pw-4821-x"; // 15文字
const JSON_HEADERS = { "content-type": "application/json" };

function basic(user, password) {
  return `Basic ${Buffer.from(`${user}:${password}`, "utf8").toString("base64")}`;
}

function testPureFunctions() {
  assert.equal(MIN_APP_PASSWORD_LENGTH, 16);
  assert.equal(WWW_AUTHENTICATE, 'Basic realm="a11y-migration-app", charset="UTF-8"');

  // 起動時の環境変数
  assert.deepEqual(resolveAppAuth({}), { mode: "off", password: "" }, "Cloud Run 以外で無ければ求めない");
  assert.deepEqual(resolveAppAuth({ APP_PASSWORD: "  \r\n" }), { mode: "off", password: "" }, "空白だけは無いものとして扱う");
  assert.deepEqual(resolveAppAuth({ APP_PASSWORD: "short" }), { mode: "required", password: "short" }, "Cloud Run 以外は長さを問わない");
  assert.deepEqual(resolveAppAuth({ APP_PASSWORD: ` ${PASSWORD}\r\n` }), { mode: "required", password: PASSWORD }, "前後の空白と改行を除く");
  assert.equal(resolveAppAuth({ K_SERVICE: "svc" }).mode, "misconfigured", "Cloud Run で無ければ 503");
  assert.equal(resolveAppAuth({ K_SERVICE: "svc", APP_PASSWORD: SHORT_PASSWORD }).mode, "misconfigured", "Cloud Run で15文字なら 503");
  assert.equal(resolveAppAuth({ K_SERVICE: "svc", APP_PASSWORD: `  ${SHORT_PASSWORD}\n` }).mode, "misconfigured", "長さは空白を除いて数える");
  assert.equal(resolveAppAuth({ K_SERVICE: "svc", APP_PASSWORD: "x".repeat(16) }).mode, "required", "Cloud Run で16文字なら求める");
  assert.equal(resolveAppAuth({ K_SERVICE: "svc", APP_PASSWORD: SHORT_PASSWORD }).password, "", "503 のときはパスワードを持たない");

  // 健康確認
  assert.ok(isHealthCheckRequest("GET", "/api/health"));
  for (const [method, pathname] of [["POST", "/api/health"], ["HEAD", "/api/health"], ["GET", "/api/healthz"], ["GET", "/api/health/"], ["GET", "/API/health"]]) {
    assert.ok(!isHealthCheckRequest(method, pathname), `${method} ${pathname} は健康確認として扱わない`);
  }

  // Authorization の読み取り
  assert.equal(parseBasicAuthPassword(basic("", PASSWORD)), PASSWORD, "ユーザー名が空");
  assert.equal(parseBasicAuthPassword(basic("worker", PASSWORD)), PASSWORD, "ユーザー名があれば捨てる");
  assert.equal(parseBasicAuthPassword(basic("", "a:b")), "a:b", "最初のコロンで分ける");
  assert.equal(parseBasicAuthPassword(basic("", "パスワード")), "パスワード", "UTF-8 として読む");
  assert.equal(parseBasicAuthPassword(`basic ${Buffer.from(`:${PASSWORD}`).toString("base64")}`), PASSWORD, "Basic の大文字と小文字は問わない");
  const malformed = [
    undefined,
    "",
    "Basic",
    "Basic ",
    `Bearer ${Buffer.from(`:${PASSWORD}`).toString("base64")}`,
    Buffer.from(`:${PASSWORD}`).toString("base64"),
    "Basic !!!!",
    "Basic abc",
    "Basic YWJj=ZA==",
    `Basic ${Buffer.from("no-colon").toString("base64")}`,
  ];
  for (const header of malformed) {
    assert.equal(parseBasicAuthPassword(header), null, `${JSON.stringify(header)} は形が崩れている`);
  }

  // 比べ方
  assert.ok(passwordMatches(PASSWORD, PASSWORD));
  assert.ok(!passwordMatches(PASSWORD, `${PASSWORD}x`));
  assert.ok(!passwordMatches(PASSWORD, ""));

  // パスワードの確認
  const required = resolveAppAuth({ APP_PASSWORD: PASSWORD });
  assert.equal(checkAppPassword(required, { method: "GET", pathname: "/", headers: { authorization: basic("", PASSWORD) } }), null);
  assert.equal(checkAppPassword(required, { method: "GET", pathname: "/api/health", headers: {} }), null);
  const unauthorized = checkAppPassword(required, { method: "GET", pathname: "/", headers: {} });
  assert.equal(unauthorized.statusCode, 401);
  assert.equal(unauthorized.headers["www-authenticate"], WWW_AUTHENTICATE);
  assert.equal(checkAppPassword(required, { method: "POST", pathname: "/api/health", headers: {} }).statusCode, 401);
  assert.equal(checkAppPassword(resolveAppAuth({}), { method: "GET", pathname: "/", headers: {} }), null);
  assert.equal(checkAppPassword(resolveAppAuth({ K_SERVICE: "svc" }), { method: "GET", pathname: "/", headers: {} }).statusCode, 503);
  assert.equal(checkAppPassword(resolveAppAuth({ K_SERVICE: "svc" }), { method: "GET", pathname: "/api/health", headers: {} }), null);

  // Sec-Fetch-Site
  for (const site of ["cross-site", "same-site", "", "Cross-Site"]) {
    const result = checkFetchSite({ method: "GET", pathname: "/api/fetch-html", headers: { "sec-fetch-site": site } });
    assert.equal(result && result.statusCode, 403, `Sec-Fetch-Site: ${JSON.stringify(site)} は 403`);
  }
  for (const headers of [{ "sec-fetch-site": "same-origin" }, { "sec-fetch-site": "none" }, {}]) {
    assert.equal(checkFetchSite({ method: "GET", pathname: "/api/fetch-html", headers }), null, `${JSON.stringify(headers)} は通す`);
  }
  assert.equal(checkFetchSite({ method: "GET", pathname: "/api/health", headers: { "sec-fetch-site": "cross-site" } }), null, "GET /api/health は除く");
  assert.equal(checkFetchSite({ method: "POST", pathname: "/api/health", headers: { "sec-fetch-site": "cross-site" } }).statusCode, 403, "POST /api/health は除かない");
  assert.equal(checkFetchSite({ method: "GET", pathname: "/", headers: { "sec-fetch-site": "cross-site" } }), null, "/api/ 以外は確かめない");
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
        resolve({ statusCode: res.statusCode, headers: res.headers, text, body: json });
      });
    });
    req.on("error", reject);
    if (body !== undefined) req.write(body);
    req.end();
  });
}

// サーバーを起動し、健康確認が通るまで待つ。ログは output に集め、パスワードが出ないことを確かめるのに使う。
async function startServer(port, extraEnv) {
  const env = serverEnv({ PORT: String(port), ...extraEnv });
  for (const [key, value] of Object.entries(extraEnv)) {
    if (value === undefined) delete env[key];
  }
  const child = spawn(process.execPath, ["server.js"], { cwd: rootDir, env, stdio: ["ignore", "pipe", "pipe"] });
  const logs = { stdout: "", stderr: "" };
  child.stdout.on("data", (chunk) => {
    logs.stdout += chunk;
  });
  child.stderr.on("data", (chunk) => {
    logs.stderr += chunk;
  });
  const start = Date.now();
  while (Date.now() - start < 5000) {
    try {
      const res = await request(port, { pathname: "/api/health", headers: { host: `localhost:${port}` } });
      if (res.statusCode === 200) return { child, logs };
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  child.kill();
  throw new Error(`server did not become ready on port ${port}: ${logs.stderr}`);
}

async function stopServer(child) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  await new Promise((resolve) => {
    child.once("exit", resolve);
    child.kill();
  });
}

function assertNoSecret(label, text, secrets) {
  for (const secret of secrets) {
    assert.ok(!String(text).includes(secret), `${label} にパスワードが出ていない`);
  }
}

// 応答の本文とヘッダーに、パスワードも Authorization の値も出ていないことを確かめる。
function assertResponseHasNoSecret(res, secrets) {
  assertNoSecret(`${res.statusCode} の応答の本文`, res.text, secrets);
  assertNoSecret(`${res.statusCode} の応答のヘッダー`, JSON.stringify(res.headers), secrets);
}

async function testPasswordRequired() {
  // Cloud Run で、前後に空白と改行の付いた APP_PASSWORD を渡す。
  const port = 9141;
  const host = "a11y-migration-app-xxxx.a.run.app";
  const { child, logs } = await startServer(port, {
    HOST: undefined,
    K_SERVICE: "a11y-migration-app",
    APP_PASSWORD: `  ${PASSWORD}\r\n`,
  });
  const good = basic("", PASSWORD);
  const secrets = [PASSWORD, good.slice("Basic ".length), basic("worker", "wrong-password-value").slice("Basic ".length)];
  try {
    // パスワードが無い要求と違う要求は 401
    for (const headers of [{}, { authorization: basic("", "wrong-password-value") }, { authorization: basic("worker", "wrong-password-value") }]) {
      for (const pathname of ["/", "/goal1.html", "/api/rules", "/api/llm/status"]) {
        const res = await request(port, { pathname, headers: { host, ...headers } });
        assert.equal(res.statusCode, 401, `${pathname} ${JSON.stringify(headers)} は 401`);
        assert.equal(res.headers["www-authenticate"], WWW_AUTHENTICATE, `${pathname} の 401 に WWW-Authenticate を付ける`);
        assert.equal(res.body.error, "unauthorized");
        assertResponseHasNoSecret(res, secrets);
      }
    }
    {
      const res = await request(port, {
        method: "POST",
        pathname: "/api/llm/enrich",
        headers: { host, ...JSON_HEADERS },
        body: JSON.stringify({ task: "no-such-task", items: [{}] }),
      });
      assert.equal(res.statusCode, 401, "パスワードが無い POST は 401");
    }

    // 合う要求は通る。ユーザー名は空でも何でもよい。
    for (const user of ["", "worker", "誰でも"]) {
      const res = await request(port, { pathname: "/", headers: { host, authorization: basic(user, PASSWORD) } });
      assert.equal(res.statusCode, 200, `ユーザー名 ${JSON.stringify(user)} で通る`);
      assertResponseHasNoSecret(res, secrets);
    }
    {
      const res = await request(port, { pathname: "/api/rules", headers: { host, authorization: good } });
      assert.equal(res.statusCode, 200, "合うパスワードで API も通る");
      const post = await request(port, {
        method: "POST",
        pathname: "/api/llm/enrich",
        headers: { host, authorization: good, ...JSON_HEADERS },
        body: JSON.stringify({ task: "no-such-task", items: [{}] }),
      });
      assert.equal(post.statusCode, 400, "合うパスワードの POST は処理に届く");
      assert.equal(post.body.error, "unknown_task");
    }

    // 前後の空白と改行は APP_PASSWORD から除く。送る側で付けた空白は、パスワードの一部として比べる。
    for (const wrapped of [`  ${PASSWORD}\r\n`, `${PASSWORD} `]) {
      const res = await request(port, { pathname: "/", headers: { host, authorization: basic("", wrapped) } });
      assert.equal(res.statusCode, 401, `空白の付いた ${JSON.stringify(wrapped.replace(PASSWORD, "<pw>"))} は合わない`);
    }

    // 健康確認
    {
      const res = await request(port, { pathname: "/api/health", headers: { host } });
      assert.equal(res.statusCode, 200, "GET /api/health はパスワード無しで通る");
      const query = await request(port, { pathname: "/api/health?probe=1", headers: { host } });
      assert.equal(query.statusCode, 200, "GET /api/health はクエリーが付いても通る");
    }
    for (const [method, pathname] of [["POST", "/api/health"], ["GET", "/api/healthz"], ["GET", "/api/health/"], ["HEAD", "/api/health"]]) {
      const res = await request(port, {
        method,
        pathname,
        headers: { host, ...(method === "POST" ? JSON_HEADERS : {}) },
        body: method === "POST" ? "{}" : undefined,
      });
      assert.equal(res.statusCode, 401, `${method} ${pathname} はパスワードを求める`);
    }

    // 形の崩れた Authorization は、例外を出さずに 401
    const malformed = [
      "Basic",
      "Basic ",
      "Basic !!!!",
      "Basic abc",
      `Basic ${Buffer.from("no-colon").toString("base64")}`,
      `Bearer ${Buffer.from(`:${PASSWORD}`).toString("base64")}`,
      Buffer.from(`:${PASSWORD}`).toString("base64"),
      PASSWORD,
    ];
    for (const authorization of malformed) {
      const res = await request(port, { pathname: "/api/rules", headers: { host, authorization } });
      assert.equal(res.statusCode, 401, `Authorization ${JSON.stringify(authorization.slice(0, 12))}... は 401`);
      assert.equal(res.headers["www-authenticate"], WWW_AUTHENTICATE);
      assertResponseHasNoSecret(res, secrets);
    }
    assert.ok(child.exitCode === null && child.signalCode === null, "形の崩れた Authorization でサーバーが止まらない");

    // Sec-Fetch-Site: パスワードが合っていても、cross-site と same-site の API の要求は 403
    const fetchTargets = ["/api/fetch-html?url=http%3A%2F%2F127.0.0.1%2F", "/api/link-title?href=http%3A%2F%2F127.0.0.1%2F"];
    for (const pathname of fetchTargets) {
      for (const site of ["cross-site", "same-site"]) {
        const res = await request(port, { pathname, headers: { host, authorization: good, "sec-fetch-site": site } });
        assert.equal(res.statusCode, 403, `${pathname} の Sec-Fetch-Site: ${site} は 403`);
        assert.equal(res.body.error, "cross_site_request");
      }
      for (const site of ["same-origin", "none", undefined]) {
        const headers = { host, authorization: good };
        if (site) headers["sec-fetch-site"] = site;
        const res = await request(port, { pathname, headers });
        assert.notEqual(res.statusCode, 401, `${pathname} の Sec-Fetch-Site: ${site} は守りを通る`);
        assert.notEqual(res.body && res.body.error, "cross_site_request", `${pathname} の Sec-Fetch-Site: ${site} は守りを通る`);
        assert.match(res.body.error, /^(html_fetch|link_title)_not_available$/, `${pathname} は処理に届く(内部のアドレスなので取りには行かない)`);
      }
    }
    {
      const res = await request(port, { pathname: "/api/fetch-html?url=x", headers: { host, "sec-fetch-site": "cross-site" } });
      assert.equal(res.statusCode, 403, "パスワードが無い cross-site の API の要求も 403");
      assert.equal(res.headers["www-authenticate"], undefined, "cross-site の要求にはパスワードの入力を求めない");
    }
    {
      const res = await request(port, { pathname: "/api/health", headers: { host, "sec-fetch-site": "cross-site" } });
      assert.equal(res.statusCode, 200, "GET /api/health は cross-site でも通る");
    }

    // ログにパスワードが出ていない
    await stopServer(child);
    assertNoSecret("標準出力", logs.stdout, secrets);
    assertNoSecret("標準エラー出力", logs.stderr, secrets);
  } finally {
    await stopServer(child);
  }
}

async function testCloudRunMisconfigured() {
  // Cloud Run で APP_PASSWORD が無いときと、16文字より短いときは、GET /api/health 以外に 503
  const cases = [
    { port: 9142, label: "APP_PASSWORD が無い", password: undefined },
    { port: 9143, label: "APP_PASSWORD が15文字", password: SHORT_PASSWORD },
  ];
  const host = "a11y-migration-app-xxxx.a.run.app";
  for (const { port, label, password } of cases) {
    const { child, logs } = await startServer(port, { HOST: undefined, K_SERVICE: "a11y-migration-app", APP_PASSWORD: password });
    const secrets = password ? [password, basic("", password).slice("Basic ".length)] : [];
    try {
      const health = await request(port, { pathname: "/api/health", headers: { host } });
      assert.equal(health.statusCode, 200, `${label}: GET /api/health は通る`);
      for (const headers of [{}, password ? { authorization: basic("", password) } : { authorization: basic("", "anything") }]) {
        for (const pathname of ["/", "/api/rules"]) {
          const res = await request(port, { pathname, headers: { host, ...headers } });
          assert.equal(res.statusCode, 503, `${label}: ${pathname} は 503`);
          assert.equal(res.body.error, "app_password_not_configured");
          assert.equal(res.headers["www-authenticate"], undefined, `${label}: 503 ではパスワードを求めない`);
          assertResponseHasNoSecret(res, secrets);
        }
      }
      const post = await request(port, { method: "POST", pathname: "/api/health", headers: { host, ...JSON_HEADERS }, body: "{}" });
      assert.equal(post.statusCode, 503, `${label}: POST /api/health は 503`);

      await stopServer(child);
      const errorLines = logs.stderr.split(/\r?\n/).filter((line) => line.includes("APP_PASSWORD"));
      assert.equal(errorLines.length, 1, `${label}: 起動時にエラーを1行出す`);
      assert.match(errorLines[0], /^ERROR: /);
      assertNoSecret(`${label}: 標準出力`, logs.stdout, secrets);
      assertNoSecret(`${label}: 標準エラー出力`, logs.stderr, secrets);
    } finally {
      await stopServer(child);
    }
  }
}

async function testLocalWithoutPassword() {
  // Cloud Run 以外で APP_PASSWORD が無いときは、パスワードを求めない。Sec-Fetch-Site の確認は行う。
  const port = 9144;
  const self = `localhost:${port}`;
  const { child, logs } = await startServer(port, { HOST: "127.0.0.1", K_SERVICE: undefined, APP_PASSWORD: undefined });
  try {
    for (const pathname of ["/", "/api/rules"]) {
      const res = await request(port, { pathname, headers: { host: self } });
      assert.equal(res.statusCode, 200, `Cloud Run 以外では ${pathname} にパスワードを求めない`);
      assert.equal(res.headers["www-authenticate"], undefined);
    }
    for (const pathname of ["/api/fetch-html?url=x", "/api/link-title?href=x", "/api/rules"]) {
      const res = await request(port, { pathname, headers: { host: self, "sec-fetch-site": "cross-site" } });
      assert.equal(res.statusCode, 403, `Cloud Run 以外でも cross-site の ${pathname} は 403`);
      assert.equal(res.body.error, "cross_site_request");
    }
    {
      const res = await request(port, {
        method: "POST",
        pathname: "/api/llm/enrich",
        headers: { host: self, "sec-fetch-site": "cross-site", ...JSON_HEADERS },
        body: JSON.stringify({ task: "no-such-task", items: [{}] }),
      });
      assert.equal(res.statusCode, 403, "Cloud Run 以外でも cross-site の API の POST は 403");
    }
    {
      const res = await request(port, { pathname: "/api/rules", headers: { host: self, "sec-fetch-site": "same-origin" } });
      assert.equal(res.statusCode, 200, "same-origin の API の要求は通る");
      const page = await request(port, { pathname: "/", headers: { host: self, "sec-fetch-site": "cross-site" } });
      assert.equal(page.statusCode, 200, "/api/ 以外は Sec-Fetch-Site を確かめない");
      const health = await request(port, { pathname: "/api/health", headers: { host: self, "sec-fetch-site": "cross-site" } });
      assert.equal(health.statusCode, 200, "GET /api/health は cross-site でも通る");
    }
    await stopServer(child);
    assert.ok(!logs.stderr.includes("APP_PASSWORD"), "Cloud Run 以外では APP_PASSWORD が無くてもエラーを出さない");
  } finally {
    await stopServer(child);
  }
}

async function main() {
  testPureFunctions();
  await testPasswordRequired();
  await testCloudRunMisconfigured();
  await testLocalWithoutPassword();
  console.log("app-auth tests passed");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

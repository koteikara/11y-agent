// 一括処理のエンジンの宿主(batch/lib/engine-host.js)が、今の画面のサーバー(server.js)と
// 同じ結果を出すことを確かめる。佐賀市の評価用データの旧ページの本文(51件)と、手で書いた断片を、
// 両方の経路で analyze → autoAcceptSafe → buildFinalHtml に通し、候補と最終の HTML を比べる。
//
// AI とリンク先の題名の取得は、両方の経路で止める。外のサービスとサイトの応答に結果を左右させないため。
// サーバーの経路は LLM の環境変数を外して起動し(test/server-env.js)、リンク先の題名は route で 502 を返す。
const assert = require("assert");
const fs = require("fs");
const http = require("http");
const path = require("path");
const { spawn } = require("child_process");
const { chromium } = require("playwright");
const { serverEnv } = require("../server-env");
const { startEngine } = require("../../batch/lib/engine-host");

const rootDir = path.resolve(__dirname, "..", "..");
const PORT = Number(process.env.ENGINE_HOST_TEST_PORT || 8127);
const DATASET = path.join(rootDir, "agents-cli", "datasets", "saga-a11y-eval.jsonl");

const HAND_WRITTEN = [
  "<h3>見出し</h3><p>ＡＢＣ１２３　電話：0952-00-0000</p><p><a href='a.pdf'>こちら（PDF：12KB）</a></p><img src='x.png'>",
  "<table><tr><td>名前</td><td>電話</td></tr><tr><td>市役所</td><td>0952-00-0000</td></tr></table>",
  "<p>・りんご<br>・みかん<br>・ぶどう</p><h2>次の章</h2><h4>飛んだ見出し</h4><p>本文</p>",
];

function loadInputs() {
  const inputs = HAND_WRITTEN.map((html, index) => ({ id: `hand-${index + 1}`, html }));
  for (const line of fs.readFileSync(DATASET, "utf8").split(/\r?\n/)) {
    if (!line.trim()) continue;
    const record = JSON.parse(line);
    inputs.push({ id: record.id, html: record.input.old_html });
  }
  return inputs;
}

function waitForHealth() {
  const deadline = Date.now() + 15000;
  return new Promise((resolve, reject) => {
    const attempt = () => {
      http
        .get(`http://127.0.0.1:${PORT}/api/health`, (res) => {
          res.resume();
          if (res.statusCode === 200) resolve();
          else retry();
        })
        .on("error", retry);
    };
    const retry = () => (Date.now() > deadline ? reject(new Error("server did not start")) : setTimeout(attempt, 200));
    attempt();
  });
}

// ページの中で動かす。両方の経路で同じ関数を使う。
async function runOne(html) {
  const res = await window.goal2Engine.analyze({ html });
  const autoAccepted = window.goal2Engine.autoAcceptSafe(res.candidates);
  const finalHtml = window.goal2Engine.buildFinalHtml(html, res.candidates);
  return {
    candidates: res.candidates.map((c) => `${c.rule_id}|${c.decision?.status || ""}|${c.proposal?.after_html || ""}`),
    notices: res.notices.map((n) => n.rule_id),
    autoAccepted,
    finalHtml,
  };
}

async function main() {
  const inputs = loadInputs();
  const server = spawn(process.execPath, [path.join(rootDir, "server.js")], {
    cwd: rootDir,
    env: serverEnv({ PORT: String(PORT) }),
    stdio: "ignore",
  });
  let browser;
  let engine;
  try {
    await waitForHealth();
    browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined });
    const serverPage = await browser.newPage();
    await serverPage.route("**/api/link-title*", (route) =>
      route.fulfill({ status: 502, contentType: "application/json", body: JSON.stringify({ ok: false }) })
    );
    await serverPage.goto(`http://127.0.0.1:${PORT}/goal1.html`, { waitUntil: "load" });
    await serverPage.waitForFunction(() => Boolean(window.goal2Engine), null, { timeout: 15000 });

    engine = await startEngine({ ai: false, linkTitle: false });

    let compared = 0;
    for (const input of inputs) {
      const viaServer = await serverPage.evaluate(runOne, input.html);
      const viaHost = await engine.evaluate(runOne, input.html);
      assert.deepStrictEqual(viaHost.candidates, viaServer.candidates, `${input.id}: 候補が食い違う`);
      assert.deepStrictEqual(viaHost.notices, viaServer.notices, `${input.id}: 知らせが食い違う`);
      assert.strictEqual(viaHost.autoAccepted, viaServer.autoAccepted, `${input.id}: 自動の採用の数が食い違う`);
      assert.strictEqual(viaHost.finalHtml, viaServer.finalHtml, `${input.id}: 最終の HTML が食い違う`);
      compared += 1;
    }
    assert.strictEqual(engine.usage.aiCalls, 0, "AI を止めた宿主から AI を呼んではいけない");
    console.log(`  ok   宿主とサーバーの結果が一致した(${compared}件)`);

    // 宿主は、エンジンのページの外への要求を止める。
    const blocked = await engine.evaluate(async () => {
      try {
        await fetch("https://example.com/");
        return false;
      } catch {
        return true;
      }
    });
    assert.ok(blocked, "宿主のページから外のサイトへ要求できてはいけない");
    console.log("  ok   宿主のページから外のサイトへの要求は止まる");

    const unknownApi = await engine.evaluate(async () => (await fetch("/api/fetch-html?url=https://example.com/")).status);
    assert.strictEqual(unknownApi, 404, "エンジンが使わない API は宿主で答えない");
    console.log("  ok   エンジンが使わない API には 404 を返す");

    console.log("\n=== engine host tests passed ===");
  } finally {
    if (engine) await engine.close();
    if (browser) await browser.close();
    server.kill();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

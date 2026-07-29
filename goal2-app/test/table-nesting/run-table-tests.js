// 入れ子テーブルと、はみ出したcolspanの回帰テスト。
//
// test/michecker-parity/run-parity-tests.js と同じ理由で `npm test`
// (test/run-tests.js) には組み込んでいない。public/app.js は実ブラウザのDOM
// (DOMParser・querySelectorAll)を前提にしており、Nodeには組み込みのDOMが無い。
// jsdomという新しい依存を足さない方針(AGENTS.md)に従い、この環境に用意されている
// Playwrightで実際のアプリを動かして検証する。
// 実行: node test/table-nesting/run-table-tests.js
//
// 対象の不具合(実データ: 安城市 碧海山古墳のページ):
//  1. table.querySelectorAll("tr") が子孫の表の行まで返すため、レイアウト表を解体すると
//     入れ子の表の行を親の行として二重に出力していた。最終HTMLに同じ内容が「表のまま」と
//     「解体後」の2通りで残り、解体後の断片は無関係な位置(本文末尾)に置かれた。
//  2. 2列の表の一部の行だけが colspan="2" になっている場合、展開で3列目ができ、セルの内容が
//     複製され(「円墳」が2回)、他の行には空セルが生まれていた。
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const http = require("http");
const { chromium } = require("playwright");

const rootDir = path.resolve(__dirname, "../..");
const PORT = Number(process.env.TABLE_TEST_PORT || 8123);

const NESTED_TABLE_HTML = `
<table border="0">
  <tbody>
    <tr>
      <td>
        <table align="left" border="1">
          <tbody>
            <tr><td><p align="center"><strong>市指定史跡</strong></p></td></tr>
            <tr>
              <td>
                <table align="center" border="0">
                  <tbody>
                    <tr><td><p>遺跡番号</p></td><td><p>541031</p></td></tr>
                    <tr><td><p>墳丘</p></td><td colspan="2">円墳</td></tr>
                  </tbody>
                </table>
              </td>
            </tr>
          </tbody>
        </table>
        <h2>概要</h2>
        <p>前期に属する大型の墳墓です。</p>
      </td>
      <td>
        <h2>所在地</h2>
        <p>安城市古井町塚干地</p>
      </td>
    </tr>
  </tbody>
</table>
`;

// 3列の表で、2行目の1セルが本当に2列にまたがっている例。はみ出しではないため、
// 展開後も3列のまま残らなければならない(切り詰めすぎの検出)。
const GENUINE_COLSPAN_HTML = `
<table border="1">
  <tbody>
    <tr><td>区分</td><td>午前</td><td>午後</td></tr>
    <tr><td>休館日</td><td colspan="2">終日休館</td></tr>
  </tbody>
</table>
`;

const results = [];
function check(name, condition, detail) {
  results.push({ name, pass: Boolean(condition), detail });
}

function waitForHealth() {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const attempt = () => {
      http
        .get(`http://127.0.0.1:${PORT}/api/health`, (res) => {
          res.resume();
          if (res.statusCode === 200) resolve();
          else retry();
        })
        .on("error", retry);
    };
    const retry = () => {
      if (Date.now() - start > 10000) reject(new Error("server did not start"));
      else setTimeout(attempt, 150);
    };
    attempt();
  });
}

function countOccurrences(haystack, needle) {
  return String(haystack || "").split(needle).length - 1;
}

async function main() {
  const server = spawn(process.execPath, [path.join(rootDir, "server.js")], {
    cwd: rootDir,
    env: { ...process.env, PORT: String(PORT) },
    stdio: "ignore",
  });

  let browser;
  try {
    await waitForHealth();
    browser = await chromium.launch();
    const page = await browser.newPage();
    await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: "load" });
    await page.waitForFunction(() => Boolean(window.goal2Engine), null, { timeout: 15000 });

    const nested = await page.evaluate(async (html) => {
      const res = await window.goal2Engine.analyze({ html });
      const byRule = (ruleId) => res.candidates.filter((c) => c.rule_id === ruleId);
      const outermost = byRule("table.layout-table").find((c) => c.target.node_id === "n0001");
      const flattened = byRule("table.simple-structure").map((c) => c.proposal.after_html);
      return {
        outerAfterHtml: outermost ? outermost.proposal.after_html : null,
        flattened,
        finalHtml: window.goal2Engine.buildFinalHtml(
          html,
          res.candidates.map((c) => {
            if (c.rule_id === "table.layout-table" && c.target.node_id === "n0001") {
              c.decision = { status: "accepted", reason: "test", actor: "test", decided_at: "", after_html: null };
            }
            return c;
          })
        ),
      };
    }, NESTED_TABLE_HTML);

    // 1. 外側のレイアウト表の解体結果に、入れ子の表の内容が二重に現れない
    check(
      "レイアウト表の解体で入れ子の表の内容が重複しない",
      countOccurrences(nested.outerAfterHtml, "遺跡番号") === 1,
      `「遺跡番号」の出現回数=${countOccurrences(nested.outerAfterHtml, "遺跡番号")} (期待: 1)`
    );
    check(
      "レイアウト表の解体で入れ子の表が見出しへ展開されない",
      !/<h[1-6][^>]*>\s*市指定史跡\s*<\/h[1-6]>/.test(nested.outerAfterHtml || ""),
      "内側の表の行が親の行として見出し化されている"
    );

    // 2. 解体を採用した最終HTMLの末尾に、解体済み断片が追記されない
    check(
      "最終HTMLに解体済み断片が追記されない",
      countOccurrences(nested.finalHtml, "遺跡番号") === 1,
      `最終HTMLでの「遺跡番号」の出現回数=${countOccurrences(nested.finalHtml, "遺跡番号")} (期待: 1)`
    );

    // 3. はみ出したcolspanを展開しても内容が複製されない
    // 最も内側の表(遺跡番号/墳丘)のフラット化結果。表を1つしか含まないもので判別する。
    const innerFlattened = nested.flattened.find(
      (html) => String(html).includes("遺跡番号") && countOccurrences(html, "<table") === 1
    );
    check(
      "はみ出したcolspanの展開で内容が複製されない",
      countOccurrences(innerFlattened, "円墳") === 1,
      `「円墳」の出現回数=${countOccurrences(innerFlattened, "円墳")} (期待: 1)`
    );
    check(
      "はみ出したcolspanの展開で空セルが生まれない",
      !/<td>\s*<\/td>/.test(String(innerFlattened || "")),
      `空のtdが残っている: ${String(innerFlattened || "").slice(0, 160)}`
    );

    // 4. 本物のcolspanは切り詰めない
    const genuine = await page.evaluate(async (html) => {
      const res = await window.goal2Engine.analyze({ html });
      const flat = res.candidates.find((c) => c.rule_id === "table.simple-structure");
      return flat ? flat.proposal.after_html : null;
    }, GENUINE_COLSPAN_HTML);

    const genuineColumns = String(genuine || "").match(/<tr>[\s\S]*?<\/tr>/g) || [];
    const firstRowCells = (genuineColumns[0] || "").match(/<t[dh][\s>]/g) || [];
    check(
      "本物のcolspanを持つ表は列数を保つ",
      firstRowCells.length === 3,
      `1行目のセル数=${firstRowCells.length} (期待: 3) / ${String(genuine || "").slice(0, 160)}`
    );
    check(
      "本物のcolspanは分割して各列に値を入れる",
      countOccurrences(genuine, "終日休館") === 2,
      `「終日休館」の出現回数=${countOccurrences(genuine, "終日休館")} (期待: 2)`
    );
  } finally {
    if (browser) await browser.close();
    server.kill();
  }

  let failed = 0;
  results.forEach((r) => {
    if (r.pass) {
      console.log(`  ok   ${r.name}`);
    } else {
      failed += 1;
      console.log(`  FAIL ${r.name}\n       ${r.detail || ""}`);
    }
  });
  console.log(`\n=== ${results.length - failed} passed, ${failed} failed ===`);
  process.exit(failed ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

// 証跡のファイル名(PRODUCTION_OPERATIONS_INSTRUCTIONS.md の 3.5 P2)のテスト。
// public/evidence-filename.js の関数を Node から直接確かめる。
// 実行: node test/evidence-filename/run-evidence-filename-tests.js(npm test から続けて走る)
const assert = require("assert");
const {
  formatJstStamp,
  sanitizeTitle,
  goal2Filename,
  goal1Filename,
} = require("../../public/evidence-filename");

function testJstStamp() {
  assert.equal(formatJstStamp("2026-09-25T05:30:00.000Z"), "20260925-1430", "UTC に9時間を足す");
  assert.equal(formatJstStamp("2026-09-25T15:30:00.000Z"), "20260926-0030", "UTC 15:30 は翌日 00:30");
  assert.equal(formatJstStamp("2026-12-31T15:00:00.000Z"), "20270101-0000", "年をまたぐ");
  assert.equal(formatJstStamp("2026-02-28T15:05:00Z"), "20260301-0005", "月をまたぐ");
  assert.equal(formatJstStamp(new Date(Date.UTC(2026, 8, 25, 0, 1))), "20260925-0901", "Date も受け付ける");
  const now = new Date("2026-09-28T01:02:00.000Z");
  assert.equal(formatJstStamp(null, now), "20260928-1002", "値が無ければ now を使う");
  assert.equal(formatJstStamp("", now), "20260928-1002", "空の文字列も now を使う");
  assert.equal(formatJstStamp("not a date", now), "20260928-1002", "読めない値も now を使う");
  assert.match(formatJstStamp(null), /^\d{8}-\d{4}$/, "now も無ければ現在の時刻");

  // 実行する PC の時刻帯に左右されない。TZ を変えた子プロセスで同じ結果になることを確かめる。
  const { execFileSync } = require("child_process");
  const script = `console.log(require(${JSON.stringify(require.resolve("../../public/evidence-filename"))}).formatJstStamp("2026-09-25T15:30:00Z"))`;
  for (const tz of ["UTC", "America/Los_Angeles", "Asia/Tokyo", "Pacific/Kiritimati"]) {
    const out = execFileSync(process.execPath, ["-e", script], { env: { ...process.env, TZ: tz } }).toString().trim();
    assert.equal(out, "20260926-0030", `TZ=${tz} でも同じ`);
  }
}

function testSanitizeTitle() {
  assert.equal(sanitizeTitle("固定資産評価審査委員会"), "固定資産評価審査委員会");
  assert.equal(sanitizeTitle('a\\b/c:d*e?f"g<h>i|j'), "a_b_c_d_e_f_g_h_i_j", "使えない文字を _ に替える");
  assert.equal(sanitizeTitle("上\n下\r\n左\t右"), "上_下__左_右", "改行とタブを _ に替える");
  assert.equal(sanitizeTitle("  前後の空白　"), "前後の空白", "前後の空白(全角を含む)を除く");
  assert.equal(sanitizeTitle("お知らせ..."), "お知らせ", "末尾の . を除く");
  assert.equal(sanitizeTitle("お知らせ. . "), "お知らせ", "末尾の . と空白が混ざっても除く");
  assert.equal(sanitizeTitle("v1.2 の案内"), "v1.2 の案内", "途中の . は残す");
  assert.equal(sanitizeTitle(""), "無題", "空なら無題");
  assert.equal(sanitizeTitle(null), "無題", "null も無題");
  assert.equal(sanitizeTitle(undefined), "無題", "undefined も無題");
  assert.equal(sanitizeTitle("  ...  "), "無題", "空白と . だけなら無題");

  // 30文字での切り詰め
  const long = "あ".repeat(40);
  assert.equal(sanitizeTitle(long), "あ".repeat(30), "先頭30文字");
  const emoji = "🎉".repeat(35);
  assert.equal(sanitizeTitle(emoji), "🎉".repeat(30), "サロゲートペアは1文字として数える");
  const mixed = "a".repeat(29) + "😀" + "b";
  assert.equal(sanitizeTitle(mixed), "a".repeat(29) + "😀", "30文字目のサロゲートペアを分けない");
  assert.ok(!/[\ud800-\udbff]$/.test(sanitizeTitle(mixed)), "末尾に上位サロゲートだけが残らない");
  assert.equal(sanitizeTitle("𠮷野家の".repeat(10)), "𠮷野家の".repeat(7) + "𠮷野", "サロゲートペアの漢字も1文字");
  assert.equal(sanitizeTitle("あ".repeat(29) + " いう"), "あ".repeat(29), "切り詰めた末尾の空白を除く");
  assert.equal(sanitizeTitle("あ".repeat(29) + ".いう"), "あ".repeat(29), "切り詰めた末尾の . を除く");
}

function testGoal2Filename() {
  assert.equal(
    goal2Filename({
      generatedAt: "2026-09-25T05:30:00.000Z",
      pageTitle: "固定資産評価審査委員会",
      pageSessionId: "goal2_3f9a1c07b2",
      extension: "json",
    }),
    "20260925-1430_固定資産評価審査委員会_goal2_3f9a1c07b2_evidence.json",
    "設計書 3.5 の例"
  );
  assert.equal(
    goal2Filename({
      generatedAt: "2026-09-25T15:30:00.000Z",
      pageTitle: "申請書/届出書",
      pageSessionId: "goal2_0123456789",
      extension: "csv",
    }),
    "20260926-0030_申請書_届出書_goal2_0123456789_evidence.csv"
  );
  assert.equal(
    goal2Filename({
      generatedAt: null,
      pageTitle: "",
      pageSessionId: "goal2_0123456789",
      extension: "json",
      now: new Date("2026-09-28T01:02:00Z"),
    }),
    "20260928-1002_無題_goal2_0123456789_evidence.json",
    "generated_at が無ければ保存する時刻、題名が空なら無題"
  );
  assert.equal(
    goal2Filename({
      generatedAt: "2026-09-25T05:30:00Z",
      pageTitle: "題名",
      pageSessionId: "goal2_0123456789",
      kind: "final",
      extension: "html",
    }),
    "20260925-1430_題名_goal2_0123456789_final.html",
    "種類を変えられる"
  );
}

function testGoal1Filename() {
  const now = new Date("2026-09-25T15:30:00Z");
  assert.equal(goal1Filename({ batchId: "batch_1758778200000", extension: "json", now }), "20260926-0030_batch_1758778200000.json");
  assert.equal(
    goal1Filename({ batchId: "batch_1758778200000", suffix: "-summary", extension: "csv", now }),
    "20260926-0030_batch_1758778200000-summary.csv"
  );
  assert.equal(
    goal1Filename({ batchId: "batch_1758778200000", suffix: "-evidence", extension: "csv", now }),
    "20260926-0030_batch_1758778200000-evidence.csv"
  );
  assert.match(goal1Filename({ batchId: "batch_1", extension: "json" }), /^\d{8}-\d{4}_batch_1\.json$/, "now が無ければ現在の時刻");
}

const tests = [testJstStamp, testSanitizeTitle, testGoal2Filename, testGoal1Filename];
let failed = 0;
for (const test of tests) {
  try {
    test();
    console.log(`  ok   ${test.name}`);
  } catch (error) {
    failed += 1;
    console.log(`  FAIL ${test.name}\n       ${error.message}`);
  }
}
console.log(`\n=== ${tests.length - failed} passed, ${failed} failed ===`);
process.exit(failed ? 1 : 0);

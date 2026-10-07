// 一括処理のコマンド(batch/cli.js)を、手元の旧サイトの代わり(fake-old-site.js)に対して通す。
// 取得、型のまとめ、承認、本処理、もう一度の本処理(飛ばす)と、取得の守り、画面と記録に本文を出さないことを確かめる。
const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFile } = require("child_process");
const { startFakeOldSite } = require("./fake-old-site");
const { isStructuralCandidate } = require("../../batch/commands/process");
const { jaccard } = require("../../batch/lib/structure");

const appRoot = path.resolve(__dirname, "..", "..");
const CLI = path.join(appRoot, "batch", "cli.js");

// 旧サイトの代わりは同じプロセスで動くので、コマンドは非同期で動かす(同期で待つと応答できない)。
function cli(...args) {
  return new Promise((resolve, reject) => {
    execFile(process.execPath, [CLI, ...args], { encoding: "utf8", cwd: appRoot }, (error, stdout, stderr) => {
      if (error) reject(new Error(`${args[0]} が失敗した: ${stderr || error.message}`));
      else resolve(stdout);
    });
  });
}

function makeProject(origin, { privateHosts }) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "batch-cli-test-"));
  fs.mkdirSync(path.join(dir, "input"));
  fs.mkdirSync(path.join(dir, "project"));
  const pages = [];
  for (let n = 1; n <= 12; n += 1) pages.push({ id: `A${String(n).padStart(3, "0")}`, oldUrl: `${origin}/a/${n}.html`, templateNo: "1", round: 1 });
  for (let n = 1; n <= 3; n += 1) pages.push({ id: `B${n}`, oldUrl: `${origin}/b/${n}.html`, templateNo: "2", round: 1 });
  pages.push(
    { id: "GONE", oldUrl: `${origin}/gone.html` },
    { id: "PDF", oldUrl: `${origin}/file.pdf` },
    { id: "MOVED", oldUrl: `${origin}/moved.html` },
    { id: "OTHER", oldUrl: "https://example.com/x.html" }
  );
  fs.writeFileSync(path.join(dir, "input", "pages.json"), JSON.stringify({ sheet: { name: "テスト", version: "1" }, pages }));
  const host = new URL(origin).host;
  fs.writeFileSync(
    path.join(dir, "project", "settings.json"),
    JSON.stringify({ fetch: { allowedHosts: [host], privateHosts: privateHosts ? [host] : [], intervalMs: 20 } })
  );
  return dir;
}

const readJson = (file) => JSON.parse(fs.readFileSync(file, "utf8"));

async function main() {
  const { server, origin } = await startFakeOldSite();
  const dirs = [];
  try {
    // 1. 社内のネットワークのアドレス(127.0.0.1)は、privateHosts に挙げないと取りに行かない。
    const guarded = makeProject(origin, { privateHosts: false });
    dirs.push(guarded);
    const guardedOut = await cli("fetch", guarded);
    assert.match(guardedOut, /取得できた 0 件/);
    assert.strictEqual(readJson(path.join(guarded, "pages", "A001", "fetch.json")).reason, "blocked");
    assert.strictEqual(readJson(path.join(guarded, "pages", "OTHER", "fetch.json")).reason, "not-allowed-host");
    console.log("  ok   取得の守り: 挙げていないサーバーと、内部のネットワークのアドレスは取りに行かない");

    // 2. 取得。
    const dir = makeProject(origin, { privateHosts: true });
    dirs.push(dir);
    const fetchOut = await cli("fetch", dir);
    assert.match(fetchOut, /取得できた 16 件、取得できなかった 3 件/);
    const page = (id) => readJson(path.join(dir, "pages", id, "fetch.json"));
    assert.strictEqual(page("GONE").reason, "http-status");
    assert.strictEqual(page("GONE").status, 404);
    assert.strictEqual(page("PDF").reason, "not-html");
    assert.strictEqual(page("MOVED").finalUrl, `${origin}/a/1.html`);
    assert.strictEqual(page("B1").charset, "shift_jis");
    assert.strictEqual(page("B1").pageTitle, "子育て記事1");
    assert.ok(jaccard(page("A002").structurePaths, page("A003").structurePaths) >= 0.8, "同じテンプレートのページは構造が似ている");
    assert.ok(jaccard(page("A002").structurePaths, page("B1").structurePaths) < 0.8, "違うテンプレートのページは構造が似ていない");
    assert.ok(fs.existsSync(path.join(dir, "pages", "A002", "source.html")));
    console.log("  ok   取得: 台帳、転送、Shift_JIS、構造の重なり");

    // もう一度動かすと、取得できていないページだけを取り直す。
    const refetchOut = await cli("fetch", dir);
    assert.match(refetchOut, /取得: 3 件/);
    console.log("  ok   取得: もう一度動かすと、取得できていないページだけを取り直す");

    // 3. 型のまとめ。テンプレート A の 12 ページと、転送で同じページに着く MOVED が1つの型になる。
    // テンプレート B は 3 ページなので、承認に回さない(小さな型として残す)。
    const groupOut = await cli("group", dir);
    const templates = readJson(path.join(dir, "project", "templates.json"));
    assert.strictEqual(templates.templates.length, 1);
    const [templateA] = templates.templates;
    assert.strictEqual(templateA.pageCount, 13);
    assert.ok(templateA.pageIds.every((id) => id.startsWith("A") || id === "MOVED"));
    assert.ok(templates.smallTemplates.some((t) => t.pageIds.join(",") === "B1,B2,B3"), "テンプレート B は小さな型として残る");
    // 範囲の案は、型の多くのページに共通する文字(ヘッダー、メニュー、フッター、脇の欄)を含まない要素になる。
    assert.ok(/^#contents\b/.test(templateA.proposedSelector), `範囲の案が本文の要素でない: ${templateA.proposedSelector}`);
    assert.strictEqual(templateA.notFound, 0);
    console.log("  ok   型のまとめ: 型と範囲の案、食い違いの数");

    // 4. 承認。案件の設定と変更の履歴に残る。
    const approveOut = await cli("approve", dir, templateA.templateId, "--by", "テスト");
    const settings = readJson(path.join(dir, "project", "settings.json"));
    assert.strictEqual(settings.templates.approved[templateA.templateId].selector, templateA.proposedSelector);
    assert.ok(Array.isArray(settings.templates.approved[templateA.templateId].paths), "承認した型に代表の構造が入る");
    assert.match(fs.readFileSync(path.join(dir, "project", "settings-history.jsonl"), "utf8"), /batch approve/);
    console.log("  ok   承認: 案件の設定と変更の履歴");

    // 5. 本処理。
    const processOut = await cli("process", dir);
    assert.match(processOut, /本処理: 16 件を処理した/);
    const candidates = (id) => readJson(path.join(dir, "pages", id, "candidates.json"));
    assert.strictEqual(candidates("A002").extraction.method, "template");
    assert.strictEqual(candidates("B1").extraction.method, "generic");
    assert.strictEqual(candidates("B1").depth, "thorough", "承認した型に当たらないページは、しっかり確認に回す");
    assert.ok(["thorough", "quick", "none"].includes(candidates("A002").depth));
    assert.strictEqual(candidates("A002").counts.autoAccepted, 0, "自動で採用にしたルールが無ければ、何も採用しない");
    assert.ok(candidates("A002").residual && typeof candidates("A002").residual.count === "number");
    console.log("  ok   本処理: 型の範囲での抽出、確認の深さ、残る指摘");

    const rerunOut = await cli("process", dir);
    assert.match(rerunOut, /0 件を処理した\(済みで飛ばした 16 件/);
    console.log("  ok   本処理: もう一度動かすと、済んだページを飛ばす");

    // 6. 自動で採用にしたルールの候補だけを採用する。
    const settingsPath = path.join(dir, "project", "settings.json");
    const withAuto = readJson(settingsPath);
    // 構造を変える候補を出すルール(リスト、見出し)を入れても、それらは採用しない。
    withAuto.rules.autoAccept = ["text.alphanumeric", "text.spaced-characters", "text.list", "html-structure.heading-order"];
    fs.writeFileSync(settingsPath, JSON.stringify(withAuto));
    await cli("process", dir, "--force");
    const accepted = Object.keys(readJson(path.join(dir, "project", "summary.json")).pages)
      .map((id) => fs.existsSync(path.join(dir, "pages", id, "candidates.json")) && candidates(id))
      .filter(Boolean)
      .flatMap((c) => c.candidates.filter((candidate) => candidate.decision?.status === "accepted"));
    assert.ok(accepted.length > 0, "自動で採用にしたルールの候補が採用されていない");
    assert.ok(accepted.every((candidate) => withAuto.rules.autoAccept.includes(candidate.rule_id)));
    assert.ok(
      accepted.every((candidate) => !isStructuralCandidate(candidate, {})),
      "構造を変える候補を自動で採用してはいけない"
    );
    console.log(`  ok   本処理: 自動で採用にしたルールの候補だけを採用する(${accepted.length} 件)`);

    // 6b. 本処理は、承認した型に当たったことを記録する。
    assert.strictEqual(candidates("A002").extraction.templateId, templateA.templateId);
    assert.ok(candidates("A002").extraction.templateSimilarity >= 0.8);

    // 6c. 保存した旧ページを取り直さずに調べ直す。
    const reinspectOut = await cli("fetch", dir, "--reinspect");
    assert.match(reinspectOut, /調べ直し: 16 件/);
    assert.ok(page("A002").inspectedAt, "調べ直した日時が台帳に入る");
    console.log("  ok   調べ直し: 取り直さずに台帳の構造を書き直す");

    // 6d. 構造の取り方の版が違う承認は使わない(取り方を変えたら、承認し直す)。
    const stale = readJson(settingsPath);
    stale.templates.approved[templateA.templateId].structureVersion = -1;
    fs.writeFileSync(settingsPath, JSON.stringify(stale));
    await cli("process", dir, "--force", "--ids", "A002");
    assert.strictEqual(candidates("A002").extraction.method, "generic", "版の違う承認で本文を抜いてはいけない");
    const staleGroupOut = await cli("group", dir);
    assert.match(staleGroupOut, /使えない承認が 1 件ある/);
    console.log("  ok   版の違う承認は使わない");

    // 7. 「AI 修正」タブへ写す一覧。
    const status = fs.readFileSync(path.join(dir, "project", "status.csv"), "utf8");
    assert.ok(status.startsWith("﻿移行管理ID,取込回,確認の深さ,状態"));
    assert.match(status, /\r\nGONE,,,取得できない,http-status,/);
    console.log("  ok   「AI 修正」タブへ写す一覧");

    // 8. 画面と実行の記録に、旧サイトの本文を出さない。
    const allOut = [guardedOut, fetchOut, refetchOut, groupOut, approveOut, processOut, rerunOut, reinspectOut].join("\n");
    const logs = fs
      .readdirSync(path.join(dir, "logs"))
      .map((name) => fs.readFileSync(path.join(dir, "logs", name), "utf8"))
      .join("\n");
    for (const text of ["子育て支援のお知らせ", "市内に住む", "<p>", "<h2>"]) {
      assert.ok(!allOut.includes(text), `画面に本文が出ている: ${text}`);
      assert.ok(!logs.includes(text), `実行の記録に本文が出ている: ${text}`);
    }
    console.log("  ok   画面と実行の記録に、旧サイトの本文を出さない");

    console.log("\n=== batch cli tests passed ===");
  } finally {
    server.close();
    for (const dir of dirs) fs.rmSync(dir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

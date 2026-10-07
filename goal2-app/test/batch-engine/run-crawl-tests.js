// 巡回(batch/cli.js crawl)を、手元の旧サイトの代わり(fake-old-site.js)に対して通す。
// ページの一覧とファイルの一覧、robots.txt と sitemap.xml、重複と転送、取得での使い回し、本文を出さないことを確かめる。
const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFile } = require("child_process");
const { startFakeOldSite } = require("./fake-old-site");

const appRoot = path.resolve(__dirname, "..", "..");
const CLI = path.join(appRoot, "batch", "cli.js");

function cli(...args) {
  return new Promise((resolve, reject) => {
    execFile(process.execPath, [CLI, ...args], { encoding: "utf8", cwd: appRoot }, (error, stdout, stderr) => {
      if (error) reject(new Error(`${args[0]} が失敗した: ${stderr || error.message}`));
      else resolve(stdout);
    });
  });
}

function readCsv(file) {
  const text = fs.readFileSync(file, "utf8").replace(/^﻿/, "");
  const [header, ...lines] = text.trim().split(/\r\n/);
  const names = header.split(",");
  return lines.map((line) => Object.fromEntries(line.split(",").map((value, i) => [names[i], value])));
}

async function main() {
  const { server, origin } = await startFakeOldSite();
  const host = new URL(origin).host;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "batch-crawl-test-"));
  try {
    fs.mkdirSync(path.join(dir, "project"));
    fs.writeFileSync(
      path.join(dir, "project", "settings.json"),
      JSON.stringify({ fetch: { allowedHosts: [host], privateHosts: [host], intervalMs: 20 }, patterns: { minPages: 3, proposals: 3 } })
    );

    const crawlOut = await cli("crawl", dir, "--start", `${origin}/`);
    const list = readCsv(path.join(dir, "crawl", "list.csv"));
    const byPath = new Map(list.map((row) => [row.URL.replace(origin, ""), row]));

    assert.strictEqual(byPath.get("/").タイトル, "テスト市トップ");
    assert.strictEqual(byPath.get("/a/3.html").階層, "1");
    assert.strictEqual(byPath.get("/b/1.html").タイトル, "子育て記事1", "Shift_JIS のページの題名が読める");
    assert.strictEqual(byPath.get("/hidden.html").見つけ方, "sitemap.xml", "リンクの無いページを sitemap.xml から見つける");
    assert.strictEqual(byPath.get("/a/3.html").ディレクトリ, "/a/");
    assert.strictEqual(byPath.get("/private/x.html").状態, "robots.txt で止めた");
    assert.strictEqual(byPath.get("/a/1.html?from=top").状態, "重複");
    assert.strictEqual(byPath.get("/a/1.html?from=top").重複先, `${origin}/a/1.html`);
    assert.strictEqual(byPath.get("/moved.html").転送先, `${origin}/a/1.html`);
    assert.match(byPath.get("/gone.html").状態, /取れない\(http-status 404\)/);
    assert.strictEqual(byPath.get("/gone.html").転送先, "", "取れなかったページに同じ URL を転送先として書かない");
    assert.ok(![...byPath.keys()].some((key) => key.includes("example.com") || key.startsWith("mailto")), "外のサイトとメールのリンクは一覧に入れない");
    assert.ok(![...byPath.keys()].some((key) => key.includes("#")), "# 以降は落とす");
    console.log("  ok   ページの一覧: 題名、階層、sitemap.xml、robots.txt、重複、転送、取れないページ");

    // 他のツールに倣って足したこと。
    assert.strictEqual(byPath.get("/onclick.html").見つけ方, "スクリプトの中", "onclick の location.href を拾う");
    assert.strictEqual(byPath.get("/rendered-only.html").見つけ方, "Chromium で開いて", "スクリプトが描いたリンクを Chromium で開いて拾う");
    assert.strictEqual(byPath.get("/members.html").状態, "取れた", "トップで受け取った Cookie を引き継ぐ");
    assert.ok(!byPath.has("/a/5.html?utm_source=top"), "広告の印の項目を外し、同じページとして扱う");
    // 外のサイトへのリンクは、トップの example.com のほか、佐賀市の本文の中のリンクも入る。
    const externalLines = fs.readFileSync(path.join(dir, "crawl", "external.csv"), "utf8").split(/\r?\n/);
    assert.ok(externalLines.some((line) => line.startsWith("https://example.com/,")), "外のサイトへのリンクを一覧にする");
    assert.ok(!externalLines.some((line) => line.startsWith(origin)), "巡回するサーバーのリンクは外のサイトに入れない");
    console.log("  ok   スクリプトの中のリンク、Chromium で開いて拾うリンク、Cookie、URL の項目の外し方、外のサイトへのリンク");

    // 開いた時刻を URL に付けるサイトでも、巡回が終わり、時刻の項目を外す。
    assert.ok(crawlOut.includes("外した URL の項目(巡回の中で見つけたもの): tm"), crawlOut);
    const clockRows = [...byPath.keys()].filter((key) => key.startsWith("/clock.html"));
    assert.ok(clockRows.length <= 5, `時刻の付いた URL が増え続けた: ${clockRows.length}`);
    console.log("  ok   値が変わっても中身が同じ URL の項目を見つけて外す(開いた時刻を付けるサイト)");

    // 記事の番号の項目は、「該当なし」のページが続いても外さない(1つの道でしか起きず、中身の違う番号もある)。
    assert.ok(!crawlOut.includes("URL の項目 id は"), "記事の番号の項目を外してはいけない");
    for (const id of [1, 2, 3, 4, 5, 6]) assert.ok(byPath.has(`/news.html?id=${id}`), `お知らせ ${id} が一覧に無い`);
    console.log("  ok   記事の番号の項目は外さない");

    const files = readCsv(path.join(dir, "crawl", "files.csv"));
    assert.deepStrictEqual(files.map((row) => row.URL.replace(origin, "")).sort(), ["/docs/form.xlsx", "/file.pdf"]);
    assert.ok(!fs.existsSync(path.join(dir, "crawl", "pages")) || fs.readdirSync(path.join(dir, "crawl", "pages")).length === list.filter((row) => row.状態 === "取れた" || row.状態 === "重複").length);
    console.log("  ok   ファイルの一覧: 中身を取らずに URL だけを書く");

    // 印刷用ページは、既定で外す。
    assert.ok(![...byPath.keys()].some((key) => key.startsWith("/print/") || key.includes("printcontent")), "印刷用ページを外す");
    // 接続が切れて取れなかったページは、取れないとして記録する(次の実行で取り直す)。
    assert.ok(byPath.get("/flaky.html").状態.startsWith("取れない(network"), byPath.get("/flaky.html").状態);
    console.log("  ok   印刷用ページを既定で外す");

    // もう一度動かすと、終わった巡回をやり直さず、一覧だけを書き直す。
    const again = await cli("crawl", dir, "--start", `${origin}/`);
    assert.match(again, /前の巡回は終わっている/);
    // ネットワークの切断や時間切れで取れなかったページは、取り直す。
    assert.match(again, /取れなかったページ 1 件を取り直す/);
    const relisted = readCsv(path.join(dir, "crawl", "list.csv"));
    assert.strictEqual(relisted.find((row) => row.URL === `${origin}/flaky.html`).状態, "取れた");
    console.log("  ok   終わった巡回は、やり直さない。切断で取れなかったページだけを取り直す");

    // 巡回で取ったページは、取得(fetch)で使い回し、旧サイトへ取りに行かない。
    fs.mkdirSync(path.join(dir, "input"));
    const pages = [
      { id: "A001", oldUrl: `${origin}/a/1.html` },
      { id: "A002", oldUrl: `${origin}/a/2.html` },
      { id: "B1", oldUrl: `${origin}/b/1.html` },
    ];
    fs.writeFileSync(path.join(dir, "input", "pages.json"), JSON.stringify({ pages }));
    const fetchOut = await cli("fetch", dir);
    assert.match(fetchOut, /巡回で取ったページを使う: 3 件/);
    const ledger = JSON.parse(fs.readFileSync(path.join(dir, "pages", "B1", "fetch.json"), "utf8"));
    assert.strictEqual(ledger.source, "crawl");
    assert.strictEqual(ledger.charset, "shift_jis");
    assert.ok(ledger.structurePaths.length > 0);
    console.log("  ok   取得: 巡回で取ったページを使い回す");

    // コンテンツパターン(サブサイトの候補)。子育てのページ(/b/)は、本体と違う作りで、ページどうしでリンクし合う。
    const patternsOut = await cli("patterns", dir);
    const patterns = JSON.parse(fs.readFileSync(path.join(dir, "crawl", "patterns.json"), "utf8"));
    const first = patterns.candidates[0];
    assert.strictEqual(first.key, "/b/", JSON.stringify(patterns.candidates.map((c) => c.key)));
    assert.ok(first.proposed && first.differentShare === 1);
    // 始まりのページを含むリンクのまとまりは、サイト全体の入口の群なので候補にしない。
    assert.ok(
      !patterns.candidates.some((c) => c.kind === "リンクのまとまり" && c.entry === `${origin}/`),
      "始まりのページを含むリンクのまとまりは候補にしない"
    );
    const xlsx = fs.readFileSync(path.join(dir, "crawl", "patterns.xlsx"));
    assert.strictEqual(xlsx.subarray(0, 2).toString(), "PK", "xlsx は ZIP の形で書く");
    console.log("  ok   コンテンツパターン: サブサイトの候補を順位付けし、xlsx に出す");

    // 画面と実行の記録に、旧サイトの本文と題名を出さない。
    const logs = fs
      .readdirSync(path.join(dir, "logs"))
      .map((name) => fs.readFileSync(path.join(dir, "logs", name), "utf8"))
      .join("\n");
    for (const text of ["子育て支援のお知らせ", "テスト市トップ", "<p>"]) {
      assert.ok(![crawlOut, again, fetchOut, patternsOut].join("\n").includes(text), `画面に出ている: ${text}`);
      assert.ok(!logs.includes(text), `実行の記録に出ている: ${text}`);
    }
    console.log("  ok   画面と実行の記録に、旧サイトの本文と題名を出さない");

    console.log("\n=== crawl tests passed ===");
  } finally {
    server.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

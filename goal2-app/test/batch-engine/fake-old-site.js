// 一括処理のテスト用の、旧サイトの代わり。手元(127.0.0.1)で動く。
// 佐賀市の評価用データの本文を、2つのテンプレートにはめて配る。
//   /a/<n>.html  テンプレート A(本文は div#contents)。12 ページ。
//   /b/<n>.html  テンプレート B(本文は div.main-body)。3 ページ。Shift_JIS で配る。
//   /gone.html   404
//   /file.pdf    HTML ではない
//   /moved.html  /a/1.html へ転送
// 巡回(crawl)の確かめ用:
//   /            トップ。A と B の全ページ、ファイル、止められた道、重複の URL へリンクする
//   /robots.txt  /private/ を止め、サイトマップを示す
//   /sitemap.xml リンクからは届かない /hidden.html を載せる
//   /private/x.html  robots.txt で止められたページ
//   /js-menu.html    スクリプトでリンクを作るページ(onclick と、描いたあとにだけ現れるリンク)
//   /members.html    トップで受け取る Cookie が無いと 403 を返すページ
//   /clock.html      開いた時刻を付けたリンク(?tm=…)を出すページ。開くたびにリンク先の URL が変わる
//   /flaky.html      1回目は接続を切る(ネットワークの切断の代わり)。2回目からは取れる
//   /print/1.html、/handlers/printcontent.cfm  印刷用ページ
//   /blog/index-itemid=N&page=2  道の中に項目を書くブログ(椎葉村の形)。記事 × ページ番号の組み合わせ 14 件と、
//                    記事だけの /blog/index-itemid=N を 3 件
//   /calendar.html?ym=N&day=1  カレンダー。月 × 日の組み合わせ 14 件(同じ形の URL の上限を確かめる)
//   /news.html?id=N  記事の番号の項目。1〜4 は「該当なし」で同じ中身、5 と 6 は違う中身(外してはいけない項目)
const fs = require("fs");
const http = require("http");
const path = require("path");

const DATASET = path.resolve(__dirname, "..", "..", "agents-cli", "datasets", "saga-a11y-eval.jsonl");

function loadBodies(count) {
  return fs
    .readFileSync(DATASET, "utf8")
    .split(/\r?\n/)
    .filter((line) => line.trim())
    .slice(0, count)
    .map((line) => JSON.parse(line).input.old_html);
}

function templateA(title, body, n) {
  return `<!doctype html><html lang="ja"><head><meta charset="utf-8"><title>${title}|テスト市</title></head>
<body><header id="header"><div class="logo">テスト市</div><nav class="gnav"><ul><li><a href="/">ホーム</a></li><li><a href="/a/1.html">くらし</a></li><li><a href="/a/2.html">子育て</a></li></ul></nav></header>
<div class="breadcrumb"><a href="/">ホーム</a> &gt; <span>記事${n}</span></div>
<div id="wrap"><div id="contents"><h1>${title}</h1>${body}</div><div class="toiawase"><p>このページに関するお問い合わせ</p><p>総務部 総務課 電話:000-000-0000</p></div><aside id="side"><ul><li><a href="/a/3.html">関連</a></li></ul></aside></div>
<footer id="footer"><p>テスト市役所 〒000-0000</p></footer></body></html>`;
}

function templateB(title, body) {
  return `<!doctype html><html lang="ja"><head><meta http-equiv="Content-Type" content="text/html; charset=Shift_JIS"><title>${title}</title></head>
<body><div class="kosodate-head"><p>子育てサイト</p></div><table class="layout"><tr><td class="menu"><a href="/b/1.html">メニュー</a></td>
<td><div class="main-body"><h1>${title}</h1>${body}</div></td></tr></table><div class="kosodate-foot">子育て支援課</div></body></html>`;
}

// Shift_JIS に直す。Node には書き出しの道具が無いので、テストの本文は Shift_JIS で書ける文字に限る前提で、
// TextDecoder の逆引きの表を作って変換する。
let sjisTable = null;
function toShiftJis(text) {
  if (!sjisTable) {
    sjisTable = new Map();
    const decoder = new TextDecoder("shift_jis");
    for (let hi = 0x81; hi <= 0xfc; hi += 1) {
      if (hi > 0x9f && hi < 0xe0) continue;
      for (let lo = 0x40; lo <= 0xfc; lo += 1) {
        if (lo === 0x7f) continue;
        const ch = decoder.decode(Uint8Array.of(hi, lo));
        if (ch.length === 1 && ch !== "�" && !sjisTable.has(ch)) sjisTable.set(ch, [hi, lo]);
      }
    }
    for (let k = 0xa1; k <= 0xdf; k += 1) sjisTable.set(decoder.decode(Uint8Array.of(k)), [k]);
  }
  const out = [];
  for (const ch of text) {
    const code = ch.codePointAt(0);
    if (code < 0x80) out.push(code);
    else out.push(...(sjisTable.get(ch) || [0x81, 0x48])); // 表に無い文字は「？」
  }
  return Buffer.from(out);
}

let clockCount = 0;
let flakyCount = 0;

function startFakeOldSite() {
  const bodies = loadBodies(15);
  const server = http.createServer((request, response) => {
    const url = new URL(request.url, "http://localhost");
    let match = url.pathname.match(/^\/a\/(\d+)\.html$/);
    if (match && Number(match[1]) >= 1 && Number(match[1]) <= 12) {
      const n = Number(match[1]);
      response.writeHead(200, { "content-type": "text/html; charset=utf-8", etag: `"a-${n}"` });
      response.end(templateA(`記事${n}`, bodies[n - 1], n));
      return;
    }
    match = url.pathname.match(/^\/b\/(\d+)\.html$/);
    if (match && Number(match[1]) >= 1 && Number(match[1]) <= 3) {
      const n = Number(match[1]);
      response.writeHead(200, { "content-type": "text/html" });
      response.end(toShiftJis(templateB(`子育て記事${n}`, `<p>子育て支援のお知らせ${n}です。申し込みは窓口へ。</p><h2>対象</h2><p>市内に住む${n}歳までの子どもがいる世帯。詳しくは子育て支援課へお問い合わせください。</p>`)));
      return;
    }
    if (url.pathname === "/") {
      const links = [
        ...Array.from({ length: 12 }, (_, i) => `<li><a href="/a/${i + 1}.html">記事${i + 1}</a></li>`),
        ...Array.from({ length: 3 }, (_, i) => `<li><a href="b/${i + 1}.html">子育て${i + 1}</a></li>`),
        '<li><a href="/file.pdf">様式(PDF)</a></li>',
        '<li><a href="/docs/form.xlsx">様式(Excel)</a></li>',
        '<li><a href="/gone.html">消えたページ</a></li>',
        '<li><a href="/moved.html">移ったページ</a></li>',
        '<li><a href="/private/x.html">内部</a></li>',
        '<li><a href="/a/1.html?from=top#section">重複の URL</a></li>',
        '<li><a href="https://example.com/">外部</a></li>',
        '<li><a href="mailto:info@example.com">メール</a></li>',
        '<li><a href="/js-menu.html">スクリプトのメニュー</a></li>',
        '<li><a href="/a/5.html?utm_source=top">広告の印の付いた URL</a></li>',
        '<li><a href="/members.html">Cookie が要るページ</a></li>',
        `<li><a href="/clock.html?tm=${Date.now()}">時刻の付いたリンク</a></li>`,
        ...[1, 2, 3, 4, 5, 6].map((id) => `<li><a href="/news.html?id=${id}">お知らせ${id}</a></li>`),
        '<li><a href="/flaky.html">ときどき切れるページ</a></li>',
        ...Array.from({ length: 14 }, (_, i) => `<li><a href="/calendar.html?ym=${202601 + i}&day=1">カレンダー${i + 1}</a></li>`),
        ...Array.from({ length: 14 }, (_, i) => `<li><a href="/blog/index-itemid=${i + 1}&page=2">ブログ${i + 1}の2ページ目</a></li>`),
        ...Array.from({ length: 3 }, (_, i) => `<li><a href="/blog/index-itemid=${i + 1}">ブログ${i + 1}</a></li>`),
        '<li><a href="/print/1.html">印刷用</a></li>',
        '<li><a href="/handlers/printcontent.cfm?ContentID=1">印刷用(遠野市の形)</a></li>',
      ];
      response.writeHead(200, { "content-type": "text/html; charset=utf-8", "set-cookie": "visited=1; Path=/" });
      response.end(`<!doctype html><html lang="ja"><head><title>テスト市トップ</title></head><body><ul>${links.join("")}</ul></body></html>`);
      return;
    }
    if (url.pathname === "/robots.txt") {
      response.writeHead(200, { "content-type": "text/plain" });
      response.end(`User-agent: *
Disallow: /private/
Sitemap: http://${request.headers.host}/sitemap.xml
`);
      return;
    }
    if (url.pathname === "/sitemap.xml") {
      response.writeHead(200, { "content-type": "application/xml" });
      response.end(`<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>http://${request.headers.host}/hidden.html</loc></url><url><loc>http://${request.headers.host}/a/2.html</loc></url></urlset>`);
      return;
    }
    if (url.pathname === "/js-menu.html") {
      response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      response.end(`<!doctype html><html><head><title>スクリプトのメニュー</title></head><body>
<button onclick="location.href='/onclick.html'">押すと移る</button><nav id="menu"></nav>
<script>document.getElementById("menu").innerHTML = '<a href="/rendered-only.html">描いたあとのリンク</a>';</script>
<p>メニューはスクリプトで作る。</p></body></html>`);
      return;
    }
    if (url.pathname === "/onclick.html" || url.pathname === "/rendered-only.html") {
      response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      response.end(`<!doctype html><html><head><title>${url.pathname.slice(1)}</title></head><body><p>${url.pathname} の本文。</p></body></html>`);
      return;
    }
    if (url.pathname === "/clock.html") {
      // 開くたびに、時刻の付いた自分自身へのリンクと、ほかのページへのリンクを出す。
      clockCount += 1;
      const tm = `${Date.now()}${clockCount}`;
      response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      response.end(`<!doctype html><html><head><title>時刻のページ</title></head><body><p>時刻の付いたリンクのページ。</p>
<a href="/clock.html?tm=${tm}">もう一度</a><a href="/a/6.html?tm=${tm}">記事6</a><a href="/a/7.html?tm=${tm}">記事7</a><a href="/a/8.html?tm=${tm}">記事8</a><a href="/a/9.html?tm=${tm}">記事9</a><a href="/a/10.html?tm=${tm}">記事10</a></body></html>`);
      return;
    }
    if (url.pathname.startsWith("/blog/index-itemid=")) {
      response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      response.end(`<!doctype html><html><head><title>ブログ</title></head><body><p>${url.pathname} の記事。</p></body></html>`);
      return;
    }
    if (url.pathname === "/calendar.html") {
      response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      response.end(`<!doctype html><html><head><title>カレンダー</title></head><body><p>${url.searchParams.get("ym")} の行事。</p></body></html>`);
      return;
    }
    if (url.pathname === "/flaky.html") {
      flakyCount += 1;
      if (flakyCount === 1) {
        request.socket.destroy();
        return;
      }
      response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      response.end("<!doctype html><html><head><title>ときどき切れるページ</title></head><body><p>2回目で取れた。</p></body></html>");
      return;
    }
    if (url.pathname === "/news.html") {
      const id = Number(url.searchParams.get("id"));
      response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      response.end(`<!doctype html><html><head><title>お知らせ</title></head><body><p>${id >= 5 ? `お知らせ${id}の本文。` : "該当する記事はありません。"}</p></body></html>`);
      return;
    }
    if (url.pathname === "/members.html") {
      if (!/visited=1/.test(request.headers.cookie || "")) {
        response.writeHead(403, { "content-type": "text/html" });
        response.end("<h1>Forbidden</h1>");
        return;
      }
      response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      response.end("<!doctype html><html><head><title>Cookie が要るページ</title></head><body><p>中に入れた。</p></body></html>");
      return;
    }
    if (url.pathname === "/hidden.html" || url.pathname === "/private/x.html") {
      response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      response.end(`<!doctype html><html><head><title>${url.pathname === "/hidden.html" ? "リンクの無いページ" : "内部のページ"}</title></head><body><p>${url.pathname === "/hidden.html" ? "サイトマップにだけあるページです。" : "止められた道のページです。"}</p></body></html>`);
      return;
    }
    if (url.pathname === "/moved.html") {
      response.writeHead(301, { location: "/a/1.html" });
      response.end();
      return;
    }
    if (url.pathname === "/file.pdf") {
      response.writeHead(200, { "content-type": "application/pdf" });
      response.end("%PDF-1.4");
      return;
    }
    response.writeHead(404, { "content-type": "text/html" });
    response.end("<h1>Not found</h1>");
  });
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve({ server, origin: `http://127.0.0.1:${server.address().port}` }));
  });
}

module.exports = { startFakeOldSite };

// 一括処理のテスト用の、旧サイトの代わり。手元(127.0.0.1)で動く。
// 佐賀市の評価用データの本文を、2つのテンプレートにはめて配る。
//   /a/<n>.html  テンプレート A(本文は div#contents)。12 ページ。
//   /b/<n>.html  テンプレート B(本文は div.main-body)。3 ページ。Shift_JIS で配る。
//   /gone.html   404
//   /file.pdf    HTML ではない
//   /moved.html  /a/1.html へ転送
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
<div id="wrap"><div id="contents"><h1>${title}</h1>${body}</div><aside id="side"><ul><li><a href="/a/3.html">関連</a></li></ul></aside></div>
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

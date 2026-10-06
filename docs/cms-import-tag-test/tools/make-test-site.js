// CMS 取込試験で使う「試験用の旧サイト」を作る。
// 実在する旧サイトのページや画像を探さなくて済むように、トップページ、下層ページ、
// 画像(JPEG、PNG、GIF、アイコン、SVG、WebP)、PDF、Excel、Word を test-site/ に書き出す。
// 使い方(リポジトリの直下で): node docs/cms-import-tag-test/tools/make-test-site.js
// 画像と PDF は goal2-app に入っている Playwright の Chromium で描く。
"use strict";

const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const ROOT = path.resolve(__dirname, "..", "test-site");
const { chromium } = require(path.resolve(__dirname, "..", "..", "..", "goal2-app", "node_modules", "playwright"));

function write(rel, data) {
  const file = path.join(ROOT, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, data);
  console.log(`  ${rel} (${fs.statSync(file).size} bytes)`);
}

// ---- 画像の絵柄 -------------------------------------------------------------

function cardHtml({ width, height, bg, fg, title, sub }) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    html,body{margin:0;width:${width}px;height:${height}px;overflow:hidden}
    body{background:${bg};color:${fg};font-family:"Yu Gothic UI","Meiryo",sans-serif;
      display:flex;flex-direction:column;justify-content:center;align-items:center;gap:8px}
    .t{font-size:${Math.round(height / 6)}px;font-weight:700}
    .s{font-size:${Math.round(height / 12)}px}
    .f{position:absolute;inset:10px;border:3px dashed ${fg};opacity:.5}
  </style></head><body><div class="f"></div><div class="t">${title}</div><div class="s">${sub}</div></body></html>`;
}

// ---- GIF(1色ずつの塗りを、LZW の最小の符号で書く) ---------------------------

function makeGif(width, height, palette, pixelAt) {
  // palette: [[r,g,b], ...] 4色まで。pixelAt(x, y) は色の番号を返す。
  const minCodeSize = 2;
  const clear = 1 << minCodeSize;
  const end = clear + 1;
  const codes = [];
  // 符号の長さを3ビットのまま保つため、2つ書くごとに clear を入れる(辞書を育てない)。
  let sinceClear = 0;
  codes.push(clear);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (sinceClear === 2) { codes.push(clear); sinceClear = 0; }
      codes.push(pixelAt(x, y));
      sinceClear++;
    }
  }
  codes.push(end);
  const bytes = [];
  let acc = 0, bits = 0;
  for (const c of codes) {
    acc |= c << bits; bits += 3;
    while (bits >= 8) { bytes.push(acc & 0xff); acc >>= 8; bits -= 8; }
  }
  if (bits > 0) bytes.push(acc & 0xff);
  const out = [];
  const push16 = (n) => out.push(n & 0xff, (n >> 8) & 0xff);
  out.push(...Buffer.from("GIF89a"));
  push16(width); push16(height);
  out.push(0x81, 0, 0); // 全体の色表あり、2^(1+1)=4色
  for (let i = 0; i < 4; i++) out.push(...(palette[i] || [0, 0, 0]));
  out.push(0x2c); push16(0); push16(0); push16(width); push16(height); out.push(0);
  out.push(minCodeSize);
  for (let i = 0; i < bytes.length; i += 255) {
    const chunk = bytes.slice(i, i + 255);
    out.push(chunk.length, ...chunk);
  }
  out.push(0, 0x3b);
  return Buffer.from(out);
}

// ---- ZIP(Excel と Word の入れ物) --------------------------------------------

function makeZip(entries) {
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const [name, text] of entries) {
    const data = Buffer.from(text, "utf8");
    const comp = zlib.deflateRawSync(data);
    const crc = zlib.crc32(data);
    const nameBuf = Buffer.from(name, "utf8");
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(8, 8); local.writeUInt32LE(0, 10); local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(comp.length, 18); local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26); local.writeUInt16LE(0, 28);
    locals.push(local, nameBuf, comp);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8); central.writeUInt16LE(8, 10); central.writeUInt32LE(0, 12);
    central.writeUInt32LE(crc, 16); central.writeUInt32LE(comp.length, 20); central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBuf.length, 28); central.writeUInt32LE(offset, 42);
    centrals.push(central, nameBuf);
    offset += 30 + nameBuf.length + comp.length;
  }
  const cdSize = centrals.reduce((n, b) => n + b.length, 0);
  const endRec = Buffer.alloc(22);
  endRec.writeUInt32LE(0x06054b50, 0); endRec.writeUInt16LE(entries.length, 8); endRec.writeUInt16LE(entries.length, 10);
  endRec.writeUInt32LE(cdSize, 12); endRec.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, ...centrals, endRec]);
}

const XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';

function makeXlsx() {
  const rows = [["項目", "値"], ["試験用の Excel ファイル", "CMS 取込試験"], ["数値", "1234"]];
  const cell = (ref, v) => /^\d+$/.test(v) ? `<c r="${ref}"><v>${v}</v></c>` : `<c r="${ref}" t="inlineStr"><is><t>${v}</t></is></c>`;
  const sheet = XML + '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>' +
    rows.map((r, i) => `<row r="${i + 1}">${cell("A" + (i + 1), r[0])}${cell("B" + (i + 1), r[1])}</row>`).join("") +
    "</sheetData></worksheet>";
  return makeZip([
    ["[Content_Types].xml", XML + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>'],
    ["_rels/.rels", XML + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'],
    ["xl/workbook.xml", XML + '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="試験" sheetId="1" r:id="rId1"/></sheets></workbook>'],
    ["xl/_rels/workbook.xml.rels", XML + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>'],
    ["xl/worksheets/sheet1.xml", sheet],
  ]);
}

function makeDocx() {
  const p = (t) => `<w:p><w:r><w:t>${t}</w:t></w:r></w:p>`;
  return makeZip([
    ["[Content_Types].xml", XML + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>'],
    ["_rels/.rels", XML + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>'],
    ["word/document.xml", XML + '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>' +
      p("試験用の Word ファイル") + p("CMS 取込試験で、ファイルのリンクが素材として取り込まれるかを確かめるためのものです。") +
      "</w:body></w:document>"],
  ]);
}

// ---- 旧サイトの役のページ ----------------------------------------------------

function sitePage(title, body) {
  return `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>${title}|CMS 取込試験の試験用サイト</title>
</head>
<body>
<header><p>CMS 取込試験の試験用サイト(実在する自治体のサイトではありません)</p></header>
<main id="contents">
${body}
</main>
</body>
</html>
`;
}

const indexBody = `<h1>試験用サイトのトップページ</h1>
<p>このサイトは、CMS 取込試験で「旧サイト」の役をするためのものです。試験ページのリンクと画像とファイルは、ここを指します。</p>
<ul>
<li><a href="page.html">下層ページ</a></li>
<li><a href="files/sample.pdf">PDF ファイル</a></li>
</ul>
<p><img src="img/photo.jpg" alt="試験用の JPEG 画像" width="320" height="180"></p>`;

const pageBody = `<h1>試験用サイトの下層ページ</h1>
<p>試験ページの「下層ページへのリンク」は、このページを指します。URL にクエリ(?id=1)を付けても同じページが返ります。</p>
<h2 id="section1">見出し1</h2>
<p>ページ内アンカーの行き先の1つ目です。</p>
<h2 id="section2">見出し2</h2>
<p>ページ内アンカーの行き先の2つ目です。</p>
<p><a href="index.html">トップページへ戻る</a></p>`;

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180" viewBox="0 0 320 180" role="img" aria-labelledby="t">
  <title id="t">試験用の SVG 画像</title>
  <rect width="320" height="180" fill="#e6edf8"/>
  <rect x="10" y="10" width="300" height="160" fill="none" stroke="#1f4a86" stroke-width="3" stroke-dasharray="8 6"/>
  <text x="160" y="96" text-anchor="middle" font-family="sans-serif" font-size="28" font-weight="700" fill="#1f4a86">TEST SVG</text>
</svg>
`;

async function main() {
  fs.rmSync(ROOT, { recursive: true, force: true });
  console.log(`書き出し先: ${ROOT}`);
  write("index.html", sitePage("トップページ", indexBody));
  write("page.html", sitePage("下層ページ", pageBody));
  write("img/shape.svg", svg);
  write("files/sample.xlsx", makeXlsx());
  write("files/sample.docx", makeDocx());
  // GIF: 横じまの4色(機械で作るので文字は入れない)
  const gifPalette = [[251, 233, 228], [179, 49, 31], [255, 253, 248], [29, 26, 22]];
  write("img/stripe.gif", makeGif(160, 90, gifPalette, (x, y) => (x < 4 || x > 155 ? 3 : (Math.floor(y / 15) % 2 === 0 ? 0 : 1))));

  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ deviceScaleFactor: 1 });
    async function shot(rel, opts, type) {
      await page.setViewportSize({ width: opts.width, height: opts.height });
      await page.setContent(cardHtml(opts));
      write(rel, await page.screenshot({ type, ...(type === "jpeg" ? { quality: 85 } : {}) }));
    }
    await shot("img/photo.jpg", { width: 320, height: 180, bg: "#efe9dd", fg: "#5b5346", title: "試験用 JPEG", sub: "CMS 取込試験の画像" }, "jpeg");
    await shot("img/chart.png", { width: 320, height: 180, bg: "#fffdf8", fg: "#1f4a86", title: "試験用 PNG", sub: "CMS 取込試験の画像" }, "png");
    await shot("img/icon-pdf.png", { width: 32, height: 32, bg: "#b3311f", fg: "#ffffff", title: "PDF", sub: "" }, "png");
    // WebP は Chromium の canvas で書き出す
    await page.setViewportSize({ width: 320, height: 180 });
    await page.setContent("<canvas id=c width=320 height=180></canvas>");
    const webp = await page.evaluate(() => {
      const c = document.getElementById("c"); const g = c.getContext("2d");
      g.fillStyle = "#efe9f6"; g.fillRect(0, 0, 320, 180);
      g.strokeStyle = "#5a3d8a"; g.lineWidth = 3; g.setLineDash([8, 6]); g.strokeRect(10, 10, 300, 160);
      g.fillStyle = "#5a3d8a"; g.font = "bold 28px sans-serif"; g.textAlign = "center"; g.fillText("TEST WEBP", 160, 100);
      return c.toDataURL("image/webp", 0.9);
    });
    if (!webp.startsWith("data:image/webp")) throw new Error("WebP を書き出せませんでした");
    write("img/photo.webp", Buffer.from(webp.split(",")[1], "base64"));
    // PDF
    await page.setContent(`<!doctype html><html lang="ja"><head><meta charset="utf-8"><title>試験用の PDF</title>
      <style>body{font-family:"Yu Gothic UI","Meiryo",sans-serif;padding:40px}</style></head>
      <body><h1>試験用の PDF ファイル</h1><p>CMS 取込試験で、ファイルのリンクが素材として取り込まれるかを確かめるためのものです。</p></body></html>`);
    write("files/sample.pdf", await page.pdf({ format: "A4" }));
  } finally {
    await browser.close();
  }
  console.log("できました。test-site/ の中身を、そのまま試験用の置き場に上げてください。");
}

main().catch((e) => { console.error(e); process.exit(1); });

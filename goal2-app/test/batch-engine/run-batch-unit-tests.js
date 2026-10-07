// 一括処理の部品の単体テスト(Chromium を使わない)。
// 書き込みの待ち行列(batch/lib/project.js)、xlsx(batch/lib/xlsx.js)、robots.txt(batch/lib/robots.js)。
const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const zlib = require("zlib");
const { openProject } = require("../../batch/lib/project");
const { buildXlsx } = require("../../batch/lib/xlsx");
const { parseRobots, isAllowedByRobots, parseSitemap } = require("../../batch/lib/robots");

// ZIP の中央のディレクトリを読み、名前と中身(展開したもの)を返す。
function unzip(buffer) {
  const end = buffer.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  const count = buffer.readUInt16LE(end + 10);
  let offset = buffer.readUInt32LE(end + 16);
  const files = new Map();
  for (let i = 0; i < count; i += 1) {
    const method = buffer.readUInt16LE(offset + 10);
    const crc = buffer.readUInt32LE(offset + 16);
    const size = buffer.readUInt32LE(offset + 20);
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localOffset = buffer.readUInt32LE(offset + 42);
    const name = buffer.subarray(offset + 46, offset + 46 + nameLength).toString("utf8");
    const localNameLength = buffer.readUInt16LE(localOffset + 26);
    const localExtraLength = buffer.readUInt16LE(localOffset + 28);
    const start = localOffset + 30 + localNameLength + localExtraLength;
    const data = buffer.subarray(start, start + size);
    const content = method === 8 ? zlib.inflateRawSync(data) : data;
    assert.strictEqual(zlib.crc32(content) >>> 0, crc, `${name}: CRC が合わない`);
    files.set(name, content.toString("utf8"));
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return files;
}

async function main() {
  // 1. 書き込みの待ち行列: 同じフォルダは出した順に書き、最後の中身が残る。別のフォルダは並べて書く。
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "batch-unit-"));
  try {
    const project = openProject(dir);
    for (let i = 0; i < 40; i += 1) project.queueWrite(path.join(dir, "pages", "p1", "a.json"), `{"v":${i}}`);
    for (let i = 0; i < 20; i += 1) project.queueWrite(path.join(dir, "pages", `q${i}`, "source.html"), `<p>${i}</p>`);
    // 同じフォルダの、旧ページを先に、台帳をあとに出す。
    project.queueWrite(path.join(dir, "pages", "p2", "source.html"), "x".repeat(200000));
    project.queueWrite(path.join(dir, "pages", "p2", "meta.json"), "{}");
    await project.flush();
    assert.strictEqual(fs.readFileSync(path.join(dir, "pages", "p1", "a.json"), "utf8"), '{"v":39}');
    assert.strictEqual(fs.readdirSync(path.join(dir, "pages")).length, 22);
    assert.strictEqual(fs.statSync(path.join(dir, "pages", "p2", "source.html")).size, 200000);
    console.log("  ok   書き込みの待ち行列: 同じフォルダは出した順、最後の中身が残る");

    // 書けなかったときは、flush でエラーを1回だけ投げ、次の flush は通る。
    fs.writeFileSync(path.join(dir, "blocker"), "file");
    project.queueWrite(path.join(dir, "blocker", "x.json"), "{}");
    await assert.rejects(() => project.flush(), /ファイルを書けませんでした/);
    await project.flush();
    console.log("  ok   書き込みの待ち行列: 書けなかったときは flush でエラーを返す");

    // 書きかけの JSON は、無いものとして読む。
    fs.writeFileSync(path.join(dir, "pages", "p1", "broken.json"), '{"a": 1, "b"');
    assert.strictEqual(project.readJson(path.join(dir, "pages", "p1", "broken.json"), null), null);
    console.log("  ok   書きかけの JSON は無いものとして読む");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }

  // 2. xlsx: ZIP の各部品が展開でき、シートの名前と文字が入っている。
  const xlsx = buildXlsx([
    { name: "サブサイト候補", rows: [["順位", "候補"], [1, "/kosodate/ & <観光>"]], widths: [6, 20] },
    { name: "ページ", rows: [["URL"], ["https://example.com/a?x=1&y=2"]] },
  ]);
  const files = unzip(xlsx);
  for (const name of ["[Content_Types].xml", "_rels/.rels", "xl/workbook.xml", "xl/styles.xml", "xl/worksheets/sheet1.xml", "xl/worksheets/sheet2.xml"]) {
    assert.ok(files.has(name), `${name} が無い`);
  }
  assert.match(files.get("xl/workbook.xml"), /<sheet name="サブサイト候補"/);
  assert.match(files.get("xl/worksheets/sheet1.xml"), /<t xml:space="preserve">\/kosodate\/ &amp; &lt;観光&gt;<\/t>/);
  assert.match(files.get("xl/worksheets/sheet1.xml"), /<c r="A2"><v>1<\/v><\/c>/);
  console.log("  ok   xlsx: 部品が展開でき、シートの名前、文字、数が入る");

  // 3. robots.txt と sitemap.xml。
  const robots = parseRobots("User-agent: Googlebot\nDisallow: /\n\nUser-agent: *\nDisallow: /private/\nAllow: /private/open/\nDisallow: /*.cgi$\nSitemap: https://example.com/sitemap.xml\n");
  assert.ok(isAllowedByRobots(robots, "https://example.com/a.html"));
  assert.ok(!isAllowedByRobots(robots, "https://example.com/private/x.html"));
  assert.ok(isAllowedByRobots(robots, "https://example.com/private/open/x.html"), "長く当たる Allow が勝つ");
  assert.ok(!isAllowedByRobots(robots, "https://example.com/bin/form.cgi"));
  assert.ok(isAllowedByRobots(robots, "https://example.com/bin/form.cgi?x=1"), "$ は末尾だけに当たる");
  assert.deepStrictEqual(robots.sitemaps, ["https://example.com/sitemap.xml"]);
  assert.deepStrictEqual(parseSitemap("<sitemapindex><sitemap><loc>https://e.com/s1.xml</loc></sitemap></sitemapindex>"), { urls: [], children: ["https://e.com/s1.xml"] });
  assert.deepStrictEqual(parseSitemap("<urlset><url><loc> https://e.com/a?x=1&amp;y=2 </loc></url></urlset>").urls, ["https://e.com/a?x=1&y=2"]);
  console.log("  ok   robots.txt と sitemap.xml");

  console.log("\n=== batch unit tests passed ===");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

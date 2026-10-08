// xlsx を読む小さな部品(外の部品に頼らない)。カテゴリ設計書や、ディレクターが書き込んだ下書きを読むのに使う。
// 読むのは、シートの名前と、セルの文字と数だけ。式は、保存されている結果の値を読む。ふりがな(rPh)は読まない。
const fs = require("fs");
const zlib = require("zlib");

// ZIP の中央ディレクトリから、名前 → 中身を作る。
function unzip(buffer) {
  let end = buffer.length - 22;
  while (end >= 0 && buffer.readUInt32LE(end) !== 0x06054b50) end -= 1;
  if (end < 0) throw new Error("xlsx(ZIP)の形ではありません");
  const count = buffer.readUInt16LE(end + 10);
  let offset = buffer.readUInt32LE(end + 16);
  const files = new Map();
  for (let i = 0; i < count; i += 1) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) throw new Error("xlsx の目次が壊れています");
    const method = buffer.readUInt16LE(offset + 10);
    const compressed = buffer.readUInt32LE(offset + 20);
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const local = buffer.readUInt32LE(offset + 42);
    const name = buffer.toString("utf8", offset + 46, offset + 46 + nameLength);
    const dataStart = local + 30 + buffer.readUInt16LE(local + 26) + buffer.readUInt16LE(local + 28);
    const raw = buffer.subarray(dataStart, dataStart + compressed);
    files.set(name, method === 0 ? raw : zlib.inflateRawSync(raw));
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return files;
}

const decode = (text) =>
  text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&amp;/g, "&");

const textOf = (xml) =>
  decode(
    [...xml.replace(/<rPh[\s\S]*?<\/rPh>/g, "").matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((m) => m[1]).join("")
  );

// 列の文字(A、AB)を 0 から始まる番号にする。
function columnIndex(letters) {
  let n = 0;
  for (const c of letters) n = n * 26 + (c.charCodeAt(0) - 64);
  return n - 1;
}

// シートの名前 → 行の配列(行は、列の番号 → 文字 の配列)。
function readXlsx(file) {
  const files = unzip(fs.readFileSync(file));
  const read = (name) => (files.has(name) ? files.get(name).toString("utf8") : "");
  const shared = [...read("xl/sharedStrings.xml").matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => textOf(m[1]));
  const rels = new Map(
    [...read("xl/_rels/workbook.xml.rels").matchAll(/<Relationship\b[^>]*>/g)].map((m) => [
      (m[0].match(/Id="([^"]+)"/) || [])[1],
      (m[0].match(/Target="([^"]+)"/) || [])[1],
    ])
  );
  const sheets = new Map();
  for (const m of read("xl/workbook.xml").matchAll(/<sheet\b[^>]*>/g)) {
    const name = decode((m[0].match(/name="([^"]*)"/) || [])[1] || "");
    const id = (m[0].match(/r:id="([^"]+)"/) || [])[1];
    const target = rels.get(id);
    if (!target) continue;
    const xml = read(`xl/${target.replace(/^\/?xl\//, "")}`);
    const rows = [];
    for (const row of xml.matchAll(/<row\b[^>]*?r="(\d+)"[^>]*?(?:\/>|>([\s\S]*?)<\/row>)/g)) {
      const cells = [];
      for (const c of (row[2] || "").matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
        const attrs = c[1];
        const body = c[2] || "";
        const ref = (attrs.match(/r="([A-Z]+)\d+"/) || [])[1];
        if (!ref) continue;
        const type = (attrs.match(/t="([^"]+)"/) || [])[1];
        const v = (body.match(/<v>([\s\S]*?)<\/v>/) || [])[1];
        let value = null;
        if (type === "s" && v != null) value = shared[Number(v)];
        else if (type === "inlineStr") value = textOf(body);
        else if (v != null) value = decode(v);
        if (value != null && value !== "") cells[columnIndex(ref)] = value;
      }
      rows[Number(row[1]) - 1] = cells;
    }
    sheets.set(name, rows);
  }
  return sheets;
}

module.exports = { readXlsx, columnIndex };

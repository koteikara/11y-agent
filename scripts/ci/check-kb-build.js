#!/usr/bin/env node
// KB の生成物が、正本の Markdown から作り直したものと一致するかを確かめる。
// あわせて、goal2-app/data/ のコピーが a11y-migration-kb/build/ と一致するかも確かめる。
// 使い方(リポジトリのどこからでも): node scripts/ci/check-kb-build.js
// Python 3 が要る。コマンド名は PYTHON で変えられる(既定は Windows なら python、ほかは python3)。
//
// 食い違ったときの直し方は PROJECT_CONTEXT.md の「実行と検証」にある。
// 生成し直して build/ に書き、同じ2ファイルを goal2-app/data/ へコピーする。
// 改行コードの違い(Windows の CRLF と LF)は、中身の違いとして扱わない。
const { execFileSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..", "..");
const kbDir = path.join(repoRoot, "a11y-migration-kb");
const appDataDir = path.join(repoRoot, "goal2-app", "data");
const python = process.env.PYTHON || (process.platform === "win32" ? "python" : "python3");

const OUTPUTS = [
  { name: "rules.jsonl", generator: "okf2jsonl.py" },
  { name: "michecker-checkitems.json", generator: "actf2json.py" },
];

function relative(file) {
  return path.relative(repoRoot, file).split(path.sep).join("/");
}

function readNormalized(file) {
  return fs.readFileSync(file, "utf8").replace(/\r\n/g, "\n");
}

function sameContent(a, b) {
  return fs.existsSync(a) && fs.existsSync(b) && readNormalized(a) === readNormalized(b);
}

const workDir = fs.mkdtempSync(path.join(os.tmpdir(), "kb-build-check-"));
const problems = [];

try {
  for (const { name, generator } of OUTPUTS) {
    const regenerated = path.join(workDir, name);
    execFileSync(python, [path.join(kbDir, "tools", generator), "--bundle", kbDir, "--out", regenerated], {
      stdio: ["ignore", "ignore", "inherit"],
    });
    const built = path.join(kbDir, "build", name);
    const copied = path.join(appDataDir, name);
    if (!sameContent(regenerated, built)) {
      problems.push({ file: relative(built), reason: `Markdown から作り直した結果と違う(tools/${generator} で生成し直す)` });
    }
    if (!sameContent(built, copied)) {
      problems.push({ file: relative(copied), reason: `${relative(built)} と違う(build/ からコピーし直す)` });
    }
  }
} finally {
  fs.rmSync(workDir, { recursive: true, force: true });
}

if (problems.length === 0) {
  console.log("OK: KB の生成物は作り直した結果と一致し、goal2-app/data/ のコピーとも一致する");
  process.exit(0);
}

for (const { file, reason } of problems) {
  console.log(`::error file=${file}::${reason}`);
}
process.exit(1);

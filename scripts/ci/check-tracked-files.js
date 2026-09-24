#!/usr/bin/env node
// 一時生成物や鍵のファイルがリポジトリに入っていないかを確かめる。
// 使い方(リポジトリのどこからでも): node scripts/ci/check-tracked-files.js
//
// 次の2つを見る。
// 1. .gitignore で無視しているのに、追跡されているファイル(git ls-files -ci --exclude-standard)。
// 2. 下の FORBIDDEN に当たるファイル。.gitignore の行が消えても気づけるように、別に持つ。
// 必要な fixture と一時ファイルの分け方は goal2-app/README.md の「検証用のデータと一時ファイル」にある。
const { execFileSync } = require("child_process");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..", "..");

const FORBIDDEN = [
  { pattern: /(^|\/)tmp\//, reason: "一時生成物の置き場(tmp/)" },
  { pattern: /(^|\/)\.tmp-[^/]*/, reason: "手元に置く外部 fixture(.tmp-*)" },
  { pattern: /\.log$/, reason: "ログ" },
  { pattern: /(^|\/)node_modules\//, reason: "npm の依存" },
  { pattern: /^goal2-app\/(dist\/|\.goal2-app-local\/|sea-prep\.blob$|server\.bundled\.js$|[^/]+\.exe$)/, reason: "Windows 版のビルド生成物と手元の設定" },
  { pattern: /(^|\/)(\.env(\..*)?|credentials\.json|token\.json|service-account[^/]*\.json|client_secret[^/]*\.json|[^/]+\.key|[^/]+\.pem)$/, reason: "鍵や認証情報" },
  { pattern: /^a11y-agent\//, reason: "削除した旧複製(a11y-agent/)。KB の正本は a11y-migration-kb/" },
];

function git(args) {
  return execFileSync("git", args, { cwd: repoRoot, encoding: "utf8" })
    .split("\0")
    .filter(Boolean);
}

const problems = [];

for (const file of git(["ls-files", "-z", "-ci", "--exclude-standard"])) {
  problems.push({ file, reason: ".gitignore で無視しているのに追跡されている" });
}

for (const file of git(["ls-files", "-z"])) {
  const hit = FORBIDDEN.find(({ pattern }) => pattern.test(file));
  if (hit && !problems.some((problem) => problem.file === file)) {
    problems.push({ file, reason: hit.reason });
  }
}

if (problems.length === 0) {
  console.log("OK: 一時生成物や鍵のファイルは追跡されていない");
  process.exit(0);
}

for (const { file, reason } of problems) {
  // GitHub Actions では ::error 行が注釈として表示される。
  console.log(`::error file=${file}::${reason}: ${file}`);
}
console.log(`\n${problems.length} 件。git rm --cached で追跡から外し、必要なら .gitignore に加える。`);
process.exit(1);

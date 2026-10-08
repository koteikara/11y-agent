// コンテンツパターンの抽出: 巡回の結果から、複数ページで構成されているページ群(サブサイトの候補)を見つけ、
// 順位を付けて xlsx に出す。案件の仕様書で「全ページを調査し、複数ページで構成されているページ群を抽出し、
// サブサイト候補として提案し、コンテンツパターンごとの移行方法定義書を Excel で出す」ことを求められる例がある
// (2026-10-07 ユーザー)。この一覧は、その定義書の下書きにする。移行方法の列は空欄で、ディレクターが書く。
//
// 群は3通りで見つける。
//   1. ディレクトリ: 同じディレクトリの下のページ(1〜3段目)。
//   2. 構造の型: 本体(いちばん多い型)と違う作りのページ(観光、子育てなどの別のデザイン)。
//   3. リンクのまとまり: メニューのように多くのページから張られているリンクを除き、残ったリンクでよく
//      つながっているページ。URL がディレクトリで分かれていないサイト(遠野市の index.cfm/… など)のため。
// 群ごとに、本体と違う作りの割合と、群の中のページどうしのリンクの割合(まとまり)を出し、順位を付ける。
const fs = require("fs");
const path = require("path");
const { clusterByStructure } = require("../lib/structure");
const { buildXlsx } = require("../lib/xlsx");
const { urlKey, isPrintPage, normalizeUrl, ANALYSIS_VERSION } = require("./crawl");

const TEMPLATE_LINK_RATIO = 0.3; // これ以上のページから張られているリンクは、メニューなどのテンプレートのリンクとみなす
const MAX_DIRECTORY_DEPTH = 3;
const LABEL_PROPAGATION_ROUNDS = 15;
const READ_CONCURRENCY = 8;

function readRecords(project, settings) {
  const file = path.join(project.root, "crawl", "records.jsonl");
  if (!fs.existsSync(file)) throw new Error("巡回の結果がありません。先に crawl を動かしてください。");
  const records = new Map();
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    if (!line.trim()) continue;
    const record = JSON.parse(line);
    records.set(record.url, record);
  }
  // URL の順に並べる。記録の順は巡回の到着順で実行ごとに変わり、型の番号や群の結果が変わってしまうため。
  return [...records.values()]
    .filter((record) => record.kind === "page" && record.ok && !record.duplicateOf)
    .filter((record) => !(settings.crawl.excludePrintPages && isPrintPage(new URL(record.url))))
    .sort((a, b) => (a.url < b.url ? -1 : a.url > b.url ? 1 : 0));
}

function directoryPrefixes(url) {
  const { pathname } = new URL(url);
  const segments = pathname.split("/").filter(Boolean);
  // 最後の部分は、ファイルの名前なら外す(末尾が / なら、全部がディレクトリ)。
  const dirs = pathname.endsWith("/") ? segments : segments.slice(0, -1);
  const prefixes = [];
  for (let i = 1; i <= Math.min(dirs.length, MAX_DIRECTORY_DEPTH); i += 1) prefixes.push(`/${dirs.slice(0, i).join("/")}/`);
  return prefixes;
}

// 題名を「|」などで区切り、群の多くのページに共通する部分を、群の名前の手がかりにする。
function commonTitlePart(titles) {
  const counts = new Map();
  for (const title of titles) {
    const parts = new Set(String(title || "").split(/\s*[|｜\-–―:：]\s*/).map((part) => part.trim()).filter((part) => part.length >= 2));
    for (const part of parts) counts.set(part, (counts.get(part) || 0) + 1);
  }
  let best = null;
  for (const [part, count] of counts) {
    if (count < Math.max(2, titles.length * 0.5)) continue;
    if (!best || count > best.count || (count === best.count && part.length < best.part.length)) best = { part, count };
  }
  return best ? best.part : "";
}

// 決まった順で回すラベル伝播。隣のページで多いラベルに合わせる(同数なら小さい番号)。
function linkCommunities(urls, edges) {
  const index = new Map(urls.map((url, i) => [url, i]));
  const neighbors = urls.map(() => new Map());
  for (const [from, to] of edges) {
    const a = index.get(from);
    const b = index.get(to);
    if (a === undefined || b === undefined || a === b) continue;
    neighbors[a].set(b, (neighbors[a].get(b) || 0) + 1);
    neighbors[b].set(a, (neighbors[b].get(a) || 0) + 1);
  }
  const labels = urls.map((_, i) => i);
  for (let round = 0; round < LABEL_PROPAGATION_ROUNDS; round += 1) {
    let changed = 0;
    for (let i = 0; i < urls.length; i += 1) {
      if (!neighbors[i].size) continue;
      const weight = new Map();
      for (const [j, w] of neighbors[i]) weight.set(labels[j], (weight.get(labels[j]) || 0) + w);
      let best = labels[i];
      let bestWeight = -1;
      for (const [label, w] of weight) {
        if (w > bestWeight || (w === bestWeight && label < best)) {
          best = label;
          bestWeight = w;
        }
      }
      if (best !== labels[i]) {
        labels[i] = best;
        changed += 1;
      }
    }
    if (!changed) break;
  }
  const groups = new Map();
  labels.forEach((label, i) => {
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label).push(urls[i]);
  });
  return [...groups.values()];
}

// under を渡すと、その URL の下のページだけで見る。学校ごとのサイトの集まり(大阪市の学校のサイト)のように、
// 1つの巡回に別々のサイトが入っているとき、サイトごとの本体と型を見るため。結果は patterns-<名前>.xlsx に出す。
// URL は、巡回の記録と同じ整え方(ホスト名の小文字、日本語の道の符号化など)にしてから比べる。道の区切りで
// 比べるので、末尾の / の有無は問わず、…/e531060 を渡しても …/e5310601/ は入らない。
function parseScope(value) {
  const normalized = normalizeUrl(value, []);
  if (!normalized) throw new Error(`--under には、http:// か https:// から始まる URL を書く(巡回の一覧 list.csv の URL と同じ書き方): ${value}`);
  const base = normalized.split("?")[0].replace(/\/+$/, "");
  // 一覧の名前は、道と項目を - でつなぐ(日本語の道はそのまま読める形にする)。ファイル名に使えない文字は _ にする。
  const { pathname, search } = new URL(normalized);
  const name =
    decodeURIComponent(pathname + search)
      .split(/[/?&=]+/)
      .filter(Boolean)
      .join("-")
      .replace(/[\\:*"<>|\s]/g, "_") || "root";
  return {
    base,
    name,
    contains: (url) => url === base || url.startsWith(`${base}/`) || url.startsWith(`${base}?`),
  };
}

async function runPatterns(project, { engine, log, report, under = null }) {
  const settings = project.readSettings();
  const minPages = settings.patterns.minPages;
  const proposals = settings.patterns.proposals;
  const scope = under ? parseScope(under) : null;
  const pages = readRecords(project, settings).filter((record) => !scope || scope.contains(record.url));
  if (!pages.length) throw new Error(scope ? `${scope.base} の下に、巡回で取れたページがありません。` : "巡回で取れたページがありません。");
  report(`コンテンツパターン: 巡回で取れたページ ${pages.length} を調べる${scope ? `(${new URL(scope.base).pathname} の下)` : ""}`);

  // ページごとの構造とリンク。調べた結果は crawl/pages/<鍵>/analysis.json に残し、次からは使い回す。
  // 共有ドライブでは、ファイルを1件読むのに時間がかかるので、READ_CONCURRENCY 件まで並べて読む
  // (1件ずつ読むと、1ページに約8秒かかった)。結果は pages の順のまま入れる。
  const analysis = new Map();
  const results = new Array(pages.length);
  let analyzed = 0;
  let failed = 0;
  let next = 0;
  const readJsonAsync = async (file) => {
    try {
      return JSON.parse(await fs.promises.readFile(file, "utf8"));
    } catch {
      return null;
    }
  };
  const lanes = Array.from({ length: READ_CONCURRENCY }, async () => {
    while (next < pages.length) {
      const index = next;
      next += 1;
      const page = pages[index];
      const dir = path.join(project.root, "crawl", "pages", urlKey(page.url));
      const cacheFile = path.join(dir, "analysis.json");
      let cached = await readJsonAsync(cacheFile);
      if (!cached || cached.analysisVersion !== ANALYSIS_VERSION) {
        let html;
        try {
          html = await fs.promises.readFile(path.join(dir, "source.html"), "utf8");
        } catch {
          continue;
        }
        const base = page.finalUrl || page.url;
        // 構造とリンクを、1回の往復で調べる。調べられなかったページは飛ばして数える(巡回の inspect-error と同じ扱い)。
        let result;
        try {
          result = await engine.evaluate(
            async (arg) => ({ structure: await window.batchTools.structureOnly(arg), links: await window.batchTools.pageLinks(arg) }),
            { html, url: base }
          );
        } catch {
          failed += 1;
          continue;
        }
        cached = { analysisVersion: ANALYSIS_VERSION, ...result.structure, links: result.links.links };
        project.queueWrite(cacheFile, JSON.stringify(cached));
        analyzed += 1;
      }
      results[index] = cached;
    }
  });
  await Promise.all(lanes);
  pages.forEach((page, index) => {
    if (results[index]) analysis.set(page.url, results[index]);
  });
  if (failed) report(`  調べられなかったページ: ${failed}(候補の計算から外した)`);
  if (analyzed) report(`  構造とリンクを調べた: ${analyzed} ページ(ほかは前の結果を使った)`);
  const urls = pages.map((page) => page.url).filter((url) => analysis.has(url));
  const pageSet = new Set(urls);
  const byUrl = new Map(pages.map((page) => [page.url, page]));

  // 構造の型。いちばん多い型を本体とする。
  const clusters = clusterByStructure(
    urls.map((url) => ({ id: url, paths: analysis.get(url).structurePaths })),
    settings.templates.similarity
  ).sort((a, b) => b.members.length - a.members.length);
  const typeOf = new Map();
  clusters.forEach((cluster, i) => cluster.members.forEach((member) => typeOf.set(member.id, `型${i + 1}`)));
  const mainType = "型1";

  // リンク。巡回したページどうしのリンクだけを見る。多くのページから張られているリンクはテンプレートとみなして除く。
  const inbound = new Map();
  const outLinks = new Map();
  const inLinks = new Map();
  for (const url of urls) {
    const targets = [...new Set(analysis.get(url).links)].filter((link) => pageSet.has(link) && link !== url);
    outLinks.set(url, targets);
    for (const target of targets) {
      inbound.set(target, (inbound.get(target) || 0) + 1);
      if (!inLinks.has(target)) inLinks.set(target, []);
      inLinks.get(target).push(url);
    }
  }
  const templateLinks = new Set([...inbound.entries()].filter(([, n]) => n >= urls.length * TEMPLATE_LINK_RATIO).map(([url]) => url));
  const contentEdges = [];
  for (const [from, targets] of outLinks) for (const to of targets) if (!templateLinks.has(to)) contentEdges.push([from, to]);

  // 候補の群を集める。
  const groups = [];
  const directoryMembers = new Map();
  for (const url of urls) for (const prefix of directoryPrefixes(url)) {
    if (!directoryMembers.has(prefix)) directoryMembers.set(prefix, []);
    directoryMembers.get(prefix).push(url);
  }
  for (const [prefix, members] of directoryMembers) {
    // ほぼ全部のページを含むディレクトリ(サイト全体が1つの道の下にある場合)は、候補にしない。
    if (members.length >= minPages && members.length < urls.length * 0.9) groups.push({ kind: "ディレクトリ", key: prefix, members });
  }
  clusters.forEach((cluster, i) => {
    if (i === 0 || cluster.members.length < minPages) return;
    groups.push({ kind: "構造の型", key: `型${i + 1}`, members: cluster.members.map((member) => member.id) });
  });
  for (const members of linkCommunities(urls, contentEdges)) {
    // 始まりのページを含む群は、サイト全体の入口の群なので、サブサイトの候補にしない。
    // 範囲を絞ったときは、範囲の入口(渡した URL)を含む群も同じ扱いにする。
    if (members.some((url) => byUrl.get(url).depth === 0 || (scope && (url === scope.base || url === `${scope.base}/`)))) continue;
    if (members.length >= minPages && members.length < urls.length * 0.9) groups.push({ kind: "リンクのまとまり", key: "", members });
  }

  // 群ごとの数。
  const rows = groups.map((group) => {
    const members = new Set(group.members);
    let internal = 0;
    let total = 0;
    const fromOutside = new Map();
    for (const url of group.members) {
      for (const to of outLinks.get(url) || []) {
        if (templateLinks.has(to)) continue;
        total += 1;
        if (members.has(to)) internal += 1;
      }
    }
    // 入口のページは、群の外から多く張られているページ。サブサイトのトップはメニューから全ページに張られて
    // いることが多いので、ここではテンプレートのリンクも数える(除くのは、まとまりの計算だけ)。
    for (const to of group.members) {
      for (const from of inLinks.get(to) || []) if (!members.has(from)) fromOutside.set(to, (fromOutside.get(to) || 0) + 1);
    }
    const sortedMembers = [...group.members].sort((a, b) => (byUrl.get(a).depth ?? 99) - (byUrl.get(b).depth ?? 99) || (a < b ? -1 : 1));
    const entry = [...fromOutside.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || sortedMembers[0];
    const typeCounts = new Map();
    for (const url of group.members) typeCounts.set(typeOf.get(url), (typeCounts.get(typeOf.get(url)) || 0) + 1);
    const mainShare = (typeCounts.get(mainType) || 0) / group.members.length;
    const topType = [...typeCounts.entries()].sort((a, b) => b[1] - a[1])[0][0];
    const cohesion = total ? internal / total : 0;
    const titleHint = commonTitlePart(group.members.map((url) => byUrl.get(url).title));
    return {
      kind: group.kind,
      key: group.key || titleHint || new URL(entry).pathname,
      pages: group.members.length,
      topType,
      differentShare: Number((1 - mainShare).toFixed(2)),
      cohesion: Number(cohesion.toFixed(2)),
      entry,
      entryTitle: byUrl.get(entry)?.title || "",
      titleHint,
      examples: sortedMembers.slice(0, 3),
      members: group.members,
      // 本体と違う作りであるほど、群の中でリンクし合うほど、サブサイトらしいとみなす。
      score: Number((0.5 * (1 - mainShare) + 0.5 * cohesion).toFixed(3)),
    };
  });

  // 同じページの集まりを2通りで見つけたときは、1つにまとめる(見つけ方を並べる)。
  const merged = [];
  for (const row of rows.sort((a, b) => b.score - a.score || b.pages - a.pages)) {
    const same = merged.find((other) => {
      const a = new Set(other.members);
      const overlap = row.members.filter((url) => a.has(url)).length;
      return overlap / Math.max(a.size, row.members.length) >= 0.9;
    });
    if (same) {
      if (!same.kind.includes(row.kind)) same.kind += `、${row.kind}`;
      continue;
    }
    merged.push({ ...row });
  }
  merged.forEach((row, i) => {
    row.rank = i + 1;
    row.proposed = i < proposals;
  });

  const candidateOf = new Map();
  for (const row of merged) for (const url of row.members) if (!candidateOf.has(url)) candidateOf.set(url, row.rank);

  const outDir = path.join(project.root, "crawl");
  const outBase = scope ? `patterns-${scope.name}` : "patterns";
  project.writeJson(path.join(outDir, `${outBase}.json`), {
    generatedAt: new Date().toISOString(),
    pages: urls.length,
    types: clusters.map((cluster, i) => ({ type: `型${i + 1}`, pages: cluster.members.length })),
    templateLinks: templateLinks.size,
    candidates: merged.map(({ members, ...row }) => ({ ...row, memberCount: members.length })),
  });
  // ページごとの構造の型と、入っている候補の順位(いちばん上の候補)。移行管理シートの下書きが、
  // 「パターン」(レイアウトをそろえる群)の案に使う。候補の一覧とは分けて置く(ページの数だけ大きくなるため)。
  project.writeJson(
    path.join(outDir, `${outBase}-pages.json`),
    Object.fromEntries(urls.map((url) => [url, { type: typeOf.get(url) || null, candidate: candidateOf.get(url) ?? null }]))
  );

  const candidateRows = [
    [
      "順位",
      "提案",
      "候補",
      "見つけ方",
      "ページ数",
      "主な構造の型",
      "本体と違う作りの割合",
      "群の中のリンクの割合",
      "入口のページ",
      "入口のページの題名",
      "例1",
      "例2",
      "例3",
      "移行方法",
      "備考",
    ],
  ];
  for (const row of merged) {
    candidateRows.push([
      row.rank,
      row.proposed ? "サブサイト候補" : "",
      row.key,
      row.kind,
      row.pages,
      row.topType,
      row.differentShare,
      row.cohesion,
      row.entry,
      row.entryTitle,
      row.examples[0] || "",
      row.examples[1] || "",
      row.examples[2] || "",
      "",
      "",
    ]);
  }
  const pageRows = [["URL", "タイトル", "階層", "構造の型", "候補の順位"]];
  for (const url of [...urls].sort()) {
    const page = byUrl.get(url);
    pageRows.push([url, page.title || "", page.depth ?? "", typeOf.get(url) || "", candidateOf.get(url) ?? ""]);
  }
  const typeRows = [["構造の型", "ページ数", "例"]];
  clusters.forEach((cluster, i) => typeRows.push([`型${i + 1}${i === 0 ? "(本体)" : ""}`, cluster.members.length, cluster.members[0].id]));

  const xlsxFile = path.join(outDir, `${outBase}.xlsx`);
  project.writeFileAtomic(
    xlsxFile,
    buildXlsx([
      { name: "サブサイト候補", rows: candidateRows, widths: [6, 14, 28, 22, 9, 12, 12, 12, 50, 30, 50, 50, 50, 30, 30] },
      { name: "ページ", rows: pageRows, widths: [70, 40, 6, 10, 10] },
      { name: "構造の型", rows: typeRows, widths: [16, 10, 70] },
    ])
  );
  await project.flush();
  log.write({ result: "ok", pages: urls.length, candidates: merged.length, types: clusters.length });

  report(`  構造の型 ${clusters.length}(本体 ${clusters[0]?.members.length || 0} ページ)、テンプレートとみなしたリンク ${templateLinks.size}`);
  report(`  候補 ${merged.length}(${minPages} ページ以上)。上位 ${Math.min(proposals, merged.length)} をサブサイト候補とした`);
  for (const row of merged.slice(0, Math.max(proposals, 5))) {
    report(`  ${row.rank}. ${row.kind} ${row.pages} ページ 違う作り ${row.differentShare} まとまり ${row.cohesion}`);
  }
  report(`  一覧: ${path.relative(project.root, xlsxFile)}`);
  return merged;
}

module.exports = { runPatterns, commonTitlePart, linkCommunities };

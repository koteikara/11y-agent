// KB rule search evaluation: char-bigram BM25 baseline vs embeddings (vs hybrid).
// usage:
//   node eval.mjs                                           BM25 only
//   node eval.mjs <ollamaModel>                             embeddings via Ollama (localhost:11434)
//   LLAMA_URL=http://127.0.0.1:8080 node eval.mjs <alias>   embeddings via llama-server
// How the 2026-10-07 run was set up: ../embeddinggemma2-kb-search-2026-10.md
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const rules = fs.readFileSync(path.join(here, "../../goal2-app/data/rules.jsonl"), "utf8")
  .trim().split("\n").map((l) => JSON.parse(l));
const queries = JSON.parse(fs.readFileSync(path.join(here, "queries.json"), "utf8"));
const model = process.argv[2];

const docText = (r) => [r.title, r.description, r.rule, ...(r.examples || []).map((e) => [e.case, e.before, e.after].join(" "))].join(" ");

// --- BM25 over character bigrams ---
const norm = (s) => s.normalize("NFKC").toLowerCase().replace(/\s+/g, "");
const grams = (s) => { const t = norm(s); const g = []; for (let i = 0; i < t.length - 1; i++) g.push(t.slice(i, i + 2)); return g; };
const docs = rules.map((r) => grams(docText(r)));
const avgdl = docs.reduce((s, d) => s + d.length, 0) / docs.length;
const df = new Map();
docs.forEach((d) => new Set(d).forEach((g) => df.set(g, (df.get(g) || 0) + 1)));
const tfs = docs.map((d) => d.reduce((m, g) => m.set(g, (m.get(g) || 0) + 1), new Map()));
function bm25(q) {
  const qg = [...new Set(grams(q))];
  return tfs.map((tf, i) => qg.reduce((s, g) => {
    const f = tf.get(g) || 0; if (!f) return s;
    const idf = Math.log(1 + (rules.length - df.get(g) + 0.5) / (df.get(g) + 0.5));
    return s + idf * (f * 2.2) / (f + 1.2 * (0.25 + 0.75 * docs[i].length / avgdl));
  }, 0));
}

// --- embeddings via Ollama ---
// LLAMA_URL set -> llama-server (OpenAI-compatible), otherwise Ollama
async function embed(input) {
  const llama = process.env.LLAMA_URL;
  const res = await fetch(llama ? `${llama}/v1/embeddings` : "http://localhost:11434/api/embed", {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ model, input }),
  });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  const body = await res.json();
  return llama ? body.data.sort((a, b) => a.index - b.index).map((d) => d.embedding) : body.embeddings;
}
const cos = (a, b) => { let d = 0, x = 0, y = 0; for (let i = 0; i < a.length; i++) { d += a[i] * b[i]; x += a[i] ** 2; y += b[i] ** 2; } return d / Math.sqrt(x * y); };

const rank = (scores) => scores.map((s, i) => [i, s]).sort((a, b) => b[1] - a[1]).map(([i]) => i);
const rrf = (...rankings) => {
  const s = new Array(rules.length).fill(0);
  rankings.forEach((r) => r.forEach((idx, pos) => { s[idx] += 1 / (60 + pos); }));
  return rank(s);
};

const methods = { bm25: [] };
let docVecs;
if (model) {
  const t0 = Date.now();
  docVecs = await embed(rules.map((r) => `title: ${r.title} | text: ${docText(r)}`));
  console.log(`doc embedding: ${rules.length} rules in ${Date.now() - t0} ms`);
  methods.embed = []; methods.hybrid = [];
}

const qTimes = [];
for (const item of queries) {
  const b = rank(bm25(item.q));
  methods.bm25.push(b);
  if (model) {
    const t0 = Date.now();
    const [qv] = await embed([`task: search result | query: ${item.q}`]);
    qTimes.push(Date.now() - t0);
    const e = rank(docVecs.map((d) => cos(qv, d)));
    methods.embed.push(e);
    methods.hybrid.push(rrf(b, e));
  }
}

const hitAt = (ranking, item, k) => ranking.slice(0, k).some((i) => item.a.includes(rules[i].id));
const report = [];
for (const [name, rankings] of Object.entries(methods)) {
  for (const level of ["all", "easy", "hard"]) {
    const idx = queries.map((q, i) => i).filter((i) => level === "all" || queries[i].level === level);
    const pct = (k) => (100 * idx.filter((i) => hitAt(rankings[i], queries[i], k)).length / idx.length).toFixed(0) + "%";
    report.push({ method: name, level, n: idx.length, top1: pct(1), top3: pct(3), top5: pct(5) });
  }
}
console.table(report);
if (qTimes.length) {
  qTimes.sort((a, b) => a - b);
  console.log(`query latency ms: median ${qTimes[Math.floor(qTimes.length / 2)]}, max ${qTimes.at(-1)}`);
}
// misses at top3
for (const [name, rankings] of Object.entries(methods)) {
  const miss = queries.map((q, i) => [q, rankings[i]]).filter(([q, r]) => !hitAt(r, q, 3));
  console.log(`\n[${name}] top3 miss ${miss.length}:`);
  miss.forEach(([q, r]) => console.log(`  ${q.q} -> ${r.slice(0, 3).map((i) => rules[i].id).join(", ")} (want ${q.a.join("/")})`));
}

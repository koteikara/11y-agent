"use strict";

const fs = require("fs");
const path = require("path");
const { visibleText } = require("./sagaAutoFix");

function listSagaSamples(fixtureRoot, options = {}) {
  const limit = Math.max(1, Math.min(50, Number(options.limit || 10)));
  const seed = String(options.seed || "goal2-saga-sample-v1");
  const oldDir = path.join(fixtureRoot, "old");
  const goldDir = path.join(fixtureRoot, "gold");
  const files = fs
    .readdirSync(oldDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".html"))
    .map((entry) => entry.name)
    .sort();

  const selected = files
    .map((fileName) => ({
      fileName,
      score: hashText(`${seed}|${fileName}`),
    }))
    .sort((a, b) => a.score - b.score || a.fileName.localeCompare(b.fileName))
    .slice(0, limit)
    .map(({ fileName }) => buildSagaSample(oldDir, goldDir, fileName));

  return {
    fixture_root: fixtureRoot,
    seed,
    total: files.length,
    limit,
    samples: selected,
  };
}

function buildSagaSample(oldDir, goldDir, fileName) {
  const oldPath = path.join(oldDir, fileName);
  const html = fs.readFileSync(oldPath, "utf8");
  const baseName = path.basename(fileName, ".html");
  const title = extractTitle(html) || baseName;
  return {
    id: `saga-${baseName}`,
    label: `佐賀市: ${truncateLabel(title)} (${baseName})`,
    pageTitle: title,
    oldUrl: `https://www.city.saga.lg.jp/${baseName}.html`,
    cmsTarget: "佐賀市サンプル > old",
    html,
    fixture: {
      old_file: fileName,
      gold_file: fs.existsSync(path.join(goldDir, fileName)) ? fileName : null,
    },
  };
}

function extractTitle(html) {
  const heading = String(html || "").match(/<h[1-6]\b[^>]*>([\s\S]*?)<\/h[1-6]>/i);
  if (heading) {
    return normalizeText(visibleText(heading[1]));
  }
  const firstParagraph = String(html || "").match(/<p\b[^>]*>([\s\S]*?)<\/p>/i);
  return firstParagraph ? normalizeText(visibleText(firstParagraph[1])) : "";
}

function truncateLabel(text) {
  const normalized = normalizeText(text);
  return normalized.length > 32 ? `${normalized.slice(0, 32)}...` : normalized;
}

function normalizeText(text) {
  return String(text || "").replace(/\s+/g, " ").trim();
}

function hashText(value) {
  let hash = 2166136261;
  for (const char of String(value || "")) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

module.exports = {
  listSagaSamples,
};

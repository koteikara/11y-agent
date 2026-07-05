"use strict";

const fs = require("fs");
const path = require("path");
const { defaultSagaFixtureRoot, textSimilarity, visibleText } = require("./sagaAutoFix");

const DEFAULT_REPORT_LIMIT = 24;

function learnSagaGoldHints(fixtureRoot = defaultFixtureRoot(), options = {}) {
  const pairs = readFixturePairs(fixtureRoot);
  const files = pairs.map((pair) => {
    const hints = learnGoldHintsForPair(pair.oldHtml, pair.goldHtml, pair.file);
    return {
      file: pair.file,
      hints,
      hintCount: hints.length,
    };
  });
  const allHints = files.flatMap((file) => file.hints);

  return {
    fixtureRoot,
    totals: {
      files: files.length,
      filesWithHints: files.filter((file) => file.hintCount > 0).length,
      hints: allHints.length,
    },
    summary: {
      byRule: countBy(allHints, "rule_id"),
      byDecision: countBy(allHints, "decision_hint"),
      byConfidence: countBy(allHints, "confidence"),
      byRuleAndDecision: countBy(allHints, (hint) => `${hint.rule_id}:${hint.decision_hint}`),
    },
    files,
    examples: selectExamples(allHints, options.limit || DEFAULT_REPORT_LIMIT),
  };
}

function learnGoldHintsForPair(oldHtml, goldHtml, file = "inline") {
  const hints = [
    ...learnHeadingHints(oldHtml, goldHtml, file),
    ...learnPseudoListHints(oldHtml, goldHtml, file),
    ...learnLinkHints(oldHtml, goldHtml, file),
    ...learnImageHints(oldHtml, goldHtml, file),
    ...learnTableHints(oldHtml, goldHtml, file),
  ];
  return dedupeHints(hints).sort(compareHints);
}

function learnHeadingHints(oldHtml, goldHtml, file) {
  const oldHeadings = extractHeadings(oldHtml);
  const goldHeadings = extractHeadings(goldHtml);
  const hints = [];
  const usedGold = new Set();

  for (const oldHeading of oldHeadings) {
    const match = bestTextMatch(oldHeading, goldHeadings, usedGold, 0.92);
    if (!match || oldHeading.level === match.level) {
      continue;
    }
    usedGold.add(match.index);
    hints.push(
      makeHint({
        file,
        ruleId: "html-structure.heading-order",
        targetKind: "heading",
        targetIndex: oldHeading.index,
        decisionHint: "accepted",
        confidence: match.score >= 0.99 ? "high" : "medium",
        before: `h${oldHeading.level}: ${truncate(oldHeading.text)}`,
        gold: `h${match.level}: ${truncate(match.text)}`,
        suggestion: `Use h${match.level} for this heading when the same text appears in gold.`,
        evidence: "Gold keeps the same heading text but changes the heading level.",
      })
    );
  }

  return hints;
}

function learnPseudoListHints(oldHtml, goldHtml, file) {
  const oldLists = extractPseudoLists(oldHtml);
  const goldItems = extractListItems(goldHtml);
  const hints = [];

  for (const list of oldLists) {
    const matched = countMatchedTexts(list.items, goldItems, 0.86);
    const ratio = matched / Math.max(1, list.items.length);
    const supported = list.items.length >= 2 && matched >= 2 && ratio >= 0.67;
    hints.push(
      makeHint({
        file,
        ruleId: "text.list",
        targetKind: "pseudo-list",
        targetIndex: list.index,
        decisionHint: supported ? "accepted" : "needs_review",
        confidence: supported && ratio >= 0.9 ? "high" : supported ? "medium" : "low",
        before: truncate(list.items.join(" / ")),
        gold: supported ? `${matched}/${list.items.length} items appear as list items in gold.` : "No stable gold list match.",
        suggestion: supported
          ? "Convert the middle-dot pseudo list to ul/li."
          : "Show the list candidate, but require human confirmation before applying.",
        evidence: supported
          ? "Gold represents the same item texts with li elements."
          : "Gold does not clearly confirm the pseudo-list conversion.",
      })
    );
  }

  return hints;
}

function learnLinkHints(oldHtml, goldHtml, file) {
  const oldLinks = extractAnchors(oldHtml);
  const goldLinks = extractAnchors(goldHtml);
  const hints = [];

  for (const oldLink of oldLinks) {
    if (!isWeakLinkText(oldLink.text)) {
      continue;
    }
    const match = bestLinkMatch(oldLink, goldLinks);
    if (match && !isWeakLinkText(match.text)) {
      hints.push(
        makeHint({
          file,
          ruleId: "link.link-text",
          targetKind: "link",
          targetIndex: oldLink.index,
          decisionHint: "edited",
          confidence: match.hrefScore >= 1 ? "high" : "medium",
          before: truncate(oldLink.text || oldLink.href),
          gold: truncate(match.text),
          suggestion: `Use the gold link text as the edit draft: ${truncate(match.text)}`,
          evidence: "Gold replaces a weak link label with descriptive link text for the same or closest link.",
        })
      );
    } else if (match && isWeakLinkText(match.text)) {
      hints.push(
        makeHint({
          file,
          ruleId: "link.link-text",
          targetKind: "link",
          targetIndex: oldLink.index,
          decisionHint: "needs_review",
          confidence: "low",
          before: truncate(oldLink.text || oldLink.href),
          gold: truncate(match.text),
          suggestion: "Do not auto-apply a descriptive label; gold does not provide a better label.",
          evidence: "Gold keeps a weak or generic link label.",
        })
      );
    } else {
      hints.push(
        makeHint({
          file,
          ruleId: "link.link-text",
          targetKind: "link",
          targetIndex: oldLink.index,
          decisionHint: "needs_review",
          confidence: "low",
          before: truncate(oldLink.text || oldLink.href),
          gold: "No matching gold link.",
          suggestion: "Present the candidate and ask the worker to identify the destination page name.",
          evidence: "The old/gold pair does not provide a stable link-text correction.",
        })
      );
    }
  }

  return hints;
}

function learnImageHints(oldHtml, goldHtml, file) {
  const oldImages = extractImages(oldHtml);
  const goldImages = extractImages(goldHtml);
  const hints = [];

  oldImages.forEach((oldImage, index) => {
    const match = bestImageMatch(oldImage, goldImages, index);
    if (!match || !match.alt) {
      return;
    }
    const oldGeneric = isGenericImageAlt(oldImage.alt);
    const goldGeneric = isGenericImageAlt(match.alt);
    const altChanged = normalizeComparableText(oldImage.alt) !== normalizeComparableText(match.alt);
    if ((oldGeneric || altChanged) && !goldGeneric) {
      hints.push(
        makeHint({
          file,
          ruleId: "image.alt-text",
          targetKind: "image",
          targetIndex: oldImage.index,
          decisionHint: "edited",
          confidence: oldImage.srcKey && oldImage.srcKey === match.srcKey ? "high" : "medium",
          before: oldImage.alt ? truncate(oldImage.alt) : "(empty alt)",
          gold: truncate(match.alt),
          suggestion: `Use the gold alt text as the image-name draft: ${truncate(match.alt)}`,
          evidence: "Gold provides a concrete alt text for the same or same-position image.",
        })
      );
    }
  });

  return hints;
}

function learnTableHints(oldHtml, goldHtml, file) {
  const oldTables = extractTables(oldHtml);
  const goldTables = extractTables(goldHtml);
  const goldTextOutsideTables = normalizeComparableText(stripTables(goldHtml));
  const hints = [];
  const usedGold = new Set();

  for (const oldTable of oldTables) {
    const match = bestTableMatch(oldTable, goldTables, usedGold);
    if (match && match.score >= 0.62) {
      usedGold.add(match.table.index);
      addMatchedTableHints(hints, file, oldTable, match.table, match.score);
      continue;
    }

    const outsideCoverage = textCoverage(oldTable.text, goldTextOutsideTables);
    const layoutLike = looksLikeLayoutTable(oldTable);
    if (layoutLike && outsideCoverage >= 0.45) {
      hints.push(
        makeHint({
          file,
          ruleId: "table.layout-table",
          targetKind: "table",
          targetIndex: oldTable.index,
          decisionHint: "accepted",
          confidence: outsideCoverage >= 0.72 ? "high" : "medium",
          before: tableSummary(oldTable),
          gold: `Table text appears outside gold tables (coverage ${round(outsideCoverage)}).`,
          suggestion: "Decompose the layout table and rebuild the content as body text/images.",
          evidence: "Gold no longer has a matching table, but keeps the same content outside table markup.",
        })
      );
    } else if (!match || match.score < 0.4) {
      hints.push(
        makeHint({
          file,
          ruleId: "table.layout-table",
          targetKind: "table",
          targetIndex: oldTable.index,
          decisionHint: "needs_review",
          confidence: "low",
          before: tableSummary(oldTable),
          gold: match ? `Closest table similarity ${round(match.score)}.` : "No matching gold table.",
          suggestion: "Show the table candidate, but require human selection because gold does not clearly confirm decomposition.",
          evidence: "Old/gold table correspondence is ambiguous.",
        })
      );
    }
  }

  return hints;
}

function addMatchedTableHints(hints, file, oldTable, goldTable, score) {
  const confidence = score >= 0.85 ? "high" : "medium";

  if (!oldTable.hasCaption && goldTable.hasCaption) {
    hints.push(
      makeHint({
        file,
        ruleId: "table.caption",
        targetKind: "table",
        targetIndex: oldTable.index,
        decisionHint: "edited",
        confidence,
        before: tableSummary(oldTable),
        gold: `caption: ${truncate(goldTable.caption)}`,
        suggestion: `Insert a caption draft based on gold: ${truncate(goldTable.caption)}`,
        evidence: "Gold keeps a matching table and adds a caption.",
      })
    );
  }

  if (!oldTable.hasHeaders && goldTable.hasHeaders) {
    hints.push(
      makeHint({
        file,
        ruleId: "table.layout-table",
        targetKind: "table",
        targetIndex: oldTable.index,
        decisionHint: "rejected",
        confidence,
        before: tableSummary(oldTable),
        gold: tableSummary(goldTable),
        suggestion: "Do not select the layout-table decomposition candidate; gold keeps this as a data table.",
        evidence: "Gold retains a matching table and improves header/scope structure instead of decomposing it.",
      })
    );
  }

  if (oldTable.hasImage && goldTable.hasImage) {
    hints.push(
      makeHint({
        file,
        ruleId: "image.image-text-layout",
        targetKind: "table",
        targetIndex: oldTable.index,
        decisionHint: "needs_review",
        confidence: "medium",
        before: tableSummary(oldTable),
        gold: tableSummary(goldTable),
        suggestion: "Keep the candidate visible, but do not infer a fixed decision from gold alone.",
        evidence: "Gold still contains an image in a matching table, so image/text layout treatment is case-specific.",
      })
    );
  }
}

function readFixturePairs(fixtureRoot) {
  const oldDir = path.join(fixtureRoot, "old");
  const goldDir = path.join(fixtureRoot, "gold");
  const files = fs
    .readdirSync(oldDir)
    .filter((name) => name.toLowerCase().endsWith(".html"))
    .filter((name) => fs.existsSync(path.join(goldDir, name)))
    .sort();

  return files.map((file) => ({
    file,
    oldHtml: fs.readFileSync(path.join(oldDir, file), "utf8"),
    goldHtml: fs.readFileSync(path.join(goldDir, file), "utf8"),
  }));
}

function extractHeadings(html) {
  const headings = [];
  String(html || "").replace(/<(h[1-6])\b[^>]*>([\s\S]*?)<\/\1>/gi, (match, tag, inner) => {
    const text = normalizeComparableText(inner);
    if (text) {
      headings.push({
        index: headings.length,
        level: Number(tag.slice(1)),
        text,
        html: match,
      });
    }
    return "";
  });
  return headings;
}

function extractPseudoLists(html) {
  const lists = [];
  String(html || "").replace(/<(p|div)\b[^>]*>([\s\S]*?)<\/\1>/gi, (match, tag, inner) => {
    if (tag.toLowerCase() === "div" && /<(p|div|table|ul|ol|dl|h[1-6]|figure|iframe|img)\b/i.test(inner)) {
      return "";
    }
    const items = pseudoListItems(inner);
    if (items.length >= 2) {
      lists.push({
        index: lists.length,
        items,
        text: items.join(" "),
        html: match,
      });
    }
    return "";
  });
  return lists;
}

function pseudoListItems(innerHtml) {
  const parts = String(innerHtml || "")
    .split(/<br\s*\/?>|\r?\n/i)
    .map((part) => normalizeComparableText(part))
    .filter(Boolean);

  const lineItems = parts.filter(isBulletLine).map(removeBulletPrefix).filter(Boolean);
  if (lineItems.length >= 2) {
    return lineItems;
  }

  const text = normalizeComparableText(innerHtml);
  const bulletPattern = /(?=(?:・|･|繝ｻ|●|○|■|□|◆|◇|▲|△|\*|-)\s*)/g;
  const inlineItems = text
    .split(bulletPattern)
    .map((part) => removeBulletPrefix(part.trim()))
    .filter(Boolean);
  return inlineItems.length >= 2 ? inlineItems : [];
}

function extractListItems(html) {
  const items = [];
  String(html || "").replace(/<li\b[^>]*>([\s\S]*?)<\/li>/gi, (_match, inner) => {
    const text = normalizeComparableText(inner);
    if (text) {
      items.push(text);
    }
    return "";
  });
  return items;
}

function extractAnchors(html) {
  const links = [];
  String(html || "").replace(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi, (match, attrs, inner) => {
    links.push({
      index: links.length,
      href: attrValue(attrs, "href") || "",
      hrefKey: hrefKey(attrValue(attrs, "href") || ""),
      text: normalizeComparableText(inner),
      html: match,
    });
    return "";
  });
  return links;
}

function extractImages(html) {
  const images = [];
  String(html || "").replace(/<img\b([^>]*)>/gi, (match, attrs) => {
    const src = attrValue(attrs, "src") || "";
    images.push({
      index: images.length,
      src,
      srcKey: srcKey(src),
      alt: normalizeComparableText(attrValue(attrs, "alt") || ""),
      title: normalizeComparableText(attrValue(attrs, "title") || ""),
      html: match,
    });
    return "";
  });
  return images;
}

function extractTables(html) {
  const tables = [];
  String(html || "").replace(/<table\b([^>]*)>([\s\S]*?)<\/table>/gi, (match, attrs, inner) => {
    const rows = extractRows(inner);
    const cells = rows.flatMap((row) => row.cells);
    const caption = extractFirstText(inner, /<caption\b[^>]*>([\s\S]*?)<\/caption>/i);
    tables.push({
      index: tables.length,
      attrs,
      inner,
      html: match,
      text: normalizeComparableText(match),
      caption,
      hasCaption: Boolean(caption),
      hasThead: /<thead\b/i.test(inner),
      hasHeaders: /<th\b/i.test(inner) || /\bscope=(["'])(row|col)\1/i.test(inner),
      hasScope: /\bscope=(["'])(row|col)\1/i.test(inner),
      hasMerge: /\b(rowspan|colspan)=/i.test(inner),
      hasImage: /<img\b/i.test(inner),
      hasIframe: /<iframe\b/i.test(inner),
      rows: rows.length,
      cells: cells.length,
      maxCols: rows.reduce((max, row) => Math.max(max, row.cells.length), 0),
    });
    return "";
  });
  return tables;
}

function extractRows(tableInner) {
  const rows = [];
  String(tableInner || "").replace(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi, (_match, rowInner) => {
    const cells = [];
    rowInner.replace(/<(td|th)\b([^>]*)>([\s\S]*?)<\/\1>/gi, (cellMatch, tag, attrs, inner) => {
      cells.push({
        tag: tag.toLowerCase(),
        attrs,
        text: normalizeComparableText(inner),
        html: cellMatch,
      });
      return "";
    });
    rows.push({ cells });
    return "";
  });
  return rows;
}

function bestTextMatch(item, candidates, used, minScore) {
  let best = null;
  for (const candidate of candidates) {
    if (used?.has(candidate.index)) {
      continue;
    }
    const score = textSimilarity(item.text, candidate.text);
    if (score >= minScore && (!best || score > best.score)) {
      best = { ...candidate, score };
    }
  }
  return best;
}

function bestLinkMatch(oldLink, goldLinks) {
  let best = null;
  for (const goldLink of goldLinks) {
    const hrefScore = linkHrefScore(oldLink, goldLink);
    const textScore = textSimilarity(oldLink.text, goldLink.text);
    const score = hrefScore * 2 + textScore;
    if (hrefScore > 0 || textScore >= 0.82) {
      if (!best || score > best.score) {
        best = { ...goldLink, hrefScore, score };
      }
    }
  }
  return best;
}

function bestImageMatch(oldImage, goldImages, oldIndex) {
  let best = null;
  for (const goldImage of goldImages) {
    let score = 0;
    if (oldImage.srcKey && oldImage.srcKey === goldImage.srcKey) {
      score += 3;
    }
    if (oldIndex === goldImage.index) {
      score += 1;
    }
    if (score > 0 && (!best || score > best.score)) {
      best = { ...goldImage, score };
    }
  }
  return best;
}

function bestTableMatch(oldTable, goldTables, usedGold) {
  let best = null;
  for (const goldTable of goldTables) {
    if (usedGold?.has(goldTable.index)) {
      continue;
    }
    const score = textSimilarity(oldTable.text, goldTable.text);
    if (!best || score > best.score) {
      best = { table: goldTable, score };
    }
  }
  return best;
}

function looksLikeLayoutTable(table) {
  const attrs = String(table.attrs || "");
  const styleHints = /border\s*:\s*0|border=(["'])0\1|cellpadding=|cellspacing=|width\s*:/i.test(attrs);
  const compactNoHeaders = !table.hasHeaders && table.rows <= 4 && table.maxCols <= 3;
  return Boolean((table.hasImage && compactNoHeaders) || (styleHints && compactNoHeaders) || (table.hasIframe && compactNoHeaders));
}

function textCoverage(sourceText, targetText) {
  const sourceTokens = tokenSet(sourceText);
  if (!sourceTokens.size) {
    return 0;
  }
  const targetTokens = tokenSet(targetText);
  let matched = 0;
  for (const token of sourceTokens) {
    if (targetTokens.has(token)) {
      matched += 1;
    }
  }
  return matched / sourceTokens.size;
}

function countMatchedTexts(items, targets, minScore) {
  let matched = 0;
  const used = new Set();
  for (const item of items) {
    let bestIndex = -1;
    let bestScore = 0;
    targets.forEach((target, index) => {
      if (used.has(index)) {
        return;
      }
      const score = textSimilarity(item, target);
      if (score > bestScore) {
        bestScore = score;
        bestIndex = index;
      }
    });
    if (bestScore >= minScore && bestIndex >= 0) {
      used.add(bestIndex);
      matched += 1;
    }
  }
  return matched;
}

function dedupeHints(hints) {
  const seen = new Set();
  return hints.filter((hint) => {
    const key = [hint.file, hint.rule_id, hint.target.kind, hint.target.index, hint.decision_hint, hint.suggestion].join("|");
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function compareHints(a, b) {
  const fileCompare = a.file.localeCompare(b.file);
  if (fileCompare) {
    return fileCompare;
  }
  return a.target.index - b.target.index || a.rule_id.localeCompare(b.rule_id);
}

function makeHint(options) {
  return {
    file: options.file,
    rule_id: options.ruleId,
    target: {
      kind: options.targetKind,
      index: options.targetIndex,
    },
    decision_hint: options.decisionHint,
    confidence: options.confidence,
    learned_from: "saga-old-gold-diff",
    before: options.before,
    gold: options.gold,
    suggestion: options.suggestion,
    evidence: options.evidence,
  };
}

function selectExamples(hints, limit) {
  const priority = { high: 0, medium: 1, low: 2 };
  return [...hints]
    .sort((a, b) => {
      const confidence = (priority[a.confidence] ?? 9) - (priority[b.confidence] ?? 9);
      if (confidence) return confidence;
      return a.file.localeCompare(b.file) || a.rule_id.localeCompare(b.rule_id);
    })
    .slice(0, limit);
}

function countBy(items, keyOrFn) {
  const counts = {};
  for (const item of items) {
    const key = typeof keyOrFn === "function" ? keyOrFn(item) : item[keyOrFn];
    counts[key] = (counts[key] || 0) + 1;
  }
  return Object.fromEntries(Object.entries(counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])));
}

function formatTextReport(report, options = {}) {
  const limit = options.limit || DEFAULT_REPORT_LIMIT;
  const lines = [];
  lines.push(`Saga gold learning root: ${report.fixtureRoot}`);
  lines.push(`Files: ${report.totals.files}`);
  lines.push(`Files with hints: ${report.totals.filesWithHints}`);
  lines.push(`Candidate decision hints: ${report.totals.hints}`);
  lines.push("");
  lines.push("Decision hints:");
  appendCounts(lines, report.summary.byDecision);
  lines.push("");
  lines.push("Rule hints:");
  appendCounts(lines, report.summary.byRule);
  lines.push("");
  lines.push(`Examples (top ${Math.min(limit, report.examples.length)}):`);
  for (const hint of report.examples.slice(0, limit)) {
    lines.push(
      `  ${hint.file} [${hint.decision_hint}/${hint.confidence}] ${hint.rule_id} ${hint.target.kind}#${hint.target.index}: ${hint.suggestion}`
    );
  }
  return lines.join("\n");
}

function formatMarkdownReport(report, options = {}) {
  const limit = options.limit || DEFAULT_REPORT_LIMIT;
  const lines = [];
  lines.push("# Saga Gold Candidate Decision Hints");
  lines.push("");
  lines.push(`- Fixture root: \`${report.fixtureRoot}\``);
  lines.push(`- Files: ${report.totals.files}`);
  lines.push(`- Files with hints: ${report.totals.filesWithHints}`);
  lines.push(`- Candidate decision hints: ${report.totals.hints}`);
  lines.push("");
  lines.push("## Decision Hints");
  appendMarkdownCounts(lines, report.summary.byDecision);
  lines.push("");
  lines.push("## Rule Hints");
  appendMarkdownCounts(lines, report.summary.byRule);
  lines.push("");
  lines.push(`## Examples`);
  for (const hint of report.examples.slice(0, limit)) {
    lines.push(
      `- \`${hint.file}\` \`${hint.rule_id}\` ${hint.decision_hint}/${hint.confidence}: ${hint.suggestion}`
    );
    lines.push(`  - Evidence: ${hint.evidence}`);
    lines.push(`  - Before: ${hint.before}`);
    lines.push(`  - Gold: ${hint.gold}`);
  }
  return lines.join("\n");
}

function appendCounts(lines, counts) {
  for (const [key, value] of Object.entries(counts)) {
    lines.push(`  ${key}: ${value}`);
  }
}

function appendMarkdownCounts(lines, counts) {
  for (const [key, value] of Object.entries(counts)) {
    lines.push(`- \`${key}\`: ${value}`);
  }
}

function tableSummary(table) {
  const flags = [
    `${table.rows} rows`,
    `${table.maxCols} cols`,
    table.hasCaption ? "caption" : "no caption",
    table.hasHeaders ? "headers" : "no headers",
    table.hasMerge ? "merged cells" : "",
    table.hasImage ? "image" : "",
  ].filter(Boolean);
  return `${flags.join(", ")}; text=${truncate(table.text)}`;
}

function stripTables(html) {
  return String(html || "").replace(/<table\b[^>]*>[\s\S]*?<\/table>/gi, " ");
}

function extractFirstText(html, regex) {
  const match = String(html || "").match(regex);
  return match ? normalizeComparableText(match[1]) : "";
}

function isBulletLine(text) {
  return /^(?:・|･|繝ｻ|●|○|■|□|◆|◇|▲|△|\*|-)\s*/.test(normalizeComparableText(text));
}

function removeBulletPrefix(text) {
  return normalizeComparableText(text).replace(/^(?:・|･|繝ｻ|●|○|■|□|◆|◇|▲|△|\*|-)\s*/, "").trim();
}

function isWeakLinkText(text) {
  const compact = normalizeComparableText(text).replace(/\s+/g, "").toLowerCase();
  return /^(こちら|ここ|詳細|詳細はこちら|詳しくはこちら|クリックしてください|clickhere|here|more|縺薙■繧・|隧ｳ邏ｰ縺ｯ縺薙■繧・|繧ｯ繝ｪ繝・け縺励※縺上□縺輔＞)$/.test(compact);
}

function isGenericImageAlt(text) {
  const normalized = normalizeComparableText(text).toLowerCase();
  if (!normalized) {
    return true;
  }
  return /^(画像|写真|イラスト|図|地図|案内図|image|photo|picture|img|逕ｻ蜒・|蜀咏悄|譯亥・蝗ｳ)$/.test(normalized);
}

function normalizeComparableText(value) {
  return visibleText(value).replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}

function tokenSet(text) {
  const normalized = normalizeComparableText(text).toLowerCase();
  const tokens = normalized.match(/[a-z0-9]+|[\u3040-\u30ff\u3400-\u9fff]{1,3}/g) || [];
  return new Set(tokens);
}

function attrValue(attrs, name) {
  const match = String(attrs || "").match(new RegExp(`\\s${name}=(["'])(.*?)\\1`, "i"));
  return match ? decodeHtml(match[2]) : "";
}

function hrefKey(href) {
  const clean = safeDecodeUri(String(href || "").split("#")[0].split("?")[0]).replace(/\/+$/, "");
  return clean.toLowerCase();
}

function linkHrefScore(a, b) {
  if (!a.hrefKey || !b.hrefKey) {
    return 0;
  }
  if (a.hrefKey === b.hrefKey) {
    return 1;
  }
  const aTail = a.hrefKey.split("/").filter(Boolean).pop();
  const bTail = b.hrefKey.split("/").filter(Boolean).pop();
  return aTail && aTail === bTail ? 0.6 : 0;
}

function srcKey(src) {
  const clean = safeDecodeUri(String(src || "").split("#")[0].split("?")[0]);
  return (clean.split("/").filter(Boolean).pop() || "").toLowerCase();
}

function decodeHtml(text) {
  return String(text || "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

function safeDecodeUri(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function truncate(text, max = 96) {
  const normalized = normalizeComparableText(text);
  return normalized.length > max ? `${normalized.slice(0, max - 1)}...` : normalized;
}

function round(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

function defaultFixtureRoot() {
  return defaultSagaFixtureRoot(path.resolve(__dirname, ".."));
}

module.exports = {
  learnSagaGoldHints,
  learnGoldHintsForPair,
  formatTextReport,
  formatMarkdownReport,
};

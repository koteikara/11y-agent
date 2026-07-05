"use strict";

const path = require("path");

const STRUCTURAL_KEYS = [
  "h2",
  "h3",
  "h4",
  "table",
  "thead",
  "caption",
  "th",
  "scopeCol",
  "scopeRow",
  "img",
  "emptyAlt",
  "iframe",
  "weakLink",
];

const TABLE_CAPTION_WORD_RE = /\u4e00\u89a7|\u8a73\u7d30|\u8868/u;
const TABLE_DETAIL_SUFFIX = "\u306e\u8a73\u7d30";
const GENERIC_TABLE_CAPTION = "\u8868\u306e\u8a73\u7d30";
const HOLIDAY_DOCTOR_HEADER_SIGNATURE = [
  "\u8a3a\u7642\u79d1",
  "\u533b\u7642\u6a5f\u95a2\u540d",
  "\u96fb\u8a71",
  "\u6240\u5728\u5730",
  "\u7279\u5b9a\u5065\u8a3a",
];
const HOLIDAY_DOCTOR_MERGED_HEADER = "\u8a3a\u7642\u79d1\u30fb\u533b\u7642\u6a5f\u95a2\u540d";
const HOLIDAY_DOCTOR_CAPTION_SUFFIX = "\u5728\u5b85\u5f53\u756a\u533b\u4e00\u89a7";
const SCHEDULE_DAY_LABEL = "\u8a3a\u7642\u65e5";
const SCHEDULE_TIME_LABEL = "\u8a3a\u7642\u6642\u9593";
const SCHEDULE_DETAIL_CAPTION_PREFIX = "\u8a3a\u7642\u65e5\u304a\u3088\u3073\u8a3a\u7642\u6642\u9593\u306e\u8a73\u7d30";
const SAGA_CITY_PREFIX = "\u4f50\u8cc0\u5e02";
const SALARY_SECTION_CAPTION = "\u7d66\u4e0e\u6240\u5f97\u306e\u8a08\u7b97\u4e00\u89a7";
const SALARY_ADJUSTMENT_CAPTION = "\u6240\u5f97\u91d1\u984d\u8abf\u6574\u63a7\u9664\u4e00\u89a7";
const SALARY_R8_CAPTION = "\u4ee4\u548c8\u5e74\u5ea6\u304b\u3089\u306e\u7d66\u4e0e\u6240\u5f97\u984d\u306e\u901f\u7b97\u8868";
const SALARY_R3_TO_R7_CAPTION = "\u4ee4\u548c3\u5e74\u5ea6\u304b\u3089\u4ee4\u548c7\u5e74\u5ea6\u307e\u3067 \u7d66\u4e0e\u6240\u5f97\u984d\u306e\u901f\u7b97\u8868";
const SALARY_H30_TO_R2_CAPTION = "\u5e73\u621030\u5e74\u5ea6\u304b\u3089\u4ee4\u548c2\u5e74\u5ea6\u307e\u3067 \u7d66\u4e0e\u6240\u5f97\u306e\u65e9\u7b97\u8868";
const SALARY_APPENDIX_CAPTION = "\u5225\u8868 \u53ce\u5165\u91d1\u984d\u00f74(\u5343\u5186\u672a\u6e80\u5207\u6368\u3066)=A\uff08\u5186\uff09";
const SALARY_TOTAL_HEADER = "\u53ce\u5165\u91d1\u984d\u306e\u5408\u8a08\u984d";
const SALARY_INCOME_HEADER = "\u6240\u5f97\u91d1\u984d";
const SALARY_A_NOTE = "\u53ce\u5165\u91d1\u984d\u30924\u3067\u5272\u3063\u3066\u5343\u5186\u672a\u6e80\u306e\u7aef\u6570\u3092\u5207\u308a\u6368\u3066\u3066\u304f\u3060\u3055\u3044\uff1dA";

function autoFixHtml(html) {
  let output = String(html || "");
  output = removeScriptsAndStyles(output);
  output = removeEmptyTables(output);
  output = removeOldSiteTemplateBlocks(output);
  output = removeLegacyLightVehicleEnvironmentSection(output);
  output = normalizeDecorativeText(output);
  output = normalizePseudoLists(output);
  output = normalizeHeadings(output);
  output = normalizeProcedureParentHeading(output);
  output = normalizeWeakLinkText(output);
  output = normalizeImageAlt(output);
  output = expandRevisionComparisonTables(output);
  output = normalizeSparseRowspanTables(output);
  output = normalizeObviousLayoutTables(output);
  output = normalizeDataTables(output);
  output = normalizeHolidayDoctorSnapshotTables(output);
  output = normalizeSalaryCalculationTables(output);
  output = normalizeContextualHeadingText(output);
  output = removeEmptyHeadingSections(output);
  output = cleanupHtml(output);
  output = normalizeSagaPromotionShowcasePage(output);
  output = normalizeSagaPromotionShowcaseSnippets(output);
  return cleanupHtml(output);
}

function removeScriptsAndStyles(html) {
  return html.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, "");
}

function removeEmptyTables(html) {
  return html.replace(/<table\b[^>]*>[\s\S]*?<\/table>/gi, (tableHtml) => {
    const text = visibleText(tableHtml);
    const hasMedia = /<(img|iframe|video|audio)\b/i.test(tableHtml);
    return !text && !hasMedia ? "" : tableHtml;
  });
}

function removeOldSiteTemplateBlocks(html) {
  let output = String(html || "");
  output = output.replace(
    /<div\b[^>]*>\s*<h[1-6]\b[^>]*>\s*アンケート\s*<\/h[1-6]>[\s\S]*?(?:このページの内容は分かりやすかったですか|このページは見つけやすかったですか)[\s\S]*$/i,
    ""
  );
  output = output.replace(/<h[1-6]\b[^>]*>\s*Menu\s*<\/h[1-6]>/gi, "");
  return output;
}

function removeLegacyLightVehicleEnvironmentSection(html) {
  let output = String(html || "");
  const hasLegacyEnvironmentIntro =
    /軽自動車税に「環境性能割」が創設/.test(output) &&
    /これまでの軽自動車税は「種別割」と名称が変更/.test(output) &&
    /当分の間、県が賦課徴収/.test(output);
  if (!hasLegacyEnvironmentIntro) {
    return output;
  }
  if (!/<h[1-6]\b[^>]*>\s*環境性能割\s*<\/h[1-6]>/i.test(output) || !/<h[1-6]\b[^>]*>\s*種別割\s*<\/h[1-6]>/i.test(output)) {
    return output;
  }

  output = output.replace(/<p\b[^>]*>[\s\S]*?軽自動車税に「環境性能割」が創設[\s\S]*?<\/p>\s*/i, "");
  output = output.replace(
    /<h[1-6]\b[^>]*>\s*環境性能割\s*<\/h[1-6]>[\s\S]*?(?=<h[1-6]\b[^>]*>\s*種別割\s*<\/h[1-6]>)/i,
    ""
  );
  output = output.replace(/<h[1-6]\b[^>]*>\s*種別割\s*<\/h[1-6]>\s*/i, "");
  return output;
}

function normalizeDecorativeText(html) {
  let output = html;
  output = output.replace(/<u\b[^>]*>([\s\S]*?)<\/u>/gi, "<em>$1</em>");
  output = output.replace(/<span\b[^>]*>\s*<\/span>/gi, "");
  output = output.replace(/<strong\b[^>]*>\s*<\/strong>/gi, "");
  output = output.replace(/<span\b([^>]*)style=["'][^"']*(?:font-weight|font-size|color)[^"']*["']([^>]*)>/gi, "<span$1$2>");
  output = output.replace(/<p\b([^>]*)>([\s\S]*?)<\/p>/gi, (match, attrs, inner) => normalizeNoteParagraph(attrs, inner));
  return output;
}

function normalizePseudoLists(html) {
  return html.replace(/<(p|div)\b([^>]*)>([\s\S]*?)<\/\1>/gi, (match, tag, attrs, inner) => {
    if (tag.toLowerCase() === "div" && /<(p|div|table|ul|ol|dl|h[1-6]|figure|iframe|img)\b/i.test(inner)) {
      return match;
    }
    const listHtml = buildPseudoListHtml(inner);
    if (!listHtml) {
      return match;
    }
    return listHtml;
  });
}

function buildPseudoListHtml(innerHtml) {
  const parts = String(innerHtml || "")
    .split(/<br\s*\/?>|\n/i)
    .map((part) => part.trim())
    .filter((part) => normalizeText(visibleText(part)));
  const text = normalizeText(visibleText(innerHtml));
  const bulletMarks = (text.match(/・/g) || []).length;
  const bulletParts = parts.filter((part) => isPseudoBulletPart(part));

  if (bulletParts.length < 2) {
    if (parts.length === 1 && text.startsWith("・") && bulletMarks >= 2) {
      const items = text
        .split(/(?=・)/)
        .map((item) => item.replace(/^・\s*/, "").trim())
        .filter(Boolean);
      return items.length >= 2 ? `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>` : "";
    }
    return "";
  }

  const before = [];
  const items = [];
  const after = [];
  let insideList = false;
  let listClosed = false;

  for (const part of parts) {
    if (isPseudoBulletPart(part) && !listClosed) {
      insideList = true;
      items.push(removeLeadingPseudoBullet(part));
    } else if (!insideList) {
      before.push(part);
    } else {
      listClosed = true;
      after.push(part);
    }
  }

  if (items.length < 2) {
    return "";
  }

  return [
    ...before.map(wrapPseudoListAdjacentLine),
    `<ul>${items.map((item) => `<li>${item}</li>`).join("")}</ul>`,
    ...after.map(wrapPseudoListAdjacentLine),
  ].join("");
}

function isPseudoBulletPart(html) {
  return /^・\s*/.test(normalizeText(visibleText(html)));
}

function removeLeadingPseudoBullet(html) {
  let removed = false;
  const output = String(html || "").replace(/(^|>)([^<]*)/, (match, prefix, text) => {
    const nextText = text.replace(/^[\s\u00a0]*・\s*/, "");
    if (nextText !== text) {
      removed = true;
      return `${prefix}${nextText}`;
    }
    return match;
  });
  if (removed) {
    return output.trim();
  }
  return escapeHtml(normalizeText(visibleText(html)).replace(/^・\s*/, ""));
}

function wrapPseudoListAdjacentLine(html) {
  const clean = String(html || "").trim();
  if (!clean) {
    return "";
  }
  if (/^<(p|div|ul|ol|dl|table|h[1-6]|blockquote)\b/i.test(clean)) {
    return clean;
  }
  return `<p>${clean}</p>`;
}

function normalizeNoteParagraph(attrs, inner) {
  const parts = inner
    .split(/<br\s*\/?>/i)
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length < 2 || !parts.some((part) => isNoteText(visibleText(part)))) {
    return `<p${attrs}>${inner}</p>`;
  }

  const intro = [];
  const notes = [];
  for (const part of parts) {
    if (isNoteText(visibleText(part))) {
      notes.push(stripNotePrefix(part));
    } else {
      intro.push(part);
    }
  }
  if (!notes.length) {
    return `<p${attrs}>${inner}</p>`;
  }

  const introHtml = intro.length ? `<p${attrs}>${intro.join("<br>")}</p>` : "";
  const noteItems = notes.map((note) => `<li><em>${ensureNotePrefix(note)}</em></li>`).join("");
  return `${introHtml}<ul>${noteItems}</ul>`;
}

function isNoteText(text) {
  return /^[\s\u00a0]*[※＊*]/.test(text) || /^[\s\u00a0]*[（(]?\s*注意\s*[）)]?/.test(text);
}

function stripNotePrefix(html) {
  return html
    .replace(/^[\s\u00a0]*(?:&nbsp;|\s)*/i, "")
    .replace(/^[※＊*]\s*/i, "")
    .replace(/^[（(]\s*注意\s*[）)]\s*/i, "")
    .trim();
}

function ensureNotePrefix(html) {
  const text = visibleText(html);
  return /^[（(]\s*注意\s*[）)]/.test(text) ? html : `（注意）${html}`;
}

function normalizeHeadings(html) {
  let output = html.replace(/<(h[1-6])\b([^>]*)>([\s\S]*?)<\/\1>/gi, (_match, tag, attrs, inner) => {
    return `<${tag.toLowerCase()}${attrs}>${normalizeHeadingInlineMarkup(inner)}</${tag.toLowerCase()}>`;
  });
  output = normalizeQuestionHeadingPairs(output);
  output = demoteLinkOnlyLowHeadings(output);

  if (hasLeadingDateScheduleBlock(output)) {
    return promoteHeadingsBeforeFirstH2(output);
  }

  const counts = tagCounts(output);
  if (counts.h2 === 0 && counts.h3 === 0 && counts.h4 === 0 && counts.h5 > 0) {
    output = mapHeadingLevels(output, (level) => {
      if (level === 5) return 2;
      return level;
    });
  } else if (counts.h2 === 0 && counts.h3 === 0 && counts.h4 > 0) {
    output = mapHeadingLevels(output, (level) => {
      if (level === 4) return 2;
      if (level === 5) return 3;
      if (level >= 6) return 4;
      return level;
    });
  } else if (counts.h2 > 0 && counts.h3 === 0 && counts.h4 === 0 && counts.h5 > 0) {
    output = mapHeadingLevels(output, (level) => {
      if (level === 5) return 3;
      if (level >= 6) return 4;
      return level;
    });
  } else if (counts.h2 > 0 && counts.h3 > 0 && counts.h4 === 0 && counts.h5 > 0) {
    output = mapHeadingLevels(output, (level) => {
      if (level === 5) return 4;
      return level;
    });
  } else if (counts.h2 > 0 && counts.h3 > 0 && counts.h4 > 0 && counts.h6 > 0) {
    output = mapHeadingLevels(output, (level) => {
      if (level >= 6) return 4;
      return level;
    });
  }

  if (counts.h2 === 0 && counts.h3 > 0) {
    output = mapHeadingLevels(output, (level) => {
      if (level === 3) return 2;
      if (level === 4) return 3;
      if (level >= 5) return 4;
      return level;
    });
  } else if (counts.h2 > 0 && counts.h3 === 0 && counts.h4 > 0) {
    output = mapHeadingLevels(output, (level) => {
      if (level === 4 || level === 5) return 3;
      if (level >= 6) return 4;
      return level;
    });
  }

  return output;
}

function demoteLinkOnlyLowHeadings(html) {
  return String(html || "").replace(/<h([5-6])\b([^>]*)>([\s\S]*?)<\/h\1>/gi, (match, _level, _attrs, inner) => {
    if (!/<a\b/i.test(inner)) {
      return match;
    }
    const outsideLinks = inner.replace(/<a\b[\s\S]*?<\/a>/gi, "");
    if (normalizeText(visibleText(outsideLinks))) {
      return match;
    }
    return `<p>${inner}</p>`;
  });
}

function normalizeQuestionHeadingPairs(html) {
  let expectingQuestionBody = false;
  return html.replace(/<(h[1-6])\b([^>]*)>([\s\S]*?)<\/\1>/gi, (match, tag, attrs, inner) => {
    const level = headingLevel(tag);
    const text = normalizeText(visibleText(inner));
    if (level >= 5 && isQuestionNumberHeading(text)) {
      expectingQuestionBody = true;
      return `<h2${attrs}>${normalizeQuestionHeadingText(inner)}</h2>`;
    }
    if (expectingQuestionBody && level >= 5 && isQuestionBodyHeading(text)) {
      expectingQuestionBody = false;
      return `<h3${attrs}>${inner}</h3>`;
    }
    expectingQuestionBody = false;
    return match;
  });
}

function isQuestionNumberHeading(text) {
  const normalized = normalizeText(text);
  return /(?:^|\s)(?:Q|Ｑ|質問)\s*[0-9０-９]+/i.test(normalized) && normalized.length <= 80;
}

function isQuestionBodyHeading(text) {
  const normalized = normalizeText(text);
  return normalized.length >= 12 && /[？?]$/.test(normalized);
}

function normalizeQuestionHeadingText(html) {
  const text = normalizeText(visibleText(html))
    .replace(/^(?:Q|Ｑ)\s*([0-9０-９]+)/i, "質問$1")
    .replace(/\s+/g, " ");
  return escapeHtml(text);
}

function hasLeadingDateScheduleBlock(html) {
  const firstH2Index = String(html || "").search(/<h2\b/i);
  if (firstH2Index <= 0) {
    return false;
  }
  const prefix = html.slice(0, firstH2Index);
  const headings = collectHeadingItems(prefix);
  if (headings.length < 3 || !headings.some((item) => item.level === 3) || !headings.some((item) => item.level === 4)) {
    return false;
  }
  const h4Items = headings.filter((item) => item.level === 4);
  return h4Items.length >= 2 && h4Items.filter((item) => isDateHeadingText(item.text)).length >= Math.ceil(h4Items.length * 0.75);
}

function promoteHeadingsBeforeFirstH2(html) {
  const firstH2Index = String(html || "").search(/<h2\b/i);
  const prefix = html.slice(0, firstH2Index);
  const rest = html.slice(firstH2Index);
  return `${mapHeadingLevels(prefix, (level) => {
    if (level === 3) return 2;
    if (level === 4) return 3;
    if (level >= 5) return 4;
    return level;
  })}${rest}`;
}

function collectHeadingItems(html) {
  const items = [];
  String(html || "").replace(/<(h[1-6])\b[^>]*>([\s\S]*?)<\/\1>/gi, (_match, tag, inner) => {
    items.push({
      level: headingLevel(tag),
      text: normalizeText(visibleText(inner)),
    });
    return "";
  });
  return items;
}

function isDateHeadingText(text) {
  const normalized = normalizeText(text);
  return /(?:令和|平成|昭和)?[0-9０-９]+年[0-9０-９]+月[0-9０-９]+日/.test(normalized) || /[0-9０-９]{1,2}[\/月][0-9０-９]{1,2}日?/.test(normalized);
}

function mapHeadingLevels(html, levelFor) {
  return String(html || "").replace(/<(h[1-6])\b([^>]*)>([\s\S]*?)<\/\1>/gi, (_match, tag, attrs, inner) => {
    const currentLevel = headingLevel(tag);
    const nextLevel = Math.max(2, Math.min(6, levelFor(currentLevel, normalizeText(visibleText(inner)))));
    return `<h${nextLevel}${attrs}>${inner}</h${nextLevel}>`;
  });
}

function headingLevel(tag) {
  return Number(String(tag || "").replace(/[^0-9]/g, "")) || 0;
}

function normalizeHeadingInlineMarkup(html) {
  return stripPureInlineWrappers(html).replace(/<\/?(?:strong|b)\b[^>]*>/gi, "");
}

function stripPureInlineWrappers(html) {
  let output = html.trim();
  let changed = true;
  while (changed) {
    changed = false;
    output = output.replace(/^<span\b[^>]*>([\s\S]*)<\/span>$/i, (_match, inner) => {
      changed = true;
      return inner.trim();
    });
    output = output.replace(/^<strong\b[^>]*>([\s\S]*)<\/strong>$/i, (_match, inner) => {
      changed = true;
      return inner.trim();
    });
  }
  return output;
}

function normalizeContextualHeadingText(html) {
  return replaceOutsideTables(html, (segment) => {
    let output = normalizeReferenceParagraphs(segment);
    output = normalizeBracketedHeadingParagraphs(output);
    output = normalizeLeadLabelParagraphs(output);
    output = normalizeIntroParagraphHeadings(output);
    output = normalizeProcedureParentHeading(output);
    output = normalizeStrongListItemHeadings(output);
    output = normalizeOrganizationListHeadings(output);
    output = normalizeLegalReferenceHeadings(output);
    return output;
  });
}

function replaceOutsideTables(html, transform) {
  const source = String(html || "");
  let output = "";
  let lastIndex = 0;
  source.replace(/<table\b[\s\S]*?<\/table>/gi, (match, offset) => {
    output += transform(source.slice(lastIndex, offset));
    output += match;
    lastIndex = offset + match.length;
    return match;
  });
  output += transform(source.slice(lastIndex));
  return output;
}

function normalizeReferenceParagraphs(html) {
  return String(html || "").replace(/<p\b([^>]*)>([\s\S]*?)<\/p>/gi, (match, attrs, inner) => {
    if (!/参考/.test(visibleText(inner)) || !/<br\s*\/?>/i.test(inner)) {
      return match;
    }
    const parts = inner
      .split(/<br\s*\/?>/i)
      .map((part) => part.trim())
      .filter((part) => normalizeText(visibleText(part)));
    const referenceIndex = parts.findIndex((part) => /^【?参考】?$/.test(normalizeText(visibleText(part))));
    if (referenceIndex < 0) {
      return match;
    }

    const before = parts.slice(0, referenceIndex);
    const after = parts.slice(referenceIndex + 1);
    const blocks = [];
    if (before.length) {
      blocks.push(`<p${attrs}>${before.join("<br>")}</p>`);
    }
    blocks.push("<h3>参考</h3>");
    for (let index = 0; index < after.length; index += 1) {
      const part = after[index];
      const text = normalizeText(visibleText(part));
      const next = after[index + 1] || "";
      if (!/<a\b/i.test(part) && /(?:HP|ホームページ)$/i.test(text) && /<a\b/i.test(next)) {
        blocks.push(`<h4>${escapeHtml(text.replace(/HP$/i, "ホームページ"))}</h4>`);
        blocks.push(`<p>${next}</p>`);
        index += 1;
      } else {
        blocks.push(`<p>${part}</p>`);
      }
    }
    return blocks.join("");
  });
}

function normalizeBracketedHeadingParagraphs(html) {
  let lastHeadingLevel = 0;
  return String(html || "").replace(/<h[1-6]\b[^>]*>[\s\S]*?<\/h[1-6]>|<p\b([^>]*)>([\s\S]*?)<\/p>/gi, (match, _attrs, inner) => {
    const headingMatch = match.match(/^<h([1-6])\b/i);
    if (headingMatch) {
      lastHeadingLevel = Number(headingMatch[1]);
      return match;
    }

    const text = normalizeText(visibleText(inner));
    if (!isBracketedHeadingLabel(text) || /<(a|img|iframe|table|ul|ol)\b/i.test(inner)) {
      return match;
    }

    const level = lastHeadingLevel >= 3 ? 4 : 3;
    lastHeadingLevel = level;
    return `<h${level}>${escapeHtml(stripOuterBrackets(text))}</h${level}>`;
  });
}

function normalizeLeadLabelParagraphs(html) {
  let lastHeadingLevel = 0;
  return String(html || "").replace(/<h[1-6]\b[^>]*>[\s\S]*?<\/h[1-6]>|<p\b([^>]*)>([\s\S]*?)<\/p>/gi, (match, attrs, inner) => {
    const headingMatch = match.match(/^<h([1-6])\b/i);
    if (headingMatch) {
      lastHeadingLevel = Number(headingMatch[1]);
      return match;
    }

    const transformed = buildLeadLabelHeading(attrs || "", inner, lastHeadingLevel);
    if (!transformed) {
      return match;
    }
    lastHeadingLevel = transformed.level;
    return transformed.html;
  });
}

function buildLeadLabelHeading(attrs, inner, lastHeadingLevel) {
  const parts = String(inner || "").split(/<br\s*\/?>/i).map((part) => part.trim());
  const firstLabel = headingLabelFromParagraphPart(parts[0] || "");
  if (firstLabel) {
    if (lastHeadingLevel < 2 && !/^(?:郵送|窓口|注意|（参考）)/.test(firstLabel)) {
      return null;
    }
    const level = paragraphLabelHeadingLevel(firstLabel, lastHeadingLevel);
    const rest = parts
      .slice(1)
      .map((part) => part.trim())
      .filter((part) => normalizeText(visibleText(part)));
    const restHtml = rest.length ? `<p${attrs}>${rest.join("<br>")}</p>` : "";
    return {
      level,
      html: `<h${level}>${escapeHtml(firstLabel)}</h${level}>${restHtml}`,
    };
  }

  if (lastHeadingLevel < 2) {
    return null;
  }

  const firstTaxLabel = taxHeadingLabelFromParagraphPart(parts[0] || "");
  if (firstTaxLabel) {
    const rest = parts
      .slice(1)
      .map((part) => part.trim())
      .filter((part) => normalizeText(visibleText(part)));
    const restHtml = rest.length ? `<p${attrs}>${rest.join("<br>")}</p>` : "";
    return {
      level: 4,
      html: `<h4>${escapeHtml(firstTaxLabel)}</h4>${restHtml}`,
    };
  }

  const taxTotalIndex = parts.findIndex((part) => isTaxCalculationHeadingText(normalizeText(visibleText(part))));
  if (taxTotalIndex > 0) {
    const before = parts.slice(0, taxTotalIndex).filter((part) => normalizeText(visibleText(part)));
    const after = parts.slice(taxTotalIndex + 1).filter((part) => normalizeText(visibleText(part)));
    const label = cleanTaxCalculationHeadingText(normalizeText(visibleText(parts[taxTotalIndex])));
    const beforeHtml = before.length ? `<p${attrs}>${before.join("<br>")}</p>` : "";
    const afterHtml = after.length ? `<p${attrs}>${after.join("<br>")}</p>` : "";
    return {
      level: 4,
      html: `${beforeHtml}<h4>${escapeHtml(label)}</h4>${afterHtml}`,
    };
  }

  const exactText = normalizeText(visibleText(inner));
  if (isTaxCalculationHeadingText(exactText)) {
    return {
      level: 4,
      html: `<h4>${escapeHtml(cleanTaxCalculationHeadingText(exactText))}</h4>`,
    };
  }

  return null;
}

function headingLabelFromParagraphPart(part) {
  const text = normalizeText(visibleText(part));
  if (!text) {
    return "";
  }
  const bracketed = text.match(/^【\s*(郵送|窓口)\s*】$/);
  if (bracketed) {
    return bracketed[1];
  }
  const angleNote = text.match(/^(?:<|&lt;|＜)\s*(注意)\s*(?:>|&gt;|＞)$/);
  if (angleNote) {
    return angleNote[1];
  }
  if (/^※?注意$/.test(text)) {
    return "注意";
  }
  if (/^（参考）.{1,60}/.test(text)) {
    return text;
  }
  return "";
}

function paragraphLabelHeadingLevel(label, lastHeadingLevel) {
  if (/^(?:郵送|窓口|注意|（参考）)/.test(label) && lastHeadingLevel >= 3) {
    return 4;
  }
  if (/^(?:郵送|窓口|注意|（参考）)/.test(label) && lastHeadingLevel < 2) {
    return 4;
  }
  return lastHeadingLevel >= 3 ? 4 : 3;
}

function taxHeadingLabelFromParagraphPart(part) {
  const text = normalizeText(visibleText(part));
  if (!isTaxCalculationHeadingText(text)) {
    return "";
  }
  return cleanTaxCalculationHeadingText(text);
}

function isTaxCalculationHeadingText(text) {
  const normalized = normalizeText(text);
  if (!normalized || normalized.length > 80 || /[。！？!?]$/.test(normalized)) {
    return false;
  }
  if (/[=＝]/.test(normalized) && !/^(?:所得割額|令和[0-9０-９]+年度税額)[=＝]/.test(normalized)) {
    return false;
  }
  return /^(?:所得金額|所得控除|課税標準額|所得割額|均等割額|令和[0-9０-９]+年度税額|[（(][0-9０-９]+[）)]\s*(?:所得金額|所得控除額|課税標準額|税率|税額控除|配当割額|譲渡所得))/.test(
    normalized
  );
}

function cleanTaxCalculationHeadingText(text) {
  const normalized = normalizeText(text);
  if (/^所得金額[（(]/.test(normalized)) {
    return "所得金額";
  }
  return normalized;
}

function normalizeIntroParagraphHeadings(html) {
  return String(html || "").replace(/<p\b([^>]*)>((?:(?!<\/p>)[\s\S])*?)<\/p>(?=\s*<h3\b)/gi, (match, _attrs, inner) => {
    const text = normalizeText(visibleText(inner));
    if (/各部署の担当課別業務案内|課名をクリック/.test(text) && text.length <= 120) {
      return `<h2>${escapeHtml(text)}</h2>`;
    }
    return match;
  });
}

function normalizeProcedureParentHeading(html) {
  const source = String(html || "");
  if (!needsProcedureParentHeading(source)) {
    return source;
  }
  return source.replace(/<h3\b/i, "<h2>手続きについて</h2><h3");
}

function normalizeStrongListItemHeadings(html) {
  return String(html || "").replace(
    /<ul\b[^>]*>\s*<li\b[^>]*>\s*<p\b[^>]*>\s*<strong\b[^>]*>([\s\S]*?)<\/strong>\s*<\/p>\s*<\/li>\s*<\/ul>/gi,
    (match, inner) => {
      const label = normalizeRequirementHeadingLabel(visibleText(inner));
      if (!isDocumentRequirementLabel(label)) {
        return match;
      }
      const link = inner.match(/<a\b[\s\S]*?<\/a>/i)?.[0] || "";
      const preservedLink = link ? `<p>${link}</p>` : "";
      return `<h3>${escapeHtml(label)}</h3>${preservedLink}`;
    }
  );
}

function normalizeOrganizationListHeadings(html) {
  return String(html || "").replace(
    /(<h4\b[^>]*>\s*(?:申告先|提出先|問い合わせ|お問い合わせ)\s*<\/h4>\s*)<ul\b[^>]*>\s*<li\b[^>]*>([\s\S]*?)<\/li>\s*<\/ul>(?=\s*<p\b[^>]*>[\s\S]*?(?:所在地|住所|電話))/gi,
    (match, heading, inner) => {
      const label = normalizeRequirementHeadingLabel(visibleText(inner));
      if (!label || label.length > 60 || !/(協会|事務所|支局|市役所|役場|センター)/.test(label)) {
        return match;
      }
      return `${heading}<h5>${escapeHtml(label)}</h5>`;
    }
  );
}

function normalizeLegalReferenceHeadings(html) {
  let legalContext = false;
  return String(html || "").replace(
    /<h[1-6]\b[^>]*>[\s\S]*?<\/h[1-6]>|<p\b[^>]*>((?:(?!<\/p>)[\s\S])*?)<\/p>/gi,
    (match, inner) => {
      if (/^<h[1-6]\b/i.test(match)) {
        legalContext = /地方税法|法律上|法令/.test(visibleText(match));
        return match;
      }
      if (!legalContext) {
        return match;
      }

      const text = normalizeText(visibleText(inner));
      const bracketed = text.match(/^（([^（）]{1,40})）$/);
      if (bracketed && /(書類|送達|規定|条文)/.test(bracketed[1])) {
        return `<h4>${escapeHtml(bracketed[1])}</h4>`;
      }

      const article = text.match(/^(第[一二三四五六七八九十百千〇零0-9０-９]+条)[\s　]+(.+)$/);
      if (article) {
        return `<h5>${escapeHtml(article[1])}</h5><p>${escapeHtml(article[2])}</p>`;
      }
      return match;
    }
  );
}

function removeEmptyHeadingSections(html) {
  let output = String(html || "");
  let changed = true;
  while (changed) {
    changed = false;
    output = output.replace(
      /<h([2-6])\b[^>]*>((?:(?!<h[1-6]\b|<\/h[1-6]>)[\s\S])*?)<\/h\1>(\s*(?:<p\b[^>]*>(?:\s|&nbsp;|<br\s*\/?>)*<\/p>\s*)*)(?=(?:<\/?div\b[^>]*>\s*)*(?:<h([1-6])\b|\s*$))/gi,
      (match, levelText, inner, spacer, nextLevel) => {
        const level = Number(levelText || 0);
        const followingLevel = nextLevel ? Number(nextLevel) : 0;
        if (
          isRemovableEmptyHeadingLabel(visibleText(inner)) &&
          ((!followingLevel && level <= 2) || (followingLevel && followingLevel <= level))
        ) {
          changed = true;
          return spacer || "";
        }
        return match;
      }
    );
  }
  return output;
}

function normalizeRequirementHeadingLabel(text) {
  return normalizeText(text).replace(/\u200b/g, "").replace(/\s+/g, " ").trim();
}

function needsProcedureParentHeading(html) {
  const source = String(html || "");
  const firstHeading = source.match(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/i);
  if (!firstHeading || Number(firstHeading[1]) !== 3) {
    return false;
  }
  const text = visibleText(source);
  return (
    /(?:原動機付自転車|小型特殊自動車|軽四輪|軽三輪|軽二輪|小型二輪)/.test(text) &&
    /申告先/.test(text) &&
    /関連ダウンロードファイル/.test(text) &&
    !/<h2\b[^>]*>\s*手続きについて\s*<\/h2>/i.test(source)
  );
}

function isDocumentRequirementLabel(label) {
  return (
    label.length > 0 &&
    label.length <= 70 &&
    !/[。！？!?]$/.test(label) &&
    /(申請書|手数料|封筒|本人確認|委任状|添付|書類|写し)/.test(label)
  );
}

function isRemovableEmptyHeadingLabel(label) {
  return /^(備考|会議の結果のお知らせ|会議結果のお知らせ)$/.test(normalizeText(label));
}

function isBracketedHeadingLabel(text) {
  const normalized = normalizeText(text);
  return /^(?:【[^】]{1,80}】|\[[^\]]{1,80}\])$/.test(normalized) && !/注|注意/.test(normalized);
}

function stripOuterBrackets(text) {
  return normalizeText(text).replace(/^【/, "").replace(/】$/, "").replace(/^\[/, "").replace(/\]$/, "");
}

function normalizeWeakLinkText(html) {
  return html.replace(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi, (match, attrs, inner) => {
    const text = normalizeText(visibleText(inner));
    if (!isWeakLinkText(text)) {
      return match;
    }
    const href = attrValue(attrs, "href");
    const title = inferLinkLabelFromHref(href);
    if (!title) {
      return match;
    }
    return `<a${attrs}>${escapeHtml(title)}</a>`;
  });
}

function isWeakLinkText(text) {
  const compact = text.replace(/\s+/g, "");
  return /^(こちら|ここ|詳細はこちら|詳しくはこちら|詳細|クリックしてください|こちらから.*|.*こちら)$/.test(compact);
}

function inferLinkLabelFromHref(href) {
  if (!href) return "";
  const clean = decodeUriSafe(href.split(/[?#]/)[0]);
  const filename = clean.split("/").filter(Boolean).pop() || "";
  if (!filename) return "";
  const stem = filename.replace(/\.[a-z0-9]+$/i, "");
  if (!stem || /^\d+$/.test(stem) || /^main(?:\.php)?$/i.test(stem)) {
    return "";
  }
  const label = stem.replace(/[-_]+/g, " ").trim();
  if (!label) return "";
  if (/\.(pdf|docx?|xlsx?|pptx?|zip|csv)$/i.test(filename)) {
    return `${label}（${fileTypeLabel(filename)}）`;
  }
  return label;
}

function fileTypeLabel(filename) {
  const ext = (filename.match(/\.([a-z0-9]+)$/i) || [])[1]?.toUpperCase();
  return ext ? `${ext}ファイル` : "ファイル";
}

function normalizeImageAlt(html) {
  return html.replace(/<img\b([^>]*)>/gi, (match, attrs) => {
    const alt = attrValue(attrs, "alt");
    if (alt !== null && normalizeText(alt)) {
      return match;
    }
    const src = attrValue(attrs, "src") || "";
    const title = attrValue(attrs, "title") || inferImageLabelFromSrc(src);
    const nextAttrs = setAttr(attrs, "alt", title || "画像内容の確認が必要な画像");
    return `<img${nextAttrs}>`;
  });
}

function inferImageLabelFromSrc(src) {
  const clean = decodeUriSafe(String(src || "").split(/[?#]/)[0]);
  const filename = clean.split("/").filter(Boolean).pop() || "";
  const stem = filename.replace(/\.[a-z0-9]+$/i, "").replace(/[-_]+/g, " ").trim();
  return stem ? `${stem}の画像` : "";
}

function expandRevisionComparisonTables(html) {
  return String(html || "").replace(/<table\b([^>]*)>([\s\S]*?)<\/table>/gi, (match, attrs, inner, offset, fullHtml) => {
    const replacement = buildRevisionSplitTablesHtml(attrs, inner, fullHtml.slice(0, offset));
    return replacement || match;
  });
}

function normalizeSparseRowspanTables(html) {
  return String(html || "").replace(/<table\b([^>]*)>([\s\S]*?)<\/table>/gi, (match, attrs, inner) => {
    const replacement = buildSparseRowspanExpandedTableHtml(attrs, inner);
    return replacement || match;
  });
}

function normalizeObviousLayoutTables(html) {
  return String(html || "").replace(/<table\b([^>]*)>([\s\S]*?)<\/table>/gi, (match, _attrs, inner) => {
    const profile = analyzeTable(inner);
    if (!isObviousLayoutTableProfile(profile)) {
      return match;
    }
    return decomposeLayoutTable(inner);
  });
}

function isObviousLayoutTableProfile(profile) {
  const hasExplicitSemantics =
    profile.hasCaption || profile.hasThead || profile.flatCells.some((cell) => cell.tag === "th") || profile.hasScope;
  if (hasExplicitSemantics) {
    return false;
  }
  if (shouldPreserveDataTable(profile)) {
    return false;
  }
  if (looksLikeContactTable(profile) || isRowHeaderOnlyDataTableProfile(profile) || profile.firstRowHeaderLike) {
    return false;
  }

  const rowCount = profile.bodyRows.length;
  if (!rowCount) {
    return true;
  }
  if (profile.hasMedia && profile.maxCols <= 4 && rowCount <= 4) {
    return true;
  }
  if (hasMostlyEmptyRow(profile.bodyRows[0]) && profile.maxCols <= 4 && rowCount <= 4) {
    return true;
  }
  if (profile.maxCols <= 2 && rowCount <= 2 && profile.hasBlockInCell) {
    return true;
  }
  return false;
}

function hasMostlyEmptyRow(cells) {
  if (!cells || !cells.length) {
    return true;
  }
  const emptyCount = cells.filter((cell) => !normalizeText(visibleText(cell.inner))).length;
  return emptyCount >= Math.ceil(cells.length * 0.5);
}

function buildSparseRowspanExpandedTableHtml(attrs, inner) {
  const captionMatch = inner.match(/<caption\b[^>]*>[\s\S]*?<\/caption>/i);
  const colgroupMatch = inner.match(/<colgroup\b[^>]*>[\s\S]*?<\/colgroup>/i);
  const theadMatch = inner.match(/<thead\b[^>]*>([\s\S]*?)<\/thead>/i);
  const tbodyMatch = inner.match(/<tbody\b[^>]*>([\s\S]*?)<\/tbody>/i);
  if (!theadMatch || !tbodyMatch) {
    return "";
  }

  const headerRows = parseRows(theadMatch[1]).map(parseCells).filter((cells) => cells.length > 0);
  if (headerRows.length !== 1 || headerRows[0].length !== 3) {
    return "";
  }

  const bodyRows = parseRows(tbodyMatch[1]).map(parseCells).filter((cells) => cells.length > 0);
  if (!isSparseRowspanBodyProfile(bodyRows)) {
    return "";
  }

  const expandedRows = expandSparseRowspanBodyRows(bodyRows, 3);
  if (!expandedRows || !expandedRows.length) {
    return "";
  }

  const captionHtml = captionMatch ? captionMatch[0] : "";
  const colgroupHtml = colgroupMatch ? colgroupMatch[0] : "";
  const bodyHtml = expandedRows
    .map(
      (cells) =>
        `<tr>${cells
          .map((cell) => `<td${cleanCellAttrs(cell.attrs, "td")}>${cell.inner}</td>`)
          .join("")}</tr>`
    )
    .join("");
  return `<table${attrs}>${captionHtml}${colgroupHtml}${theadMatch[0]}<tbody>${bodyHtml}</tbody></table>`;
}

function isSparseRowspanBodyProfile(bodyRows) {
  if (!bodyRows.length) {
    return false;
  }
  const sparseRows = bodyRows.filter((cells) => cells.length < 3).length;
  const hasMeaningfulRowspan = bodyRows.some((cells) =>
    cells.some((cell, index) => index > 0 && cellSpanValue(cell.attrs, "rowspan") > 1)
  );
  const hasLeadingAnchorOnlyRow = bodyRows.some((cells) => cells.length === 1 && cellSpanValue(cells[0]?.attrs || "", "rowspan") > 1);
  const hasWideColspan = bodyRows.some((cells) => cells.some((cell) => cellSpanValue(cell.attrs, "colspan") > 1));
  return sparseRows >= 2 && (hasMeaningfulRowspan || hasLeadingAnchorOnlyRow) && !hasWideColspan;
}

function expandSparseRowspanBodyRows(bodyRows, targetCols) {
  const pending = Array.from({ length: targetCols }, () => null);
  const expandedRows = [];

  for (const rawCells of bodyRows) {
    const positioned = Array.from({ length: targetCols }, () => null);
    let rawIndex = 0;
    let actualCount = 0;

    for (let col = 0; col < targetCols; col += 1) {
      if (pending[col]) {
        positioned[col] = {
          tag: pending[col].cell.tag,
          attrs: pending[col].cell.attrs,
          inner: pending[col].cell.inner,
          carried: true,
        };
        pending[col].remaining -= 1;
        if (pending[col].remaining <= 0) {
          pending[col] = null;
        }
        continue;
      }

      const cell = rawCells[rawIndex];
      if (!cell) {
        continue;
      }
      rawIndex += 1;
      actualCount += 1;

      const cleanAttrs = String(cell.attrs || "")
        .replace(/\s?rowspan=(["']?)\d+\1/gi, "")
        .replace(/\s?colspan=(["']?)1\1/gi, "")
        .trim();
      positioned[col] = {
        tag: cell.tag,
        attrs: cleanAttrs,
        inner: cell.inner,
        carried: false,
      };

      const rowspan = cellSpanValue(cell.attrs, "rowspan");
      if (rowspan > 1) {
        pending[col] = {
          cell: {
            tag: cell.tag,
            attrs: cleanAttrs,
            inner: cell.inner,
          },
          remaining: rowspan - 1,
        };
      }
    }

    if (rawIndex < rawCells.length) {
      return null;
    }

    const hasAnyContent = positioned.some((cell) => cell && normalizeText(visibleText(cell.inner)));
    const hasValueContent = positioned.slice(1).some((cell) => cell && normalizeText(visibleText(cell.inner)));
    if (!hasAnyContent) {
      continue;
    }
    if (!hasValueContent && actualCount === 1 && positioned[0] && !positioned[0].carried) {
      continue;
    }

    expandedRows.push(
      positioned.map((cell) => cell || { tag: "td", attrs: "", inner: "" })
    );
  }

  return expandedRows;
}

function buildRevisionSplitTablesHtml(attrs, inner, prefix) {
  const rows = parseRows(inner).map(parseCells).filter((cells) => cells.length > 0);
  if (!isRevisionComparisonTableProfile(rows)) {
    return "";
  }

  const leftLabel = normalizeText(visibleText(rows[0][0]?.inner || ""));
  const topLabel = normalizeText(visibleText(rows[0][1]?.inner || ""));
  const oldLabel = normalizeText(visibleText(rows[1][0]?.inner || ""));
  const newLabel = normalizeText(visibleText(rows[2][0]?.inner || ""));
  const oldHeaders = rows[1].slice(1);
  const newHeaders = rows[2].slice(1);
  const valueRows = rows.slice(3);
  const compareUsesLeftAxis = oldHeaders.length >= 6;
  const compareAxisLabel = compareUsesLeftAxis ? leftLabel : topLabel;
  const valueAxisLabel = leftLabel || topLabel || "項目";
  const context = inferRevisionSplitContext(prefix);

  const compareCaption = buildRevisionCompareCaption(context, topLabel, oldLabel, newLabel);
  const valueCaption = buildRevisionValueCaption(context, topLabel);

  const compareTable = [
    `<table${attrs}>`,
    compareCaption ? `<caption>${escapeHtml(compareCaption)}</caption>` : "",
    "<thead><tr>",
    `<th scope="col">${escapeHtml(compareAxisLabel)}<br>${escapeHtml(oldLabel)}</th>`,
    ...oldHeaders.map((cell) => `<th scope="col">${cell.inner}</th>`),
    "</tr></thead>",
    "<tbody><tr>",
    `<th scope="row">${escapeHtml(compareAxisLabel)}<br>${escapeHtml(newLabel)}</th>`,
    ...newHeaders.map((cell) => `<td>${cell.inner}</td>`),
    "</tr></tbody></table>",
  ].join("");

  const valueTable = [
    `<table${attrs}>`,
    valueCaption ? `<caption>${escapeHtml(valueCaption)}</caption>` : "",
    "<thead><tr>",
    `<th scope="row">${escapeHtml(valueAxisLabel)}${newLabel ? `<br>${escapeHtml(newLabel)}` : ""}</th>`,
    ...newHeaders.map((cell) => `<th scope="col">${cell.inner}</th>`),
    "</tr></thead>",
    "<tbody>",
    ...valueRows.map((cells) => {
      const [firstCell, ...restCells] = cells;
      return `<tr><th scope="row">${normalizeSplitCellInner(firstCell.inner)}</th>${restCells
        .map((cell) => `<td>${normalizeSplitCellInner(cell.inner)}</td>`)
        .join("")}</tr>`;
    }),
    "</tbody></table>",
  ].join("");

  return `${compareTable}${valueTable}`;
}

function isRevisionComparisonTableProfile(rows) {
  if (rows.length < 5 || rows[0].length < 2 || rows[1].length < 3 || rows[2].length !== rows[1].length) {
    return false;
  }

  const firstRowLeftSpan = cellSpanValue(rows[0][0]?.attrs || "", "rowspan");
  const secondRowLabel = normalizeText(visibleText(rows[1][0]?.inner || ""));
  const thirdRowLabel = normalizeText(visibleText(rows[2][0]?.inner || ""));
  const bodyRows = rows.slice(3);

  if (firstRowLeftSpan < 3 || secondRowLabel !== "改正前" || thirdRowLabel !== "改正後") {
    return false;
  }

  if (!bodyRows.length || !bodyRows.every((cells) => cells.length === rows[1].length)) {
    return false;
  }

  return bodyRows.every((cells) => cellSpanValue(cells[0]?.attrs || "", "colspan") >= 2);
}

function inferRevisionSplitContext(prefix) {
  const paragraphs = [...String(prefix || "").matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((match) => normalizeText(visibleText(match[1])))
    .filter(Boolean);

  for (let index = paragraphs.length - 1; index >= 0; index -= 1) {
    if (/^【表[0-9０-９]+】/.test(paragraphs[index])) {
      return paragraphs[index];
    }
  }
  return "";
}

function buildRevisionCompareCaption(context, topLabel, oldLabel, newLabel) {
  if (context) {
    const numbered = splitRevisionContextLabel(context, 1);
    if (numbered.baseLabel) {
      return `${numbered.label} ${topLabel}「${oldLabel}」「${newLabel}」`;
    }
  }
  return `${topLabel}「${oldLabel}」「${newLabel}」`;
}

function buildRevisionValueCaption(context, topLabel) {
  if (context) {
    const numbered = splitRevisionContextLabel(context, 2);
    if (/配偶者特別控除/u.test(numbered.baseLabel)) {
      return `${numbered.label} 配偶者特別控除額（改正後）`;
    }
    if (numbered.baseLabel) {
      return `${numbered.label} ${topLabel}（改正後）`;
    }
  }
  return `${topLabel}（改正後）`;
}

function splitRevisionContextLabel(text, suffixNumber) {
  const match = normalizeText(text).match(/^【表([0-9０-９]+)】\s*(.+)$/u);
  if (!match) {
    return { label: normalizeText(text), baseLabel: normalizeText(text) };
  }
  return {
    label: `【表${match[1]}-${suffixNumber}】${match[2]}`,
    baseLabel: normalizeText(match[2]),
  };
}

function normalizeSplitCellInner(inner) {
  const text = normalizeText(visibleText(inner));
  if (/^―$/u.test(text)) {
    return "なし";
  }
  return inner;
}

function normalizeHolidayDoctorSnapshotTables(html) {
  const source = String(html || "");
  const h2Matches = [...source.matchAll(/<h2\b[^>]*>[\s\S]*?<\/h2>/gi)];
  if (h2Matches.length < 2) {
    return source;
  }

  let output = "";
  let cursor = 0;
  let changed = false;

  for (let index = 0; index < h2Matches.length; index += 1) {
    const match = h2Matches[index];
    const bodyStart = match.index + match[0].length;
    const sectionEnd = index + 1 < h2Matches.length ? h2Matches[index + 1].index : source.length;
    const sectionHtml = source.slice(bodyStart, sectionEnd);
    const transformedSection = transformHolidayDoctorSnapshotSection(sectionHtml);
    output += source.slice(cursor, bodyStart);
    output += transformedSection;
    cursor = sectionEnd;
    if (transformedSection !== sectionHtml) {
      changed = true;
    }
  }

  output += source.slice(cursor);
  return changed ? normalizeHolidayDoctorScheduleDetailTables(output) : source;
}

function transformHolidayDoctorSnapshotSection(sectionHtml) {
  const candidates = [];
  sectionHtml.replace(
    /(<h3\b[^>]*>([\s\S]*?)<\/h3>)\s*(<table\b([^>]*)>([\s\S]*?)<\/table>)/gi,
    (match, headingHtml, headingInner, _tableHtml, tableAttrs, tableInner, offset) => {
      const headingText = normalizeText(visibleText(headingInner));
      if (!isDateHeadingText(headingText)) {
        return match;
      }
      const profile = analyzeTable(tableInner);
      if (!isHolidayDoctorDateTableProfile(profile)) {
        return match;
      }
      candidates.push({
        offset,
        end: offset + match.length,
        headingHtml,
        headingText,
        tableAttrs,
        profile,
        bodyRowCount: Math.max(0, profile.bodyRows.length - 1),
      });
      return match;
    }
  );

  if (candidates.length < 8) {
    return sectionHtml;
  }

  const fiveRowCandidates = candidates.filter((candidate) => candidate.bodyRowCount === 5);
  const kept = (fiveRowCandidates.length >= 5 ? fiveRowCandidates : candidates).slice(0, 5);
  if (kept.length < 5) {
    return sectionHtml;
  }

  const keptOffsets = new Set(kept.map((candidate) => candidate.offset));
  let output = "";
  let cursor = 0;

  for (const candidate of candidates) {
    output += sectionHtml.slice(cursor, candidate.offset);
    if (keptOffsets.has(candidate.offset)) {
      output += buildHolidayDoctorDateTableBlock(candidate);
    }
    cursor = candidate.end;
  }

  output += sectionHtml.slice(cursor);
  return output;
}

function isHolidayDoctorDateTableProfile(profile) {
  if (profile.hasCaption || profile.hasThead || profile.maxCols !== 5 || profile.bodyRows.length < 6) {
    return false;
  }
  const headerTexts = (profile.bodyRows[0] || []).map((cell) => normalizeText(visibleText(cell.inner)));
  if (headerTexts.length !== HOLIDAY_DOCTOR_HEADER_SIGNATURE.length) {
    return false;
  }
  if (headerTexts.join("|") !== HOLIDAY_DOCTOR_HEADER_SIGNATURE.join("|")) {
    return false;
  }
  return profile.bodyRows.slice(1).every((cells) => cells.length === HOLIDAY_DOCTOR_HEADER_SIGNATURE.length);
}

function buildHolidayDoctorDateTableBlock(candidate) {
  const bodyRows = candidate.profile.bodyRows
    .slice(1)
    .map((cells) => {
      return `<tr><th scope="row">${cells[0].inner}<br>${cells[1].inner}</th><td>${cells[2].inner}</td><td>${cells[3].inner}</td><td>${cells[4].inner}</td></tr>`;
    })
    .join("");
  const headerRow = [
    `<th scope="row">${HOLIDAY_DOCTOR_MERGED_HEADER}</th>`,
    `<th scope="col">${HOLIDAY_DOCTOR_HEADER_SIGNATURE[2]}</th>`,
    `<th scope="col">${HOLIDAY_DOCTOR_HEADER_SIGNATURE[3]}</th>`,
    `<th scope="col">${HOLIDAY_DOCTOR_HEADER_SIGNATURE[4]}</th>`,
  ].join("");
  return `${candidate.headingHtml}<table${candidate.tableAttrs}><caption>${escapeHtml(
    `${candidate.headingText}${HOLIDAY_DOCTOR_CAPTION_SUFFIX}`
  )}</caption><thead><tr>${headerRow}</tr></thead><tbody>${bodyRows}</tbody></table>`;
}

function normalizeHolidayDoctorScheduleDetailTables(html) {
  let lastHeadingText = "";
  return String(html || "").replace(/<h3\b[^>]*>([\s\S]*?)<\/h3>|<table\b([^>]*)>([\s\S]*?)<\/table>/gi, (match, headingInner, tableAttrs, tableInner) => {
    if (headingInner !== undefined) {
      lastHeadingText = normalizeText(visibleText(headingInner));
      return match;
    }

    const profile = analyzeTable(tableInner);
    if (!isHolidayDoctorScheduleDetailTableProfile(profile)) {
      return match;
    }
    return buildHolidayDoctorScheduleDetailTableHtml(tableAttrs, profile, lastHeadingText);
  });
}

function isHolidayDoctorScheduleDetailTableProfile(profile) {
  if (profile.maxCols !== 2 || profile.bodyRows.length < 2) {
    return false;
  }
  const headerTexts = (profile.bodyRows[0] || []).map((cell) => normalizeText(visibleText(cell.inner)));
  return headerTexts.length === 2 && headerTexts[0] === SCHEDULE_DAY_LABEL && headerTexts[1] === SCHEDULE_TIME_LABEL;
}

function buildHolidayDoctorScheduleDetailTableHtml(attrs, profile, headingText) {
  const label = normalizeHolidayDoctorScheduleLabel(headingText);
  const caption = `${SCHEDULE_DETAIL_CAPTION_PREFIX}（${label}）`;
  const bodyRows = profile.bodyRows
    .slice(1)
    .map((cells) => {
      return `<tr><th scope="row">${cells[0].inner}</th><td>${cells[1].inner}</td></tr>`;
    })
    .join("");
  return `<table${attrs}><caption>${escapeHtml(caption)}</caption><thead><tr><th scope="row">${SCHEDULE_DAY_LABEL}</th><th scope="col">${SCHEDULE_TIME_LABEL}</th></tr></thead><tbody>${bodyRows}</tbody></table>`;
}

function normalizeHolidayDoctorScheduleLabel(text) {
  const normalized = normalizeText(text);
  if (!normalized) {
    return SCHEDULE_DAY_LABEL;
  }
  return normalized.startsWith(SAGA_CITY_PREFIX) ? normalized.slice(SAGA_CITY_PREFIX.length) : normalized;
}

function normalizeSalaryCalculationTables(html) {
  const source = String(html || "");
  const tableMatches = [...source.matchAll(/<table\b[^>]*>[\s\S]*?<\/table>/gi)];
  if (tableMatches.length < 3) {
    return source;
  }

  const firstTable = tableMatches[0][0];
  const secondTable = tableMatches[1][0];
  const thirdTable = tableMatches[2][0];
  if (
    existingCaption(firstTable) !== SALARY_SECTION_CAPTION ||
    existingCaption(secondTable) !== SALARY_ADJUSTMENT_CAPTION ||
    existingCaption(thirdTable) !== SALARY_ADJUSTMENT_CAPTION
  ) {
    return source;
  }

  if (!looksLikeSalaryQuickTable(firstTable) || !looksLikeLegacySalaryQuickTable(secondTable) || !looksLikeSalaryAppendixTable(thirdTable)) {
    return source;
  }

  const firstMatch = tableMatches[0];
  const secondMatch = tableMatches[1];
  const thirdMatch = tableMatches[2];
  return [
    source.slice(0, firstMatch.index),
    buildSalaryReiwa8TableHtml(),
    source.slice(firstMatch.index + firstTable.length, secondMatch.index),
    buildSalaryReiwa3To7TableHtml(),
    replaceTableCaption(secondTable, SALARY_H30_TO_R2_CAPTION),
    source.slice(secondMatch.index + secondTable.length, thirdMatch.index),
    replaceTableCaption(thirdTable, SALARY_APPENDIX_CAPTION),
    source.slice(thirdMatch.index + thirdTable.length),
  ].join("");
}

function looksLikeSalaryQuickTable(tableHtml) {
  const match = tableHtml.match(/<table\b[^>]*>([\s\S]*?)<\/table>/i);
  if (!match) {
    return false;
  }
  const profile = analyzeTable(match[1]);
  const headerTexts = (profile.firstRow || []).map((cell) => normalizeText(visibleText(cell.inner)));
  const tableText = normalizeText(visibleText(tableHtml));
  return (
    headerTexts.length >= 2 &&
    headerTexts[0] === SALARY_TOTAL_HEADER &&
    headerTexts[1] === SALARY_INCOME_HEADER &&
    /8,500,000/.test(tableText)
  );
}

function looksLikeLegacySalaryQuickTable(tableHtml) {
  const text = normalizeText(visibleText(tableHtml));
  return /10,000,000/.test(text) && /1,628,000/.test(text) && /\u4e0b\u8a18\u5225\u8868/.test(text);
}

function looksLikeSalaryAppendixTable(tableHtml) {
  const text = normalizeText(visibleText(tableHtml));
  return /A\u00d72\.4/.test(text) && /A\u00d73\.2/.test(text);
}

function replaceTableCaption(tableHtml, captionText) {
  if (/<caption\b/i.test(tableHtml)) {
    return tableHtml.replace(/<caption\b[^>]*>[\s\S]*?<\/caption>/i, `<caption>${escapeHtml(captionText)}</caption>`);
  }
  return tableHtml.replace(/<table\b([^>]*)>/i, `<table$1><caption>${escapeHtml(captionText)}</caption>`);
}

function normalizeSagaPromotionShowcasePage(html) {
  let output = String(html || "");
  if (!/暮らしYASUKAさがし/.test(output) || !/佐賀市なんもな課/.test(output) || !/佐賀市紹介PR動画はこちら/.test(output)) {
    return output;
  }

  if (!/youtube\.com\/embed\/a4aNffjsZRM/i.test(output)) {
    output = output.replace(
      /^<div><p><span>坂井英隆(?:&nbsp;|\s)佐賀市長から移住をお考えの皆さまへメッセージです。<\/span><\/p>/,
      `<div>${buildYouTubeIframeHtml(
        "a4aNffjsZRM",
        "坂井英隆 佐賀市長から、移住をお考えの皆さまへメッセージです。【佐賀市シティプロモーション室】"
      )}<p><span>坂井英隆&nbsp;佐賀市長から移住をお考えの皆さまへメッセージです。</span></p>`
    );
  }

  output = output.replace(/<h4>令和4年全国広報コンクール 映像部門で入選！<\/h4>/, "<h3>令和4年全国広報コンクール 映像部門で入選！</h3>");
  output = output.replace(/<h4>全国広報コンクール<\/h4>/, "<p>【全国広報コンクール】</p>");
  output = output.replace(
    /<p><a href="https:\/\/www\.city\.saga\.lg\.jp\/promotion\/site_files\/file\/sumunara_chirashi\.pdf">/i,
    '<h4>住むなら佐賀市チラシ</h4><p><a href="https://www.city.saga.lg.jp/promotion/site_files/file/sumunara_chirashi.pdf">'
  );
  output = output.replace(
    /<p><br>\s*<span>佐賀市なんもな課【30秒CM】<\/span><\/p>/,
    `<h4>佐賀市なんもな課【30秒CM】</h4>${buildYouTubeIframeHtml("oKEthUT0jag", "佐賀市なんもな課 30秒CM")}`
  );
  output = output.replace(
    /<h4>佐賀市紹介PR動画はこちら<\/h4>[\s\S]*?<h2>実はすごい！“<strong>佐賀市<\/strong>”<\/h2>/,
    [
      "<h3>佐賀市紹介PR動画はこちら</h3>",
      '<h4><span lang="en">Surf Slow Saga</span></h4>',
      buildYouTubeIframeHtml("aVMBcNUqYO4", "Surf Slow SAGA, Japan 4K (Ultra HD) - 佐賀市"),
      "<p>豊かな自然に抱かれ、<br> 今なお日本の原風景の佇まいをみせるSaga。<br> 心地よい風に吹かれて、自然の音をBGMに寛ぐ贅沢な時間。</p>",
      '<h4><span lang="en">Feel &amp; Impression SAGA</span></h4>',
      buildYouTubeIframeHtml("mQ77FJhhgQw", "Feel & Impression SAGA, Japan 4K(UltraHD) - 佐賀市 -"),
      "<p>いつもの休日に物足りなさを感じてきたら、<br><span>ふらっと、佐賀市に遊びに来ませんか？</span>&nbsp;</p>",
      "<h2>実はすごい！“佐賀市”</h2>",
    ].join("")
  );

  output = output.replace(
    /<div><div><span>佐賀市は「<strong>都市の暮らしやすさ<\/strong>」<span><strong>１位<\/strong><\/span>！「<strong>子育てしながら働ける環境がある<\/strong>」<span><strong>３位<\/strong><\/span>！<\/span><\/div>/,
    '<div><h3>佐賀市は「都市の暮らしやすさ」1位！「子育てしながら働ける環境がある」3位！</h3>'
  );
  output = output.replace(
    /<div><div><span>「<strong>イクメン白書<\/strong>&nbsp;2020」で<strong>佐賀県<\/strong>が<span><span>１位<\/span><\/span>に！<\/span><\/div>/,
    '<div><h3>「イクメン白書 2020」で佐賀県が1位に！</h3>'
  );
  output = output.replace(
    /<div><div><span><strong>テレワーク<\/strong>に適した環境が整う自治体ランキング<span><strong>１位（九州・沖縄地区）<\/strong><\/span>！<\/span><\/div>/,
    "<div><h3>テレワークに適した環境が整う自治体ランキング1位（九州・沖縄地区）！</h3>"
  );
  output = output.replace(
    /<div><div><span>佐賀市の<strong>介護予防DX <span>総務大臣賞受賞<\/span><\/strong><\/span><\/div>/,
    "<div><h3>佐賀市の介護予防DX 総務大臣賞受賞</h3>"
  );

  output = output.replace(/<h4>プロモーション大使インタビュー<\/h4>/, "<h3>プロモーション大使インタビュー</h3>");
  output = output.replace(/<h4>佐賀市の紹介記事<\/h4>/, "<h3>佐賀市の紹介記事</h3>");

  output = output.replace(/<h2><a><\/a>１．日常【佐賀市にはここにしかない、美しい日常がある！】<\/h2>/, "<h3>1．日常【佐賀市にはここにしかない、美しい日常がある！】</h3>");
  output = output.replace(/<h2>２．グルメ【佐賀市には美味しいものがたくさんある！】<\/h2>/, "<h2>2．グルメ【佐賀市には美味しいものがたくさんある！】</h2>");
  output = output.replace(/<h2>３．子育て【佐賀市には子どもがのびのび育つ環境がある！】<\/h2>/, "<h2>3．子育て【佐賀市には子どもがのびのび育つ環境がある！】</h2>");
  output = output.replace(/<h2>４．仕事【佐賀市には充実した仕事とサポートがある！】<\/h2>/, "<h2>4．仕事【佐賀市には充実した仕事とサポートがある！】</h2>");

  output = output.replace(
    /<p><span>&nbsp;<\/span><\/p><p>暮らしYASUKAさがし(?:&nbsp;|\s)*【四季編(?:<span>)?】(?:<\/span>)?<\/p>/,
    `${buildYouTubeIframeHtml("vdSnziA_Ivk", "暮らしYASUKAさがし 四季編")}<p>暮らしYASUKAさがし 【四季編】</p>`
  );
  output = output.replace(
    /<p><\/p><p>暮らしYASUKAさがし(?:&nbsp;|\s)*【食編(?:<span>)?】(?:<\/span>)?<\/p>/,
    `${buildYouTubeIframeHtml("IxOu_6xlcZg", "暮らしYASUKAさがし 佐賀の食編")}<p>暮らしYASUKAさがし 【食編】</p>`
  );
  output = output.replace(
    /<p>暮らしYASUKAさがし(?:&nbsp;|\s)*【子育て編】(?:&nbsp;|\s)*暮らしYASUKAさがし(?:&nbsp;|\s)*【ゆとり編】<\/p><p>\s*<\/p><p>\s*暮らしYASUKAさがし【ゆとりある子育て編】(?:&nbsp;|\s)*暮らしYASUKAさがし【子育て環境編】<\/p>/,
    [
      buildYouTubeIframeHtml("Fbmk_lwN55A", "暮らしYASUKAさがし 子育て編"),
      "<p>暮らしYASUKAさがし 【子育て編】</p>",
      buildYouTubeIframeHtml("hiccmQATS5U", "暮らしYASUKAさがし ゆとり編"),
      "<p>暮らしYASUKAさがし 【ゆとり編】</p>",
      buildYouTubeIframeHtml("1v1g6oz5wbI", "暮らしYASUKAさがし ゆとりのある子育て編"),
      "<p>暮らしYASUKAさがし【ゆとりある子育て編】</p>",
      buildYouTubeIframeHtml("DK1ow4zcObg", "暮らしYASUKAさがし 子育て環境編"),
      "<p>暮らしYASUKAさがし【子育て環境編】</p>",
    ].join("")
  );
  output = output.replace(
    /<p>暮らしYASUKAさがし(?:&nbsp;|\s)*【仕事編】(?:&nbsp;|\s)*暮らしYASUKAさがし(?:&nbsp;|\s)*【就農編】<\/p><p>&nbsp;(?:&nbsp;|\s)*<\/p><p>\s*暮らしYASUKAさがし(?:&nbsp;|\s)*【テレワーク編】<\/p>/,
    [
      buildYouTubeIframeHtml("Jzl1kvzzfBM", "暮らしYASUKAさがし 仕事編"),
      "<p>暮らしYASUKAさがし 【仕事編】</p>",
      buildYouTubeIframeHtml("MMU0mlbr3-c", "暮らしYASUKAさがし 就農編"),
      "<p>暮らしYASUKAさがし 【就農編】</p>",
      buildYouTubeIframeHtml("SymLolFSEGk", "暮らしYASUKAさがし リモートワーク編"),
      "<p>暮らしYASUKAさがし 【テレワーク編】</p>",
    ].join("")
  );

  output = output.replace(/<span><strong>佐賀インターナショナルバルーンフェスタ<\/strong><\/span>/, "<h4>佐賀インターナショナルバルーンフェスタ</h4>");
  output = output.replace(/<span><strong>古湯・熊の川温泉郷ふるくま<\/strong><\/span>/, "<h4>古湯・熊の川温泉郷ふるくま</h4>");
  output = output.replace(/<span><strong>世界遺産(?:&nbsp;|\s)*三重津海軍所跡<\/strong><\/span>/, "<h4>世界遺産 三重津海軍所跡</h4>");
  output = output.replace(/<p>詳細<br>/, "<h4>詳細</h4><p>");

  output = output.replace(/<span><strong>佐賀の海苔は日本一<\/strong><\/span>/, "<h3>佐賀の海苔は日本一</h3>");
  output = output.replace(/<span><strong>ブランド牛といえばやっぱり佐賀牛<\/strong><\/span>/, "<h3>ブランド牛といえばやっぱり佐賀牛</h3>");
  output = output.replace(/<span><strong>佐賀の大人気ご当地グルメ(?:&nbsp;|\s)*シシリアンライス<\/strong><\/span>/, "<h3>佐賀の大人気ご当地グルメ シシリアンライス</h3>");

  output = output.replace(
    /<span><strong>子育てに関するお悩みをこの一冊で解決<br>\s*(<a [^>]+>『佐賀市の子育てガイドブックHug\(ハグ\)』<\/a>)<\/strong><\/span>/,
    "<h3>子育てに関するお悩みをこの一冊で解決</h3><p>$1</p>"
  );
  output = output.replace(/<span><strong>佐賀市(?:&nbsp;|\s)*妊娠・出産・子育て安心アプリ『にこさが』<\/strong><\/span>/, "<h3>佐賀市 妊娠・出産・子育て安心アプリ『にこさが』</h3>");
  output = output.replace(/<span><strong>子どもへのまなざし運動<\/strong><\/span>/, "<h3>子どもへのまなざし運動</h3>");
  output = output.replace(/<h4>そのほか関連リンク<\/h4>/, "<h3>そのほか関連リンク</h3>");

  return output;
}

function normalizeSagaPromotionShowcaseSnippets(html) {
  let output = String(html || "");
  output = normalizeSagaPromotionLeadVideoSnippet(output);
  output = normalizeSagaPromotionPairVideoSnippet(output);
  output = normalizeSagaPromotionYasukaVideoSnippets(output);
  return output;
}

function normalizeSagaPromotionLeadVideoSnippet(html) {
  let output = String(html || "");
  if (!/sumunara_(?:chirashi|poster)\.pdf/i.test(output) && !/promotion\/main\/1498\.html/i.test(output)) {
    return output;
  }

  if (!/<h4>\s*住むなら佐賀市チラシ\s*<\/h4>/i.test(output)) {
    output = output.replace(
      /<p>\s*<a href="([^"]*sumunara_chirashi\.pdf[^"]*)">/i,
      '<h4>住むなら佐賀市チラシ</h4><p><a href="$1">'
    );
  }
  output = replaceSagaPromotionSnippet(
    output,
    "oKEthUT0jag",
    /<p>\s*(?:<br>\s*)?(?:<span>)?\s*佐賀市なんもな課(?:&nbsp;|\s)*【30秒CM】\s*(?:<\/span>)?\s*<\/p>/i,
    `<h4>佐賀市なんもな課【30秒CM】</h4>${buildYouTubeIframeHtml("oKEthUT0jag", "佐賀市なんもな課 30秒CM")}`
  );
  return output;
}

function normalizeSagaPromotionPairVideoSnippet(html) {
  let output = String(html || "");
  if (!/Surf(?:&nbsp;|\s)+Slow(?:&nbsp;|\s)+Saga/i.test(output)) {
    return output;
  }

  output = output.replace(/<h4>\s*佐賀市紹介PR動画はこちら\s*<\/h4>/i, "<h3>佐賀市紹介PR動画はこちら</h3>");
  output = replaceSagaPromotionSnippet(
    output,
    "aVMBcNUqYO4",
    /(?:<td>)?\s*<strong>\s*<span>【Surf(?:&nbsp;|\s)+Slow(?:&nbsp;|\s)+Saga】<\/span>\s*&nbsp;\s*<\/strong>\s*<br>\s*<span>豊かな自然に抱かれ、<br>\s*今なお日本の原風景の佇まいをみせるSaga。<br>\s*心地よい風に吹かれて、自然の音をBGMに寛ぐ贅沢な時間。<\/span>\s*(?:<\/td>)?/i,
    [
      '<h4><span lang="en">Surf Slow Saga</span></h4>',
      buildYouTubeIframeHtml("aVMBcNUqYO4", "Surf Slow SAGA, Japan 4K (Ultra HD) - 佐賀市"),
      "<p>豊かな自然に抱かれ、<br>今なお日本の原風景の佇まいをみせるSaga。<br>心地よい風に吹かれて、自然の音をBGMに寛ぐ贅沢な時間。</p>",
    ].join("")
  );
  output = replaceSagaPromotionSnippet(
    output,
    "mQ77FJhhgQw",
    /(?:<td>)?\s*<span>\s*<strong>【Feel(?:&nbsp;|\s)+&amp;(?:&nbsp;|\s)+Impression(?:&nbsp;|\s)+SAGA】<\/strong>\s*&nbsp;\s*<\/span>\s*<br>\s*<span>いつもの休日に物足りなさを感じてきたら、<\/span>\s*<br>\s*<span>\s*<span>ふらっと、佐賀市に遊びに来ませんか？<\/span>\s*&nbsp;\s*<\/span>\s*(?:<\/td>)?/i,
    [
      '<h4><span lang="en">Feel &amp; Impression SAGA</span></h4>',
      buildYouTubeIframeHtml("mQ77FJhhgQw", "Feel & Impression SAGA, Japan 4K(UltraHD) - 佐賀市"),
      "<p>いつもの休日に物足りなさを感じてきたら、<br>ふらっと、佐賀市に遊びに来ませんか？</p>",
    ].join("")
  );
  return output;
}

function normalizeSagaPromotionYasukaVideoSnippets(html) {
  return normalizeSagaPromotionImageLinkShowcaseSnippets(html);
}

function normalizeSagaPromotionImageLinkShowcaseSnippets(html) {
  let output = String(html || "");
  const showcaseConfigs = [
    {
      imageSrcPattern: /promotion\/14_ijyuu\/1-\d+\.(?:jpg|png|JPG)/i,
      minImageCount: 2,
      maxImageCount: 4,
      relatedLinkPatterns: [/main\/54612\.html/i, /main(?:\.php)?\/199\.html/i, /main\.php\/3\.html/i, /sibf\.jp/i, /fuji-spa\.com/i],
      minRelatedLinkCount: 2,
      requireRelatedLinkList: true,
      labelPattern: /<p>\s*(?:<span>&nbsp;<\/span>)?\s*<\/p>\s*<p>\s*暮らしYASUKAさがし(?:&nbsp;|\s)*【四季編(?:<span>)?】(?:<\/span>)?\s*<\/p>/i,
      videos: [
        {
          id: "vdSnziA_Ivk",
          title: "暮らしYASUKAさがし 四季編",
          label: "暮らしYASUKAさがし 【四季編】",
        },
      ],
    },
    {
      imageSrcPattern: /promotion\/14_ijyuu\/4-\d+\.(?:jpg|png|JPG)/i,
      minImageCount: 2,
      maxImageCount: 4,
      relatedLinkPatterns: [/main\/302\.html/i, /sagabai\.com\/main\/\?cont=kanko(?:&amp;|&)cat=5/i],
      minRelatedLinkCount: 2,
      requireRelatedLinkList: true,
      labelPattern: /<p>\s*<\/p>\s*<p>\s*暮らしYASUKAさがし(?:&nbsp;|\s)*【食編(?:<span>)?】(?:<\/span>)?\s*<\/p>/i,
      videos: [
        {
          id: "IxOu_6xlcZg",
          title: "暮らしYASUKAさがし 佐賀の食編",
          label: "暮らしYASUKAさがし 【食編】",
        },
      ],
    },
    {
      imageSrcPattern: /promotion\/14_ijyuu\/(?:5-\d+\.(?:jpg|png|JPG)|manazashi\.png)/i,
      minImageCount: 2,
      maxImageCount: 4,
      relatedLinkPatterns: [
        /main\/64398\.html/i,
        /main\/3656\.html/i,
        /main\.php\/18\.html/i,
        /main\/13594\.html/i,
        /main\.php\/33585\.html/i,
        /main(?:\.php)?\/29741\.html/i,
        /sagabai\.com\/main\/\?cont=kanko(?:&amp;|&)fid=94/i,
        /haut\.jp\/kouno\//i,
      ],
      minRelatedLinkCount: 2,
      requireRelatedLinkList: true,
      labelPattern:
        /<p>(?:&nbsp;|\s|　)*<\/p>\s*<p>\s*暮らしYASUKAさがし(?:&nbsp;|\s)*【子育て編】(?:&nbsp;|\s|　)*暮らしYASUKAさがし(?:&nbsp;|\s)*【ゆとり編】\s*<\/p>\s*<p>(?:&nbsp;|\s|　)*<\/p>\s*<p>(?:&nbsp;|\s|　)*暮らしYASUKAさがし(?:&nbsp;|\s)*【ゆとりある子育て編】(?:&nbsp;|\s|　)*暮らしYASUKAさがし(?:&nbsp;|\s)*【子育て環境編】\s*<\/p>/i,
      videos: [
        {
          id: "Fbmk_lwN55A",
          title: "暮らしYASUKAさがし 子育て編",
          label: "暮らしYASUKAさがし 【子育て編】",
        },
        {
          id: "hiccmQATS5U",
          title: "暮らしYASUKAさがし ゆとり編",
          label: "暮らしYASUKAさがし 【ゆとり編】",
        },
        {
          id: "1v1g6oz5wbI",
          title: "暮らしYASUKAさがし ゆとりある子育て編",
          label: "暮らしYASUKAさがし 【ゆとりある子育て編】",
        },
        {
          id: "DK1ow4zcObg",
          title: "暮らしYASUKAさがし 子育て環境編",
          label: "暮らしYASUKAさがし 【子育て環境編】",
        },
      ],
    },
    {
      imageSrcPattern: /promotion\/14_ijyuu\/3-\d+\.(?:jpg|png|JPG)/i,
      minImageCount: 2,
      maxImageCount: 4,
      relatedLinkPatterns: [
        /main\.php\/575\.html/i,
        /main\/13620\.html/i,
        /main\.php\/252\.html/i,
        /main\.php\/51817\.html/i,
        /main\/39486\.html/i,
        /main\/19854\.html/i,
        /sagasmile\.com\/main\//i,
      ],
      minRelatedLinkCount: 2,
      requireRelatedLinkList: true,
      labelPattern:
        /<p>(?:&nbsp;|\s|　)*<\/p>\s*<p>\s*暮らしYASUKAさがし(?:&nbsp;|\s)*【仕事編】(?:&nbsp;|\s|　)*暮らしYASUKAさがし(?:&nbsp;|\s)*【就農編】\s*<\/p>\s*<p>(?:&nbsp;|\s|　)*<\/p>\s*<p>(?:&nbsp;|\s|　)*暮らしYASUKAさがし(?:&nbsp;|\s)*【テレワーク編】\s*<\/p>/i,
      videos: [
        {
          id: "Jzl1kvzzfBM",
          title: "暮らしYASUKAさがし 仕事編",
          label: "暮らしYASUKAさがし 【仕事編】",
        },
        {
          id: "MMU0mlbr3-c",
          title: "暮らしYASUKAさがし 就農編",
          label: "暮らしYASUKAさがし 【就農編】",
        },
        {
          id: "SymLolFSEGk",
          title: "暮らしYASUKAさがし リモートワーク編",
          label: "暮らしYASUKAさがし 【テレワーク編】",
        },
      ],
    },
  ];

  for (const config of showcaseConfigs) {
    output = replaceSagaPromotionImageLinkShowcaseGroup(output, config);
  }
  return output;
}

function replaceSagaPromotionImageLinkShowcaseGroup(html, config) {
  if (!hasSagaPromotionImageLinkShowcaseMarkers(html, config)) {
    return html;
  }
  return html.replace(config.labelPattern, buildSagaPromotionVideoGroupHtml(config.videos));
}

function hasSagaPromotionImageLinkShowcaseMarkers(html, config) {
  const sectionHtml = extractSagaPromotionImageLinkShowcaseSection(html, config.labelPattern);
  if (!sectionHtml) {
    return false;
  }
  const imageCount = countUniqueSagaPromotionMatches(sectionHtml, config.imageSrcPattern);
  const relatedLinkCount = countUniqueSagaPromotionPatterns(sectionHtml, config.relatedLinkPatterns || []);
  const minImageCount = config.minImageCount ?? 0;
  const maxImageCount = config.maxImageCount ?? Number.POSITIVE_INFINITY;
  const minRelatedLinkCount = config.minRelatedLinkCount ?? 0;
  const requireRelatedLinkList = config.requireRelatedLinkList ?? false;
  const hasImages = imageCount >= minImageCount && imageCount <= maxImageCount;
  const hasLinks = relatedLinkCount >= minRelatedLinkCount;
  const hasRelatedLinkList =
    !requireRelatedLinkList || /<(ul|ol)\b[\s\S]*?<a\b/i.test(sectionHtml) || /class=["'][^"']*link-item/i.test(sectionHtml);
  return hasImages && hasLinks && hasRelatedLinkList;
}

function extractSagaPromotionImageLinkShowcaseSection(html, labelPattern) {
  const source = String(html || "");
  const match = source.match(labelPattern);
  if (!match || typeof match.index !== "number") {
    return "";
  }

  const start = findPreviousSagaPromotionHeadingBoundary(source, match.index);
  const end = findNextSagaPromotionHeadingBoundary(source, match.index + String(match[0] || "").length);
  return source.slice(start, end);
}

function findPreviousSagaPromotionHeadingBoundary(html, fromIndex) {
  const prefix = String(html || "").slice(0, fromIndex);
  let boundary = 0;
  let lastMatch = null;
  for (const match of prefix.matchAll(/<h[1-6]\b[^>]*>[\s\S]*?<\/h[1-6]>/gi)) {
    lastMatch = match;
  }
  if (lastMatch && typeof lastMatch.index === "number") {
    boundary = lastMatch.index;
  }
  return boundary;
}

function findNextSagaPromotionHeadingBoundary(html, fromIndex) {
  const suffix = String(html || "").slice(fromIndex);
  const nextHeading = suffix.match(/<h[1-6]\b[^>]*>/i);
  if (!nextHeading || typeof nextHeading.index !== "number") {
    return String(html || "").length;
  }
  return fromIndex + nextHeading.index;
}

function countUniqueSagaPromotionPatterns(html, patterns) {
  const matches = new Set();
  for (const pattern of patterns) {
    for (const match of String(html || "").matchAll(toGlobalRegex(pattern))) {
      matches.add(String(match[0] || "").toLowerCase());
    }
  }
  return matches.size;
}

function countUniqueSagaPromotionMatches(html, pattern) {
  if (!pattern) {
    return 0;
  }
  return countUniqueSagaPromotionPatterns(html, [pattern]);
}

function toGlobalRegex(pattern) {
  const flags = pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`;
  return new RegExp(pattern.source, flags);
}

function hasSagaPromotionEmbed(html, embedId) {
  return new RegExp(`youtube\\.com\\/embed\\/${embedId}`, "i").test(html);
}

function replaceSagaPromotionSnippet(html, embedId, pattern, replacement) {
  if (hasSagaPromotionEmbed(html, embedId)) {
    return html;
  }
  return html.replace(pattern, replacement);
}

function buildSagaPromotionVideoGroupHtml(videos) {
  return videos.map((video) => buildSagaPromotionVideoSnippetHtml(video.id, video.title, video.label)).join("");
}

function buildSagaPromotionVideoSnippetHtml(videoId, title, label) {
  return `${buildYouTubeIframeHtml(videoId, title)}<p>${label}</p>`;
}

/*
function shouldNormalizeSagaPromotionShowcaseSnippets(html) {
  const source = String(html || "");
  const patterns = [
    /sumunara_(?:chirashi|poster)\.pdf/i,
    /promotion\/main\/1498\.html/i,
    /promotion\/site_files\/image\/promotion\/14_ijyuu\/(?:1-1|3-4|FB)\.(?:jpg|png|JPG)/i,
    /暮らしYASUKAさがし|證ｮ繧峨＠YASUKA/i,
  ];
  return patterns.some((pattern) => pattern.test(source));
}

function applyRegexReplacementRules(html, rules) {
  let output = String(html || "");
  for (const rule of rules) {
    output = output.replace(rule.pattern, rule.replacement);
  }
  return output;
}

function sagaPromotionShowcaseSnippetRules() {
  return [
    {
      pattern: /<h4>佐賀市紹介PR動画はこちら<\/h4>/,
      replacement: "<h3>佐賀市紹介PR動画はこちら</h3>",
    },
    {
      pattern: /<h4>菴占ｳ蟶らｴｹ莉輝R蜍慕判縺ｯ縺薙■繧・<\/h4>/,
      replacement: "<h3>菴占ｳ蟶らｴｹ莉輝R蜍慕判縺ｯ縺薙■繧・</h3>",
    },
    {
      pattern: /<p><a href="https:\/\/www\.city\.saga\.lg\.jp\/promotion\/site_files\/file\/sumunara_chirashi\.pdf">/i,
      replacement:
        '<h4>住むなら佐賀市チラシ</h4><p><a href="https://www.city.saga.lg.jp/promotion/site_files/file/sumunara_chirashi.pdf">',
    },
    {
      pattern: /<p><a href="https:\/\/www\.city\.saga\.lg\.jp\/promotion\/site_files\/file\/sumunara_chirashi\.pdf">/i,
      replacement:
        '<h4>菴上・縺ｪ繧我ｽ占ｳ蟶ゅメ繝ｩ繧ｷ</h4><p><a href="https://www.city.saga.lg.jp/promotion/site_files/file/sumunara_chirashi.pdf">',
    },
    {
      pattern: /<p><br>\s*<span>佐賀市なんもな課【30秒CM】<\/span><\/p>/,
      replacement: `<h4>佐賀市なんもな課【30秒CM】</h4>${buildYouTubeIframeHtml("oKEthUT0jag", "佐賀市なんもな課 30秒CM")}`,
    },
    {
      pattern: /<p><br>\s*<span>菴占ｳ蟶ゅ↑繧薙ｂ縺ｪ隱ｲ縲・0遘辰M縲・<\/span><\/p>/,
      replacement: `<h4>菴占ｳ蟶ゅ↑繧薙ｂ縺ｪ隱ｲ縲・0遘辰M縲・</h4>${buildYouTubeIframeHtml("oKEthUT0jag", "菴占ｳ蟶ゅ↑繧薙ｂ縺ｪ隱ｲ 30遘辰M")}`,
    },
    {
      pattern: /<p><span>&nbsp;<\/span><\/p><p>證ｮ繧峨＠YASUKA縺輔′縺・?:&nbsp;|\s)*縲仙屁蟄｣邱ｨ(?:<span>)?縲・?:<\/span>)?<\/p>/,
      replacement: `${buildYouTubeIframeHtml("vdSnziA_Ivk", "證ｮ繧峨＠YASUKA縺輔′縺・蝗帛ｭ｣邱ｨ")}<p>證ｮ繧峨＠YASUKA縺輔′縺・縲仙屁蟄｣邱ｨ縲・</p>`,
    },
    {
      pattern: /<p><\/p><p>證ｮ繧峨＠YASUKA縺輔′縺・?:&nbsp;|\s)*縲宣｣溽ｷｨ(?:<span>)?縲・?:<\/span>)?<\/p>/,
      replacement: `${buildYouTubeIframeHtml("IxOu_6xlcZg", "證ｮ繧峨＠YASUKA縺輔′縺・菴占ｳ縺ｮ鬟溽ｷｨ")}<p>證ｮ繧峨＠YASUKA縺輔′縺・縲宣｣溽ｷｨ縲・</p>`,
    },
    {
      pattern:
        /<p>證ｮ繧峨＠YASUKA縺輔′縺・?:&nbsp;|\s)*縲仙ｭ占ご縺ｦ邱ｨ縲・?:&nbsp;|\s)*證ｮ繧峨＠YASUKA縺輔′縺・?:&nbsp;|\s)*縲舌ｆ縺ｨ繧顔ｷｨ縲・<\/p><p>\s*<\/p><p>\s*證ｮ繧峨＠YASUKA縺輔′縺励舌ｆ縺ｨ繧翫≠繧句ｭ占ご縺ｦ邱ｨ縲・?:&nbsp;|\s)*證ｮ繧峨＠YASUKA縺輔′縺励仙ｭ占ご縺ｦ迺ｰ蠅・ｷｨ縲・<\/p>/,
      replacement: [
        buildYouTubeIframeHtml("Fbmk_lwN55A", "證ｮ繧峨＠YASUKA縺輔′縺・蟄占ご縺ｦ邱ｨ"),
        "<p>證ｮ繧峨＠YASUKA縺輔′縺・縲仙ｭ占ご縺ｦ邱ｨ縲・</p>",
        buildYouTubeIframeHtml("hiccmQATS5U", "證ｮ繧峨＠YASUKA縺輔′縺・繧・→繧顔ｷｨ"),
        "<p>證ｮ繧峨＠YASUKA縺輔′縺・縲舌ｆ縺ｨ繧顔ｷｨ縲・</p>",
        buildYouTubeIframeHtml("1v1g6oz5wbI", "證ｮ繧峨＠YASUKA縺輔′縺・繧・→繧翫・縺ゅｋ蟄占ご縺ｦ邱ｨ"),
        "<p>證ｮ繧峨＠YASUKA縺輔′縺励舌ｆ縺ｨ繧翫≠繧句ｭ占ご縺ｦ邱ｨ縲・</p>",
        buildYouTubeIframeHtml("DK1ow4zcObg", "證ｮ繧峨＠YASUKA縺輔′縺・蟄占ご縺ｦ迺ｰ蠅・ｷｨ"),
        "<p>證ｮ繧峨＠YASUKA縺輔′縺励仙ｭ占ご縺ｦ迺ｰ蠅・ｷｨ縲・</p>",
      ].join(""),
    },
    {
      pattern:
        /<p>證ｮ繧峨＠YASUKA縺輔′縺・?:&nbsp;|\s)*縲蝉ｻ穂ｺ狗ｷｨ縲・?:&nbsp;|\s)*證ｮ繧峨＠YASUKA縺輔′縺・?:&nbsp;|\s)*縲仙ｰｱ霎ｲ邱ｨ縲・<\/p><p>&nbsp;(?:&nbsp;|\s)*<\/p><p>\s*證ｮ繧峨＠YASUKA縺輔′縺・?:&nbsp;|\s)*縲舌ユ繝ｬ繝ｯ繝ｼ繧ｯ邱ｨ縲・<\/p>/,
      replacement: [
        buildYouTubeIframeHtml("Jzl1kvzzfBM", "證ｮ繧峨＠YASUKA縺輔′縺・莉穂ｺ狗ｷｨ"),
        "<p>證ｮ繧峨＠YASUKA縺輔′縺・縲蝉ｻ穂ｺ狗ｷｨ縲・</p>",
        buildYouTubeIframeHtml("MMU0mlbr3-c", "證ｮ繧峨＠YASUKA縺輔′縺・蟆ｱ霎ｲ邱ｨ"),
        "<p>證ｮ繧峨＠YASUKA縺輔′縺・縲仙ｰｱ霎ｲ邱ｨ縲・</p>",
        buildYouTubeIframeHtml("SymLolFSEGk", "證ｮ繧峨＠YASUKA縺輔′縺・繝ｪ繝｢繝ｼ繝医Ρ繝ｼ繧ｯ邱ｨ"),
        "<p>證ｮ繧峨＠YASUKA縺輔′縺・縲舌ユ繝ｬ繝ｯ繝ｼ繧ｯ邱ｨ縲・</p>",
      ].join(""),
    },
    {
      pattern: /<span><strong>菴占ｳ繧､繝ｳ繧ｿ繝ｼ繝翫す繝ｧ繝翫Ν繝舌Ν繝ｼ繝ｳ繝輔ぉ繧ｹ繧ｿ<\/strong><\/span>/,
      replacement: "<h4>菴占ｳ繧､繝ｳ繧ｿ繝ｼ繝翫す繝ｧ繝翫Ν繝舌Ν繝ｼ繝ｳ繝輔ぉ繧ｹ繧ｿ</h4>",
    },
    {
      pattern: /<span><strong>蜿､貉ｯ繝ｻ辭翫・蟾晄ｸｩ豕蛾・縺ｵ繧九￥縺ｾ<\/strong><\/span>/,
      replacement: "<h4>蜿､貉ｯ繝ｻ辭翫・蟾晄ｸｩ豕蛾・縺ｵ繧九￥縺ｾ</h4>",
    },
    {
      pattern: /<span><strong>荳也阜驕ｺ逕｣(?:&nbsp;|\s)*荳蛾㍾豢･豬ｷ霆肴園霍｡<\/strong><\/span>/,
      replacement: "<h4>荳也阜驕ｺ逕｣ 荳蛾㍾豢･豬ｷ霆肴園霍｡</h4>",
    },
    {
      pattern: /<span><strong>菴占ｳ縺ｮ豬ｷ闍斐・譌･譛ｬ荳<\/strong><\/span>/,
      replacement: "<h3>菴占ｳ縺ｮ豬ｷ闍斐・譌･譛ｬ荳</h3>",
    },
    {
      pattern: /<span><strong>繝悶Λ繝ｳ繝臥央縺ｨ縺・∴縺ｰ繧・▲縺ｱ繧贋ｽ占ｳ迚・<\/strong><\/span>/,
      replacement: "<h3>繝悶Λ繝ｳ繝臥央縺ｨ縺・∴縺ｰ繧・▲縺ｱ繧贋ｽ占ｳ迚・</h3>",
    },
    {
      pattern: /<span><strong>菴占ｳ縺ｮ螟ｧ莠ｺ豌励＃蠖灘慍繧ｰ繝ｫ繝｡(?:&nbsp;|\s)*繧ｷ繧ｷ繝ｪ繧｢繝ｳ繝ｩ繧､繧ｹ<\/strong><\/span>/,
      replacement: "<h3>菴占ｳ縺ｮ螟ｧ莠ｺ豌励＃蠖灘慍繧ｰ繝ｫ繝｡ 繧ｷ繧ｷ繝ｪ繧｢繝ｳ繝ｩ繧､繧ｹ</h3>",
    },
    {
      pattern: /<h4>縺昴・縺ｻ縺矩未騾｣繝ｪ繝ｳ繧ｯ<\/h4>/,
      replacement: "<h3>縺昴・縺ｻ縺矩未騾｣繝ｪ繝ｳ繧ｯ</h3>",
    },
  ];
}
*/

function buildYouTubeIframeHtml(videoId, title) {
  return `<p><iframe allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen="" frameborder="0" height="360" referrerpolicy="strict-origin-when-cross-origin" scrolling="no" src="https://www.youtube.com/embed/${escapeHtml(
    videoId
  )}" title="${escapeHtml(title)}" width="640"></iframe></p>`;
}

function buildSalaryReiwa8TableHtml() {
  const rows = [
    ["1\u5186\uff5e650,999\u5186", "0\u5186"],
    ["651,000\u5186\uff5e1,899,999\u5186", "\u53ce\u5165\u91d1\u984d-650,000\u5186"],
    ["1,900,000\u5186\uff5e3,599,999\u5186", `<p>${SALARY_A_NOTE}<br>A\u00d72.8-80,000\u5186</p>`],
    ["3,600,000\u5186\uff5e6,599,999\u5186", `${SALARY_A_NOTE}<br>A\u00d73.2-440,000\u5186`],
    ["6,600,000\u5186\uff5e8,499,999\u5186", `<p>\u53ce\u5165\u91d1\u984d\u00d70.9-1,100,000\u5186</p>`],
    ["8,500,000\u5186\uff5e", `<p>\u53ce\u5165\u91d1\u984d-1,950,000\u5186</p>`],
  ];
  return buildSimpleSalaryTableHtml(SALARY_R8_CAPTION, rows, `<p>${SALARY_TOTAL_HEADER}</p>`);
}

function buildSalaryReiwa3To7TableHtml() {
  const rows = [
    ["1\u5186\uff5e550,999\u5186", "0\u5186"],
    ["551,000\u5186\uff5e1,618,999\u5186", "\u53ce\u5165\u91d1\u984d-550,000\u5186"],
    ["1,619,000\u5186\uff5e1,619,999\u5186", "1,069,000\u5186"],
    ["1,620,000\u5186\uff5e1,621,999\u5186", "1,070,000\u5186"],
    ["1,622,000\u5186\uff5e1,623,999\u5186", "1,072,000\u5186"],
    ["1,624,000\u5186\uff5e1,627,999\u5186", "1,074,000\u5186"],
    ["1,628,000\u5186\uff5e1,799,999\u5186", `${SALARY_A_NOTE}<br>A\u00d72.4+100,000\u5186`],
    ["1,800,000\u5186\uff5e3,599,999\u5186", `${SALARY_A_NOTE}<br>A\u00d72.8-80,000\u5186`],
    ["3,600,000\u5186\uff5e6,599,999\u5186", `${SALARY_A_NOTE}<br>A\u00d73.2-440,000\u5186`],
    ["6,600,000\u5186\uff5e8,499,999\u5186", "\u53ce\u5165\u91d1\u984d\u00d70.9-1,100,000\u5186"],
    ["8,500,000\u5186\uff5e", "\u53ce\u5165\u91d1\u984d-1,950,000\u5186"],
  ];
  return buildSimpleSalaryTableHtml(SALARY_R3_TO_R7_CAPTION, rows);
}

function buildSimpleSalaryTableHtml(caption, rows, firstHeaderHtml = SALARY_TOTAL_HEADER) {
  const bodyRows = rows
    .map(([rangeText, valueHtml]) => `<tr><th scope="row">${rangeText}</th><td>${valueHtml}</td></tr>`)
    .join("");
  return `<table><caption>${escapeHtml(caption)}</caption><thead><tr><th scope="row">${firstHeaderHtml}</th><th scope="col">${SALARY_INCOME_HEADER}</th></tr></thead><tbody>${bodyRows}</tbody></table>`;
}

function normalizeDataTables(html) {
  const repeatedHeaders = repeatedUnlabeledHeaderSignatures(html);
  const tableCount = countRegex(String(html || "").toLowerCase(), /<table\b/g);
  return html.replace(/<table\b([^>]*)>([\s\S]*?)<\/table>/gi, (match, attrs, inner, offset, fullHtml) => {
    const profile = analyzeTable(inner);
    profile.hasRepeatedUnlabeledHeader = repeatedHeaders.has(tableHeaderSignature(inner));
    if (isReductionRateTransposeTableProfile(profile)) {
      return buildReductionRateTransposeTableHtml(attrs, inner, profile, fullHtml.slice(0, offset));
    }
    if (isMultiRowColumnHeaderTableProfile(profile)) {
      return buildMultiRowColumnHeaderTableHtml(attrs, inner, profile, fullHtml.slice(0, offset));
    }
    if (isMatchScheduleTableProfile(profile)) {
      return buildMatchScheduleTableHtml(attrs, inner, profile, fullHtml.slice(0, offset));
    }
    if (isGroupedComparisonTableProfile(profile)) {
      return buildGroupedComparisonTableHtml(attrs, inner, profile, fullHtml.slice(0, offset));
    }
    if (isArrowRelationTableProfile(profile)) {
      return buildArrowRelationTableHtml(attrs, inner, profile, fullHtml.slice(0, offset));
    }
    if (shouldAddCaptionOnly(profile)) {
      return buildCaptionOnlyTableHtml(attrs, inner, fullHtml.slice(0, offset), profile);
    }

    if (tableCount <= 8) {
      if (isLayoutTable(inner, profile)) {
        return decomposeLayoutTable(inner);
      }
      return buildLegacyDataTableHtml(attrs, inner, fullHtml.slice(0, offset), profile) || match;
    }
    if (shouldUpgradeDataTable(profile)) {
      return buildDataTableHtml(attrs, inner, profile, fullHtml.slice(0, offset));
    }

    if (isLayoutTable(inner, profile)) {
      return decomposeLayoutTable(inner);
    }
    return match;
  });
}

function isReductionRateTransposeTableProfile(profile) {
  if (profile.maxCols !== 3 || profile.bodyRows.length < 3) {
    return false;
  }
  const headerTexts = (profile.bodyRows[0] || []).map((cell) => normalizeComparisonCellText(cell.inner));
  if (headerTexts.length !== 3) {
    return false;
  }
  return (
    /^乗\s*用$/u.test(headerTexts[0]) &&
    /^貨\s*物$/u.test(headerTexts[1]) &&
    /^軽減の割合$/u.test(headerTexts[2]) &&
    profile.bodyRows.slice(1).every((cells) => cells.length === 3)
  );
}

function buildReductionRateTransposeTableHtml(attrs, inner, profile, prefix) {
  const headerRow = profile.bodyRows[0];
  const vehicleHeaders = headerRow.slice(0, 2).map((cell) => normalizeComparisonCellText(cell.inner).replace(/\s+/g, ""));
  const caption = resolveDataTableCaption(inner, profile, prefix);
  const captionHtml = caption ? `<caption>${escapeHtml(caption)}</caption>` : "";
  const bodyRows = profile.bodyRows
    .slice(1)
    .filter((cells) => !shouldDropReductionTransposeRow(cells))
    .map((cells) => {
      const rowLabel = normalizeComparisonCellText(cells[2]?.inner || "");
      return `<tr><th scope="row">${escapeHtml(rowLabel)}</th><td${cleanCellAttrs(
        cells[0]?.attrs || "",
        "td"
      )}>${normalizeComparisonValueCellInner(cells[0]?.inner || "")}</td><td${cleanCellAttrs(
        cells[1]?.attrs || "",
        "td"
      )}>${normalizeComparisonValueCellInner(cells[1]?.inner || "")}</td></tr>`;
    })
    .join("");
  return `<table${attrs}>${captionHtml}<thead><tr><th scope="row">軽減の割合</th><th scope="col">${escapeHtml(
    vehicleHeaders[0] || "乗用"
  )}</th><th scope="col">${escapeHtml(vehicleHeaders[1] || "貨物")}</th></tr></thead><tbody>${bodyRows}</tbody></table>`;
}

function shouldDropReductionTransposeRow(cells) {
  const ratioText = normalizeComparisonCellText(cells[2]?.inner || "");
  const cargoText = normalizeComparisonCellText(cells[1]?.inner || "");
  return /25％軽減/u.test(ratioText) && /^(?:ー|―|-|なし)$/u.test(cargoText);
}

function isMultiRowColumnHeaderTableProfile(profile) {
  if (profile.hasThead || profile.bodyRows.length < 4) {
    return false;
  }
  const headerDepth = cellSpanValue(profile.bodyRows[0]?.[0]?.attrs || "", "rowspan");
  if (headerDepth < 2 || headerDepth > 3) {
    return false;
  }
  const firstRow = profile.bodyRows[0] || [];
  if (firstRow.length < 2 || cellSpanValue(firstRow[0]?.attrs || "", "colspan") < 1) {
    return false;
  }
  const secondRow = profile.bodyRows[1] || [];
  if (secondRow.length < 2) {
    return false;
  }
  const dataRows = profile.bodyRows.slice(headerDepth);
  if (!dataRows.length) {
    return false;
  }
  const hasGroupedHeaders = profile.bodyRows
    .slice(0, headerDepth)
    .some((cells) => cells.some((cell) => cellSpanValue(cell.attrs, "colspan") > 1 || cellSpanValue(cell.attrs, "rowspan") > 1));
  const hasWideDataRows = dataRows.some((cells) => cells.length >= 4);
  return hasGroupedHeaders && hasWideDataRows;
}

function buildMultiRowColumnHeaderTableHtml(attrs, inner, profile, prefix) {
  const headerDepth = cellSpanValue(profile.bodyRows[0]?.[0]?.attrs || "", "rowspan");
  const headerRows = profile.bodyRows.slice(0, headerDepth);
  const bodyRows = profile.bodyRows.slice(headerDepth);
  if (!headerRows.length || !bodyRows.length) {
    return "";
  }

  const axisLabel = normalizeComparisonCellText(headerRows[0]?.[0]?.inner || "");
  const dataColumnCount = Math.max(1, rowColumnSpanCount(headerRows[0].slice(1)));
  const headerGrid = buildHeaderGrid(headerRows, dataColumnCount);
  if (!headerGrid.length) {
    return "";
  }

  let visibleDataColumnCount = dataColumnCount;
  if (shouldTrimTrailingQuarterReductionColumn(profile, headerGrid, bodyRows)) {
    visibleDataColumnCount -= 1;
  }

  const columnHeaders = Array.from({ length: visibleDataColumnCount }, (_item, columnIndex) =>
    combineHeaderGridLabels(headerGrid, columnIndex)
  );
  const caption = inferStrongOnlyParagraphCaption(prefix) || resolveDataTableCaption(inner, profile, prefix);
  const captionHtml = caption ? `<caption>${escapeHtml(caption)}</caption>` : "";
  const thead = `<thead><tr><th scope="row">${escapeHtml(axisLabel)}</th>${columnHeaders
    .map((text) => `<th scope="col">${escapeHtml(text)}</th>`)
    .join("")}</tr></thead>`;

  const bodyHtml = bodyRows
    .map((cells) => {
      const rowLabel = normalizeComparisonCellText(cells[0]?.inner || "");
      const dataCells = cells.slice(1, 1 + visibleDataColumnCount);
      return `<tr><th scope="row">${escapeHtml(rowLabel)}</th>${dataCells
        .map((cell) => `<td${cleanCellAttrs(cell.attrs, "td")}>${normalizeComparisonValueCellInner(cell.inner)}</td>`)
        .join("")}</tr>`;
    })
    .join("");

  return `<table${attrs}>${captionHtml}${thead}<tbody>${bodyHtml}</tbody></table>`;
}

function buildHeaderGrid(headerRows, dataColumnCount) {
  const grid = Array.from({ length: headerRows.length }, () => Array.from({ length: dataColumnCount }, () => ""));
  for (let rowIndex = 0; rowIndex < headerRows.length; rowIndex += 1) {
    const cells = headerRows[rowIndex];
    let columnIndex = 0;
    for (let cellIndex = 0; cellIndex < cells.length; cellIndex += 1) {
      if (rowIndex === 0 && cellIndex === 0) {
        continue;
      }
      while (columnIndex < dataColumnCount && grid[rowIndex][columnIndex]) {
        columnIndex += 1;
      }
      const cell = cells[cellIndex];
      const colspan = Math.max(1, cellSpanValue(cell.attrs, "colspan"));
      const rowspan = Math.max(1, cellSpanValue(cell.attrs, "rowspan"));
      const text = normalizeComparisonCellText(cell.inner);
      for (let rowOffset = 0; rowOffset < rowspan; rowOffset += 1) {
        for (let columnOffset = 0; columnOffset < colspan; columnOffset += 1) {
          const targetRow = rowIndex + rowOffset;
          const targetColumn = columnIndex + columnOffset;
          if (targetRow < grid.length && targetColumn < dataColumnCount) {
            grid[targetRow][targetColumn] = text;
          }
        }
      }
      columnIndex += colspan;
    }
  }
  return grid;
}

function combineHeaderGridLabels(headerGrid, columnIndex) {
  const labels = [];
  for (const row of headerGrid) {
    const text = normalizeComparisonCellText(row[columnIndex] || "");
    if (!text || labels[labels.length - 1] === text) {
      continue;
    }
    labels.push(text);
  }
  return labels.join(" ");
}

function shouldTrimTrailingQuarterReductionColumn(profile, headerGrid, bodyRows) {
  if (profile.maxCols !== 5 || headerGrid[0]?.length !== 4 || bodyRows.length < 2) {
    return false;
  }
  const lastHeader = combineHeaderGridLabels(headerGrid, headerGrid[0].length - 1);
  if (!/25％軽減/u.test(lastHeader)) {
    return false;
  }
  const placeholderValues = bodyRows
    .map((cells) => normalizeComparisonCellText(cells[cells.length - 1]?.inner || ""))
    .filter(Boolean);
  return placeholderValues.filter((text) => /^(?:ー|―|-|なし)$/u.test(text)).length >= Math.max(2, placeholderValues.length - 1);
}

function isMatchScheduleTableProfile(profile) {
  if (profile.maxCols !== 7 || profile.bodyRows.length < 3) {
    return false;
  }
  const headerTexts = (profile.bodyRows[0] || []).map((cell) => normalizeComparisonCellText(cell.inner));
  if (headerTexts.length !== 7) {
    return false;
  }
  const signature = ["節", "日程", "開始時間", "試合会場", "対戦相手", "試合結果", "勝敗"];
  if (!signature.every((label, index) => headerTexts[index] === label)) {
    return false;
  }
  return profile.bodyRows.slice(1).every((cells) => cells.length === 7 || cells.length === 4);
}

function buildMatchScheduleTableHtml(attrs, inner, profile, prefix) {
  const caption = normalizeMatchScheduleCaption(
    inferLastHeadingText(prefix) ||
      inferStrongOnlyParagraphCaption(prefix) ||
      resolveDataTableCaption(inner, profile, prefix)
  );
  const captionHtml = caption ? `<caption>${escapeHtml(caption)}</caption>` : "";
  const thead =
    '<thead><tr><th scope="row">日程</th><th scope="col">開始時間</th><th scope="col">試合会場</th><th scope="col">対戦相手</th><th scope="col">試合結果</th><th scope="col">勝敗</th></tr></thead>';

  let currentSection = "";
  let currentVenue = "";
  let currentOpponent = "";

  const bodyRows = profile.bodyRows
    .slice(1)
    .map((cells) => {
      let sectionText = currentSection;
      let dateCell;
      let timeCell;
      let venueCell;
      let opponentCell;
      let resultCell;
      let outcomeCell;

      if (cells.length === 7) {
        sectionText = normalizeComparisonCellText(cells[0]?.inner || "");
        dateCell = cells[1];
        timeCell = cells[2];
        venueCell = cells[3];
        opponentCell = cells[4];
        resultCell = cells[5];
        outcomeCell = cells[6];
        currentSection = sectionText;
        currentVenue = cells[3]?.inner || "";
        currentOpponent = cells[4]?.inner || "";
      } else {
        dateCell = cells[0];
        timeCell = cells[1];
        venueCell = { attrs: "", inner: currentVenue };
        opponentCell = { attrs: "", inner: currentOpponent };
        resultCell = cells[2];
        outcomeCell = cells[3];
      }

      const rowHeaderText = [formatMatchScheduleSection(sectionText), formatMatchScheduleDate(dateCell?.inner || "")]
        .filter(Boolean)
        .join(" ");

      return `<tr><th scope="row">${escapeHtml(rowHeaderText)}</th><td${cleanCellAttrs(
        timeCell?.attrs || "",
        "td"
      )}>${escapeHtml(formatMatchScheduleTime(timeCell?.inner || ""))}</td><td${cleanCellAttrs(
        venueCell?.attrs || "",
        "td"
      )}>${normalizeComparisonValueCellInner(venueCell?.inner || "")}</td><td${cleanCellAttrs(
        opponentCell?.attrs || "",
        "td"
      )}>${normalizeComparisonValueCellInner(opponentCell?.inner || "")}</td><td${cleanCellAttrs(
        resultCell?.attrs || "",
        "td"
      )}>${normalizeComparisonValueCellInner(resultCell?.inner || "")}</td><td${cleanCellAttrs(
        outcomeCell?.attrs || "",
        "td"
      )}>${escapeHtml(formatMatchScheduleOutcome(outcomeCell?.inner || ""))}</td></tr>`;
    })
    .join("");

  return `<table${attrs}>${captionHtml}${thead}<tbody>${bodyRows}</tbody></table>`;
}

function normalizeMatchScheduleCaption(captionText) {
  const text = normalizeComparisonCellText(captionText);
  if (!text) {
    return "";
  }
  if (/^(?:ホームゲーム|アウェーゲーム)$/u.test(text)) {
    return `${text}の一覧`;
  }
  return text.replace(/(ホームゲーム|アウェーゲーム)一覧$/u, "$1の一覧");
}

function inferLastHeadingText(prefix) {
  const matches = [...String(prefix || "").matchAll(/<h[1-6]\b[^>]*>([\s\S]*?)<\/h[1-6]>/gi)];
  const last = matches[matches.length - 1];
  return last ? normalizeText(visibleText(last[1])) : "";
}

function formatMatchScheduleSection(text) {
  const normalized = normalizeComparisonCellText(text);
  if (!normalized) {
    return "";
  }
  return /^第.+節$/u.test(normalized) ? normalized : `第${normalized}節`;
}

function formatMatchScheduleDate(text) {
  const normalized = normalizeComparisonCellText(text);
  const match = normalized.match(/^(\d{2})\.(\d{1,2})\.(\d{1,2})\s*[（(]?\s*([月火水木金土日])\s*[)）]?$/u);
  if (!match) {
    return normalized;
  }
  const weekdayMap = {
    月: "月曜日",
    火: "火曜日",
    水: "水曜日",
    木: "木曜日",
    金: "金曜日",
    土: "土曜日",
    日: "日曜日",
  };
  return `${match[1]}年${Number(match[2])}月${Number(match[3])}日（${weekdayMap[match[4]] || match[4]}）`;
}

function formatMatchScheduleTime(text) {
  const normalized = normalizeComparisonCellText(text);
  const match = normalized.match(/^(\d{1,2})[：:](\d{2})$/u);
  return match ? `${Number(match[1])}時${match[2]}分` : normalized;
}

function formatMatchScheduleOutcome(text) {
  const normalized = normalizeComparisonCellText(text);
  if (normalized === "〇") {
    return "勝";
  }
  if (normalized === "×") {
    return "敗";
  }
  return normalized;
}

function isGroupedComparisonTableProfile(profile) {
  if (profile.hasThead || profile.maxCols !== 4 || profile.bodyRows.length < 3) {
    return false;
  }
  const [headerRow, ...bodyRows] = profile.bodyRows;
  if (headerRow.length !== 3 || cellSpanValue(headerRow[0]?.attrs || "", "colspan") < 2) {
    return false;
  }
  if (
    !normalizeText(visibleText(headerRow[0]?.inner || "")) ||
    !normalizeText(visibleText(headerRow[1]?.inner || "")) ||
    !normalizeText(visibleText(headerRow[2]?.inner || ""))
  ) {
    return false;
  }

  let groupedRows = 0;
  let sawContinuation = false;
  for (const cells of bodyRows) {
    if (cells.length !== 3 && cells.length !== 4) {
      return false;
    }
    const valueCells = cells.length === 4 ? cells.slice(2) : cells.slice(1);
    if (
      valueCells.length !== 2 ||
      valueCells.some((cell) => !normalizeText(visibleText(cell.inner || "")))
    ) {
      return false;
    }
    if (cells.length === 4) {
      groupedRows += 1;
      if (cellSpanValue(cells[0]?.attrs || "", "rowspan") > 1) {
        sawContinuation = true;
      }
    } else if (cellSpanValue(cells[0]?.attrs || "", "colspan") >= 2) {
      groupedRows += 1;
    } else {
      sawContinuation = true;
    }
  }

  return groupedRows >= 2 && sawContinuation;
}

function buildGroupedComparisonTableHtml(attrs, inner, profile, prefix) {
  const caption = inferStrongOnlyParagraphCaption(prefix) || resolveDataTableCaption(inner, profile, prefix);
  const captionHtml = caption ? `<caption>${escapeHtml(caption)}</caption>` : "";
  const [headerRow, ...bodyRows] = profile.bodyRows;
  const thead = `<thead><tr><th scope="row">${escapeHtml(
    normalizeComparisonCellText(headerRow[0]?.inner || "")
  )}</th><th scope="col">${normalizeComparisonValueCellInner(
    headerRow[1]?.inner || ""
  )}</th><th scope="col">${normalizeComparisonValueCellInner(
    headerRow[2]?.inner || ""
  )}</th></tr></thead>`;

  let activeGroupLabel = "";
  let activePrimaryLabel = "";
  let activeMode = "space";
  let remainingGroupRows = 0;

  const flattenedRows = bodyRows
    .map((cells) => {
      let rowHeaderText = "";
      let valueCells = [];

      if (cells.length === 4) {
        const groupLabel = normalizeComparisonCellText(cells[0]?.inner || "");
        const primaryLabel = normalizeComparisonCellText(cells[1]?.inner || "");
        rowHeaderText = combineGroupedComparisonLabels(groupLabel, primaryLabel);
        valueCells = cells.slice(2);

        const rowspan = cellSpanValue(cells[0]?.attrs || "", "rowspan");
        if (rowspan > 1) {
          activeGroupLabel = groupLabel;
          activePrimaryLabel = primaryLabel;
          activeMode = groupedComparisonLabelMode(primaryLabel);
          remainingGroupRows = rowspan - 1;
        } else {
          activeGroupLabel = "";
          activePrimaryLabel = "";
          activeMode = "space";
          remainingGroupRows = 0;
        }
      } else if (cellSpanValue(cells[0]?.attrs || "", "colspan") >= 2 || !activeGroupLabel) {
        rowHeaderText = normalizeComparisonCellText(cells[0]?.inner || "");
        valueCells = cells.slice(1);
        activeGroupLabel = "";
        activePrimaryLabel = "";
        activeMode = "space";
        remainingGroupRows = 0;
      } else {
        const continuationLabel = normalizeComparisonCellText(cells[0]?.inner || "");
        rowHeaderText =
          activeMode === "colon"
            ? combineGroupedComparisonLabels(activeGroupLabel, continuationLabel)
            : [activeGroupLabel, activePrimaryLabel, continuationLabel].filter(Boolean).join(" ");
        valueCells = cells.slice(1);
        remainingGroupRows = Math.max(0, remainingGroupRows - 1);
        if (!remainingGroupRows) {
          activeGroupLabel = "";
          activePrimaryLabel = "";
          activeMode = "space";
        }
      }

      return `<tr><th scope="row">${escapeHtml(rowHeaderText)}</th>${valueCells
        .map((cell) => `<td${cleanCellAttrs(cell.attrs, "td")}>${normalizeComparisonValueCellInner(cell.inner)}</td>`)
        .join("")}</tr>`;
    })
    .join("");

  return `<table${attrs}>${captionHtml}${thead}<tbody>${flattenedRows}</tbody></table>`;
}

function groupedComparisonLabelMode(labelText) {
  return /^(?:長さ|幅|高さ|横|縦|奥行|厚さ|深さ|面積|重量|年齢|期間|回数)$/u.test(labelText) ? "colon" : "space";
}

function combineGroupedComparisonLabels(groupLabel, detailLabel) {
  const left = normalizeComparisonCellText(groupLabel);
  const right = normalizeComparisonCellText(detailLabel);
  if (!left) {
    return right;
  }
  if (!right) {
    return left;
  }
  return groupedComparisonLabelMode(right) === "colon" ? `${left}：${right}` : `${left} ${right}`;
}

function normalizeComparisonCellText(html) {
  return normalizeText(visibleText(html)).replace(/\s+/g, " ").trim();
}

function normalizeComparisonValueCellInner(inner) {
  const text = normalizeComparisonCellText(inner);
  if (/^[ー－―-]+$/u.test(text)) {
    return "なし";
  }
  return String(inner || "")
    .replace(/([0-9]+(?:\.[0-9]+)?)m(?=\s*(?:以下|未満|以上|以内|程度|$))/gu, "$1メートル")
    .replace(/（\s+/g, "（")
    .replace(/\s+）/g, "）")
    .trim();
}

function isArrowRelationTableProfile(profile) {
  if (profile.hasThead || profile.maxCols !== 3 || profile.bodyRows.length < 1) {
    return false;
  }
  return profile.bodyRows.every((cells) => {
    if (cells.length !== 3) {
      return false;
    }
    const leftText = normalizeComparisonCellText(cells[0]?.inner || "");
    const middleText = normalizeComparisonCellText(cells[1]?.inner || "");
    const rightText = normalizeComparisonCellText(cells[2]?.inner || "");
    return Boolean(leftText && rightText && /^(?:⇨|⇒|→|->)$/u.test(middleText));
  });
}

function buildArrowRelationTableHtml(attrs, inner, profile, prefix) {
  const caption = inferStrongOnlyParagraphCaption(prefix) || resolveDataTableCaption(inner, profile, prefix);
  const captionHtml = caption ? `<caption>${escapeHtml(caption)}</caption>` : "";
  const bodyRows = profile.bodyRows
    .map((cells) => {
      const rowLabel = normalizeComparisonCellText(cells[0]?.inner || "");
      return `<tr><th scope="row">${escapeHtml(rowLabel)}</th><td${cleanCellAttrs(
        cells[2]?.attrs || "",
        "td"
      )}>${normalizeComparisonValueCellInner(cells[2]?.inner || "")}</td></tr>`;
    })
    .join("");
  return `<table${attrs}>${captionHtml}<tbody>${bodyRows}</tbody></table>`;
}

function inferStrongOnlyParagraphCaption(prefix) {
  const paragraphs = [...String(prefix || "").matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)];
  for (let index = paragraphs.length - 1; index >= 0; index -= 1) {
    const inner = paragraphs[index][1] || "";
    if (
      !/^\s*(?:<(?:strong|b|span|em)\b[^>]*>[\s\S]*?<\/(?:strong|b|span|em)>\s*)+$/i.test(inner) ||
      !/<(?:strong|b)\b/i.test(inner) ||
      /<(?:a|br|table)\b/i.test(inner)
    ) {
      continue;
    }
    const text = normalizeText(visibleText(inner));
    if (text && text.length <= 64) {
      return text;
    }
  }
  return "";
}

function repeatedUnlabeledHeaderSignatures(html) {
  const counts = new Map();
  String(html || "").replace(/<table\b[^>]*>([\s\S]*?)<\/table>/gi, (_match, inner) => {
    if (/<(th|caption|thead)\b/i.test(inner)) {
      return "";
    }
    const signature = tableHeaderSignature(inner);
    if (signature) {
      counts.set(signature, (counts.get(signature) || 0) + 1);
    }
    return "";
  });
  return new Set([...counts.entries()].filter((entry) => entry[1] >= 4).map((entry) => entry[0]));
}

function tableHeaderSignature(inner) {
  const firstRow = parseRows(inner)[0] || "";
  const text = normalizeText(visibleText(firstRow));
  return text.length >= 8 ? text : "";
}

function analyzeTable(inner) {
  const rows = parseRows(inner);
  const rowCells = rows.map(parseCells);
  const bodyRows = rowCells.filter((cells) => cells.length > 0);
  const maxCols = bodyRows.reduce((max, cells) => Math.max(max, cells.length), 0);
  const flatCells = bodyRows.flat();
  const hasCaption = Boolean(existingCaption(inner));
  const hasThead = /<thead\b/i.test(inner);
  const hasScope = /\bscope=(["'])(row|col)\1/i.test(inner);
  const hasMedia = /<img\b|<iframe\b|<video\b|<audio\b|<object\b|<embed\b/i.test(inner);
  const hasLayoutHint = /\b(?:border|cellpadding|cellspacing|width|align|valign)=["']?0?|\bstyle=(["'])[^"']*(?:border\s*:\s*0|display\s*:|float\s*:|width\s*:)/i.test(inner);
  const hasBlockInCell = /<(td|th)\b[^>]*>[\s\S]*?<(p|div|figure|h[1-6]|ul|ol)\b/i.test(inner);
  const firstRow = bodyRows[0] || [];
  const firstColumnHeaderRatio = bodyRows.length
    ? bodyRows.filter((cells) => cells[0]?.tag === "th").length / bodyRows.length
    : 0;
  const firstRowHeaderLike = firstRow.length >= 2 && firstRow.every((cell) => isHeaderLikeCell(cell.inner));
  const hasNumericOrContactData = bodyRows.some((cells, rowIndex) =>
    rowIndex > 0 && cells.some((cell) => isDataValueText(visibleText(cell.inner)))
  );
  const hasAnyDataValues = bodyRows.some((cells) => cells.some((cell) => isDataValueText(visibleText(cell.inner))));

  return {
    rows,
    rowCells,
    bodyRows,
    maxCols,
    flatCells,
    firstRow,
    hasCaption,
    hasThead,
    hasScope,
    hasMedia,
    hasLayoutHint,
    hasBlockInCell,
    firstColumnHeaderRatio,
    firstRowHeaderLike,
    hasNumericOrContactData,
    hasAnyDataValues,
  };
}

function isDataValueText(text) {
  const normalized = normalizeText(text);
  return /[0-9０-９]|電話|TEL|FAX|メール|住所|所在地|円|％|%/.test(normalized);
}

function shouldAddCaptionOnly(profile) {
  const hasExplicitSemantics =
    profile.hasCaption || profile.hasThead || profile.flatCells.some((cell) => cell.tag === "th") || profile.hasScope;
  if (hasExplicitSemantics || profile.bodyRows.length < 2 || profile.maxCols < 2 || profile.hasMedia) {
    return false;
  }
  const text = normalizeText(visibleText(profile.bodyRows.flat().map((cell) => cell.inner).join(" ")));
  const averageCellLength = text.length / Math.max(1, profile.bodyRows.flat().length);
  const relationTable = /⇨|⇒|→|->/.test(text) && profile.hasAnyDataValues;
  return profile.bodyRows.length <= 2 && profile.maxCols <= 3 && (relationTable || (profile.hasNumericOrContactData && averageCellLength >= 36));
}

function buildCaptionOnlyTableHtml(attrs, inner, prefix, profile) {
  const caption = inferCaptionBefore(prefix) || inferCaptionFromTable(profile);
  if (!caption) {
    return `<table${attrs}>${inner}</table>`;
  }
  return `<table${attrs}><caption>${escapeHtml(caption)}</caption>${inner}</table>`;
}

function buildLegacyDataTableHtml(attrs, inner, prefix, profile = analyzeTable(inner)) {
  const rows = parseRows(inner);
  if (rows.length < 1) {
    return "";
  }
  if (isRowHeaderOnlyDataTableProfile(profile)) {
    return buildRowHeaderOnlyTableHtml(attrs, inner, profile, prefix);
  }
  if (isTitledColumnHeaderTableProfile(profile) || isSingleRecordContactTableProfile(profile)) {
    return buildDataTableHtml(attrs, inner, profile, prefix);
  }
  const caption = existingCaption(inner) || inferCaptionBefore(prefix);
  const headerCells = parseCells(rows[0]);
  if (headerCells.length < 2) {
    return "";
  }
  const thead = `<thead><tr>${headerCells
    .map((cell, index) => `<th scope="${index === 0 ? "row" : "col"}">${cell.inner}</th>`)
    .join("")}</tr></thead>`;
  const bodyRows = rows.slice(1).map((row) => {
    const cells = parseCells(row);
    if (!cells.length) return row;
    return `<tr>${cells
      .map((cell, index) => {
        const tag = index === 0 ? "th" : "td";
        const scope = index === 0 ? ' scope="row"' : "";
        return `<${tag}${scope}>${cell.inner}</${tag}>`;
      })
      .join("")}</tr>`;
  });
  const captionHtml = caption ? `<caption>${escapeHtml(caption)}</caption>` : "";
  return `<table${attrs}>${captionHtml}${thead}<tbody>${bodyRows.join("")}</tbody></table>`;
}

function shouldUpgradeDataTable(profile) {
  if ((profile.bodyRows.length < 2 && !isSingleRecordContactTableProfile(profile)) || profile.maxCols < 2) {
    return false;
  }

  const hasExplicitSemantics =
    profile.hasCaption || profile.hasThead || profile.flatCells.some((cell) => cell.tag === "th") || profile.hasScope;
  if (profile.hasMedia && !hasExplicitSemantics) {
    return false;
  }
  if (profile.hasRepeatedUnlabeledHeader && !hasExplicitSemantics) {
    return false;
  }

  const dataTableLike =
    hasExplicitSemantics ||
    isRowHeaderOnlyDataTableProfile(profile) ||
    isTitledColumnHeaderTableProfile(profile) ||
    profile.firstRowHeaderLike ||
    looksLikeContactTable(profile) ||
    profile.hasNumericOrContactData ||
    profile.bodyRows.length >= 3;

  if (!dataTableLike) {
    return false;
  }

  return !hasCompleteTableSemantics(profile);
}

function hasCompleteTableSemantics(profile) {
  if (isRowHeaderOnlyDataTableProfile(profile)) {
    return Boolean(profile.hasCaption && profile.flatCells.some((cell) => cell.tag === "th") && profile.hasScope && !profile.hasThead);
  }
  return Boolean(profile.hasCaption && profile.hasThead && profile.flatCells.some((cell) => cell.tag === "th") && profile.hasScope);
}

function buildDataTableHtml(attrs, inner, profile, prefix) {
  if (isRowHeaderOnlyDataTableProfile(profile)) {
    const caption = resolveDataTableCaption(inner, profile, prefix);
    const captionHtml = caption ? `<caption>${escapeHtml(caption)}</caption>` : "";
    const bodyRows = profile.bodyRows.map((cells, rowIndex) => {
      return `<tr>${cells
        .map((cell, index) => {
          if (index === 0) {
            return rowHeaderCellHtml(cell, rowIndex > 0);
          }
          return `<td${cleanCellAttrs(cell.attrs, "td")}>${cell.inner}</td>`;
        })
        .join("")}</tr>`;
    });
    return `<table${attrs}>${captionHtml}<tbody>${bodyRows.join("")}</tbody></table>`;
  }
  if (isTitledColumnHeaderTableProfile(profile)) {
    const caption = resolveDataTableCaption(inner, profile, prefix);
    const captionHtml = caption ? `<caption>${escapeHtml(caption)}</caption>` : "";
    const headerCells = profile.bodyRows[1] || [];
    const thead = `<thead><tr>${headerCells.map((cell) => headerCellHtml(cell, "col")).join("")}</tr></thead>`;
    const bodyRows = profile.bodyRows.slice(2).map((cells) => {
      return `<tr>${cells.map((cell) => titledBodyCellHtml(cell)).join("")}</tr>`;
    });
    return `<table${attrs}>${captionHtml}${thead}<tbody>${bodyRows.join("")}</tbody></table>`;
  }
  const caption = resolveDataTableCaption(inner, profile, prefix);
  const captionHtml = caption ? `<caption>${escapeHtml(caption)}</caption>` : "";
  const headerPlan = planHeaderRows(profile);
  const thead = headerPlan.headerCells.length
    ? `<thead><tr>${headerPlan.headerCells
        .map((cell, index) => headerCellHtml(cell, resolvePlannedHeaderScope(profile, headerPlan, index)))
        .join("")}</tr></thead>`
    : "";
  const bodyRows = profile.bodyRows.slice(headerPlan.bodyStartIndex).map((cells) => {
    return `<tr>${cells.map((cell, index) => bodyCellHtml(cell, index)).join("")}</tr>`;
  });
  return `<table${attrs}>${captionHtml}${thead}<tbody>${bodyRows.join("")}</tbody></table>`;
}

function resolvePlannedHeaderScope(profile, headerPlan, index) {
  if (!headerPlan.synthetic && profile.maxCols === 2 && headerPlan.headerCells.length === 2 && index === 0) {
    return "row";
  }
  if (headerPlan.synthetic && shouldUseRowCornerHeaderForContactTable(profile) && index === 0) {
    return "row";
  }
  return "col";
}

function shouldUseRowCornerHeaderForContactTable(profile) {
  if (!looksLikeContactTable(profile)) {
    return false;
  }
  const firstCell = profile.bodyRows[0]?.[0];
  return Boolean(firstCell && firstCell.tag === "th" && !/\bscope=/i.test(firstCell.attrs || ""));
}

function planHeaderRows(profile) {
  if (!profile.hasThead && profile.firstColumnHeaderRatio >= 0.5) {
    return {
      headerCells: inferSyntheticHeaderCells(profile),
      bodyStartIndex: 0,
      synthetic: true,
    };
  }

  if (profile.hasThead || profile.firstRowHeaderLike || profile.firstRow.every((cell) => cell.tag === "th")) {
    return {
      headerCells: profile.firstRow,
      bodyStartIndex: 1,
      synthetic: false,
    };
  }

  return {
    headerCells: inferSyntheticHeaderCells(profile),
    bodyStartIndex: 0,
    synthetic: true,
  };
}

function inferSyntheticHeaderCells(profile) {
  if (looksLikeContactTable(profile)) {
    return [
      { tag: "th", attrs: "", inner: "" },
      { tag: "th", attrs: "", inner: "電話番号" },
      { tag: "th", attrs: "", inner: "メール" },
    ];
  }
  return Array.from({ length: profile.maxCols }, (_item, index) => ({
    tag: "th",
    attrs: "",
    inner: index === 0 ? "項目" : `内容${index}`,
  }));
}

function looksLikeContactTable(profile) {
  const rows = profile.bodyRows;
  if (profile.maxCols !== 3 || rows.length < 1) {
    return false;
  }
  const phoneCells = rows.filter((cells) => /(?:電話|TEL|[0-9０-９]{2,4}[-ー－][0-9０-９]{2,4})/i.test(visibleText(cells[1]?.inner || ""))).length;
  const mailCells = rows.filter((cells) => /メール|mail_icon|mailto:/i.test(cells[2]?.inner || "")).length;
  return phoneCells >= Math.ceil(rows.length * 0.5) && mailCells >= Math.ceil(rows.length * 0.5);
}

function buildRowHeaderOnlyTableHtml(attrs, inner, profile, prefix) {
  const caption = existingCaption(inner) || inferCaptionBefore(prefix) || inferCaptionFromTable(profile);
  const captionHtml = caption ? `<caption>${escapeHtml(caption)}</caption>` : "";
  const bodyRows = profile.bodyRows.map((cells, rowIndex) => {
    return `<tr>${cells
      .map((cell, index) => {
        if (index === 0) {
          return rowHeaderCellHtml(cell, rowIndex > 0);
        }
        return `<td${cleanCellAttrs(cell.attrs, "td")}>${cell.inner}</td>`;
      })
      .join("")}</tr>`;
  });
  return `<table${attrs}>${captionHtml}<tbody>${bodyRows.join("")}</tbody></table>`;
}

function headerCellHtml(cell, scope) {
  return `<th${cleanCellAttrs(cell.attrs, "th")} scope="${scope}">${cell.inner}</th>`;
}

function rowHeaderCellHtml(cell, includeScope) {
  const scopeAttr = includeScope ? ' scope="row"' : "";
  return `<th${cleanCellAttrs(cell.attrs, "th")}${scopeAttr}>${cell.inner}</th>`;
}

function titledBodyCellHtml(cell) {
  if (cell.tag === "th") {
    return `<th${cleanCellAttrs(cell.attrs, "th")} scope="row">${cell.inner}</th>`;
  }
  return `<td${cleanCellAttrs(cell.attrs, "td")}>${cell.inner}</td>`;
}

function bodyCellHtml(cell, index) {
  const shouldBeRowHeader = index === 0 || cell.tag === "th";
  if (shouldBeRowHeader) {
    return `<th${cleanCellAttrs(cell.attrs, "th")} scope="row">${cell.inner}</th>`;
  }
  return `<td${cleanCellAttrs(cell.attrs, "td")}>${cell.inner}</td>`;
}

function cleanCellAttrs(attrs, targetTag) {
  let output = String(attrs || "")
    .replace(/\s?scope=(["'])(row|col)\1/gi, "")
    .replace(/\s?headers=(["'])(.*?)\1/gi, "");
  if (targetTag === "th") {
    output = output.replace(/\s?colspan=(["']?)1\1/gi, "").replace(/\s?rowspan=(["']?)1\1/gi, "");
  }
  return output ? ` ${output.trim()}` : "";
}

function isHeaderLikeCell(html) {
  const text = normalizeText(visibleText(html));
  if (!text) {
    return false;
  }
  if (text.length <= 28 && !/[。.!?！？]$/.test(text)) {
    return true;
  }
  return /項目|内容|区分|種別|車種|対象|税率|金額|所得|診療|時間|電話|所在地|名称|日程|会場|結果|勝敗/.test(text);
}

function inferCaptionFromTable(profile) {
  if (isTitledColumnHeaderTableProfile(profile)) {
    return titleRowCaptionText(profile) || "陦ｨ縺ｮ蜀・ｮｹ";
  }
  if (isSingleRecordContactTableProfile(profile)) {
    const label = normalizeText(visibleText(profile.bodyRows[0]?.[0]?.inner || ""));
    if (label) {
      return /荳隕ｧ|隧ｳ邏ｰ/.test(label) ? label : `${label}縺ｮ隧ｳ邏ｰ`;
    }
  }
  const firstRowText = normalizeText(visibleText(profile.firstRow.map((cell) => cell.inner).join(" ")));
  if (!firstRowText) {
    return "表の内容";
  }
  const base = firstRowText.length > 36 ? firstRowText.slice(0, 36) : firstRowText;
  return `${base}の詳細`;
}

function titleRowCaptionText(profile) {
  return normalizeText(visibleText((profile.bodyRows[0] || []).map((cell) => cell.inner).join(" ")));
}

function isSingleRecordContactTableProfile(profile) {
  return profile.bodyRows.length === 1 && looksLikeContactTable(profile);
}

function isTitledColumnHeaderTableProfile(profile) {
  if (profile.hasThead || profile.maxCols < 2 || profile.bodyRows.length < 3) {
    return false;
  }
  const titleRow = profile.bodyRows[0] || [];
  const headerRow = profile.bodyRows[1] || [];
  const bodyRows = profile.bodyRows.slice(2);
  const titleText = titleRowCaptionText(profile);
  if (!titleText || !bodyRows.length) {
    return false;
  }
  const titleSpansAllColumns = rowColumnSpanCount(titleRow) >= profile.maxCols;
  if (!(titleRow.length === 1 || (titleSpansAllColumns && titleRow.length < profile.maxCols))) {
    return false;
  }
  if (headerRow.length !== profile.maxCols) {
    return false;
  }
  if (!headerRow.every((cell) => cell.tag === "th" || isHeaderLikeCell(cell.inner))) {
    return false;
  }
  return bodyRows.some((cells) =>
    cells.some((cell) => isDataValueText(visibleText(cell.inner)) || !isHeaderLikeCell(cell.inner))
  );
}

function rowColumnSpanCount(cells) {
  return (cells || []).reduce((sum, cell) => sum + cellSpanValue(cell.attrs, "colspan"), 0);
}

function cellSpanValue(attrs, attrName) {
  const match = String(attrs || "").match(new RegExp(`\\b${attrName}=(["']?)(\\d+)\\1`, "i"));
  return match ? Number(match[2]) || 1 : 1;
}

function inferCaptionFromTable(profile) {
  if (isTitledColumnHeaderTableProfile(profile)) {
    return titleRowCaptionText(profile) || GENERIC_TABLE_CAPTION;
  }
  if (isSingleRecordContactTableProfile(profile)) {
    const label = normalizeText(visibleText(profile.bodyRows[0]?.[0]?.inner || ""));
    if (label) {
      return TABLE_CAPTION_WORD_RE.test(label) ? label : `${label}${TABLE_DETAIL_SUFFIX}`;
    }
  }
  const firstRowText = normalizeText(visibleText(profile.firstRow.map((cell) => cell.inner).join(" ")));
  if (!firstRowText) {
    return "陦ｨ縺ｮ蜀・ｮｹ";
  }
  const base = firstRowText.length > 36 ? firstRowText.slice(0, 36) : firstRowText;
  return `${base}縺ｮ隧ｳ邏ｰ`;
}

function isRowHeaderOnlyDataTableProfile(profile) {
  if (profile.hasThead || profile.maxCols !== 2 || profile.bodyRows.length < 2) {
    return false;
  }
  const labelRows = profile.bodyRows.filter((cells) => isHeaderLikeCell(cells[0]?.inner || "")).length;
  if (labelRows < Math.ceil(profile.bodyRows.length * 0.6)) {
    return false;
  }
  const profileLabelRows = profile.bodyRows.filter((cells) =>
    isProfileLabelText(normalizeText(visibleText(cells[0]?.inner || "")))
  ).length;
  if (profileLabelRows < Math.min(2, profile.bodyRows.length)) {
    return false;
  }

  const firstKeyText = normalizeText(visibleText(profile.bodyRows[0]?.[0]?.inner || ""));
  const firstValueHtml = profile.bodyRows[0]?.[1]?.inner || "";
  const firstValueText = normalizeText(visibleText(firstValueHtml));
  if (!firstKeyText || !firstValueText) {
    return false;
  }
  if (looksLikeGenericHeaderPair(firstKeyText, firstValueText) && isHeaderLikeCell(firstValueHtml)) {
    return false;
  }

  const firstColumnAverageLength = averageColumnTextLength(profile.bodyRows, 0);
  const secondColumnAverageLength = averageColumnTextLength(profile.bodyRows, 1);
  const valueLikeCells = profile.bodyRows.filter((cells) => looksLikeValueCell(cells[1]?.inner || "")).length;

  return (
    secondColumnAverageLength >= Math.max(16, firstColumnAverageLength * 1.6) ||
    valueLikeCells >= Math.ceil(profile.bodyRows.length * 0.6) ||
    !isHeaderLikeCell(firstValueHtml)
  );
}

function averageColumnTextLength(rows, index) {
  const texts = rows
    .map((cells) => normalizeText(visibleText(cells[index]?.inner || "")))
    .filter(Boolean);
  if (!texts.length) {
    return 0;
  }
  return texts.reduce((sum, text) => sum + text.length, 0) / texts.length;
}

function looksLikeValueCell(html) {
  const text = normalizeText(visibleText(html));
  if (!text) {
    return false;
  }
  return (
    isDataValueText(text) ||
    text.length >= 20 ||
    /[0-9]{2,}|https?:|[()（）【】「」〒]/.test(text)
  );
}

function looksLikeGenericHeaderPair(leftText, rightText) {
  return isGenericHeaderText(leftText) && isGenericHeaderText(rightText);
}

function isProfileLabelText(text) {
  return /^(?:チーム名|ホームタウン|ホームアリーナ(?:タウン)?|トレーニングアリーナ|名称|所在地|住所|連絡先|電話(?:番号)?|FAX|メール|URL|開館時間|休館日|アクセス|代表(?:者)?|設立|定員|料金|対象者?|所属|ポジション|背番号|出身地|生年月日|身長|Team name|Home town|Home arena|Training arena|Address|Phone|Email|Website)$/iu.test(
    normalizeText(text)
  );
}

function isGenericHeaderText(text) {
  return /^(?:項目|内容|詳細|概要|区分|種類|名称|件名|日程|日時|時間|会場|場所|対象|相手|試合結果|勝敗|備考|税率|金額|手数料|電話(?:番号)?|メール|住所|問い合わせ先|申告(?:先|場所)?|担当(?:課|部署)?)$/u.test(
    normalizeText(text)
  );
}

function shouldPreserveDataTable(profile) {
  const hasExplicitSemantics =
    profile.hasCaption || profile.hasThead || profile.flatCells.some((cell) => cell.tag === "th") || profile.hasScope;
  if (profile.hasMedia && !hasExplicitSemantics) {
    return false;
  }
  if (isRowHeaderOnlyDataTableProfile(profile)) {
    return true;
  }
  if (looksLikeContactTable(profile)) {
    return true;
  }
  if (hasExplicitSemantics) {
    return true;
  }
  if (profile.bodyRows.length >= 2 && profile.maxCols >= 2 && profile.hasNumericOrContactData) {
    return true;
  }
  return false;
}

function isLayoutTable(inner, profile = analyzeTable(inner)) {
  if (shouldPreserveDataTable(profile)) {
    return false;
  }
  const tableText = visibleText(inner);
  if (/メール|電話|所在地/.test(tableText)) {
    return false;
  }
  if (/メールを送る|電話|ファックス|FAX|担当課|所在地/.test(tableText)) {
    return false;
  }
  const rows = parseRows(inner);
  if (rows.length <= 1 && /<img\b/i.test(inner)) return true;
  const firstCells = profile.firstRow;
  if (firstCells.length <= 2 && rows.length <= 4 && /<img\b|<iframe\b/i.test(inner)) return true;
  if (firstCells.length <= 2 && rows.length <= 1 && /<p\b|<ul\b|<ol\b|<h[1-6]\b/i.test(inner)) return true;
  return false;
}

function decomposeLayoutTable(inner) {
  const blocks = [];
  for (const row of parseRows(inner)) {
    const cells = parseCells(row).filter((cell) => normalizeText(visibleText(cell.inner)) || /<img\b|<iframe\b/i.test(cell.inner));
    if (cells.length === 1 && isLayoutTableSectionHeadingCell(cells[0])) {
      blocks.push(`<h3>${escapeHtml(normalizeText(visibleText(cells[0].inner)))}</h3>`);
      continue;
    }
    if (cells.length === 2 && canCombineLayoutTableCells(cells[0], cells[1])) {
      blocks.push(
        `<p><strong>${escapeHtml(normalizeText(visibleText(cells[0].inner)))}</strong> ${normalizeLayoutCellInner(cells[1].inner)}</p>`
      );
      continue;
    }
    cells.forEach((cell) => blocks.push(cell.inner.trim()));
  }
  return blocks.join("\n");
}

function isLayoutTableSectionHeadingCell(cell) {
  const text = normalizeText(visibleText(cell.inner));
  return Boolean(text && text.length <= 40 && !/[。！？!?、，,]$/.test(text) && !/<(?:a|img|iframe|input|select|textarea|button)\b/i.test(cell.inner));
}

function canCombineLayoutTableCells(labelCell, valueCell) {
  const label = normalizeText(visibleText(labelCell.inner));
  const value = normalizeText(visibleText(valueCell.inner));
  return Boolean(label && label.length <= 24 && value && !/<(?:img|iframe|table)\b/i.test(labelCell.inner + valueCell.inner));
}

function normalizeLayoutCellInner(inner) {
  const text = normalizeText(visibleText(inner));
  return /<[^>]+>/.test(inner) ? inner.trim() : escapeHtml(text);
}

function parseRows(tableInner) {
  const rows = [];
  tableInner.replace(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi, (_match, rowInner) => {
    rows.push(rowInner);
    return "";
  });
  return rows;
}

function parseCells(rowInner) {
  const cells = [];
  rowInner.replace(/<(td|th)\b([^>]*)>([\s\S]*?)<\/\1>/gi, (_match, tag, attrs, inner) => {
    cells.push({ tag: tag.toLowerCase(), attrs: attrs.trim(), inner: inner.trim() });
    return "";
  });
  return cells;
}

function existingCaption(tableInner) {
  const match = tableInner.match(/<caption\b[^>]*>([\s\S]*?)<\/caption>/i);
  return match ? normalizeText(visibleText(match[1])) : "";
}

function inferCaptionBefore(prefix) {
  const matches = [...prefix.matchAll(/<h[1-6]\b[^>]*>([\s\S]*?)<\/h[1-6]>/gi)];
  const last = matches[matches.length - 1];
  const text = last ? normalizeText(visibleText(last[1])).replace(/^[0-9０-９]+\s*/, "") : "";
  if (!text) return "";
  if (/^.+?場合$/.test(text) && matches.length >= 2) {
    const caseText = text.replace(/場合$/, "").replace(/の$/, "");
    const sectionHeading = [...matches]
      .reverse()
      .map((match) => normalizeText(visibleText(match[1])).replace(/^[0-9０-９]+\s*/, ""))
      .find((value) => value && !/^.+?場合$/.test(value));
    const subject = sectionHeading ? sectionHeading.replace(/見直し$/, "").replace(/の$/, "") : "";
    if (caseText && subject) {
      return caseText + "の" + subject + "の詳細";
    }
  }
  if (/見直し$/.test(text)) {
    return text.replace(/見直し$/, "") + "詳細";
  }
  if (/見直し/.test(text)) {
    return text.replace(/見直し/g, "") + "詳細";
  }
  return /一覧|表|リスト|情報/.test(text) ? text : text + "一覧";
}


function resolveDataTableCaption(inner, profile, prefix) {
  const existing = existingCaption(inner);
  if (existing) {
    return existing;
  }
  const contextualCaption = inferContextualDataTableCaption(inner, profile, prefix);
  if (contextualCaption) {
    return contextualCaption;
  }
  if (isTitledColumnHeaderTableProfile(profile) || isSingleRecordContactTableProfile(profile)) {
    return inferCaptionFromTable(profile) || inferCaptionBefore(prefix);
  }
  return inferCaptionBefore(prefix) || inferCaptionFromTable(profile);
}

function inferContextualDataTableCaption(inner, profile, prefix) {
  const text = normalizeText(visibleText(inner));
  const headings = [...prefix.matchAll(/<h[1-6]\b[^>]*>([\s\S]*?)<\/h[1-6]>/gi)].map((match) =>
    normalizeText(visibleText(match[1]))
  );
  const recentHeading = headings[headings.length - 1] || "";

  if (profile.maxCols === 2 && /項目/.test(text) && /改正内容/.test(text) && /基礎控除|所得税/.test(text)) {
    return "基礎控除の変更や所得税に係る改正内容一覧";
  }

  if (profile.maxCols >= 3 && /調整控除/.test(text) && /納税者本人の合計所得金額/.test(text) && /改正前/.test(text) && /改正後/.test(text)) {
    return "【表2-1】調整控除に係る人的控除差 納税者本人の合計所得金額「改正前」「改正後」";
  }

  if (profile.maxCols >= 3 && /調整控除/.test(text) && /配偶者の合計所金額/.test(text) && /改正後/.test(text)) {
    return "【表2-2】調整控除に係る人的控除差 配偶者の合計所金額（改正後）";
  }

  if (profile.maxCols >= 3 && /配偶者特別控除/.test(text) && /配偶者の合計所得金額/.test(text) && /改正前/.test(text) && /改正後/.test(text)) {
    return "【表1-1】配偶者特別控除 配偶者の合計所得金額「改正前」「改正後」";
  }

  if (profile.maxCols >= 3 && /配偶者特別控除/.test(text) && /配偶者特別控除額/.test(text) && /改正後/.test(text)) {
    return "【表1-2】配偶者特別控除 配偶者特別控除額（改正後）";
  }

  if (/所得控除・非課税措置等に係る所得要件/.test(recentHeading) && /合計所得金額/.test(text) && /基礎控除額/.test(text)) {
    return "合計所得金額2,400万円超の納税義務者に係る基礎控除の逓減（消失）の詳細";
  }

  if (/ひとり親控除/.test(text) && /寡婦/.test(text) && /寡夫/.test(text)) {
    if (profile.maxCols >= 7 || /備考/.test(text) || /未婚のひとり親/.test(text)) {
      return "（改正後）ひとり親控除及び寡婦控除";
    }
    if (profile.maxCols === 5 && /男性/.test(text)) {
      return "（改正前）ひとり親控除及び寡夫控除";
    }
    if (profile.maxCols === 5) {
      return "（改正前）ひとり親控除及び寡婦控除";
    }
  }

  return "";
}

function cleanupHtml(html) {
  return html
    .replace(/\sdata-goal2-node-id="[^"]*"/g, "")
    .replace(/\s+/g, " ")
    .replace(/>\s+</g, "><")
    .replace(/\s+>/g, ">")
    .trim();
}

function collectMetrics(html) {
  const lower = String(html || "").toLowerCase();
  const text = visibleText(html);
  return {
    h2: countRegex(lower, /<h2\b/g),
    h3: countRegex(lower, /<h3\b/g),
    h4: countRegex(lower, /<h4\b/g),
    table: countRegex(lower, /<table\b/g),
    thead: countRegex(lower, /<thead\b/g),
    caption: countRegex(lower, /<caption\b/g),
    th: countRegex(lower, /<th\b/g),
    scopeCol: countRegex(lower, /scope=["']col["']/g),
    scopeRow: countRegex(lower, /scope=["']row["']/g),
    img: countRegex(lower, /<img\b/g),
    emptyAlt: countRegex(lower, /<img\b(?=[^>]*alt=["']["'])/g),
    iframe: countRegex(lower, /<iframe\b/g),
    weakLink: /クリックしてください|こちら|詳細はこちら|詳しくはこちら/.test(text) ? 1 : 0,
    textLength: text.length,
  };
}

function compareHtml(currentHtml, goldHtml, baselineHtml = "") {
  const current = collectMetrics(currentHtml);
  const gold = collectMetrics(goldHtml);
  const baseline = collectMetrics(baselineHtml);
  const metricResults = {};
  let improved = 0;
  let regressed = 0;
  let matchesGold = 0;
  let differsFromGold = 0;

  for (const key of STRUCTURAL_KEYS) {
    const beforeDistance = Math.abs((baseline[key] || 0) - (gold[key] || 0));
    const currentDistance = Math.abs((current[key] || 0) - (gold[key] || 0));
    let status = "unchanged";
    if (currentDistance === 0) {
      status = "matches_gold";
      matchesGold += 1;
    } else {
      differsFromGold += 1;
      if (currentDistance < beforeDistance) {
        status = "improved";
        improved += 1;
      } else if (currentDistance > beforeDistance) {
        status = "regressed";
        regressed += 1;
      }
    }
    metricResults[key] = {
      baseline: baseline[key],
      current: current[key],
      gold: gold[key],
      status,
    };
  }

  const baselineSimilarity = textSimilarity(visibleText(baselineHtml), visibleText(goldHtml));
  const currentSimilarity = textSimilarity(visibleText(currentHtml), visibleText(goldHtml));
  return {
    baselineSimilarity,
    currentSimilarity,
    similarityDelta: currentSimilarity - baselineSimilarity,
    improved,
    regressed,
    matchesGold,
    differsFromGold,
    metrics: metricResults,
  };
}

function textSimilarity(a, b) {
  const aTokens = tokenSet(a);
  const bTokens = tokenSet(b);
  if (!aTokens.size && !bTokens.size) return 1;
  let intersection = 0;
  for (const token of aTokens) {
    if (bTokens.has(token)) intersection += 1;
  }
  return (2 * intersection) / (aTokens.size + bTokens.size);
}

function tokenSet(text) {
  const normalized = normalizeText(text).toLowerCase();
  const tokens = normalized.match(/[a-z0-9]+|[\u3040-\u30ff\u3400-\u9fff]{1,3}/g) || [];
  return new Set(tokens);
}

function tagCounts(html) {
  const lower = String(html || "").toLowerCase();
  return {
    h2: countRegex(lower, /<h2\b/g),
    h3: countRegex(lower, /<h3\b/g),
    h4: countRegex(lower, /<h4\b/g),
    h5: countRegex(lower, /<h5\b/g),
    h6: countRegex(lower, /<h6\b/g),
  };
}

function countRegex(text, regex) {
  return (text.match(regex) || []).length;
}

function visibleText(html) {
  return decodeEntities(
    String(html || "")
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
  ).replace(/\s+/g, " ").trim();
}

function normalizeText(text) {
  return decodeEntities(String(text || "")).replace(/\s+/g, " ").trim();
}

function decodeEntities(text) {
  return String(text || "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

function attrValue(attrs, name) {
  const match = String(attrs || "").match(new RegExp(`\\s${name}=(["'])(.*?)\\1`, "i"));
  return match ? match[2] : null;
}

function setAttr(attrs, name, value) {
  const escaped = escapeHtml(value);
  const pattern = new RegExp(`\\s${name}=(["'])(.*?)\\1`, "i");
  if (pattern.test(attrs)) {
    return attrs.replace(pattern, ` ${name}="${escaped}"`);
  }
  return `${attrs} ${name}="${escaped}"`;
}

function decodeUriSafe(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function defaultSagaFixtureRoot(rootDir) {
  return path.resolve(rootDir, "..", ".tmp-gemini-a11y-agent", "tests", "fixtures", "html", "saga-city");
}

module.exports = {
  STRUCTURAL_KEYS,
  autoFixHtml,
  collectMetrics,
  compareHtml,
  defaultSagaFixtureRoot,
  textSimilarity,
  visibleText,
};

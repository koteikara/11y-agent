/*******************************************************************************
 * Portions of this file are a JavaScript port of logic from:
 *   - org.eclipse.actf.validation.html/src/.../internal/CheckEngine.java
 *   - org.eclipse.actf.visualization.engines.blind/src/.../TextChecker.java
 *   - org.eclipse.actf.visualization.engines.blind/config/altText.properties
 * from https://github.com/eclipse-actf/org.eclipse.actf (miChecker / HTML Checker),
 * reference commit 703e34f0af7b7c4882a7adbd4fa6305f114cd548.
 *
 * Original copyright:
 *   Copyright (c) 2004, 2025 IBM Corporation and Others
 * Original license: Eclipse Public License v1.0 (EPL-1.0)
 *   https://www.eclipse.org/legal/epl-v10.html
 *
 * This port is a derivative work distributed under the same terms (EPL-1.0).
 * Ported logic is confined to this file; see
 * a11y-migration-kb/vendor/eclipse-actf/NOTICE.md for provenance details and
 * goal2-app/MICHECKER_ENGINE_PORT_INSTRUCTIONS.md for the porting plan.
 *
 * Scope: only the ~116 check items classified as "in scope for CMS content
 * editing" in a11y-migration-kb/reference/michecker-out-of-content-scope.json
 * are ported (see goal2-app/MICHECKER_PORT_INVENTORY.md for the full list).
 * Checks are ported faithfully (same thresholds/branches as the Java source);
 * do not "improve" the logic here — see MICHECKER_ENGINE_PORT_INSTRUCTIONS.md
 * §4.4.
 *******************************************************************************/
(function () {
  "use strict";

  // ---------------------------------------------------------------------
  // Check registry
  //
  // Each entry: id -> { type, method, run(ctx) }
  // `run(ctx)` calls ctx.report(checkId, { nodes, extraText }) for each
  // problem found (nodes omitted or empty for page-level checks). ctx.page
  // is the shared PageContext (see buildPageContext below), computed once
  // per run() call and passed to every check, mirroring the Java engine's
  // single precomputation pass. Checks are registered by PR-M1/M2/M3; PR-M0
  // only provided the scaffolding (CHECKS was empty). PR-M1 adds the 23
  // in-scope "error"-type checks (see MICHECKER_PORT_INVENTORY.md).
  // ---------------------------------------------------------------------
  const CHECKS = {};

  function registerCheck(id, type, method, fn) {
    CHECKS[id] = { type, method, run: fn };
  }

  // ---------------------------------------------------------------------
  // TextChecker port (org.eclipse.actf.visualization.engines.blind.TextChecker)
  // + altText.properties (NG word lists). Ported as a self-contained helper
  // section; used by the alt-text quality checks added in later PRs
  // (C_300.x and friends — see MICHECKER_PORT_INVENTORY.md "TextChecker依存").
  // ---------------------------------------------------------------------
  const TextChecker = (function () {
    // From org.eclipse.actf.visualization.engines.blind/config/altText.properties,
    // blindViz.inappropriateAlt_* keys (lowercase exact-match NG words).
    const NG_WORDS = [
      "spacer gif", "spacer.gif", "spacer", "space", "blank", "click here",
      "clickhere", "click here!", "null", "void", "banner", "line",
      "dashline", "space", "image", "gif", "gif image", "jpeg",
      "jpeg image", "photo", "bullet", "icon", "button", "ボタン",
      "alt",
    ];

    // blindViz.possible_inappAlt_* keys (lowercase NG "word" fragments, used
    // against tokens split out of the ALT string).
    const NG_WORDS_PARTIAL = [
      "spacer", "space", "blank", "null", "void", "banner", "line",
      "dashline", "space", "gif", "jpeg", "bullet", "shade", "star", "bar",
      "icon", "影", "点", "空白", "線", "画像",
      "写真", "バナー", "アイコン",
      "背景",
    ];

    // CheckEngine/TextChecker use \p{InXxx} Unicode block regex classes that
    // the JS regex engine does not support directly; \p{Script=Han} etc. are
    // the closest standard equivalents available in ES2018+ Unicode regex.
    const KIGOU_RE =
      "[\\u2200-\\u22FF\\u25A0-\\u25FF\\u2600-\\u27BF\\u2500-\\u257F\\u2000-\\u206F\\u3000-\\u303F\\u2190-\\u21FF]";
    const NIHONGO_RE = "[\\p{Script=Han}\\p{Script=Hiragana}\\p{Script=Katakana}]";
    const SPLIT_RE = new RegExp("(?:" + KIGOU_RE + "|[\\p{P}\\p{S}]|\\s)", "u");

    const ngWordSet = new Set(NG_WORDS);
    const ngWordSet2 = new Set(NG_WORDS_PARTIAL);

    function isEndWithImageExt(alt) {
      return /^[\s\S]*\.(jpg|jpeg|gif|png|bmp|tiff)$/i.test(alt.trim());
    }

    // Faithful port note: \b in both Java's default Pattern and JS RegExp is
    // an ASCII word boundary (transition between [A-Za-z0-9_] and
    // everything else); it is NOT Unicode-aware even with the "u" flag
    // here. Since NIHONGO_RE characters are not \w, \bNIHONGO...NIHONGO\b
    // only matches when an ASCII alnum character sits directly adjacent on
    // each side (e.g. "1開 始2"). Plain Japanese text with no adjacent
    // ASCII characters never satisfies the \b, so this check effectively
    // does not fire for ordinary all-Japanese alt text — this matches the
    // original CheckEngine.java/TextChecker.java behavior exactly and is
    // intentionally NOT "fixed" here (see MICHECKER_ENGINE_PORT_INSTRUCTIONS.md §4.4).
    function isSeparatedJapaneseChars(target) {
      const s = target.trim().toLowerCase();
      const re = new RegExp(
        "\\b" + NIHONGO_RE + "[\\s\\u3000\\u00A0]+" + NIHONGO_RE + "\\b",
        "u"
      );
      return re.test(s);
    }

    function isAsciiArtString(str) {
      const origLength = str.length;
      const words = str.toLowerCase().split(SPLIT_RE).filter((w) => w.length > 0 || true);
      let charLength = 0;
      for (const w of words) charLength += w.length;
      const isBlank = /^[\s　 ]*$/.test(str);
      return origLength > 0 && charLength / origLength < 0.5 && !isBlank;
    }

    // Mirrors TextChecker#checkAlt(alt, src, ngWords). Returns one of the
    // TextCheckResult constant names (see TextCheckResult.java).
    function checkAlt(alt, src, extraNgWords) {
      const ngWords = extraNgWords || new Set();
      const origAlt = alt;
      const origLength = alt.length;
      let a = alt.toLowerCase();

      if (a === "") return "NULL";
      if (origLength === 0) return "NULL"; // Java asserts origLength > 0 past this point

      if (/^[\s　 ]+$/.test(a)) {
        return / /.test(a) ? "BLANK_NBSP" : "BLANK";
      }

      a = a.trim();

      if (ngWordSet.has(a) || ngWords.has(a)) return "NG_WORD";
      if (/画像\s*\d+/.test(a)) return "NG_WORD"; // ngPatterns: "画像\s*\d+"
      if (isEndWithImageExt(a)) return "IMG_EXT";
      if (/(?:[A-Za-z]\s){3,}/.test(a)) return "SPACE_SEPARATED";
      if (isSeparatedJapaneseChars(a)) return "SPACE_SEPARATED_JP";

      const wordList = a.split(SPLIT_RE);
      let wordCountNg = 0;
      let wordCountAll = 0;
      for (const word of wordList) {
        if (word.length > 0) wordCountAll++;
        if (ngWordSet2.has(word)) wordCountNg++;
      }

      if (isAsciiArtString(origAlt)) return "ASCII_ART";

      if (wordCountAll > 0) {
        const ratio = wordCountNg / wordCountAll;
        if (ratio > 0.6) return "INCLUDING_MANY_NG_WORD";
        if (ratio > 0.3) return "INCLUDING_NG_WORD";
      }

      if (src) {
        const m = /.*?([^/]+)$/.exec(src.toLowerCase());
        if (m && a === m[1]) return "SAME_AS_SRC";
      }

      return "OK";
    }

    function isRedundantText(prevText, curText) {
      if (prevText && prevText.length > 1 && curText && curText.length > 1) {
        const strip = (s) => s.replace(/\[|\]|\.|!|>|\n/g, "").trim();
        return strip(prevText).toLowerCase() === strip(curText).toLowerCase();
      }
      return false;
    }

    return { checkAlt, isRedundantText, isAsciiArtString, isSeparatedJapaneseChars };
  })();

  // ---------------------------------------------------------------------
  // HtmlTagUtil / HtmlEvalUtil helper ports (org.eclipse.actf.visualization.eval).
  // These are DOM traversal utilities shared across many CheckEngine checks;
  // ported once here rather than duplicated per check.
  // ---------------------------------------------------------------------

  // HtmlTagUtil#getTextAltDescendant(Node): walks descendants, appending
  // trimmed text-node values (each followed by a space) and, for <img> or
  // role="img" elements, their accessible name (aria-label/aria-labelledby,
  // falling back to alt). Final result is trimmed.
  function getTextAltDescendant(target) {
    const parts = [];
    const stack = [];
    let cur = target.firstChild;
    while (cur) {
      if (cur.nodeType === 3) {
        parts.push((cur.nodeValue || "").trim() + " ");
      } else if (cur.nodeType === 1) {
        const el = cur;
        if (el.tagName && el.tagName.toLowerCase() === "img") {
          const name = getNameByAria(el, "alt");
          if (name && name.trim().length > 0) parts.push(name.trim() + " ");
        } else if ((el.getAttribute("role") || "").toLowerCase() === "img") {
          const name = getNameByAria(el, null);
          if (name && name.trim().length > 0) parts.push(name.trim() + " ");
        }
      }
      if (cur.hasChildNodes()) {
        stack.push(cur);
        cur = cur.firstChild;
      } else if (cur.nextSibling) {
        cur = cur.nextSibling;
      } else {
        cur = null;
        while (!cur && stack.length > 0) {
          cur = stack.pop().nextSibling;
        }
      }
    }
    return parts.join("").trim();
  }

  // HtmlTagUtil#getTextDescendant(Node): concatenates raw (untrimmed)
  // text-node values with no separator — distinct from getTextAltDescendant.
  function getTextDescendant(target) {
    let text = "";
    const stack = [];
    let cur = target.firstChild;
    while (cur) {
      if (cur.nodeType === 3) text += cur.nodeValue || "";
      if (cur.hasChildNodes()) {
        stack.push(cur);
        cur = cur.firstChild;
      } else if (cur.nextSibling) {
        cur = cur.nextSibling;
      } else {
        cur = null;
        while (!cur && stack.length > 0) {
          cur = stack.pop().nextSibling;
        }
      }
    }
    return text;
  }

  // HtmlTagUtil#hasTextDescendant(Node): true if any descendant Text node
  // exists (content not checked, matching the Java source exactly).
  function hasTextDescendant(target) {
    const stack = [];
    let cur = target.firstChild;
    while (cur) {
      if (cur.nodeType === 3) return true;
      if (cur.hasChildNodes()) {
        stack.push(cur);
        cur = cur.firstChild;
      } else if (cur.nextSibling) {
        cur = cur.nextSibling;
      } else {
        cur = null;
        while (!cur && stack.length > 0) {
          cur = stack.pop().nextSibling;
        }
      }
    }
    return false;
  }

  // HtmlTagUtil#getNoScriptText(Node): text of descendant <noscript>
  // elements, but only when the element also contains a <script> descendant
  // (matches the Java source's guard condition).
  function getNoScriptText(target) {
    if (target.nodeType !== 1) return "";
    const el = target;
    if (el.getElementsByTagName("script").length === 0) return "";
    let text = "";
    const noscripts = el.getElementsByTagName("noscript");
    for (let i = 0; i < noscripts.length; i++) {
      text += getTextAltDescendant(noscripts[i]);
    }
    return text;
  }

  // HtmlTagUtil#getNameByAria(Element, attrForAlt): aria-labelledby (space-
  // separated ID refs, resolved + concatenated) takes priority, then
  // aria-label, then falls back to attrForAlt (e.g. "alt") if given.
  function getNameByAria(target, attrForAlt) {
    let result = null;
    const labelledBy = (target.getAttribute("aria-labelledby") || "").trim();
    if (labelledBy) {
      const ids = labelledBy.split(" ").filter(Boolean);
      const doc = target.ownerDocument;
      const parts = [];
      if (doc) {
        for (const id of ids) {
          const referenced = doc.getElementById(id);
          if (referenced) {
            const text = getTextAltDescendant(referenced).trim();
            if (text.length > 0) parts.push(text);
          }
        }
      }
      if (parts.length > 0) result = parts.join(" ");
    }
    if (result != null) return result;

    const flagForAlt = Boolean(attrForAlt && attrForAlt.trim().length > 0);
    if (target.hasAttribute("aria-label")) {
      result = target.getAttribute("aria-label");
      if (flagForAlt && result != null && result.trim().length === 0) {
        if (target.hasAttribute(attrForAlt)) result = target.getAttribute(attrForAlt);
      }
    }
    if (result != null) return result;

    if (flagForAlt && target.hasAttribute(attrForAlt)) {
      result = target.getAttribute(attrForAlt);
    }
    return result;
  }

  // CheckEngine#getWordCount(String): StringTokenizer split on the same
  // delimiter set the Java source uses (ASCII whitespace/punctuation plus
  // full-width Japanese punctuation), counting non-empty tokens.
  const WORD_COUNT_DELIMS = " \t\n\r\f,.[]()<>!?:/\"、。「」・〈〉　";
  function getWordCount(str) {
    const delimSet = new Set(WORD_COUNT_DELIMS);
    let count = 0;
    let inToken = false;
    for (const ch of str) {
      if (delimSet.has(ch)) {
        inToken = false;
      } else if (!inToken) {
        inToken = true;
        count++;
      }
    }
    return count;
  }

  // HtmlEvalUtil#getElementsList(node, tag1, tag2, ...): NOTE this
  // concatenates ALL matches of tag1 (in document order) followed by ALL
  // matches of tag2 (in document order) — NOT a single document-order merge
  // of both tags. This ordering quirk is preserved faithfully; it matters
  // for checks like C_332.1/C_332.2 (item_332) that iterate "th", "td" cells.
  function elementsList(root, ...tags) {
    const result = [];
    for (const tag of tags) {
      result.push(...Array.from(root.getElementsByTagName(tag)));
    }
    return result;
  }

  // HtmlEvalUtil block-element set (HtmlTagUtil.BLOCK_ELEMENT), used by
  // isLeafBlockEle for the ASCII-art check (C_6.0).
  const BLOCK_ELEMENT_SET = new Set([
    "address", "blockquote", "center", "dir", "div", "dl", "fieldset",
    "form", "h1", "h2", "h3", "h4", "h5", "h6", "hr", "isindex", "menu",
    "noframes", "noscript", "ol", "p", "pre", "table", "ul", "dd",
    "frameset", "li", "tbody", "td", "tfoot", "th", "thead", "tr",
  ]);

  // CheckEngine#isLeafBlockEle(Node): a block element with no block-element
  // descendant (a "leaf" block, i.e. its rendered text is not further
  // subdivided by nested block structure).
  function isLeafBlockEle(node) {
    if (node.nodeType !== 1) return false;
    const tag = (node.nodeName || "").toLowerCase();
    if (!BLOCK_ELEMENT_SET.has(tag)) return false;
    if (!node.hasChildNodes()) return true;
    const stack = [];
    let cur = node.firstChild;
    while (cur) {
      const curTag = (cur.nodeName || "").toLowerCase();
      if (BLOCK_ELEMENT_SET.has(curTag)) return false;
      if (cur.hasChildNodes()) {
        stack.push(cur);
        cur = cur.firstChild;
      } else if (cur.nextSibling) {
        cur = cur.nextSibling;
      } else {
        cur = null;
        while (!cur && stack.length > 0) {
          cur = stack.pop().nextSibling;
        }
      }
    }
    return true;
  }

  // HtmlEvalUtil#isDataCell(Element): text too long (>250 chars) or too
  // many nested <img> (>10) disqualifies a cell from "data cell" status.
  const LONG_TEXT_NUM = 250;
  function isDataCell(el) {
    if (getTextAltDescendant(el).length > LONG_TEXT_NUM) return false;
    if (el.getElementsByTagName("img").length > 10) return false;
    return true;
  }

  // HtmlEvalUtil#hasFormControl(Element)
  function hasFormControl(el) {
    return ["form", "input", "select", "textarea"].some((tag) => el.getElementsByTagName(tag).length > 0);
  }

  // HtmlEvalUtil#is1Row1ColTable(Element): a table with <=1 <tr>, or where
  // no single <tr> has more than 1 combined th+td cell, is a "1x1" table
  // (treated as neither a data table nor further classified here).
  function is1Row1ColTable(el) {
    const rows = Array.from(el.getElementsByTagName("tr"));
    if (rows.length <= 1) return true;
    for (const row of rows) {
      const cellCount = row.getElementsByTagName("th").length + row.getElementsByTagName("td").length;
      if (cellCount > 1) return false;
    }
    return true;
  }

  // HtmlEvalUtil#isDataTable(Element): has no form control, has >=1 <td>,
  // and every <td>/<th> qualifies as a data cell (see isDataCell).
  function isDataTable(el) {
    if (hasFormControl(el)) return false;
    const tds = Array.from(el.getElementsByTagName("td"));
    if (tds.length === 0) return false;
    if (tds.some((td) => !isDataCell(td))) return false;
    const ths = Array.from(el.getElementsByTagName("th"));
    if (ths.some((th) => !isDataCell(th))) return false;
    return true;
  }

  // HtmlEvalUtil's table-classification pass (constructor of HtmlEvalUtil):
  // tables containing a nested <table> are set aside as "parent" tables and
  // excluded from further classification here (matches the Java source,
  // which only classifies leaf/"bottom" tables into 1x1 / data / non-data).
  // Returns { dataTables } — only bottom_data_tables is needed by the
  // ported checks so far (table.th-scope / headers-attribute checks).
  function classifyTables(document) {
    const tables = Array.from(document.getElementsByTagName("table"));
    const dataTables = [];
    for (const table of tables) {
      if (table.getElementsByTagName("table").length === 0) {
        if (is1Row1ColTable(table)) {
          // bottom_1row1col_tables — not used by ported checks yet
        } else if (isDataTable(table)) {
          dataTables.push(table);
        }
        // else: bottom_notdata_tables — not used by ported checks yet
      }
      // else: has a nested table -> parent_table_elements, not classified
    }
    return { dataTables };
  }

  // DocumentTypeUtil#isOriginalHTML5(DocumentType): true only if a doctype
  // is present AND its public ID is empty or "about:legacy-compat". A
  // *missing* doctype (docType == null) returns false in the Java source —
  // counter-intuitively, this means the DOMParser fragments this engine
  // usually analyzes (no <!DOCTYPE>, since only a body fragment is parsed)
  // are treated as NOT HTML5, exactly like the Java source would treat them.
  function isHTML5(document) {
    const doctype = document.doctype;
    if (!doctype) return false;
    const publicId = doctype.publicId || "";
    return publicId === "" || publicId.toLowerCase() === "about:legacy-compat";
  }

  // Builds the shared per-run page context once, mirroring the precomputed
  // fields on the Java CheckEngine/HtmlEvalUtil instance (img_elements,
  // aWithHref_*, frame/iframe_elements, headings, dataTableList, etc.).
  function buildPageContext(document) {
    const imgElements = Array.from(document.getElementsByTagName("img"));
    const aWithHrefElements = Array.from(document.querySelectorAll("a[href]"));
    const aWithHrefHrefs = aWithHrefElements.map((el) => el.getAttribute("href") || "");
    const aWithHrefTexts = aWithHrefElements.map((el) => getTextAltDescendant(el));
    const frameElements = Array.from(document.getElementsByTagName("frame"));
    const iframeElements = Array.from(document.getElementsByTagName("iframe"));
    const headings = Array.from(document.querySelectorAll("h1,h2,h3,h4,h5,h6"));
    const bodyElements = Array.from(document.getElementsByTagName("body"));
    const { dataTables } = classifyTables(document);
    return {
      imgElements,
      aWithHrefElements,
      aWithHrefHrefs,
      aWithHrefTexts,
      frameElements,
      iframeElements,
      headings,
      bodyElements,
      dataTableList: dataTables,
      isHTML5: isHTML5(document),
    };
  }

  // ---------------------------------------------------------------------
  // desc_ja template substitution ({0}, {1}, ... placeholders), mirroring
  // java.text.MessageFormat.format(desc, args) as used for
  // addCheckerProblem(id, extraText, ...). Only positional {n} substitution
  // is needed here (no MessageFormat choice/plural syntax appears in
  // description_ja.properties).
  // ---------------------------------------------------------------------
  function formatMessage(template, args) {
    if (!template) return "";
    const list = Array.isArray(args) ? args : args == null ? [] : [args];
    return template.replace(/\{(\d+)\}/g, (match, index) => {
      const value = list[Number(index)];
      return value == null ? "" : String(value);
    });
  }

  // ---------------------------------------------------------------------
  // CSS selector path generator, used in place of the Java engine's source
  // line numbers (see MICHECKER_ENGINE_PORT_INSTRUCTIONS.md §3.2-5 — line
  // numbers are not reproducible from a DOMParser document).
  // ---------------------------------------------------------------------
  function selectorPathFor(node) {
    if (!node || node.nodeType !== 1) return "";
    const parts = [];
    let el = node;
    while (el && el.nodeType === 1 && el.tagName) {
      let part = el.tagName.toLowerCase();
      if (el.id) {
        part += `#${el.id}`;
        parts.unshift(part);
        break;
      }
      const parent = el.parentElement;
      if (parent) {
        const siblings = Array.from(parent.children).filter((c) => c.tagName === el.tagName);
        if (siblings.length > 1) {
          part += `:nth-of-type(${siblings.indexOf(el) + 1})`;
        }
      }
      parts.unshift(part);
      el = parent;
    }
    return parts.join(" > ");
  }

  // ---------------------------------------------------------------------
  // Collector context passed to each check's run(ctx), mirroring
  // CheckEngine#addCheckerProblem(id, extraText, nodeOrNodes).
  // ---------------------------------------------------------------------
  function createCollector() {
    const problems = [];
    return {
      report(checkId, options = {}) {
        const nodes = options.nodes
          ? Array.isArray(options.nodes)
            ? options.nodes
            : [options.nodes]
          : [];
        problems.push({
          checkId,
          extraText: options.extraText || "",
          selectors: nodes.map(selectorPathFor).filter(Boolean),
        });
      },
      problems,
    };
  }

  // ---------------------------------------------------------------------
  // PR-M1: "error"-type checks (23 of the 24 in-scope error items; C_332.0
  // is excluded as "本体未発火" per MICHECKER_PORT_INVENTORY.md). Each
  // check is a faithful port of the corresponding CheckEngine.java method
  // (see inventory for method name / line number). Constants below are
  // ported verbatim from CheckEngine.java's field initializers.
  // ---------------------------------------------------------------------
  const QUOTATION_SHORT_NUM = 10;
  // CheckEngine sets these from isDBCS (true for Japanese-locale analysis,
  // which is this project's only real usage context).
  const VALIDATE_STR_LEN = 20;
  const VALID_TOTAL_TEXT_LEN = 50;

  function hasTitle(el) {
    return el.hasAttribute("title");
  }
  function hasBlankTitle(el) {
    if (!el.hasAttribute("title")) return true;
    return /^[\s　]*$/.test(el.getAttribute("title") || "");
  }

  // C_3.0 (item_3, L679): <img longdesc="..."> that doesn't point to a
  // "D-link" (an <a href> whose href matches the longdesc URL and whose
  // link text is literally "d"). Only evaluated for non-HTML5 documents
  // (matches the Java source's isHTML5 guard).
  registerCheck("C_3.0", "error", "item_3", ({ page, report }) => {
    if (page.isHTML5) return;
    for (const img of page.imgElements) {
      if (!img.hasAttribute("longdesc")) continue;
      const longdesc = img.getAttribute("longdesc") || "";
      if (longdesc.length === 0) continue;
      let isDlink = false;
      for (let i = 0; i < page.aWithHrefHrefs.length; i++) {
        if (longdesc.toLowerCase() === page.aWithHrefHrefs[i].toLowerCase()) {
          if ((page.aWithHrefTexts[i] || "").trim().toLowerCase() === "d") {
            isDlink = true;
            break;
          }
        }
      }
      if (!isDlink) report("C_3.0", { nodes: img });
    }
  });

  // CheckEngine's own isAsciiArtString(String) (distinct from
  // TextChecker's — see private method at CheckEngine.java L4612), used by
  // C_6.0. ASCII_ART_CHAR is the art-glyph set from CheckEngine.java.
  const ASCII_ART_CHARS = new Set([
    "∧", "＿", "￣", "＠", "／", "＼", "γ",
    "Φ", "∩", "∪", "ι", "Ｏ", "⊂", "ﾟ",
    "Д", "σ", "･", "∀", "∑", "i", "o", "0", "_",
    "＿", "￣", "´", "｀", "ヾ",
  ]);
  const ASCII_PUNCT_RE = /[!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~]/g;
  function checkEngineIsAsciiArtString(str) {
    if (str == null) return false;
    const tokens = str.split(/[ \t\n\x0B\f\r]/);
    let num = 0;
    let total = 0;
    for (const token of tokens) {
      const strLength = token.length;
      total += strLength;
      const stripped = token.replace(ASCII_PUNCT_RE, "");
      num += strLength - stripped.length;
      for (const ch of stripped) {
        if (ASCII_ART_CHARS.has(ch)) num++;
      }
    }
    const safeTotal = total === 0 ? 1 : total;
    if (num > 30 && num / safeTotal > 0.8) return true;
    if (num > 30 && TextChecker.isAsciiArtString(str)) return true;
    return false;
  }

  // C_6.0 (item_6, L742): a "leaf" block element (no nested block-level
  // descendant) whose combined text/alt content looks like ASCII art.
  registerCheck("C_6.0", "error", "item_6", ({ page, report }) => {
    for (const body of page.bodyElements) {
      const stack = [];
      let cur = body;
      while (cur) {
        let isArt = false;
        if (isLeafBlockEle(cur) && checkEngineIsAsciiArtString(getTextAltDescendant(cur))) {
          report("C_6.0", { nodes: cur });
          isArt = true;
        }
        if (!isArt && cur.hasChildNodes()) {
          stack.push(cur);
          cur = cur.firstChild;
        } else if (cur.nextSibling) {
          cur = cur.nextSibling;
        } else {
          cur = null;
          while (!cur && stack.length > 0) cur = stack.pop().nextSibling;
        }
      }
    }
  });

  // C_14.0 (item_14, L937): a heading level jumps by more than 1 from the
  // previous heading in document order (e.g. h2 directly followed by h4).
  registerCheck("C_14.0", "error", "item_14", ({ page, report }) => {
    let lastLevel = 0;
    for (let i = 0; i < page.headings.length; i++) {
      const curLevel = Number(page.headings[i].tagName.slice(1));
      if (curLevel > 0) {
        if (lastLevel > 0 && curLevel - lastLevel > 1) {
          const extraText = ` (H${curLevel}タグの1階層上がH${lastLevel}タグです)`;
          report("C_14.0", { nodes: [page.headings[i - 1], page.headings[i]], extraText });
        }
        lastLevel = curLevel;
      }
    }
  });

  // C_18.2 (item_18, L1077): <q> (with quotation text longer than
  // QUOTATION_SHORT_NUM) or <blockquote>, missing a "cite" attribute.
  registerCheck("C_18.2", "error", "item_18", ({ document, report }) => {
    for (const q of Array.from(document.getElementsByTagName("q"))) {
      const text = getTextDescendant(q);
      if (text.length > QUOTATION_SHORT_NUM && !(q.getAttribute("cite") || "")) {
        report("C_18.2", { nodes: q });
      }
    }
    for (const bq of Array.from(document.getElementsByTagName("blockquote"))) {
      if (!(bq.getAttribute("cite") || "")) {
        report("C_18.2", { nodes: bq });
      }
    }
  });

  // C_33.0 (item_33, L1464): <blink> element containing text.
  registerCheck("C_33.0", "error", "item_33", ({ document, report }) => {
    for (const el of Array.from(document.getElementsByTagName("blink"))) {
      if (hasTextDescendant(el)) report("C_33.0", { nodes: el });
    }
  });

  // C_33.1 (item_33/styleCheck, L1472): style="..." attribute containing a
  // text-decoration: blink declaration (regex-based; real CSSOM/computed-
  // style resolution is out of scope — see MICHECKER_ENGINE_PORT_INSTRUCTIONS.md §3.2-2).
  const BLINK_PATTERN_ATTR = /text-decoration(\s)*:[^;]*blink.*/is;
  registerCheck("C_33.1", "error", "item_33", ({ document, report }) => {
    for (const el of Array.from(document.querySelectorAll("[style]"))) {
      const style = el.getAttribute("style") || "";
      if (BLINK_PATTERN_ATTR.test(style)) {
        report("C_33.1", { nodes: el, extraText: `style="${style}"` });
      }
    }
  });

  // C_34.0 (item_34, L1508): <marquee> element.
  registerCheck("C_34.0", "error", "item_34", ({ document, report }) => {
    for (const el of Array.from(document.getElementsByTagName("marquee"))) {
      report("C_34.0", { nodes: el });
    }
  });

  // C_36.0/C_36.1 (item_36, L1546/L1551): <meta http-equiv="refresh"> —
  // C_36.0 for a bare refresh (no "url" in content), C_36.1 for an
  // automatic redirect with a positive delay.
  registerCheck("C_36.0", "error", "item_36", ({ document, report }) => {
    for (const el of Array.from(document.getElementsByTagName("meta"))) {
      if (!el.hasAttribute("http-equiv")) continue;
      if ((el.getAttribute("http-equiv") || "").toLowerCase() !== "refresh") continue;
      const content = el.getAttribute("content");
      if (content == null || content.toLowerCase().indexOf("url") < 0) {
        report("C_36.0", { nodes: el });
      }
    }
  });
  registerCheck("C_36.1", "error", "item_36", ({ document, report }) => {
    for (const el of Array.from(document.getElementsByTagName("meta"))) {
      if (!el.hasAttribute("http-equiv")) continue;
      if ((el.getAttribute("http-equiv") || "").toLowerCase() !== "refresh") continue;
      const content = el.getAttribute("content");
      if (content != null && content.toLowerCase().indexOf("url") >= 0) {
        const m = /^(\d+);.*/.exec(content);
        if (m && Number(m[1]) > 0) report("C_36.1", { nodes: el });
      }
    }
  });

  // C_51.0/C_51.1/C_51.4/C_51.5 (item_51, L2045-2060): missing or
  // blank-only title attribute on <frame>/<iframe>.
  registerCheck("C_51.0", "error", "item_51", ({ page, report }) => {
    for (const el of page.frameElements) {
      if (!hasTitle(el)) report("C_51.0", { nodes: el });
    }
  });
  registerCheck("C_51.4", "error", "item_51", ({ page, report }) => {
    for (const el of page.frameElements) {
      if (hasTitle(el) && hasBlankTitle(el)) report("C_51.4", { nodes: el });
    }
  });
  registerCheck("C_51.1", "error", "item_51", ({ page, report }) => {
    for (const el of page.iframeElements) {
      if (!hasTitle(el)) report("C_51.1", { nodes: el, extraText: `: src=${el.getAttribute("src") || ""}` });
    }
  });
  registerCheck("C_51.5", "error", "item_51", ({ page, report }) => {
    for (const el of page.iframeElements) {
      if (hasTitle(el) && hasBlankTitle(el)) {
        report("C_51.5", { nodes: el, extraText: `: src=${el.getAttribute("src") || ""}` });
      }
    }
  });

  // C_57.2/C_57.3 (item_57, L2217/L2275): part of a larger loop over every
  // <a href> element (item_57 also computes C_57.0/C_57.1/C_57.4/C_57.5/
  // C_57.6, which are "info"/"user" type and not yet reported — PR-M3).
  // The control flow below (word count, empty-title, in-page-anchor,
  // childless/no-img exclusion, noscript exclusion, adjacent-same-href
  // "sequence" exclusion) is preserved in full so that C_57.2 fires under
  // exactly the same conditions as the Java source, even though the
  // C_57.5 branch it's mutually exclusive with isn't reported here yet.
  registerCheck("C_57.3", "error", "item_57", ({ page, report }) => {
    for (const el of page.aWithHrefElements) {
      if (el.hasAttribute("title") && hasBlankTitle(el)) {
        report("C_57.3", { nodes: el });
      }
    }
  });
  registerCheck("C_57.2", "error", "item_57", ({ page, report }) => {
    const hrefs = page.aWithHrefHrefs;
    const texts = page.aWithHrefTexts;
    const elements = page.aWithHrefElements;
    for (let i = 0; i < elements.length; i++) {
      const el = elements[i];
      let strTxt = texts[i] || "";
      if (strTxt.trim().length === 0) {
        const ariaName = getNameByAria(el, null);
        if (ariaName != null) strTxt = ariaName.trim();
      }
      if (getWordCount(strTxt) >= 3 || strTxt.length >= VALIDATE_STR_LEN) continue;
      const strTitle = el.getAttribute("title") || "";
      if (strTitle !== "") continue; // titled links are handled by C_57.4 (M3), not here
      if (strTxt.trim().length > 0) continue; // non-empty short text -> C_57.0/C_57.1 (M3)
      // "can't use link" branch (empty accessible text)
      if (hrefs[i].startsWith("#")) continue; // in-page anchor: counted only, no report in Java
      const noScriptText = getNoScriptText(el);
      const hasImg = el.getElementsByTagName("img").length > 0;
      if (!el.hasChildNodes() && !hasImg) continue; // exceptCount case
      if (noScriptText.length > 0) continue; // script+noscript fallback, exceptCount case
      let sequenceOk = false;
      if (i - 1 >= 0 && hrefs[i - 1] === hrefs[i] && (texts[i - 1] || "").length > 0) {
        sequenceOk = true;
      }
      if (!sequenceOk && i + 1 < hrefs.length && hrefs[i + 1] === hrefs[i] && (texts[i + 1] || "").length > 0) {
        sequenceOk = true;
      }
      if (sequenceOk) continue; // C_57.5 (M3), not C_57.2
      report("C_57.2", { nodes: el, extraText: ` (href="${hrefs[i]}")` });
    }
  });

  // C_85.0 (mediaCheck, L1423): <video>/<audio> with autoplay enabled
  // (attribute present and not literally "false"). All matching elements
  // across the page are reported as a single grouped problem, matching
  // addCheckerProblem(id, extraText, Vector<Node>) semantics in the Java
  // source (a call with an empty vector reports nothing at all).
  registerCheck("C_85.0", "error", "mediaCheck", ({ document, report }) => {
    const autoplayEls = [];
    for (const tag of ["video", "audio"]) {
      for (const el of Array.from(document.getElementsByTagName(tag))) {
        if (el.hasAttribute("autoplay")) {
          const autoplay = el.getAttribute("autoplay") || "";
          if (autoplay.toLowerCase() !== "false") autoplayEls.push(el);
        }
      }
    }
    if (autoplayEls.length > 0) report("C_85.0", { nodes: autoplayEls });
  });

  // C_89.0 (item_89, L3293): a single-<body> page (no <frameset>) whose
  // accumulated body text/alt/title content (walked in document order,
  // stopping once VALID_TOTAL_TEXT_LEN chars are collected) is empty.
  registerCheck("C_89.0", "error", "item_89", ({ document, page, report }) => {
    if (page.bodyElements.length !== 1) return;
    if (document.getElementsByTagName("frameset").length > 0) return;
    const body = page.bodyElements[0];
    let text = "";
    const stack = [];
    let cur = body.firstChild;
    const nbsp = String.fromCharCode(160);
    while (cur && text.length < VALID_TOTAL_TEXT_LEN) {
      if (cur.nodeType === 3) {
        text += (cur.nodeValue || "").split(nbsp).join("").trim();
      } else if (cur.nodeType === 1) {
        const el = cur;
        if (el.hasAttribute("alt")) text += (el.getAttribute("alt") || "").split(nbsp).join("").trim();
        if (el.hasAttribute("title")) text += (el.getAttribute("title") || "").split(nbsp).join("").trim();
      }
      if (cur.hasChildNodes()) {
        stack.push(cur);
        cur = cur.firstChild;
      } else if (cur.nextSibling) {
        cur = cur.nextSibling;
      } else {
        cur = null;
        while (!cur && stack.length > 0) cur = stack.pop().nextSibling;
      }
    }
    if (text.length === 0) report("C_89.0");
    // text.length > 0 && < VALID_TOTAL_TEXT_LEN -> C_89.1/C_89.2 (info/warning, not this PR)
  });

  // C_331.0/C_331.1 (item_331, L3552/L3557): missing/invalid scope
  // attribute on <th> within a data table, using the same
  // simple-table/row-and-col-header classification as the Java source.
  // C_331.0 groups by table (one problem per table); C_331.1 groups across
  // the whole page (one problem total) — this asymmetry matches the Java
  // source exactly (withoutScope is reset per table, invalidScope is not).
  registerCheck("C_331.0", "error", "item_331", ({ page, report }) => {
    for (const table of page.dataTableList) {
      const withoutScope = [];
      const thCount = elementsList(table, "th").length;
      let isHeaderRow = false;
      let isHeaderColumn = true;
      let isRowAndCol = false;
      let isSimpleTable2 = false;
      let firstRowLength = 0;
      let trCount = 0;
      let maxColCount = 0;
      let topLeftElement = null;

      const rows = elementsList(table, "tr");
      for (const tr of rows) {
        const thList = elementsList(tr, "th");
        const cellList = elementsList(tr, "th", "td");
        const thSize = thList.length;

        let colCount = 0;
        for (const el of cellList) {
          let col = 1;
          if (el.hasAttribute("colspan")) {
            const parsed = parseInt(el.getAttribute("colspan"), 10);
            if (!Number.isNaN(parsed)) col = parsed; // parse failure -> keeps default 1, matching the Java catch-and-ignore
          }
          colCount += col;
        }
        if (colCount > maxColCount) maxColCount = colCount;

        // NOTE: Java uses tr.getFirstChild() (the tr's literal first CHILD
        // NODE, which is frequently a whitespace Text node in
        // pretty-printed HTML source, not necessarily the first <td>/<th>)
        // and tr.getChildNodes().getLength() (raw child-node count,
        // including such whitespace text nodes) — not the cell-only counts
        // one might expect. This is preserved exactly rather than "fixed"
        // to use cellList, since it measurably changes which tables get
        // classified as header rows in real (whitespace-formatted) HTML.
        const firstCellNode = tr.firstChild;
        const firstCellName = firstCellNode ? (firstCellNode.nodeName || "").toLowerCase() : "";
        const isTH = firstCellName === "th";

        if (trCount === 0) {
          firstRowLength = tr.childNodes.length;
          if (thSize === firstRowLength) {
            isHeaderRow = true;
          } else if (thSize + 1 === firstRowLength && firstCellName === "td") {
            isSimpleTable2 = true;
          }
          if (firstCellNode && firstCellNode.nodeType === 1) {
            topLeftElement = firstCellNode;
          }
        }

        let isTHwoRowspan = isTH;
        if (isTHwoRowspan) {
          const rowspanAttr = firstCellNode.getAttribute("rowspan");
          const parsed = parseInt(rowspanAttr, 10);
          if (!Number.isNaN(parsed)) isTHwoRowspan = parsed < 2;
          // else: no/non-numeric rowspan attribute -> isTHwoRowspan stays
          // true (unchanged), matching the Java catch-and-ignore.
        }

        if (isHeaderColumn) isHeaderColumn = isTHwoRowspan;
        if (isSimpleTable2 && trCount !== 0) isSimpleTable2 = isTHwoRowspan;
        trCount++;
      }

      isHeaderRow = isHeaderRow && firstRowLength === maxColCount;
      isSimpleTable2 = isSimpleTable2 && firstRowLength === maxColCount && firstRowLength + trCount - 2 === thCount;

      if (isHeaderRow && isHeaderColumn && trCount + firstRowLength - 1 === thCount) {
        isRowAndCol = true;
      }

      const isSimpleTable = (isHeaderRow && firstRowLength === thCount) || (isHeaderColumn && trCount === thCount);

      for (const th of elementsList(table, "th")) {
        if (!th.hasAttribute("scope")) {
          if (!isSimpleTable && !isSimpleTable2 && !isRowAndCol) withoutScope.push(th);
        }
      }
      if (isRowAndCol && topLeftElement && !topLeftElement.hasAttribute("scope")) {
        withoutScope.push(topLeftElement);
      }
      // isSimpleTable2 && topLeftElement has non-empty text -> C_331.2
      // (warning type, PR-M2 — not reported here).

      if (withoutScope.length > 0) {
        const tds = elementsList(table, "td");
        const tdWithHeaders = tds.filter((td) => td.hasAttribute("headers"));
        // Matches Java literally: a table with zero <td> elements trivially
        // satisfies tdWithHeaders.length === tds.length (0 === 0), which
        // suppresses C_331.0 for that table even though withoutScope is
        // non-empty. Not special-cased away — see §4.4 (faithful port).
        const hasHeaders = tdWithHeaders.length === tds.length;
        if (!hasHeaders) report("C_331.0", { nodes: withoutScope });
      }
    }
  });
  registerCheck("C_331.1", "error", "item_331", ({ page, report }) => {
    const invalidScope = [];
    for (const table of page.dataTableList) {
      for (const th of elementsList(table, "th")) {
        if (th.hasAttribute("scope") && !/^(row(group)?|col(group)?)$/.test(th.getAttribute("scope") || "")) {
          invalidScope.push(th);
        }
      }
    }
    if (invalidScope.length > 0) report("C_331.1", { nodes: invalidScope });
  });

  // C_332.1/C_332.2 (item_332, L3569/L3571): a "headers" attribute value
  // referencing an id that either doesn't exist (C_332.1) or resolves to a
  // non-th/td element (C_332.2). NOTE: the Java source re-scans ALL
  // th/td cells in the whole document once per table in dataTableList
  // (not just that table's own cells) — a latent inefficiency/duplication
  // quirk in the original that is preserved here faithfully rather than
  // "fixed" (see MICHECKER_ENGINE_PORT_INSTRUCTIONS.md §4.4). With N
  // qualifying tables, a single bad "headers" reference is reported N times.
  registerCheck("C_332.1", "error", "item_332", ({ document, page, report }) => {
    for (const _table of page.dataTableList) {
      for (const cell of elementsList(document, "th", "td")) {
        if (!cell.hasAttribute("headers")) continue;
        for (const id of (cell.getAttribute("headers") || "").split(/[ \t]+/).filter(Boolean)) {
          const referred = document.getElementById(id);
          if (!referred) report("C_332.1", { nodes: cell, extraText: `(id=${id})` });
        }
      }
    }
  });
  registerCheck("C_332.2", "error", "item_332", ({ document, page, report }) => {
    for (const _table of page.dataTableList) {
      for (const cell of elementsList(document, "th", "td")) {
        if (!cell.hasAttribute("headers")) continue;
        for (const id of (cell.getAttribute("headers") || "").split(/[ \t]+/).filter(Boolean)) {
          const referred = document.getElementById(id);
          if (referred && !/^(td|th)$/.test(referred.tagName.toLowerCase())) {
            report("C_332.2", { nodes: cell, extraText: referred.tagName.toLowerCase() });
          }
        }
      }
    }
  });

  // C_422.0 (item_422, L3701): two or more elements sharing the same
  // non-empty accesskey value.
  registerCheck("C_422.0", "error", "item_422", ({ document, report }) => {
    const groups = new Map();
    for (const el of Array.from(document.querySelectorAll("[accesskey]"))) {
      const key = el.getAttribute("accesskey") || "";
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(el);
    }
    for (const [key, els] of groups) {
      if (els.length > 1) report("C_422.0", { nodes: els, extraText: key });
    }
  });

  // C_423.0 (item_423, L3719): two or more elements sharing the same id
  // value. NOTE: the Java source scopes this to direct children of <body>
  // only (XPath "//body/*[@id]", not a full descendant search) — a narrow
  // scope preserved faithfully here rather than widened to all descendants.
  registerCheck("C_423.0", "error", "item_423", ({ document, report }) => {
    const groups = new Map();
    for (const body of Array.from(document.getElementsByTagName("body"))) {
      for (const el of Array.from(body.children)) {
        if (!el.hasAttribute("id")) continue;
        const key = el.getAttribute("id") || "";
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(el);
      }
    }
    for (const [key, els] of groups) {
      if (els.length > 1) {
        report("C_423.0", { nodes: els, extraText: key === "" ? 'id=""' : key });
      }
    }
  });

  // ---------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------
  function buildMessage(checkId, extraText, checkitemsById) {
    const item = checkitemsById.get(checkId);
    if (!item) return extraText || "";
    return formatMessage(item.desc_ja, extraText ? [extraText] : []);
  }

  function run(document, options = {}) {
    const checkitems = options.checkitems || [];
    const checkitemsById = new Map(checkitems.map((item) => [item.id, item]));
    const allowedIds = options.checkIds ? new Set(options.checkIds) : null;

    const page = buildPageContext(document);
    const collector = createCollector();
    const checklist = [];

    for (const [checkId, check] of Object.entries(CHECKS)) {
      if (allowedIds && !allowedIds.has(checkId)) continue;
      if (check.method === "always") {
        // "always" checks are unconditional, page-level manual-review
        // reminders (see MICHECKER_ENGINE_PORT_INSTRUCTIONS.md §3.2-3) and
        // are surfaced separately from element-anchored problems.
        const localCollector = createCollector();
        check.run({ document, page, report: localCollector.report });
        for (const p of localCollector.problems) {
          checklist.push({
            checkId: p.checkId,
            type: CHECKS[p.checkId] ? CHECKS[p.checkId].type : check.type,
            message: buildMessage(p.checkId, p.extraText, checkitemsById),
          });
        }
      } else {
        check.run({ document, page, report: collector.report });
      }
    }

    const problems = collector.problems.map((p) => ({
      checkId: p.checkId,
      type: CHECKS[p.checkId] ? CHECKS[p.checkId].type : undefined,
      nodes: p.selectors,
      extraText: p.extraText,
      message: buildMessage(p.checkId, p.extraText, checkitemsById),
    }));

    return { problems, checklist, engineVersion: "actf-703e34f0" };
  }

  window.micheckerEngine = {
    run,
    // Exposed for PR-M1+ implementations and for the parity test runner.
    _internal: { registerCheck, TextChecker, formatMessage, selectorPathFor },
  };
})();

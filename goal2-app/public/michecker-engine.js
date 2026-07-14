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
  // tables containing a nested <table> are set aside as "parent" tables.
  // layoutTableList = parent + bottom_1row1col + bottom_notdata (everything
  // that ISN'T a bottom data table) — mirrors the Java source's field
  // initializer (layoutTableList.addAll(parent/1row1col/notdata)).
  function classifyTables(document) {
    const tables = Array.from(document.getElementsByTagName("table"));
    const dataTables = [];
    const layoutTables = [];
    const parentTables = [];
    const bottom1Row1ColTables = [];
    const bottomNotDataTables = [];
    for (const table of tables) {
      if (table.getElementsByTagName("table").length === 0) {
        if (is1Row1ColTable(table)) {
          layoutTables.push(table);
          bottom1Row1ColTables.push(table);
        } else if (isDataTable(table)) {
          dataTables.push(table);
        } else {
          layoutTables.push(table);
          bottomNotDataTables.push(table);
        }
      } else {
        layoutTables.push(table);
        parentTables.push(table);
      }
    }
    return { dataTables, layoutTables, parentTables, bottom1Row1ColTables, bottomNotDataTables };
  }

  // HtmlEvalUtil#getDirectDescendantElements(Element, tagName): finds
  // descendant elements matching tagName, WITHOUT recursing into a nested
  // element whose own tag matches the starting element's tag (e.g. a
  // nested <table> when called on a <table>) — so th/caption belonging to
  // an inner nested table are not counted for the outer table.
  function getDirectDescendantElements(element, tagName, excludedTag) {
    const excluded = excludedTag || element.tagName.toLowerCase();
    const result = [];
    for (const child of Array.from(element.children)) {
      const childTag = child.tagName.toLowerCase();
      if (childTag === tagName) {
        result.push(child);
      } else if (childTag !== excluded) {
        result.push(...getDirectDescendantElements(child, tagName, excluded));
      }
    }
    return result;
  }

  function isEmptyString(s) {
    return s == null || s.length === 0;
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
    const { dataTables, layoutTables, parentTables, bottom1Row1ColTables, bottomNotDataTables } =
      classifyTables(document);
    const objectElements = Array.from(document.getElementsByTagName("object"));
    const embedElements = Array.from(document.getElementsByTagName("embed"));
    // HtmlEvalUtil#getEventMouseButtonElements / getEventOnMouseElements:
    // elements with any mouse-button / mouse-focus event handler attribute
    // (EVENT_MOUSE_BUTTON / EVENT_MOUSE_FOCUS constants).
    const eventMouseButtonElements = Array.from(
      document.querySelectorAll("[onclick],[ondblclick],[onmouseup],[onmousedown]")
    );
    const eventMouseFocusElements = Array.from(
      document.querySelectorAll("[onmouseover],[onmouseout],[onmousemove]")
    );
    // HtmlEvalUtil#getElementsWithStyle: elements with a style="" attribute
    // (used for text-decoration:blink text-analysis checks). styleElementMap
    // covers inline <style> element text content; the Java source also has
    // a styleSheetsMap for *external* stylesheet text, which this engine
    // does not resolve (no network fetch — see MICHECKER_ENGINE_PORT_INSTRUCTIONS.md §3.2-2).
    const elementsWithStyle = Array.from(document.querySelectorAll("[style]"));
    const styleElementMap = new Map(
      Array.from(document.getElementsByTagName("style")).map((el) => [el, el.textContent || ""])
    );
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
      layoutTableList: layoutTables,
      parentTableElements: parentTables,
      bottom1Row1ColTables,
      bottomNotDataTables,
      objectElements,
      embedElements,
      elementsWithStyle,
      styleElementMap,
      eventMouseButtonElements,
      eventMouseFocusElements,
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

  // Shared body-text accumulation for item_89 (C_89.0/C_89.1/C_89.2).
  // Returns null if the page doesn't qualify (not exactly one <body>, or a
  // <frameset> is present); otherwise the accumulated text length capped at
  // VALID_TOTAL_TEXT_LEN chars, matching the Java source's early-exit walk.
  function accumulateBodyText(document, page) {
    if (page.bodyElements.length !== 1) return null;
    if (document.getElementsByTagName("frameset").length > 0) return null;
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
    return text;
  }

  // C_89.0 (item_89, L3293): a single-<body> page (no <frameset>) whose
  // accumulated body text/alt/title content (walked in document order,
  // stopping once VALID_TOTAL_TEXT_LEN chars are collected) is empty.
  registerCheck("C_89.0", "error", "item_89", ({ document, page, report }) => {
    const text = accumulateBodyText(document, page);
    if (text != null && text.length === 0) report("C_89.0");
  });

  // C_89.2 (item_89, L3298, warning): same page-level scan as C_89.0, but
  // for the case where SOME text was found (0 < length < threshold) and
  // there are no <img> elements on the page at all (if there are images,
  // C_89.1 — "user"-type, PR-M3 — fires instead; mutually exclusive).
  registerCheck("C_89.2", "warning", "item_89", ({ document, page, report }) => {
    const text = accumulateBodyText(document, page);
    if (text != null && text.length > 0 && text.length < VALID_TOTAL_TEXT_LEN && page.imgElements.length === 0) {
      report("C_89.2");
    }
  });

  // Shared per-table analysis for item_331 (C_331.0/C_331.1/C_331.2). See
  // MICHECKER_ENGINE_PORT_INSTRUCTIONS.md §3.2-... — extracted into one
  // function so C_331.0 and C_331.2 (which both depend on the same
  // isSimpleTable2/topLeftElement/withoutScope computation) can't drift
  // apart from each other or from the original single Java loop.
  function analyzeScopeTable(table) {
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

    return { withoutScope, isSimpleTable2, topLeftElement };
  }

  // C_331.0/C_331.1 (item_331, L3552/L3557): missing/invalid scope
  // attribute on <th> within a data table, using the same
  // simple-table/row-and-col-header classification as the Java source.
  // C_331.0 groups by table (one problem per table); C_331.1 groups across
  // the whole page (one problem total) — this asymmetry matches the Java
  // source exactly (withoutScope is reset per table, invalidScope is not).
  registerCheck("C_331.0", "error", "item_331", ({ page, report }) => {
    for (const table of page.dataTableList) {
      const { withoutScope } = analyzeScopeTable(table);
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

  // C_331.2 (item_331, L3540, warning): a "simple table with row/col
  // headers" (isSimpleTable2 — top-left cell should be empty) whose actual
  // top-left <td> has non-empty text.
  registerCheck("C_331.2", "warning", "item_331", ({ page, report }) => {
    for (const table of page.dataTableList) {
      const { isSimpleTable2, topLeftElement } = analyzeScopeTable(table);
      if (isSimpleTable2 && topLeftElement) {
        const text = getTextAltDescendant(topLeftElement).trim();
        if (text.length > 0) report("C_331.2", { nodes: topLeftElement });
      }
    }
  });

  // C_6.1 (item_6, L743, warning): companion to C_6.0 — reported for the
  // exact same leaf-block/ASCII-art matches, as a second (differently
  // worded) reminder about providing alternative text near the art.
  registerCheck("C_6.1", "warning", "item_6", ({ page, report }) => {
    for (const body of page.bodyElements) {
      const stack = [];
      let cur = body;
      while (cur) {
        let isArt = false;
        if (isLeafBlockEle(cur) && checkEngineIsAsciiArtString(getTextAltDescendant(cur))) {
          report("C_6.1", { nodes: cur });
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

  // C_13.0 (item_13, L908, warning): absolute (non-%, no +/-) size
  // specifications — <font size="N">, and width/height on
  // table/tr/td/col. Each element/tag group is a separate grouped problem
  // (matches checkAbsoluteSize's per-tag addCheckerProblem calls).
  function checkAbsoluteSizeTag(document, report, tagName) {
    const nodes = Array.from(document.getElementsByTagName(tagName)).filter((el) => {
      const width = el.getAttribute("width");
      const height = el.getAttribute("height");
      const widthAbsolute = width != null && width !== "" && width.indexOf("%") === -1;
      const heightAbsolute = height != null && height !== "" && height.indexOf("%") === -1;
      return widthAbsolute || heightAbsolute;
    });
    if (nodes.length > 0) report("C_13.0", { nodes });
  }
  registerCheck("C_13.0", "warning", "item_13", ({ document, report }) => {
    const fontNodes = Array.from(document.getElementsByTagName("font")).filter((el) => {
      if (!el.hasAttribute("size")) return false;
      const size = el.getAttribute("size") || "";
      return size.length > 0 && size.indexOf("+") === -1 && size.indexOf("-") === -1;
    });
    if (fontNodes.length > 0) report("C_13.0", { nodes: fontNodes });
    for (const tag of ["table", "tr", "td", "col"]) {
      checkAbsoluteSizeTag(document, report, tag);
    }
  });

  // C_23.2 (item_23, L1244, warning): a layout table (see layoutTableList)
  // that has a direct-descendant <th>/<caption>, or a non-empty "summary"
  // attribute in a non-HTML5 document — i.e. a table that LOOKS like it
  // might be a data table despite being classified as layout.
  registerCheck("C_23.2", "warning", "item_23", ({ page, report }) => {
    const tables = [];
    for (const table of page.layoutTableList) {
      if (getDirectDescendantElements(table, "th").length > 0) {
        tables.push(table);
      } else if (getDirectDescendantElements(table, "caption").length > 0) {
        tables.push(table);
      } else {
        // isHTML5 && has summary -> C_48.8 (registered separately, warning, this PR)
        if (table.hasAttribute("summary") && !isEmptyString(table.getAttribute("summary"))) {
          tables.push(table);
        }
      }
    }
    if (tables.length > 0) report("C_23.2", { nodes: tables });
  });

  // C_33.2 (item_33, L1481, warning): text-decoration:blink inside a
  // <style> element's text content or (unresolved — see
  // MICHECKER_ENGINE_PORT_INSTRUCTIONS.md §3.2-2) an external stylesheet.
  const BLINK_PATTERN = /\{[^}]*text-decoration(\s)*:[^;]*blink[\s\S]*\}/is;
  registerCheck("C_33.2", "warning", "item_33", ({ page, report }) => {
    for (const [el, style] of page.styleElementMap) {
      if (style && BLINK_PATTERN.test(style)) {
        report("C_33.2", { nodes: el });
      }
    }
    // External stylesheet text (styleSheetsMap in the Java source) is not
    // resolved by this engine — see scope note above.
  });

  // C_38.0 (item_38, L1576, warning): elements with a mouse-button event
  // handler (onclick/ondblclick/onmouseup/onmousedown) but no matching
  // keyboard equivalent, and (separately) elements with a mouse-focus
  // handler (onmouseover/onmouseout/onmousemove) but no keyboard-focus
  // equivalent. Two separate grouped reports, matching the two
  // addCheckerProblem("C_38.0", ...) call sites in item_38.
  registerCheck("C_38.0", "warning", "item_38", ({ page, report }) => {
    const seen = new Set();
    const withoutKeyboard = [];
    for (const el of page.eventMouseButtonElements) {
      seen.add(el);
      const hasKeyEquivalent = el.hasAttribute("onkeydown") || el.hasAttribute("onkeypress") || el.hasAttribute("onkeyup");
      if (!hasKeyEquivalent) withoutKeyboard.push(el);
    }
    if (withoutKeyboard.length > 0) report("C_38.0", { nodes: withoutKeyboard });

    const withoutFocus = [];
    for (const el of page.eventMouseFocusElements) {
      if (seen.has(el)) continue; // Java's HashSet#add returns false for duplicates -> skipped
      seen.add(el);
      const hasFocusEquivalent = el.hasAttribute("onfocus") || el.hasAttribute("onblur") || el.hasAttribute("onselect");
      if (!hasFocusEquivalent) withoutFocus.push(el);
    }
    if (withoutFocus.length > 0) report("C_38.0", { nodes: withoutFocus });
  });

  // C_46.0 (item_46, L1980, warning): two adjacent <a href> links with
  // DIFFERENT targets, separated only by whitespace text / <br> / <p>
  // (no visible separator between them).
  function resolveUrl(href, document) {
    try {
      return new URL(href, document.baseURI).toString();
    } catch (e) {
      return href;
    }
  }
  registerCheck("C_46.0", "warning", "item_46", ({ document, page, report }) => {
    const seen = [];
    for (let i = 0; i < page.aWithHrefElements.length; i++) {
      const el = page.aWithHrefElements[i];
      if (seen.includes(el)) continue;
      let endEl = null;
      let next = el.nextSibling;
      const url1 = resolveUrl(page.aWithHrefHrefs[i], document);
      let adjacent = false;
      while (next) {
        if (next.nodeType === 1) {
          const name = (next.nodeName || "").toLowerCase();
          if (name === "br" || name === "p") {
            next = next.nextSibling;
            continue;
          } else if (name === "a") {
            const url2 = resolveUrl(next.getAttribute("href") || "", document);
            if (url1 !== url2) {
              endEl = next;
              if (!seen.includes(el)) seen.push(el);
              if (!seen.includes(endEl)) seen.push(endEl);
              adjacent = true;
            } else {
              break;
            }
          } else {
            break;
          }
        } else if (next.nodeType === 3) {
          const text = next.nodeValue || "";
          if (text.trim() !== "") break;
        }
        next = next.nextSibling;
      }
      if (adjacent) report("C_46.0", { nodes: [el, endEl] });
    }
  });

  // C_48.0-C_48.5/C_48.7/C_48.8 (item_48 + item_3's summary/longdesc
  // branches, warning): deprecated elements and attributes. Grouped by
  // element name per checkObsoluteEle. C_48.6 (b/i without HTML5 —
  // "use strong/em instead") is "user"-type (PR-M3), not reported here.
  // C_48.7 (acronym) and C_48.8 (deprecated attributes) only fire in the
  // Java source's `if (isHTML5)` branches; since this engine's fragment
  // parsing always yields isHTML5===false (see isHTML5() above), these two
  // are structurally unreachable in this engine's normal usage — they are
  // still registered faithfully for completeness (and in case a full,
  // doctype-bearing document is ever analyzed).
  function checkObsoluteEle(document, report, id, tag) {
    const nodes = Array.from(document.getElementsByTagName(tag));
    if (nodes.length > 0) report(id, { nodes, extraText: tag });
  }
  registerCheck("C_48.0", "warning", "item_48", ({ document, page, report }) => {
    checkObsoluteEle(document, report, "C_48.0", "menuitem");
    if (page.isHTML5) {
      checkObsoluteEle(document, report, "C_48.0", "frame");
      checkObsoluteEle(document, report, "C_48.0", "frameset");
      checkObsoluteEle(document, report, "C_48.0", "noframes");
      // isXML (XHTML) is not evaluated by this engine (no XML mode); the
      // Java source's `if (isXML) checkObsoluteEle("C_48.0", "noscript")`
      // is therefore not reproduced here.
    }
  });
  registerCheck("C_48.1", "warning", "item_48", ({ document, report }) => {
    checkObsoluteEle(document, report, "C_48.1", "applet");
  });
  registerCheck("C_48.2", "warning", "item_48", ({ document, page, report }) => {
    for (const tag of ["basefont", "center", "font", "strike", "u"]) {
      checkObsoluteEle(document, report, "C_48.2", tag);
    }
    if (!page.isHTML5) {
      checkObsoluteEle(document, report, "C_48.2", "s");
    } else {
      checkObsoluteEle(document, report, "C_48.2", "big");
      checkObsoluteEle(document, report, "C_48.2", "tt");
    }
  });
  registerCheck("C_48.3", "warning", "item_48", ({ document, page, report }) => {
    checkObsoluteEle(document, report, "C_48.3", "dir");
    if (!page.isHTML5) {
      checkObsoluteEle(document, report, "C_48.3", "menu");
    }
  });
  registerCheck("C_48.4", "warning", "item_48", ({ document, report }) => {
    checkObsoluteEle(document, report, "C_48.4", "isindex");
  });
  registerCheck("C_48.5", "warning", "item_48", ({ document, report }) => {
    for (const tag of ["listing", "plaintext", "xmp"]) {
      checkObsoluteEle(document, report, "C_48.5", tag);
    }
  });
  registerCheck("C_48.7", "warning", "item_48", ({ document, page, report }) => {
    if (page.isHTML5) checkObsoluteEle(document, report, "C_48.7", "acronym");
  });
  registerCheck("C_48.8", "warning", "item_3/item_23", ({ page, report }) => {
    if (!page.isHTML5) return;
    for (const img of page.imgElements) {
      if (img.hasAttribute("longdesc")) report("C_48.8", { nodes: img, extraText: "longdesc" });
    }
    for (const table of [...page.dataTableList, ...page.layoutTableList]) {
      if (table.hasAttribute("summary")) report("C_48.8", { nodes: table, extraText: "summary" });
    }
  });

  // C_80.0 (item_80, L3124, warning): any element with an "alt" attribute
  // longer than 150 characters.
  registerCheck("C_80.0", "warning", "item_80", ({ page, report }) => {
    for (const body of page.bodyElements) {
      const stack = [];
      let cur = body;
      while (cur) {
        if (cur.nodeType === 1 && cur.hasAttribute("alt")) {
          const alt = cur.getAttribute("alt") || "";
          if (alt.length > 150) report("C_80.0", { nodes: cur });
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
    }
  });

  // C_300.1 (item_300, L3380, warning): an <area alt="..."> whose alt text
  // (checked with "area" as an extra NG word) is problematic — and is
  // either not BLANK, or is BLANK but the area also has an href. Reported
  // once per <img usemap> that references the area's parent <map> (a
  // single area can be reported multiple times if several images share the
  // same map — matches the Java source's nested loop exactly).
  registerCheck("C_300.1", "warning", "item_300", ({ document, report }) => {
    for (const area of Array.from(document.getElementsByTagName("area"))) {
      const alt = area.getAttribute("alt");
      if (alt == null) continue;
      const ngWords = new Set(["area"]);
      const result = TextChecker.checkAlt(alt, null, ngWords);
      if (result === "OK") continue;
      if (result === "SPACE_SEPARATED" || result === "SPACE_SEPARATED_JP") continue;
      if (result === "BLANK" && !area.hasAttribute("href")) continue;
      const map = area.parentElement;
      if (!map || map.tagName.toLowerCase() !== "map") continue;
      const mapName = map.getAttribute("name") || "";
      const images = Array.from(document.querySelectorAll(`img[usemap="#${mapName}"]`));
      for (const _image of images) {
        report("C_300.1", { nodes: area, extraText: alt });
      }
    }
  });

  // ---------------------------------------------------------------------
  // PR-M3, part 1: "always" checklist items (page-level, unconditional
  // manual-review reminders — see always(), L3939 in CheckEngine.java).
  //
  // IMPORTANT CORRECTION vs. MICHECKER_PORT_INVENTORY.md: the inventory's
  // "手動確認(always)" classification was generated by regex-matching
  // "C_x.y" string literals anywhere in CheckEngine.java, which does not
  // distinguish live code from comments. Reading always() in full (not
  // done for the original inventory pass) revealed that 5 of the 24
  // "always"-classified in-scope IDs are addCheckerProblem calls that are
  // COMMENTED OUT in the current source and therefore never actually fire:
  //   C_500.4  — "// moved into 15 & 388" (superseded by item_15/formCheck,
  //              but no live emitter for C_500.4 exists anywhere in the file)
  //   C_500.13, C_500.14, C_500.15, C_500.16 — commented out with no
  //              explanation and no other emitter found via full-file search
  // These 5 are therefore genuinely "not-fired" (same category as C_16.0/
  // C_332.0 from PR-M0/M1) and are intentionally NOT registered below.
  // The remaining 19 are live and are registered as ordinary "always"-
  // method checks (report() with no nodes -> routed to run()'s checklist).
  // ---------------------------------------------------------------------
  function registerAlways(id, type, fn) {
    registerCheck(id, type, "always", fn);
  }
  registerAlways("C_19.0", "info", ({ report }) => report("C_19.0"));
  registerAlways("C_20.0", "info", ({ report }) => report("C_20.0"));
  registerAlways("C_55.0", "info", ({ report }) => report("C_55.0"));
  registerAlways("C_56.1", "info", ({ page, report }) => {
    if (page.aWithHrefElements.length > 0) report("C_56.1");
  });
  registerAlways("C_67.0", "info", ({ report }) => report("C_67.0"));
  registerAlways("C_71.0", "info", ({ report }) => report("C_71.0"));
  registerAlways("C_81.0", "info", ({ page, report }) => {
    if (page.aWithHrefElements.length > 0) report("C_81.0");
  });
  registerAlways("C_83.0", "info", ({ report }) => report("C_83.0"));
  registerAlways("C_500.2", "info", ({ report }) => report("C_500.2"));
  registerAlways("C_500.6", "info", ({ report }) => report("C_500.6"));
  registerAlways("C_500.11", "info", ({ report }) => report("C_500.11"));
  registerAlways("C_500.12", "info", ({ report }) => report("C_500.12"));
  registerAlways("C_600.0", "info", ({ report }) => report("C_600.0"));
  registerAlways("C_600.8", "info", ({ report }) => report("C_600.8"));
  registerAlways("C_600.9", "info", ({ report }) => report("C_600.9"));
  registerAlways("C_600.10", "info", ({ report }) => report("C_600.10"));
  registerAlways("C_600.14", "info", ({ report }) => report("C_600.14"));
  registerAlways("C_600.17", "info", ({ report }) => report("C_600.17"));
  registerAlways("C_600.19", "info", ({ report }) => report("C_600.19"));

  // ---------------------------------------------------------------------
  // PR-M3, part 2: remaining info/user-type individual checks (49 items).
  // ---------------------------------------------------------------------

  // CheckEngine#isNormalImage(Element): images with declared width/height
  // both present and either dimension "small" (<50) are excluded from
  // several alt-text-quality checks. Integer.valueOf() throws (and BOTH
  // dimensions fall back to 100) for a missing/non-numeric width or
  // height string — ported via a strict-integer helper standing in for
  // Java's NumberFormatException.
  function javaIntegerValueOf(s) {
    if (/^[+-]?\d+$/.test(s)) {
      const n = parseInt(s, 10);
      if (!Number.isNaN(n)) return n;
    }
    return null;
  }
  function isNormalImage(el) {
    const strWidth = el.getAttribute("width");
    const strHeight = el.getAttribute("height");
    let iWidth = 0;
    let iHeight = 0;
    let threw = false;
    if (strWidth != null) {
      const v = javaIntegerValueOf(strWidth);
      if (v == null) threw = true;
      else iWidth = v;
    }
    if (!threw && strHeight != null) {
      const v = javaIntegerValueOf(strHeight);
      if (v == null) threw = true;
      else iHeight = v;
    }
    if (threw) {
      iWidth = 100;
      iHeight = 100;
    }
    if (iWidth < 50 || iHeight < 50) {
      const iBig = iWidth > iHeight ? iWidth : iHeight;
      const iSmall = iWidth > iHeight ? iHeight : iWidth;
      if (iBig < 50) return false;
      if (iSmall / iBig < 0.2) return false;
    }
    return true;
  }

  // CheckEngine#getFileExtension(String)
  function getFileExtension(name) {
    const pos = name.lastIndexOf(".");
    if (pos > 0) return name.substring(pos + 1);
    return "";
  }

  const TABLE_CELL_ABBR_CHARS = 30;
  const TABLE_CELL_ABBR_WORDS = 10;
  const IS_DBCS = true; // Japanese-locale analysis, matching M1's VALIDATE_STR_LEN choice

  // CheckEngine#isAudioFileExt / isMultimediaFileExt + their extension lists
  const AUDIO_FILE_EXTENSIONS = new Set(["mp3", "mid", "mrm", "mrl", "vqf", "wav", "ogg", "spx", "oga"]);
  const MULTIMEDIA_FILE_EXTENSIONS = new Set([
    "avi", "ram", "rm", "asf", "wm", "wmx", "wmv", "asx", "mpeg", "mpg", "mp4", "ogv", "3gp",
  ]);
  function isAudioOrMultimediaFileExt(ext) {
    const lower = ext.toLowerCase();
    return AUDIO_FILE_EXTENSIONS.has(lower) || MULTIMEDIA_FILE_EXTENSIONS.has(lower);
  }

  // CheckEngine#hasRowColSpan(Element): any th/td cell with rowspan>1 or
  // colspan>1.
  function hasRowColSpan(table) {
    for (const cell of elementsList(table, "th", "td")) {
      const row = javaIntegerValueOf(cell.getAttribute("rowspan") || "");
      const col = javaIntegerValueOf(cell.getAttribute("colspan") || "");
      if ((row != null && row > 1) || (col != null && col > 1)) return true;
    }
    return false;
  }

  // C_3.1 (item_3, L683, user): <img longdesc="..."> (any value, even
  // empty) present in a non-HTML5 document — a broader companion to C_3.0.
  registerCheck("C_3.1", "user", "item_3", ({ page, report }) => {
    if (page.isHTML5) return;
    for (const img of page.imgElements) {
      if (img.hasAttribute("longdesc")) report("C_3.1", { nodes: img });
    }
  });

  // C_4.0 (item_4, L706, user): a "normal"-sized image whose alt text is
  // long (>=3 words or long overall) AND (contains non-ASCII characters OR
  // is longer than 30 chars) — a candidate for being a genuinely complex
  // image needing a fuller description.
  registerCheck("C_4.0", "user", "item_4", ({ page, report }) => {
    const nodes = [];
    for (const img of page.imgElements) {
      if (!isNormalImage(img)) continue;
      if (!img.hasAttribute("alt")) continue;
      const alt = img.getAttribute("alt") || "";
      if (getWordCount(alt) >= 3 || alt.length >= VALIDATE_STR_LEN) {
        if (!/^[\x00-\x7F]*$/.test(alt) || alt.length > 30) {
          nodes.push(img);
        }
      }
    }
    if (nodes.length > 0) report("C_4.0", { nodes });
  });

  // C_7.0 (item_7, L784, user): an <area href="..."> whose href does not
  // match any <a href> elsewhere on the page (an image-map link with no
  // corresponding text-link fallback). Reported once per unmatched area,
  // ungrouped (matches addCheckerProblem(id, extraText) with no target).
  registerCheck("C_7.0", "user", "item_7", ({ document, page, report }) => {
    for (const area of Array.from(document.getElementsByTagName("area"))) {
      let hasLink = false;
      const href = area.getAttribute("href") || "";
      if (href.length > 0) {
        hasLink = page.aWithHrefHrefs.some((h) => h.toLowerCase() === href.toLowerCase());
      }
      if (!hasLink) report("C_7.0", { extraText: ` (href="${href}")` });
    }
  });

  // C_8.0 (item_8, L805, user): <font color="..."> or <font
  // bgcolor="..."> with a non-empty value. NOTE: the Java source's
  // styleCheck() also emits C_8.0 for <style> elements / style attributes
  // that declare BOTH a color and a background-color — that path requires
  // a fuller CSS selector-block parser (findStyles/StyleSelectorSets) and
  // is out of scope for this port (see MICHECKER_ENGINE_PORT_INSTRUCTIONS.md
  // §3.2-2); only the <font> attribute path (item_8) is implemented here.
  registerCheck("C_8.0", "user", "item_8", ({ document, report }) => {
    const nodes = Array.from(document.getElementsByTagName("font")).filter((el) => {
      if (!(el.hasAttribute("color") || el.hasAttribute("bgcolor"))) return false;
      const color = el.getAttribute("color") || "";
      const bgcolor = el.getAttribute("bgcolor") || "";
      return color !== "" || bgcolor !== "";
    });
    if (nodes.length > 0) report("C_8.0", { nodes });
  });

  // C_12.0/C_12.1/C_12.2 (item_12, L875/880/885, user): nested-table depth
  // reporting. C_12.0 fires once per "parent" table (one containing a
  // nested <table>), with extraText noting the max nesting depth found
  // inside it. C_12.1/C_12.2 fire once per bottom 1-row/1-col / non-data
  // table (per-element, not grouped).
  registerCheck("C_12.0", "user", "item_12", ({ page, report }) => {
    for (const table of page.parentTableElements) {
      // Depth-tracking tree walk mirroring the Java source's stack-based
      // traversal: increments on entering a nested <table>, decrements on
      // leaving one (via next-sibling advance or stack pop), tracking the
      // maximum concurrent nesting depth encountered.
      let tableCount = 0;
      let maxCount = 0;
      const stack = [];
      let cur = table.firstChild;
      while (cur) {
        const name = cur.nodeName || "";
        if (cur.nodeType === 1 && name.toLowerCase() === "table") {
          tableCount++;
          if (maxCount < tableCount) maxCount = tableCount;
        }
        if (cur.hasChildNodes()) {
          stack.push(cur);
          cur = cur.firstChild;
        } else if (cur.nextSibling) {
          if (cur.nodeType === 1 && name === "table") tableCount--;
          cur = cur.nextSibling;
        } else {
          if (cur.nodeType === 1 && name === "table") tableCount--;
          cur = null;
          while (!cur && stack.length > 0) {
            const popped = stack.pop();
            if (popped.nodeType === 1 && (popped.nodeName || "") === "table") tableCount--;
            cur = popped.nextSibling;
          }
        }
      }
      if (maxCount > 0) {
        const extraText =
          maxCount === 1
            ? " (入れ子のテーブルが存在しています)"
            : ` (${maxCount}階層の入れ子のテーブルが存在しています)`;
        report("C_12.0", { nodes: table, extraText });
      }
    }
  });
  registerCheck("C_12.1", "user", "item_12", ({ page, report }) => {
    for (const table of page.bottom1Row1ColTables) report("C_12.1", { nodes: table });
  });
  registerCheck("C_12.2", "user", "item_12", ({ page, report }) => {
    for (const table of page.bottomNotDataTables) report("C_12.2", { nodes: table });
  });

  // C_15.0 (item_15, L953, user): all headings on the page, grouped into
  // one report (unconditional reminder to review heading structure, but
  // only emitted — i.e. has any target nodes — when headings exist).
  registerCheck("C_15.0", "user", "item_15", ({ page, report }) => {
    if (page.headings.length > 0) report("C_15.0", { nodes: page.headings });
  });

  // C_16.1/C_16.2 (item_16, L970/1029, user): C_16.1 = an <ol>/<ul> with no
  // <li> descendant (empty list). C_16.2 = <li> elements with no <ol>/<ul>
  // ancestor before reaching <body> (orphaned list items), grouped by
  // contiguous sibling run into a single start/end-range report.
  registerCheck("C_16.1", "user", "item_16", ({ document, report }) => {
    for (const tag of ["ol", "ul"]) {
      for (const el of Array.from(document.getElementsByTagName(tag))) {
        if (el.getElementsByTagName("li").length === 0) report("C_16.1", { nodes: el });
      }
    }
  });
  registerCheck("C_16.2", "user", "item_16", ({ document, report }) => {
    const lis = Array.from(document.getElementsByTagName("li"));
    const grouped = [];
    for (const li of lis) {
      if (grouped.includes(li)) continue;
      let hasUlOl = false;
      let cur = li;
      while (cur) {
        const name = (cur.nodeName || "").toLowerCase();
        if (name === "ol" || name === "ul") {
          hasUlOl = true;
          break;
        } else if (name === "body") {
          break;
        }
        cur = cur.parentNode;
      }
      if (!hasUlOl) {
        let startNode = li;
        let endNode = li;
        grouped.push(li);
        let prev = li.previousSibling;
        while (prev) {
          if ((prev.nodeName || "").toLowerCase() === "li" && !grouped.includes(prev)) {
            grouped.push(prev);
            startNode = prev;
          } else break;
          prev = prev.previousSibling;
        }
        let next = li.nextSibling;
        while (next) {
          if ((next.nodeName || "").toLowerCase() === "li" && !grouped.includes(next)) {
            grouped.push(next);
            endNode = next;
          } else break;
          next = next.nextSibling;
        }
        report("C_16.2", { nodes: [startNode, endNode] });
      }
    }
  });

  // C_17.0/C_17.1 (item_17, L1046/1060, info/user): C_17.0 = a <q> or
  // <blockquote> with no text descendant at all (per-element). C_17.1 =
  // all <blockquote> elements, grouped (unconditional reminder — note this
  // is the <blockquote> NodeList specifically, reused after the loop that
  // reassigned `nl`, not <q>).
  registerCheck("C_17.0", "info", "item_17", ({ document, report }) => {
    for (const tag of ["q", "blockquote"]) {
      for (const el of Array.from(document.getElementsByTagName(tag))) {
        if (!hasTextDescendant(el)) report("C_17.0", { nodes: el });
      }
    }
  });
  registerCheck("C_17.1", "user", "item_17", ({ document, report }) => {
    const blockquotes = Array.from(document.getElementsByTagName("blockquote"));
    if (blockquotes.length > 0) report("C_17.1", { nodes: blockquotes });
  });

  // C_18.0/C_18.1 (item_18, L1072/1091, user): C_18.0 = a <q> whose
  // quotation text is longer than QUOTATION_SHORT_NUM (a "long" quotation,
  // flagged for review regardless of cite). C_18.1 = a <blockquote> whose
  // text is QUOTATION_SHORT_NUM or shorter (a suspiciously "short"
  // blockquote, which might not need block-level quoting).
  registerCheck("C_18.0", "user", "item_18", ({ document, report }) => {
    for (const q of Array.from(document.getElementsByTagName("q"))) {
      if (getTextDescendant(q).length > QUOTATION_SHORT_NUM) report("C_18.0", { nodes: q });
    }
  });
  registerCheck("C_18.1", "user", "item_18", ({ document, report }) => {
    for (const bq of Array.from(document.getElementsByTagName("blockquote"))) {
      if (getTextDescendant(bq).length <= QUOTATION_SHORT_NUM) report("C_18.1", { nodes: bq });
    }
  });

  // C_23.0/C_23.1/C_25.1-C_25.4 (item_23, L1171-1223, user): a battery of
  // layout-vs-data-table sanity checks. C_23.0 = a "parent" table (one
  // containing a nested <table>) that also has a direct-descendant <th>,
  // <caption>, or non-empty "summary" (suggesting it may not really be
  // pure layout). C_23.1 = all data tables that have a direct <th> or
  // <caption> (grouped). C_25.1 = data tables with no <caption> and no
  // accessible name (aria-label/aria-labelledby). C_25.2 = data tables
  // with no non-empty "summary" attribute (non-HTML5 only). C_25.3 = data
  // tables that DO have a <caption>. C_25.4 = data tables with a non-empty
  // "summary" attribute (non-HTML5 only).
  registerCheck("C_23.0", "user", "item_23", ({ page, report }) => {
    for (const table of page.parentTableElements) {
      const hasSummary = (table.getAttribute("summary") || "").length > 0;
      const hasCaption = table.getElementsByTagName("caption").length > 0;
      let hasTh = false;
      const stack = [];
      let cur = table.firstChild;
      while (cur) {
        if ((cur.nodeName || "").toLowerCase() === "th") {
          hasTh = true;
          break;
        }
        const tag = (cur.nodeName || "").toLowerCase();
        if (cur.hasChildNodes() && tag !== "table") {
          stack.push(cur);
          cur = cur.firstChild;
        } else if (cur.nextSibling) {
          cur = cur.nextSibling;
        } else {
          cur = null;
          while (!cur && stack.length > 0) cur = stack.pop().nextSibling;
        }
      }
      if (hasTh || hasCaption || hasSummary) report("C_23.0", { nodes: table });
    }
  });
  function analyzeDataTableSummary(page) {
    const tables = [];
    const table251 = [];
    const table252 = [];
    const table253 = [];
    const table254 = [];
    for (const table of page.dataTableList) {
      let added = false;
      if (getDirectDescendantElements(table, "th").length > 0) {
        tables.push(table);
        added = true;
      }
      if (getDirectDescendantElements(table, "caption").length > 0) {
        if (!added) {
          tables.push(table);
          added = true;
        }
        table253.push(table);
      } else {
        const name = getNameByAria(table, null);
        if (name == null || name.trim() === "") table251.push(table);
      }
      if (!page.isHTML5) {
        if (table.hasAttribute("summary") && !isEmptyString(table.getAttribute("summary"))) {
          if (!added) {
            tables.push(table);
            added = true;
          }
          table254.push(table);
        } else {
          table252.push(table);
        }
      }
    }
    return { tables, table251, table252, table253, table254 };
  }
  registerCheck("C_23.1", "user", "item_23", ({ page, report }) => {
    const { tables } = analyzeDataTableSummary(page);
    if (tables.length > 0) report("C_23.1", { nodes: tables });
  });
  registerCheck("C_25.1", "user", "item_23", ({ page, report }) => {
    const { table251 } = analyzeDataTableSummary(page);
    if (table251.length > 0) report("C_25.1", { nodes: table251 });
  });
  registerCheck("C_25.2", "user", "item_23", ({ page, report }) => {
    const { table252 } = analyzeDataTableSummary(page);
    if (table252.length > 0) report("C_25.2", { nodes: table252 });
  });
  registerCheck("C_25.3", "user", "item_23", ({ page, report }) => {
    const { table253 } = analyzeDataTableSummary(page);
    if (table253.length > 0) report("C_25.3", { nodes: table253 });
  });
  registerCheck("C_25.4", "user", "item_23", ({ page, report }) => {
    const { table254 } = analyzeDataTableSummary(page);
    if (table254.length > 0) report("C_25.4", { nodes: table254 });
  });

  // C_26.0 (item_26, L1259, user): a <th> whose text is long — measured in
  // characters for DBCS (Japanese) locales, or in words otherwise. This
  // engine always analyzes as DBCS (IS_DBCS), matching M1's VALIDATE_STR_LEN
  // choice for the same reason (Japanese municipal-site content).
  registerCheck("C_26.0", "user", "item_26", ({ document, report }) => {
    for (const th of Array.from(document.getElementsByTagName("th"))) {
      const text = getTextAltDescendant(th);
      if (IS_DBCS) {
        if (text.length > TABLE_CELL_ABBR_CHARS) report("C_26.0", { nodes: th });
      } else if (getWordCount(text) > TABLE_CELL_ABBR_WORDS) {
        report("C_26.0", { nodes: th });
      }
    }
  });

  // C_30.0/C_30.1 (mediaCheck, L1334/1335, user): the page has at least
  // one <object>, <embed>, or <applet> element (grouped, same node set for
  // both IDs — two differently-worded reminders about the same elements).
  registerCheck("C_30.0", "user", "mediaCheck", ({ document, page, report }) => {
    const nodes = [...page.objectElements, ...page.embedElements, ...Array.from(document.getElementsByTagName("applet"))];
    if (nodes.length > 0) report("C_30.0", { nodes });
  });
  registerCheck("C_30.1", "user", "mediaCheck", ({ document, page, report }) => {
    const nodes = [...page.objectElements, ...page.embedElements, ...Array.from(document.getElementsByTagName("applet"))];
    if (nodes.length > 0) report("C_30.1", { nodes });
  });

  // C_32.0 (item_32, L1448, user): the page has at least one <object> OR
  // (if none) at least one <applet> — a page-level, ungrouped reminder.
  registerCheck("C_32.0", "user", "item_32", ({ document, page, report }) => {
    if (page.objectElements.length > 0 || document.getElementsByTagName("applet").length > 0) {
      report("C_32.0");
    }
  });

  // C_35.0 (item_35, L1528, user): "normal"-sized <img src="*.gif">
  // elements, grouped.
  registerCheck("C_35.0", "user", "item_35", ({ page, report }) => {
    const nodes = [];
    for (const img of page.imgElements) {
      if (!isNormalImage(img) || !img.hasAttribute("src")) continue;
      const src = img.getAttribute("src") || "";
      if (src.length > 0 && getFileExtension(src).toLowerCase() === "gif") nodes.push(img);
    }
    if (nodes.length > 0) report("C_35.0", { nodes });
  });

  // C_48.6 (item_48, L2008, user): <b>/<i> in a non-HTML5 document
  // ("use strong/em instead"). Companion to the C_48.0-48.5/48.7/48.8
  // group registered in PR-M2; grouped per tag, matching checkObsoluteEle.
  registerCheck("C_48.6", "user", "item_48", ({ document, page, report }) => {
    if (page.isHTML5) return;
    for (const tag of ["b", "i"]) {
      const nodes = Array.from(document.getElementsByTagName(tag));
      if (nodes.length > 0) report("C_48.6", { nodes, extraText: tag });
    }
  });

  // C_51.2/C_51.3 (item_51, L2049/2064, user): a <frame>/<iframe> with a
  // present, non-blank title — the "confirm the title text is appropriate"
  // companion to C_51.0/51.1/51.4/51.5 (PR-M1).
  registerCheck("C_51.2", "user", "item_51", ({ page, report }) => {
    for (const el of page.frameElements) {
      if (hasTitle(el) && !hasBlankTitle(el)) {
        report("C_51.2", { nodes: el, extraText: el.getAttribute("title") || "" });
      }
    }
  });
  registerCheck("C_51.3", "user", "item_51", ({ page, report }) => {
    for (const el of page.iframeElements) {
      if (hasTitle(el) && !hasBlankTitle(el)) {
        report("C_51.3", { nodes: el, extraText: el.getAttribute("title") || "" });
      }
    }
  });

  // C_52.0/C_52.1 (item_52, L2081/2096, info): a <frame>/<iframe> that has
  // a non-empty title but NO longdesc attribute (or an empty one) — a
  // reminder to consider adding a fuller description alongside the title.
  registerCheck("C_52.0", "info", "item_52", ({ page, report }) => {
    for (const el of page.frameElements) {
      const title = el.getAttribute("title") || "";
      if (title !== "") {
        const longdesc = el.getAttribute("longdesc");
        if (longdesc == null || longdesc === "") report("C_52.0", { nodes: el });
      }
    }
  });
  registerCheck("C_52.1", "info", "item_52", ({ page, report }) => {
    for (const el of page.iframeElements) {
      const title = el.getAttribute("title") || "";
      if (title !== "") {
        const longdesc = el.getAttribute("longdesc");
        if (longdesc == null || longdesc === "") report("C_52.1", { nodes: el });
      }
    }
  });

  // C_57.0/C_57.1/C_57.4/C_57.5/C_57.6 (item_57, L2301/2291/2303/2268/2311,
  // info/user): the remaining branches of item_57's link-text/title
  // analysis loop (C_57.2/C_57.3 were registered in PR-M1). Each re-runs
  // the same per-link control flow as C_57.2 (see that check's comment for
  // the full branch structure) to stay faithful to the original single
  // loop, but reports only its own branch's outcome.
  registerCheck("C_57.0", "info", "item_57", ({ page, report }) => {
    // Links with short (<3 words, <VALIDATE_STR_LEN chars), non-empty,
    // untitled text — grouped into a single reminder.
    const nodes = [];
    const { aWithHrefHrefs: hrefs, aWithHrefTexts: texts, aWithHrefElements: elements } = page;
    for (let i = 0; i < elements.length; i++) {
      let strTxt = texts[i] || "";
      if (strTxt.trim().length === 0) {
        const ariaName = getNameByAria(elements[i], null);
        if (ariaName != null) strTxt = ariaName.trim();
      }
      if (getWordCount(strTxt) >= 3 || strTxt.length >= VALIDATE_STR_LEN) continue;
      const strTitle = elements[i].getAttribute("title") || "";
      if (strTitle !== "") continue;
      if (strTxt.trim().length > 0) nodes.push(elements[i]);
    }
    if (nodes.length > 0) report("C_57.0", { nodes });
  });
  registerCheck("C_57.1", "user", "item_57", ({ page, report }) => {
    // Links with a present, non-blank title that is ITSELF short (<3
    // words, <VALIDATE_STR_LEN chars) — per-element.
    const { aWithHrefHrefs: hrefs, aWithHrefTexts: texts, aWithHrefElements: elements } = page;
    for (let i = 0; i < elements.length; i++) {
      let strTxt = texts[i] || "";
      if (strTxt.trim().length === 0) {
        const ariaName = getNameByAria(elements[i], null);
        if (ariaName != null) strTxt = ariaName.trim();
      }
      if (getWordCount(strTxt) >= 3 || strTxt.length >= VALIDATE_STR_LEN) continue;
      const strTitle = elements[i].getAttribute("title") || "";
      if (strTitle === "") continue;
      if (getWordCount(strTitle) < 3 && strTitle.length < VALIDATE_STR_LEN) {
        report("C_57.1", {
          nodes: elements[i],
          extraText: ` (link text="${strTxt}", title="${strTitle}", href="${hrefs[i]}")`,
        });
      }
    }
  });
  registerCheck("C_57.4", "user", "item_57", ({ page, report }) => {
    // Links with a present, non-blank title and text NOT short enough to
    // hit the C_57.0/57.1 branches at all (linkTitle: collected whenever
    // hasBlankTitle() is false, independent of the word-count checks).
    for (const el of page.aWithHrefElements) {
      if (el.hasAttribute("title") && !hasBlankTitle(el)) {
        report("C_57.4", { nodes: el, extraText: el.getAttribute("title") || "" });
      }
    }
  });
  registerCheck("C_57.5", "user", "item_57", ({ page, report }) => {
    // The "can't use link" branch (empty accessible text, non-#-href, not
    // excluded by childless/noscript rules) WHEN an adjacent same-href
    // link with text exists — the sequence-ok counterpart to C_57.2.
    const { aWithHrefHrefs: hrefs, aWithHrefTexts: texts, aWithHrefElements: elements } = page;
    for (let i = 0; i < elements.length; i++) {
      const el = elements[i];
      let strTxt = texts[i] || "";
      if (strTxt.trim().length === 0) {
        const ariaName = getNameByAria(el, null);
        if (ariaName != null) strTxt = ariaName.trim();
      }
      if (getWordCount(strTxt) >= 3 || strTxt.length >= VALIDATE_STR_LEN) continue;
      const strTitle = el.getAttribute("title") || "";
      if (strTitle !== "") continue;
      if (strTxt.trim().length > 0) continue;
      if (hrefs[i].startsWith("#")) continue;
      const noScriptText = getNoScriptText(el);
      const hasImg = el.getElementsByTagName("img").length > 0;
      if (!el.hasChildNodes() && !hasImg) continue;
      if (noScriptText.length > 0) continue;
      let sequenceOk = false;
      if (i - 1 >= 0 && hrefs[i - 1] === hrefs[i] && (texts[i - 1] || "").length > 0) sequenceOk = true;
      if (!sequenceOk && i + 1 < hrefs.length && hrefs[i + 1] === hrefs[i] && (texts[i + 1] || "").length > 0) {
        sequenceOk = true;
      }
      if (sequenceOk) report("C_57.5", { nodes: el, extraText: ` (href="${hrefs[i]}")` });
    }
  });
  registerCheck("C_57.6", "user", "item_57", ({ page, report }) => {
    // Truly-empty links (no children, no <img>) grouped by resolved href
    // — the exceptCount branch that C_57.2/57.5 explicitly skip.
    const { aWithHrefHrefs: hrefs, aWithHrefTexts: texts, aWithHrefElements: elements } = page;
    const emptyMap = new Map();
    for (let i = 0; i < elements.length; i++) {
      const el = elements[i];
      let strTxt = texts[i] || "";
      if (strTxt.trim().length === 0) {
        const ariaName = getNameByAria(el, null);
        if (ariaName != null) strTxt = ariaName.trim();
      }
      if (getWordCount(strTxt) >= 3 || strTxt.length >= VALIDATE_STR_LEN) continue;
      const strTitle = el.getAttribute("title") || "";
      if (strTitle !== "") continue;
      if (strTxt.trim().length > 0) continue;
      if (hrefs[i].startsWith("#")) continue;
      const hasImg = el.getElementsByTagName("img").length > 0;
      if (!el.hasChildNodes() && !hasImg) {
        if (!emptyMap.has(hrefs[i])) emptyMap.set(hrefs[i], []);
        emptyMap.get(hrefs[i]).push(el);
      }
    }
    for (const [href, nodes] of emptyMap) {
      if (nodes.length > 0) report("C_57.6", { nodes, extraText: href });
    }
  });

  // C_58.0 (item_58, L2454, user): two links, in the same text-length
  // bucket (0-3/4-6/7-9/10-19/20+ chars), with IDENTICAL link text but
  // DIFFERENT resolved target URLs — an ambiguous "same label, different
  // destination" pattern. Ported using direct string equality in place of
  // the Java source's String.hashCode() pre-check (a same-result
  // simplification for any realistic input; hash-collision false
  // positives in the original are not reproduced).
  function textLengthBucket(length) {
    if (length > 9) return length < 20 ? 3 : 4;
    if (length < 7) return length < 4 ? 0 : 1;
    return 2;
  }
  registerCheck("C_58.0", "user", "item_58", ({ document, page, report }) => {
    const buckets = [[], [], [], [], []];
    for (let i = 0; i < page.aWithHrefElements.length; i++) {
      const text = page.aWithHrefTexts[i];
      if (text.length === 0) continue;
      buckets[textLengthBucket(text.length)].push({
        text,
        href: page.aWithHrefHrefs[i],
        el: page.aWithHrefElements[i],
      });
    }
    for (const bucket of buckets) {
      const dup = new Array(bucket.length).fill(false);
      for (let j = 0; j < bucket.length - 1; j++) {
        if (dup[j]) continue;
        const idVec = [];
        for (let k = j + 1; k < bucket.length; k++) {
          if (dup[k]) continue;
          if (bucket[j].text !== bucket[k].text) continue;
          const url1 = resolveUrl(bucket[j].href, document);
          const url2 = resolveUrl(bucket[k].href, document);
          if (url1.toLowerCase() !== url2.toLowerCase()) {
            if (!dup[j]) {
              idVec.push(bucket[j].el);
              dup[j] = true;
            }
            idVec.push(bucket[k].el);
            dup[k] = true;
          }
        }
        if (idVec.length > 0) {
          report("C_58.0", { nodes: idVec, extraText: ` (link text="${bucket[j].text}")` });
        }
      }
    }
  });

  // C_69.0 (item_69, L2574, user): a third reminder ID for the exact same
  // leaf-block ASCII-art detection as C_6.0/C_6.1 (PR-M1/M2) — the Java
  // source genuinely re-emits a differently-worded problem for the same
  // matches from a second, separate check method.
  registerCheck("C_69.0", "user", "item_69", ({ page, report }) => {
    for (const body of page.bodyElements) {
      const stack = [];
      let cur = body;
      while (cur) {
        let isArt = false;
        if (isLeafBlockEle(cur) && checkEngineIsAsciiArtString(getTextAltDescendant(cur))) {
          report("C_69.0", { nodes: cur });
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

  // C_75.0 (item_75, L2663, user): a data table with no <th> at all.
  registerCheck("C_75.0", "user", "item_75", ({ page, report }) => {
    for (const table of page.dataTableList) {
      if (table.getElementsByTagName("th").length === 0) report("C_75.0", { nodes: table });
    }
  });

  // C_76.1 (item_76, L2702, user): a data table using rowspan/colspan.
  // NOTE: C_76.0 (the "th count > 1 with no scope/axis" variant this
  // method's comment references) is entirely commented out in the current
  // Java source — like C_500.4/13-16 (PR-M3 §always block), it is
  // genuinely not-fired and intentionally not registered here.
  registerCheck("C_76.1", "user", "item_76", ({ page, report }) => {
    const nodes = page.dataTableList.filter((table) => hasRowColSpan(table));
    if (nodes.length > 0) report("C_76.1", { nodes });
  });

  // C_86.0 (item_86, L3204, info): the page references an audio/multimedia
  // file — via <object data="...">, an <applet><param value="..."></applet>,
  // or an <a href="..."> — by file extension. Page-level, ungrouped.
  registerCheck("C_86.0", "info", "item_86", ({ document, page, report }) => {
    let hasMulti = false;
    for (const el of page.objectElements) {
      if (isAudioOrMultimediaFileExt(getFileExtension(el.getAttribute("data") || ""))) {
        hasMulti = true;
        break;
      }
    }
    if (!hasMulti) {
      for (const applet of Array.from(document.getElementsByTagName("applet"))) {
        for (const param of Array.from(applet.getElementsByTagName("param"))) {
          if (isAudioOrMultimediaFileExt(getFileExtension(param.getAttribute("value") || ""))) {
            hasMulti = true;
            break;
          }
        }
        if (hasMulti) break;
      }
    }
    if (!hasMulti) {
      for (const href of page.aWithHrefHrefs) {
        if (isAudioOrMultimediaFileExt(getFileExtension(href))) {
          hasMulti = true;
          break;
        }
      }
    }
    if (hasMulti) report("C_86.0");
  });

  // C_89.1 (item_89, L3296, user): same page-level scan as C_89.0/C_89.2
  // (PR-M1/M2) — for the case where SOME text was found (0 < length <
  // threshold) AND there is at least one <img> on the page (mutually
  // exclusive with C_89.2).
  registerCheck("C_89.1", "user", "item_89", ({ document, page, report }) => {
    const text = accumulateBodyText(document, page);
    if (text != null && text.length > 0 && text.length < VALID_TOTAL_TEXT_LEN && page.imgElements.length > 0) {
      report("C_89.1");
    }
  });

  // C_300.5 (item_300, L3407, user): the page has at least one <canvas>
  // element (grouped, unconditional reminder about providing a canvas
  // fallback).
  registerCheck("C_300.5", "user", "item_300", ({ document, report }) => {
    const nodes = Array.from(document.getElementsByTagName("canvas"));
    if (nodes.length > 0) report("C_300.5", { nodes });
  });

  // C_388.0 (formCheck, L3652, user): the page has at least one <form>
  // element (grouped, unconditional reminder).
  registerCheck("C_388.0", "user", "formCheck", ({ document, report }) => {
    const nodes = Array.from(document.getElementsByTagName("form"));
    if (nodes.length > 0) report("C_388.0", { nodes });
  });

  // C_500.17/18/19/20/21 (styleCheck, L4109-4179, user): color-only,
  // background-color-only, fixed-unit font-size, and viewport-unit
  // font-size declarations, tested against both style="" attributes
  // (faithful — uses the Java source's exact attribute-level regexes) and
  // <style> element text (SIMPLIFIED — the Java source extracts and lists
  // the specific matching CSS selectors via a block-level parser
  // (findStyles/StyleSelectorSets); this port only tests whether the
  // pattern appears anywhere in a `{...}` rule block, which preserves
  // fire/no-fire behavior per <style> element but omits the selector list
  // from the message text. External stylesheets are not resolved at all —
  // see MICHECKER_ENGINE_PORT_INSTRUCTIONS.md §3.2-2).
  // NOTE: the Java source tests this one with Matcher#matches() ("need to
  // use matches()", per its own comment) — a FULL-STRING match, unlike
  // BGCOLOR_ATTR/BGCOLOR2_ATTR below which use find() (substring search).
  // Anchored with ^...$ to reproduce that; without the anchors this over-
  // matches "background-color: ..." as a plain "color" declaration too
  // (the DOTALL-equivalent "s" flag makes "." span newlines, matching the
  // Java Pattern.DOTALL flag, but does not by itself require a full match).
  const COLOR_ATTR_RE = /^(((.*[^-]+)color)|(\s)*color)(\s)*:.*$/is;
  const BGCOLOR_ATTR_RE = /background-color(\s)*:.*/is;
  const FIXSIZE_PATTERN_ATTR_RE = /font-size(\s)*:[^;v]*(mm|cm|in|pt|pc|px)/is;
  const VIEWPORT_PATTERN_ATTR_RE = /font-size(\s)*:[^;v]*(vh|vw|vi|vb|vmin|vmax)/is;
  const COLOR_BLOCK_RE = /\{(.*[^-]+)?color(\s)*:[\s\S]*?\}/is;
  const BGCOLOR_BLOCK_RE = /\{[\s\S]*?background-color(\s)*:[\s\S]*?\}/is;
  const FIXSIZE_BLOCK_RE = /\{[^}]*font-size(\s)*:[^;v]*(mm|cm|in|pt|pc|px)[\s\S]*\}/is;
  const VIEWPORT_BLOCK_RE = /\{[^}]*font-size(\s)*:[^;v]*(vh|vw|vi|vb|vmin|vmax)[\s\S]*\}/is;
  registerCheck("C_500.17", "user", "styleCheck", ({ page, report }) => {
    for (const el of page.elementsWithStyle) {
      const style = el.getAttribute("style") || "";
      const color = COLOR_ATTR_RE.test(style);
      const bgColor = BGCOLOR_ATTR_RE.test(style);
      if (color && !bgColor) report("C_500.17", { nodes: el, extraText: `(style属性, ${style})` });
    }
    for (const [el, style] of page.styleElementMap) {
      if (style && COLOR_BLOCK_RE.test(style)) report("C_500.17", { nodes: el });
    }
  });
  registerCheck("C_500.18", "user", "styleCheck", ({ page, report }) => {
    for (const el of page.elementsWithStyle) {
      const style = el.getAttribute("style") || "";
      const color = COLOR_ATTR_RE.test(style);
      const bgColor = BGCOLOR_ATTR_RE.test(style);
      if (!color && bgColor) report("C_500.18", { nodes: el, extraText: `(style属性, ${style})` });
    }
    for (const [el, style] of page.styleElementMap) {
      if (style && BGCOLOR_BLOCK_RE.test(style)) report("C_500.18", { nodes: el });
    }
  });
  // C_500.19 is the <style>-element-only counterpart of the fixed-unit
  // font-size check; the style="" ATTRIBUTE path for the exact same
  // pattern reports under the DIFFERENT id C_500.20 (not C_500.19) —
  // preserved faithfully even though it reads like it should be the same
  // id (see styleCheck() L4109 vs L4166 in CheckEngine.java).
  registerCheck("C_500.19", "user", "styleCheck", ({ page, report }) => {
    for (const [el, style] of page.styleElementMap) {
      if (style && FIXSIZE_BLOCK_RE.test(style)) report("C_500.19", { nodes: el });
    }
  });
  registerCheck("C_500.20", "user", "styleCheck", ({ page, report }) => {
    for (const el of page.elementsWithStyle) {
      const style = el.getAttribute("style") || "";
      if (FIXSIZE_PATTERN_ATTR_RE.test(style)) report("C_500.20", { nodes: el, extraText: `(style属性, ${style})` });
    }
  });
  // C_500.21 (viewport-unit font-size) is, unlike C_500.19/20, reported
  // under the SAME id for both the <style>-element and style="" attribute
  // paths (matches the Java source using "C_500.21" in both loops).
  registerCheck("C_500.21", "user", "styleCheck", ({ page, report }) => {
    for (const el of page.elementsWithStyle) {
      const style = el.getAttribute("style") || "";
      if (VIEWPORT_PATTERN_ATTR_RE.test(style)) report("C_500.21", { nodes: el, extraText: `(style属性, ${style})` });
    }
    for (const [el, style] of page.styleElementMap) {
      if (style && VIEWPORT_BLOCK_RE.test(style)) report("C_500.21", { nodes: el });
    }
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

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
  // problem found (nodes omitted or empty for page-level checks). Checks are
  // registered by PR-M1/M2/M3; this file (PR-M0) only provides the
  // scaffolding, so CHECKS starts empty and `run()` reports 0 problems.
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

    const collector = createCollector();
    const checklist = [];

    for (const [checkId, check] of Object.entries(CHECKS)) {
      if (allowedIds && !allowedIds.has(checkId)) continue;
      if (check.method === "always") {
        // "always" checks are unconditional, page-level manual-review
        // reminders (see MICHECKER_ENGINE_PORT_INSTRUCTIONS.md §3.2-3) and
        // are surfaced separately from element-anchored problems.
        const localCollector = createCollector();
        check.run({ document, report: localCollector.report });
        for (const p of localCollector.problems) {
          checklist.push({
            checkId: p.checkId,
            type: CHECKS[p.checkId] ? CHECKS[p.checkId].type : check.type,
            message: buildMessage(p.checkId, p.extraText, checkitemsById),
          });
        }
      } else {
        check.run({ document, report: collector.report });
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

// Parity test runner for goal2-app/public/michecker-engine.js
// (see goal2-app/MICHECKER_ENGINE_PORT_INSTRUCTIONS.md §5/§7).
//
// This is intentionally NOT wired into `npm test` (test/run-tests.js), which
// is dependency-free by design (static file/string assertions + a server
// health check, no browser automation). michecker-engine.js targets a real
// browser DOM (DOMParser, querySelectorAll) exactly like public/app.js and
// public/goal3.js already do, and Node has no built-in DOM implementation.
// Rather than add jsdom (a new npm dependency the repo has always avoided —
// see AGENTS.md / GOAL1_BUILD_INSTRUCTIONS.md §8), this runner uses the
// Playwright installation this project's own PR verification workflow has
// relied on all along (pre-installed in the Claude Code on the web
// environment; install locally with `npx playwright install chromium` if
// running elsewhere). Run with: `node test/michecker-parity/run-parity-tests.js`
//
// Structure: a harness-sanity block (collector/message-templating/selector-
// path/TextChecker plumbing, isolated from real checks via checkIds: []),
// followed by one M<N>_CASES array per PR (M1_CASES, M2_CASES, ...) with a
// positive+negative fixture per check id, run through the same
// run-and-compare-counts loop. Add new PR's cases as a new M<N>_CASES array
// and fold it into the loop's spread below.
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const rootDir = path.resolve(__dirname, "../..");
const engineSource = fs.readFileSync(path.join(rootDir, "public/michecker-engine.js"), "utf8");
const checkitems = fs
  .readFileSync(path.join(rootDir, "data/michecker-checkitems.json"), "utf8")
  .split("\n")
  .filter((line) => line.trim())
  .map((line) => JSON.parse(line));

const results = [];

function check(name, condition, detail) {
  results.push({ name, pass: Boolean(condition), detail });
}

async function main() {
  const browser = await chromium.launch({
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || "/opt/pw-browsers/chromium",
  });
  const page = await browser.newPage();
  await page.goto("about:blank");
  await page.addScriptTag({ content: engineSource });

  // --- Harness sanity: options.checkIds: [] must be a hard no-op, isolating
  // the collector/message-building plumbing from whichever real checks
  // PR-M1+ has since registered (checkIds: [] rather than omitted, so this
  // stays true regardless of how many checks CHECKS accumulates over time).
  const fixtureHtml = fs.readFileSync(
    path.join(__dirname, "fixtures/generic-page.html"),
    "utf8"
  );
  const runResult = await page.evaluate(
    ({ html, checkitems }) => {
      const doc = new DOMParser().parseFromString(html, "text/html");
      return window.micheckerEngine.run(doc, { checkitems, checkIds: [] });
    },
    { html: fixtureHtml, checkitems }
  );
  check(
    "harness: run() with checkIds: [] returns 0 problems",
    Array.isArray(runResult.problems) && runResult.problems.length === 0,
    JSON.stringify(runResult.problems)
  );
  check(
    "harness: run() with checkIds: [] returns 0 checklist items",
    Array.isArray(runResult.checklist) && runResult.checklist.length === 0,
    JSON.stringify(runResult.checklist)
  );
  check(
    "harness: run() reports an engineVersion",
    typeof runResult.engineVersion === "string" && runResult.engineVersion.length > 0,
    runResult.engineVersion
  );

  // --- formatMessage: {0}-style MessageFormat substitution ---
  const fmt = await page.evaluate(() => {
    const { formatMessage } = window.micheckerEngine._internal;
    return {
      withArg: formatMessage("必要があれば、リンクにその内容を表すtitleを付加して下さい。{0}", ["候補: 詳細はこちら"]),
      noArgsLeftAsIs: formatMessage("可能であれば、完全に仕様に準じて{0}を用いることを検討してください。", []),
      staticNoPlaceholder: formatMessage("th要素にscope属性がありません。", []),
    };
  });
  check(
    "formatMessage: substitutes {0} with the supplied arg",
    fmt.withArg === "必要があれば、リンクにその内容を表すtitleを付加して下さい。候補: 詳細はこちら",
    fmt.withArg
  );
  check(
    "formatMessage: missing arg substitutes empty string, not literal {0}",
    fmt.noArgsLeftAsIs === "可能であれば、完全に仕様に準じてを用いることを検討してください。",
    fmt.noArgsLeftAsIs
  );
  check(
    "formatMessage: static (no-placeholder) templates pass through unchanged",
    fmt.staticNoPlaceholder === "th要素にscope属性がありません。",
    fmt.staticNoPlaceholder
  );

  // --- selectorPathFor ---
  const selectors = await page.evaluate(() => {
    const doc = new DOMParser().parseFromString(
      '<table><tr><th id="hdr">A</th></tr><tr><td>1</td><td>2</td></tr></table>',
      "text/html"
    );
    const { selectorPathFor } = window.micheckerEngine._internal;
    return {
      withId: selectorPathFor(doc.getElementById("hdr")),
      nthOfType: selectorPathFor(doc.querySelectorAll("td")[1]),
    };
  });
  check(
    "selectorPathFor: stops at the nearest ancestor id",
    selectors.withId === "th#hdr",
    selectors.withId
  );
  check(
    "selectorPathFor: disambiguates same-tag siblings with :nth-of-type",
    selectors.nthOfType.endsWith("td:nth-of-type(2)"),
    selectors.nthOfType
  );

  // --- TextChecker.checkAlt (ported from TextChecker.java#checkAlt) ---
  const tc = await page.evaluate(() => {
    const { checkAlt } = window.micheckerEngine._internal.TextChecker;
    return {
      empty: checkAlt(""),
      blank: checkAlt("   "),
      ngWordExact: checkAlt("spacer.gif"),
      imgExt: checkAlt("photo-of-park.jpg"),
      spaceSeparatedEn: checkAlt("p u s h  h e r e"),
      // isSeparatedJapaneseChars uses \b (ASCII word boundary, same as the
      // Java source) around the Japanese-char/space/Japanese-char pattern,
      // so it only fires when an ASCII alnum sits directly adjacent on both
      // sides — plain Japanese text with no adjacent ASCII never matches.
      // This is a faithful quirk of the original, not a JS-port bug (see
      // "known differences" note below and in MICHECKER_PORT_INVENTORY.md).
      spaceSeparatedJpWithAsciiBoundary: checkAlt("1開 始2"),
      spaceSeparatedJpPureJapaneseDoesNotFire: checkAlt("開　始"),
      ok: checkAlt("公園で遊ぶ子どもたちの写真"),
      // "sample.png" itself ends in an image extension, so it hits the
      // earlier IMG_EXT branch before the SAME_AS_SRC comparison runs
      // (matches the Java method's check order). Use a non-image extension
      // to exercise SAME_AS_SRC specifically.
      sameAsSrc: checkAlt("sample.svg", "/img/sample.svg"),
    };
  });
  check("TextChecker.checkAlt: empty string -> NULL", tc.empty === "NULL", tc.empty);
  check("TextChecker.checkAlt: whitespace-only -> BLANK", tc.blank === "BLANK", tc.blank);
  check("TextChecker.checkAlt: exact NG word match -> NG_WORD", tc.ngWordExact === "NG_WORD", tc.ngWordExact);
  check("TextChecker.checkAlt: filename-like alt -> IMG_EXT", tc.imgExt === "IMG_EXT", tc.imgExt);
  check(
    "TextChecker.checkAlt: space-separated English -> SPACE_SEPARATED",
    tc.spaceSeparatedEn === "SPACE_SEPARATED",
    tc.spaceSeparatedEn
  );
  check(
    "TextChecker.checkAlt: Japanese chars space-separated with adjacent ASCII -> SPACE_SEPARATED_JP",
    tc.spaceSeparatedJpWithAsciiBoundary === "SPACE_SEPARATED_JP",
    tc.spaceSeparatedJpWithAsciiBoundary
  );
  check(
    "TextChecker.checkAlt: pure-Japanese space-separated text does NOT trigger SPACE_SEPARATED_JP (faithful \\b quirk)",
    tc.spaceSeparatedJpPureJapaneseDoesNotFire === "OK",
    tc.spaceSeparatedJpPureJapaneseDoesNotFire
  );
  check("TextChecker.checkAlt: descriptive Japanese alt -> OK", tc.ok === "OK", tc.ok);
  check(
    "TextChecker.checkAlt: alt identical to src filename (non-image ext) -> SAME_AS_SRC",
    tc.sameAsSrc === "SAME_AS_SRC",
    tc.sameAsSrc
  );

  // --- PR-M1: error-type check cases (positive + negative per check id) ---
  // Table fixtures deliberately avoid whitespace between tags: item_331's
  // port faithfully reproduces the Java source's use of tr.firstChild /
  // tr.childNodes.length (raw child NODES, not cell counts), which shifts
  // classification results when whitespace text nodes are present between
  // <tr>/<td>/<th> tags. See michecker-engine.js C_331.0 comments.
  const M1_CASES = [
    {
      name: "C_3.0 positive: img longdesc with no matching D-link",
      checkIds: ["C_3.0"],
      html: '<img src="a.jpg" longdesc="detail.html" alt="x">',
      expected: { "C_3.0": 1 },
    },
    {
      name: "C_3.0 negative: img longdesc with a matching D-link present",
      checkIds: ["C_3.0"],
      html: '<img src="a.jpg" longdesc="detail.html" alt="x"><a href="detail.html">d</a>',
      expected: {},
    },
    {
      name: "C_6.0 positive: leaf block with ASCII-art-like content",
      checkIds: ["C_6.0"],
      html: "<p>o_o_o_o_o_o_o_o_o_o_o_o_o_o_o_o_o_o_o_o_o_o_o_o_o_o_o_o_o_o_o_o_o_o_o_o_o_o</p>",
      expected: { "C_6.0": 1 },
    },
    {
      name: "C_6.0 negative: leaf block with ordinary Japanese text",
      checkIds: ["C_6.0"],
      html: "<p>通常のお知らせ本文です。特に問題はありません。</p>",
      expected: {},
    },
    {
      name: "C_14.0 positive: heading level jumps from h2 to h4",
      checkIds: ["C_14.0"],
      html: "<h2>見出し2</h2><h4>見出し4</h4>",
      expected: { "C_14.0": 1 },
    },
    {
      name: "C_14.0 negative: heading levels step by 1",
      checkIds: ["C_14.0"],
      html: "<h2>見出し2</h2><h3>見出し3</h3>",
      expected: {},
    },
    {
      name: "C_18.2 positive: blockquote without cite",
      checkIds: ["C_18.2"],
      html: "<blockquote>引用文</blockquote>",
      expected: { "C_18.2": 1 },
    },
    {
      name: "C_18.2 negative: blockquote with cite",
      checkIds: ["C_18.2"],
      html: '<blockquote cite="https://example.com/">引用文</blockquote>',
      expected: {},
    },
    {
      name: "C_33.0 positive: <blink> with text",
      checkIds: ["C_33.0"],
      html: "<blink>点滅注意</blink>",
      expected: { "C_33.0": 1 },
    },
    {
      name: "C_33.0 negative: no <blink> element",
      checkIds: ["C_33.0"],
      html: "<p>通常の文章です</p>",
      expected: {},
    },
    {
      name: 'C_33.1 positive: style attribute with "text-decoration: blink"',
      checkIds: ["C_33.1"],
      html: '<p style="text-decoration: blink;">x</p>',
      expected: { "C_33.1": 1 },
    },
    {
      name: "C_33.1 negative: unrelated style attribute",
      checkIds: ["C_33.1"],
      html: '<p style="color: red;">x</p>',
      expected: {},
    },
    {
      name: "C_34.0 positive: <marquee>",
      checkIds: ["C_34.0"],
      html: "<marquee>scroll</marquee>",
      expected: { "C_34.0": 1 },
    },
    {
      name: "C_34.0 negative: no <marquee> element",
      checkIds: ["C_34.0"],
      html: "<p>通常の文章です</p>",
      expected: {},
    },
    {
      name: 'C_36.0 positive: meta refresh with no "url" in content',
      checkIds: ["C_36.0"],
      html: '<meta http-equiv="refresh" content="5">',
      expected: { "C_36.0": 1 },
    },
    {
      name: 'C_36.0 negative: meta refresh with "url" in content',
      checkIds: ["C_36.0"],
      html: '<meta http-equiv="refresh" content="5;url=https://example.com/">',
      expected: {},
    },
    {
      name: "C_36.1 positive: meta redirect with a positive delay",
      checkIds: ["C_36.1"],
      html: '<meta http-equiv="refresh" content="5;url=https://example.com/">',
      expected: { "C_36.1": 1 },
    },
    {
      name: "C_36.1 negative: meta redirect with a zero delay",
      checkIds: ["C_36.1"],
      html: '<meta http-equiv="refresh" content="0;url=https://example.com/">',
      expected: {},
    },
    {
      // <frame> is only recognized by the HTML parser inside a <frameset>
      // (a bare <frame> tag is dropped as a parse error per the HTML5
      // parsing spec's "in body" insertion mode) — these fixtures wrap it
      // accordingly, unlike the other single-tag fixtures in this file.
      name: "C_51.0 positive: <frame> with no title",
      checkIds: ["C_51.0"],
      html: '<frameset><frame src="a.html"></frameset>',
      expected: { "C_51.0": 1 },
    },
    {
      name: "C_51.0 negative: <frame> with a title",
      checkIds: ["C_51.0"],
      html: '<frameset><frame src="a.html" title="説明"></frameset>',
      expected: {},
    },
    {
      name: "C_51.4 positive: <frame> with a blank title",
      checkIds: ["C_51.4"],
      html: '<frameset><frame src="a.html" title="   "></frameset>',
      expected: { "C_51.4": 1 },
    },
    {
      name: "C_51.4 negative: <frame> with a non-blank title",
      checkIds: ["C_51.4"],
      html: '<frameset><frame src="a.html" title="説明"></frameset>',
      expected: {},
    },
    {
      name: "C_51.1 positive: <iframe> with no title",
      checkIds: ["C_51.1"],
      html: '<iframe src="a.html"></iframe>',
      expected: { "C_51.1": 1 },
    },
    {
      name: "C_51.1 negative: <iframe> with a title",
      checkIds: ["C_51.1"],
      html: '<iframe src="a.html" title="説明"></iframe>',
      expected: {},
    },
    {
      name: "C_51.5 positive: <iframe> with a blank title",
      checkIds: ["C_51.5"],
      html: '<iframe src="a.html" title="   "></iframe>',
      expected: { "C_51.5": 1 },
    },
    {
      name: "C_51.5 negative: <iframe> with a non-blank title",
      checkIds: ["C_51.5"],
      html: '<iframe src="a.html" title="説明"></iframe>',
      expected: {},
    },
    {
      name: "C_57.2 positive: link with no accessible text (has a childless-but-present child element)",
      checkIds: ["C_57.2"],
      html: '<a href="/page.html"><span></span></a>',
      expected: { "C_57.2": 1 },
    },
    {
      name: "C_57.2 negative: link with real text",
      checkIds: ["C_57.2"],
      html: '<a href="/page.html">詳しく見る</a>',
      expected: {},
    },
    {
      name: "C_57.3 positive: link title is whitespace-only",
      checkIds: ["C_57.3"],
      html: '<a href="/x" title="   ">text</a>',
      expected: { "C_57.3": 1 },
    },
    {
      name: "C_57.3 negative: link title is meaningful",
      checkIds: ["C_57.3"],
      html: '<a href="/x" title="役立つ説明">text</a>',
      expected: {},
    },
    {
      name: "C_85.0 positive: autoplay <video>",
      checkIds: ["C_85.0"],
      html: '<video src="a.mp4" autoplay></video>',
      expected: { "C_85.0": 1 },
    },
    {
      name: "C_85.0 negative: <video> without autoplay",
      checkIds: ["C_85.0"],
      html: '<video src="a.mp4"></video>',
      expected: {},
    },
    {
      name: "C_89.0 positive: page with no readable text at all",
      checkIds: ["C_89.0"],
      html: "",
      expected: { "C_89.0": 1 },
    },
    {
      name: "C_89.0 negative: page with some readable text",
      checkIds: ["C_89.0"],
      html: "<p>十分な長さのテキストがここにあります。読み上げ可能な内容が存在します。</p>",
      expected: {},
    },
    {
      // Neither row nor column fits a "simple table" pattern (a lone <th>
      // surrounded by data cells), so scope is required.
      name: "C_331.0 positive: th outside any simple-table pattern, missing scope",
      checkIds: ["C_331.0"],
      html: "<table><tr><td>1</td><td>2</td><td>3</td></tr><tr><td>4</td><th>H</th><td>6</td></tr></table>",
      expected: { "C_331.0": 1 },
    },
    {
      // A plain "header row over data rows" table is recognized as simple
      // and exempted, even though its th's have no scope attribute.
      name: "C_331.0 negative: simple header-row table is exempt",
      checkIds: ["C_331.0"],
      html: "<table><tr><th>A</th><th>B</th></tr><tr><td>1</td><td>2</td></tr></table>",
      expected: {},
    },
    {
      name: "C_331.1 positive: th scope value is invalid",
      checkIds: ["C_331.1"],
      html: '<table><tr><th scope="cell">A</th><td>1</td></tr><tr><th scope="row">B</th><td>2</td></tr></table>',
      expected: { "C_331.1": 1 },
    },
    {
      name: "C_331.1 negative: all th scope values are valid",
      checkIds: ["C_331.1"],
      html: '<table><tr><th scope="col">A</th><td>1</td></tr><tr><th scope="row">B</th><td>2</td></tr></table>',
      expected: {},
    },
    {
      name: "C_332.1 positive: headers references a non-existent id",
      checkIds: ["C_332.1"],
      html: '<table><tr><th>A</th><td headers="nope">1</td></tr><tr><td>x</td><td>y</td></tr></table>',
      expected: { "C_332.1": 1 },
    },
    {
      name: "C_332.1 negative: headers references an existing id",
      checkIds: ["C_332.1"],
      html: '<table><tr><th id="hdr1">A</th><td headers="hdr1">1</td></tr><tr><td>x</td><td>y</td></tr></table>',
      expected: {},
    },
    {
      name: "C_332.2 positive: headers references a non-cell element",
      checkIds: ["C_332.2"],
      html:
        '<table><tr><th>A</th><td headers="lbl">1</td></tr><tr><td>x</td><td>y</td></tr></table><p id="lbl">note</p>',
      expected: { "C_332.2": 1 },
    },
    {
      name: "C_332.2 negative: headers references a th/td element",
      checkIds: ["C_332.2"],
      html: '<table><tr><th id="lbl">A</th><td headers="lbl">1</td></tr><tr><td>x</td><td>y</td></tr></table>',
      expected: {},
    },
    {
      // Documents the item_332 quirk (§4.4): the Java source re-scans all
      // th/td cells once PER qualifying table, so a single bad reference is
      // reported once per table in dataTableList.
      name: "C_332.1 quirk: a bad reference is reported once per qualifying table",
      checkIds: ["C_332.1"],
      html:
        '<table><tr><th>A</th><td headers="nope">1</td></tr><tr><td>x</td><td>y</td></tr></table>' +
        '<table><tr><th>C</th><td>3</td></tr><tr><td>z</td><td>w</td></tr></table>',
      expected: { "C_332.1": 2 },
    },
    {
      name: "C_422.0 positive: two elements share an accesskey",
      checkIds: ["C_422.0"],
      html: '<a href="/a" accesskey="x">A</a><a href="/b" accesskey="x">B</a>',
      expected: { "C_422.0": 1 },
    },
    {
      name: "C_422.0 negative: accesskeys are distinct",
      checkIds: ["C_422.0"],
      html: '<a href="/a" accesskey="x">A</a><a href="/b" accesskey="y">B</a>',
      expected: {},
    },
    {
      name: "C_423.0 positive: two direct body children share an id",
      checkIds: ["C_423.0"],
      html: '<div id="dup">A</div><div id="dup">B</div>',
      expected: { "C_423.0": 1 },
    },
    {
      // Faithful quirk (§4.4): the Java source only scans direct children
      // of <body> (XPath //body/*[@id]), not all descendants, so duplicate
      // ids nested inside wrapper elements are not detected by this check.
      name: "C_423.0 negative (quirk): duplicate ids nested below direct body children are not detected",
      checkIds: ["C_423.0"],
      html: '<div><p id="dup">A</p></div><div><p id="dup">B</p></div>',
      expected: {},
    },
  ];

  // --- PR-M2: warning-type check cases (positive + negative per check id) ---
  const M2_CASES = [
    {
      // Same underlying detection as C_6.0 (PR-M1) — companion reminder ID.
      name: "C_6.1 positive: leaf block with ASCII-art-like content",
      checkIds: ["C_6.1"],
      html: "<p>o_o_o_o_o_o_o_o_o_o_o_o_o_o_o_o_o_o_o_o_o_o_o_o_o_o_o_o_o_o_o_o_o_o_o_o_o_o</p>",
      expected: { "C_6.1": 1 },
    },
    {
      name: "C_6.1 negative: leaf block with ordinary Japanese text",
      checkIds: ["C_6.1"],
      html: "<p>通常のお知らせ本文です。特に問題はありません。</p>",
      expected: {},
    },
    {
      name: "C_13.0 positive: <font size> with an absolute value",
      checkIds: ["C_13.0"],
      html: '<font size="3">x</font>',
      expected: { "C_13.0": 1 },
    },
    {
      name: "C_13.0 negative: <font size> with a relative value",
      checkIds: ["C_13.0"],
      html: '<font size="+1">x</font>',
      expected: {},
    },
    {
      // A 1-row table is unconditionally "layout" (is1Row1ColTable), and a
      // direct <th> inside a layout table is suspicious.
      name: "C_23.2 positive: layout (1-row) table with a direct <th>",
      checkIds: ["C_23.2"],
      html: "<table><tr><th>X</th></tr></table>",
      expected: { "C_23.2": 1 },
    },
    {
      name: "C_23.2 negative: layout table with no th/caption/summary",
      checkIds: ["C_23.2"],
      html: "<table><tr><td>1</td></tr></table>",
      expected: {},
    },
    {
      name: 'C_33.2 positive: <style> text containing "text-decoration: blink"',
      checkIds: ["C_33.2"],
      html: "<style>p { text-decoration: blink; }</style>",
      expected: { "C_33.2": 1 },
    },
    {
      name: "C_33.2 negative: <style> text with unrelated declarations",
      checkIds: ["C_33.2"],
      html: "<style>p { color: red; }</style>",
      expected: {},
    },
    {
      name: "C_38.0 positive: onclick handler with no keyboard equivalent",
      checkIds: ["C_38.0"],
      html: '<div onclick="foo()">x</div>',
      expected: { "C_38.0": 1 },
    },
    {
      name: "C_38.0 negative: onclick handler with a keyboard equivalent",
      checkIds: ["C_38.0"],
      html: '<div onclick="foo()" onkeydown="bar()">x</div>',
      expected: {},
    },
    {
      name: "C_46.0 positive: adjacent links with different targets and no separator",
      checkIds: ["C_46.0"],
      html: '<a href="/a">A</a> <a href="/b">B</a>',
      expected: { "C_46.0": 1 },
    },
    {
      name: "C_46.0 negative: adjacent links with the same target",
      checkIds: ["C_46.0"],
      html: '<a href="/a">A</a> <a href="/a">A again</a>',
      expected: {},
    },
    {
      name: "C_48.0 positive: <menuitem>",
      checkIds: ["C_48.0"],
      html: "<menuitem>x</menuitem>",
      expected: { "C_48.0": 1 },
    },
    {
      name: "C_48.0 negative: no deprecated element",
      checkIds: ["C_48.0"],
      html: "<p>x</p>",
      expected: {},
    },
    {
      name: "C_48.1 positive: <applet>",
      checkIds: ["C_48.1"],
      html: "<applet>x</applet>",
      expected: { "C_48.1": 1 },
    },
    {
      name: "C_48.1 negative: no <applet>",
      checkIds: ["C_48.1"],
      html: "<p>x</p>",
      expected: {},
    },
    {
      name: "C_48.2 positive: <center>",
      checkIds: ["C_48.2"],
      html: "<center>x</center>",
      expected: { "C_48.2": 1 },
    },
    {
      name: "C_48.2 negative: no deprecated presentational element",
      checkIds: ["C_48.2"],
      html: "<p>x</p>",
      expected: {},
    },
    {
      name: "C_48.3 positive: <dir>",
      checkIds: ["C_48.3"],
      html: "<dir><li>x</li></dir>",
      expected: { "C_48.3": 1 },
    },
    {
      name: "C_48.3 negative: no <dir>/<menu>",
      checkIds: ["C_48.3"],
      html: "<p>x</p>",
      expected: {},
    },
    {
      name: "C_48.4 positive: <isindex>",
      checkIds: ["C_48.4"],
      html: "<isindex>",
      expected: { "C_48.4": 1 },
    },
    {
      name: "C_48.4 negative: no <isindex>",
      checkIds: ["C_48.4"],
      html: "<p>x</p>",
      expected: {},
    },
    {
      name: "C_48.5 positive: <xmp>",
      checkIds: ["C_48.5"],
      html: "<xmp>code</xmp>",
      expected: { "C_48.5": 1 },
    },
    {
      name: "C_48.5 negative: no listing/plaintext/xmp",
      checkIds: ["C_48.5"],
      html: "<p>x</p>",
      expected: {},
    },
    {
      // C_48.7 (acronym) only fires when isHTML5 is true, which requires an
      // actual <!DOCTYPE html> — normal GOAL2 fragment analysis never has
      // one (see michecker-engine.js isHTML5() comment), so this positive
      // fixture uses a full document with a doctype to exercise that path.
      name: "C_48.7 positive: <acronym> in an HTML5 document",
      checkIds: ["C_48.7"],
      html: "<!DOCTYPE html><html><body><acronym>x</acronym></body></html>",
      expected: { "C_48.7": 1 },
    },
    {
      name: "C_48.7 negative: fragment with no doctype never triggers (isHTML5 is always false)",
      checkIds: ["C_48.7"],
      html: "<acronym>x</acronym>",
      expected: {},
    },
    {
      // Same isHTML5 gating as C_48.7 — see note above.
      name: "C_48.8 positive: longdesc attribute in an HTML5 document",
      checkIds: ["C_48.8"],
      html: '<!DOCTYPE html><html><body><img src="a.jpg" longdesc="d.html"></body></html>',
      expected: { "C_48.8": 1 },
    },
    {
      name: "C_48.8 negative: fragment with no doctype never triggers (isHTML5 is always false)",
      checkIds: ["C_48.8"],
      html: '<img src="a.jpg" longdesc="d.html">',
      expected: {},
    },
    {
      name: "C_80.0 positive: alt attribute longer than 150 characters",
      checkIds: ["C_80.0"],
      html: `<img src="a.jpg" alt="${"あ".repeat(151)}">`,
      expected: { "C_80.0": 1 },
    },
    {
      name: "C_80.0 negative: short alt attribute",
      checkIds: ["C_80.0"],
      html: '<img src="a.jpg" alt="短い説明">',
      expected: {},
    },
    {
      name: "C_89.2 positive: some body text but no images at all",
      checkIds: ["C_89.2"],
      html: "<p>短い文</p>",
      expected: { "C_89.2": 1 },
    },
    {
      name: "C_89.2 negative: page has an image (falls to C_89.1, not this PR)",
      checkIds: ["C_89.2"],
      html: '<p>短い文</p><img src="a.jpg" alt="x">',
      expected: {},
    },
    {
      name: "C_300.1 positive: area alt text matches the extra NG word",
      checkIds: ["C_300.1"],
      html: '<map name="m"><area alt="area" href="/a"></map><img src="i.jpg" usemap="#m">',
      expected: { "C_300.1": 1 },
    },
    {
      name: "C_300.1 negative: area alt text is descriptive",
      checkIds: ["C_300.1"],
      html: '<map name="m"><area alt="通常の目的地の説明" href="/a"></map><img src="i.jpg" usemap="#m">',
      expected: {},
    },
    {
      // Same table shape used to validate isSimpleTable2 in PR-M1's
      // C_331.0 negative test — here the top-left <td> has visible text,
      // which C_331.2 flags (the cell "should be empty" in this pattern).
      name: "C_331.2 positive: simple row/col-header table with top-left text",
      checkIds: ["C_331.2"],
      html: "<table><tr><td>X</td><th>A</th></tr><tr><th>B</th><td>1</td></tr></table>",
      expected: { "C_331.2": 1 },
    },
    {
      name: "C_331.2 negative: same shape with an empty top-left cell",
      checkIds: ["C_331.2"],
      html: "<table><tr><td></td><th>A</th></tr><tr><th>B</th><td>1</td></tr></table>",
      expected: {},
    },
  ];

  for (const testCase of [...M1_CASES, ...M2_CASES]) {
    const result = await page.evaluate(
      ({ html, checkIds, checkitems }) => {
        const doc = new DOMParser().parseFromString(html, "text/html");
        return window.micheckerEngine.run(doc, { checkitems, checkIds });
      },
      { html: testCase.html, checkIds: testCase.checkIds, checkitems }
    );
    const counts = {};
    for (const p of result.problems) counts[p.checkId] = (counts[p.checkId] || 0) + 1;
    const expectedKeys = Object.keys(testCase.expected);
    const actualKeys = Object.keys(counts);
    const sameKeys =
      expectedKeys.length === actualKeys.length && expectedKeys.every((k) => actualKeys.includes(k));
    const sameCounts = sameKeys && expectedKeys.every((k) => counts[k] === testCase.expected[k]);
    check(testCase.name, sameKeys && sameCounts, JSON.stringify(counts));
  }

  await browser.close();

  const failed = results.filter((r) => !r.pass);
  for (const r of results) {
    console.log(`${r.pass ? "PASS" : "FAIL"}: ${r.name}${r.pass ? "" : ` (got: ${r.detail})`}`);
  }
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  if (failed.length > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

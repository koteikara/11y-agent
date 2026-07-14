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
// PR-M0 has no C_x.y checks registered yet (see michecker-engine.js CHECKS),
// so this file validates the PR-M0 infrastructure itself (collector,
// message templating, selector paths, the ported TextChecker helper) plus a
// harness sanity check. PR-M1+ will add fixtures/cases exercising real
// checks and wire this runner's "compare check-id counts" path for those.
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

  // --- Harness sanity: with zero checks registered, run() must be a no-op ---
  const fixtureHtml = fs.readFileSync(
    path.join(__dirname, "fixtures/generic-page.html"),
    "utf8"
  );
  const runResult = await page.evaluate(
    ({ html, checkitems }) => {
      const doc = new DOMParser().parseFromString(html, "text/html");
      return window.micheckerEngine.run(doc, { checkitems });
    },
    { html: fixtureHtml, checkitems }
  );
  check(
    "PR-M0 harness: run() with no registered checks returns 0 problems",
    Array.isArray(runResult.problems) && runResult.problems.length === 0,
    JSON.stringify(runResult.problems)
  );
  check(
    "PR-M0 harness: run() with no registered checks returns 0 checklist items",
    Array.isArray(runResult.checklist) && runResult.checklist.length === 0,
    JSON.stringify(runResult.checklist)
  );
  check(
    "PR-M0 harness: run() reports an engineVersion",
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

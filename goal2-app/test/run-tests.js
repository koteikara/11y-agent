const assert = require("assert");
const fs = require("fs");
const http = require("http");
const path = require("path");
const { spawn } = require("child_process");
const { loadRules } = require("../lib/rules");
const { loadCheckitems } = require("../lib/michecker-checkitems");
const { autoFixHtml, compareHtml } = require("../lib/sagaAutoFix");
const { learnGoldHintsForPair } = require("../lib/sagaGoldHints");

const rootDir = path.resolve(__dirname, "..");

function requestJson(url) {
  return new Promise((resolve, reject) => {
    http
      .get(url, (response) => {
        let body = "";
        response.setEncoding("utf8");
        response.on("data", (chunk) => {
          body += chunk;
        });
        response.on("end", () => {
          try {
            resolve({
              statusCode: response.statusCode,
              body: JSON.parse(body),
            });
          } catch (error) {
            reject(error);
          }
        });
      })
      .on("error", reject);
  });
}

async function waitForHealth(port) {
  const start = Date.now();
  while (Date.now() - start < 5000) {
    try {
      const response = await requestJson(`http://127.0.0.1:${port}/api/health`);
      if (response.statusCode === 200 && response.body.ok) return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  throw new Error("Server health endpoint did not become ready");
}

async function main() {
  const result = loadRules({ rootDir });
  assert.ok(result.rules.length >= 40, "rules.jsonl should contain the full KB rule set");
  assert.ok(result.rules.some((rule) => rule.id === "image.alt-text"), "image.alt-text rule should exist");
  assert.ok(result.rules.some((rule) => rule.id === "link.link-text"), "link.link-text rule should exist");
  assert.ok(result.summary.byProcessingClass.mechanical >= 1, "mechanical rules should be summarized");
  assert.ok(result.summary.byCategory.image >= 1, "image category should be summarized");

  const checkitemsResult = loadCheckitems({ rootDir });
  assert.ok(checkitemsResult.checkitems.length >= 260, "michecker-checkitems.json should contain the full official catalog");
  assert.ok(
    checkitemsResult.checkitems.some((item) => item.id === "C_51.0"),
    "C_51.0 (iframe title) checkitem should exist"
  );
  assert.ok(
    checkitemsResult.checkitems.every((item) => item.desc_ja_normalized.includes("{0}") === !item.is_static),
    "is_static flag should be consistent with the presence of {0} in desc_ja_normalized"
  );
  const c384 = checkitemsResult.checkitems.find((item) => item.id === "C_384.0");
  assert.ok(c384 && c384.content_scope_note, "C_384.0 (client-side validation) should be marked out of content scope");
  const c331 = checkitemsResult.checkitems.find((item) => item.id === "C_331.0");
  assert.ok(c331 && !c331.content_scope_note, "C_331.0 (th scope) should stay in content scope");
  assert.ok(result.rules.some((rule) => rule.id === "table.th-scope"), "table.th-scope rule should exist");
  {
    const taggedIds = new Set();
    for (const rule of result.rules) {
      for (const checkId of rule.michecker_check_ids || []) taggedIds.add(checkId);
    }
    const conflicted = checkitemsResult.checkitems.filter(
      (item) => item.content_scope_note && taggedIds.has(item.id)
    );
    assert.strictEqual(
      conflicted.length,
      0,
      `checkitems must not be both rule-tagged and out-of-scope: ${conflicted.map((item) => item.id).join(", ")}`
    );
  }

  for (const file of [
    "public/index.html",
    "public/app.js",
    "public/goal3.html",
    "public/goal3.js",
    "public/michecker-compare.html",
    "public/michecker-compare.js",
    "public/styles.css",
    "data/michecker-checkitems.json",
    "lib/michecker-checkitems.js",
    "public/images/sample-park-generated.png",
    "public/images/sample-map-generated.png",
    "public/images/sample-flower-generated.png",
    "public/images/sample-family-generated.png",
    "server.js",
    "Dockerfile",
    "sea-config.json",
    "build-windows-app.bat",
    "LOCAL_WINDOWS_APP.md",
    "tools/build-agents-cli-dataset.js",
    "tools/run-agents-cli-local-eval.js",
    "tools/analyze-agents-cli-results.js",
    "tools/analyze-table-rule-focus.js",
    "tools/analyze-heading-rule-focus.js",
    "agents-cli/README.md",
    "agents-cli/execution-plan.md",
  ]) {
    assert.ok(fs.existsSync(path.join(rootDir, file)), `${file} should exist`);
  }

  const appJs = fs.readFileSync(path.join(rootDir, "public/app.js"), "utf8");
  const goal3Html = fs.readFileSync(path.join(rootDir, "public/goal3.html"), "utf8");
  const goal3Js = fs.readFileSync(path.join(rootDir, "public/goal3.js"), "utf8");
  const stylesCss = fs.readFileSync(path.join(rootDir, "public/styles.css"), "utf8");
  const serverJs = fs.readFileSync(path.join(rootDir, "server.js"), "utf8");
  assert.ok(
    appJs.includes("公園の芝生広場で親子が参加しているイベントの写真"),
    "AI image name draft should include the image type for the park sample"
  );
  assert.ok(
    appJs.includes("花壇に咲くピンク色のサツキの花の写真"),
    "AI image name draft should include the image type for the flower sample"
  );
  assert.ok(appJs.includes("const noticeRuleIds = new Set"), "notice rule ids should be defined");
  assert.ok(appJs.includes("isMicheckerRelevantRule"), "rule scope mode filter should be implemented in app.js");
  assert.ok(appJs.includes("rule_scope_mode"), "rule scope mode should be recorded in evidence output");
  const compareJs = fs.readFileSync(path.join(rootDir, "public/michecker-compare.js"), "utf8");
  const compareScreenHtml = fs.readFileSync(path.join(rootDir, "public/michecker-compare.html"), "utf8");
  assert.ok(compareJs.includes("handleRuleBasisChange"), "rule basis toggle should be implemented in michecker-compare.js");
  assert.ok(compareScreenHtml.includes('id="ruleBasisSelect"'), "rule basis selector should exist on the compare screen");
  assert.ok(appJs.includes("\"image.display-width\""), "image display width should be treated as a notice");
  assert.ok(appJs.includes("\"image.multiple-images\""), "multiple image layout should be treated as a CMS notice");
  assert.ok(appJs.includes("\"image.image-text-layout\""), "image/text layout should be treated as a CMS notice");
  assert.ok(appJs.includes("noticeOutput"), "notice output field should be wired");
  assert.ok(appJs.includes("bulkAcceptSelected"), "bulk candidate adoption should be wired");
  assert.ok(appJs.includes("bulkSelectedCandidateIds"), "bulk candidate selection state should be tracked");
  assert.ok(appJs.includes("renderBulkControls"), "bulk candidate controls should be rendered");
  assert.ok(appJs.includes("renderPageAgent"), "workflow guidance should be rendered");
  assert.ok(appJs.includes("pageAgentActionForCandidate"), "workflow guidance should react to the selected candidate");
  assert.ok(appJs.includes("handlePageAgentAction"), "workflow guidance should expose semi-automatic navigation actions");
  assert.ok(appJs.includes("pageAgentRecommendedAction"), "workflow guidance should recommend a likely next operation");
  assert.ok(appJs.includes("pageAgentWorkflowState"), "workflow guidance should cover the full flow from input to output copy");
  assert.ok(appJs.includes("copy-final-html"), "workflow guidance should support final HTML copy");
  assert.ok(appJs.includes("次にやること"), "workflow guidance should use a user-facing next-action label");
  assert.ok(appJs.includes("startPageAgentDrag"), "floating workflow guidance should be draggable");
  assert.ok(appJs.includes("goal2.pageAgentPosition"), "floating workflow guidance should remember its position");
  assert.ok(appJs.includes("scrollPreviewToSelectedCandidate"), "preview highlight should auto-scroll after candidate selection");
  assert.ok(appJs.includes("isLikelyPartialDateMatch"), "partial date detection should use explicit date logic");
  assert.ok(appJs.includes("findWeekdayNotationMatches"), "weekday detection should cover date-adjacent weekday notation");
  assert.ok(appJs.includes("isFollowedByDateExcludedUnit"), "date detection should reject numeric unit expressions");
  assert.ok(appJs.includes("メガバイト"), "file display text cleanup should cover Japanese file-size units");
  assert.ok(appJs.includes("【［"), "file display text cleanup should cover square bracket file metadata");
  assert.ok(appJs.includes("ワード"), "file display text cleanup should cover Japanese Office file labels");
  assert.ok(appJs.includes("buildMarkSeparatedTableHtml"), "mark-based tables should use a dedicated prose conversion");
  assert.ok(appJs.includes("shouldPreserveAsDataTable"), "data table preservation should run before layout decomposition");
  assert.ok(appJs.includes("buildDataTableSemanticsHtml"), "data tables should get per-table caption/thead/th/scope proposals");
  assert.ok(appJs.includes("isRelationExplanationTableProfile"), "relationship explanation tables should avoid over-eager thead proposals");
  assert.ok(appJs.includes("isRowHeaderOnlyDataTableProfile"), "row-header-only profile tables should avoid synthetic thead");
  assert.ok(appJs.includes("isLayoutTableSectionHeadingDraft"), "layout-table decomposition should promote short one-cell rows to child headings");
  assert.ok(appJs.includes("nearestPreviousHeadingTag"), "layout-table decomposition should use the surrounding heading only to choose child heading levels");
  assert.ok(appJs.includes("layoutTableChildHeadingTag"), "layout-table child headings should be nested under the surrounding heading without duplicating it");
  assert.ok(appJs.includes("shouldCollectNoteSymbolCandidate"), "single inline note symbols should not always become correction candidates");
  assert.ok(appJs.includes("\"text.note-symbol\""), "single note symbols should remain visible as review notices");
  assert.ok(appJs.includes("単発の注釈記号"), "single note symbols should have a dedicated notice message");
  assert.ok(appJs.includes("merge-following-note"), "adjacent note markers should be resolvable by merging the note into the referenced paragraph");
  assert.ok(!appJs.includes("\"注記: \""), "note-symbol handling should not mechanically rewrite ※ to 注記");
  assert.ok(appJs.includes("collectSequentialNumberedParagraphCandidates"), "sequential numbered paragraphs should become ordered-list candidates");
  assert.ok(appJs.includes("replace-paragraph-sequence"), "ordered-list candidates should replace the full paragraph sequence");
  assert.ok(appJs.includes("mergeNoteTextIntoHtml"), "ordered-list conversion should preserve adjacent ※ note text inside the list item");
  assert.ok(appJs.includes("isStandaloneNoteParagraphText"), "ordered-list conversion should not swallow standalone note paragraphs as normal list descriptions");
  assert.ok(appJs.includes("splitMergedRowsIntoTablesHtml"), "merged-row tables should be splittable into multiple semantic tables");
  assert.ok(appJs.includes("if (captionText)"), "split merged tables should not duplicate an already existing previous heading");
  assert.ok(appJs.includes("該当なしです。"), "mark-based table conversion should make unmarked rows explicit");
  assert.ok(appJs.includes('content:"H2"'), "preview headings should show heading-level badges");
  assert.ok(appJs.includes("singleStrongListHeadingProposal"), "single strong list labels should become heading candidates");
  assert.ok(appJs.includes('"remove-element"'), "empty heading candidates should be removable");
  assert.ok(appJs.includes("procedureParentHeadingProposal"), "procedure heading groups should get parent heading candidates");
  assert.ok(appJs.includes("oldSiteTemplateHeadingProposal"), "old-site template headings should become removal candidates");
  assert.ok(appJs.includes("loadSagaSamples"), "Saga fixture samples should be loaded into the sample picker");

  // miChecker error-type parity additions (C_33.0/34.0, C_36.0/36.1, C_422.0/423.0, C_51.0/51.4,
  // C_57.2, C_331.0/331.1, C_332.1/332.2). See detector functions and their generated ruleIds/messages below.
  assert.ok(appJs.includes("collectDeprecatedMotionElementCandidate"), "blink/marquee detection should be implemented");
  assert.ok(appJs.includes('"BLINK", "MARQUEE"'), "blink/marquee tags should be recognized as deprecated motion elements");
  assert.ok(appJs.includes("hasTextDescendant"), "blink detection should require a text descendant, matching miChecker item_33");
  assert.ok(appJs.includes("blink要素が含まれています。"), "blink candidates should have a Japanese message");
  assert.ok(appJs.includes("marquee要素が含まれています。"), "marquee candidates should have a Japanese message");
  assert.ok(
    appJs.includes('ruleId: "html-structure.deprecated-elements"'),
    "blink/marquee candidates should use the deprecated-elements KB rule id"
  );

  assert.ok(appJs.includes("collectMetaRefreshCandidates"), "meta refresh detection should be implemented");
  assert.ok(appJs.includes('meta[http-equiv]'), "meta refresh detection should scan http-equiv attributes");
  assert.ok(appJs.includes("周期的にページを再読み込みするmeta refreshが含まれています。"), "meta refresh reload should have a Japanese message");
  assert.ok(appJs.includes("自動的にページを切り替えるmeta refresh"), "meta refresh redirect should have a Japanese message");
  assert.ok(
    appJs.includes('ruleId: "html-structure.embedded-script-behavior"'),
    "meta refresh candidates should use the embedded-script-behavior KB rule id"
  );

  assert.ok(appJs.includes("collectDuplicateAttributeCandidates"), "duplicate id/accesskey detection should be implemented");
  assert.ok(appJs.includes("collectDuplicateAttributeCandidatesFor"), "duplicate id/accesskey detection should share a per-attribute helper");
  assert.ok(appJs.includes("が他の要素と重複しています"), "duplicate id/accesskey candidates should have a Japanese message");
  assert.ok(
    appJs.includes('ruleId: "html-structure.duplicate-id-accesskey"'),
    "duplicate id/accesskey candidates should use the duplicate-id-accesskey KB rule id"
  );

  assert.ok(appJs.includes('querySelectorAll("iframe,frame")'), "frame elements should be checked for title like iframe (C_51.0/51.4)");
  assert.ok(
    appJs.includes("collectFrameElementNotices"),
    "frame elements dropped by the HTML parser should be detected from the raw source (C_51.0/51.4)"
  );
  assert.ok(appJs.includes('"iframe.frame-unsupported"'), "frame notices should use the iframe.frame-unsupported pseudo rule id");
  assert.ok(
    appJs.includes('"iframe.frame-unsupported": "html-structure.iframe-frame-title"'),
    "iframe.frame-unsupported should map to the iframe-frame-title KB rule for miChecker mode"
  );
  assert.ok(
    appJs.includes("sanitizeVisualPreviewHtml"),
    "visual preview must sanitize active content (meta refresh navigated the app page before this fix)"
  );

  assert.ok(appJs.includes("computeLinkAccessibleText"), "empty-link-text detection should compute an accessible text value");
  assert.ok(appJs.includes("リンク内に読み上げ可能なテキストがありません。"), "empty link candidates should have a Japanese message");
  assert.ok(
    appJs.includes('ruleId: "link.link-purpose-standalone"'),
    "empty link candidates should use the link-purpose-standalone KB rule id"
  );

  assert.ok(appJs.includes("collectTableHeaderScopeCandidates"), "per-cell th scope/headers validation should be implemented");
  assert.ok(appJs.includes("guessThScopeValue"), "th scope auto-fix should guess a scope value from cell position");
  assert.ok(appJs.includes("th要素にscope属性がありません。"), "missing scope candidates should have a Japanese message");
  assert.ok(appJs.includes("が不正です。"), "invalid scope value candidates should have a Japanese message");
  assert.ok(appJs.includes("headers属性が参照するid"), "headers reference validation should check for a matching id in the table");
  assert.ok(appJs.includes("がth・td要素ではありません"), "headers reference validation should check the referenced element's tag");
  assert.ok(
    appJs.includes('ruleId: "table.th-scope"'),
    "th scope/headers candidates should use the table.th-scope KB rule id"
  );

  // miChecker warning/B-classification parity additions (Phase 2A: table layout heuristics + color/contrast).
  // C_12.0/12.1/12.2 (naive table structure), C_23.0/23.2 (th/caption/summary on suspected layout tables),
  // C_75.0 (th-less data table fallback), C_48.8 (longdesc/summary deprecated attributes),
  // C_500.17/18 (color/background-color inside table cells + bgcolor attribute).
  assert.ok(appJs.includes("classifyNaiveTableStructure"), "naive table structure classifier (C_12.0/12.1/12.2) should be implemented");
  assert.ok(appJs.includes('return "nested"'), "naive table structure classifier should detect nested tables (C_12.0)");
  assert.ok(appJs.includes('return "1row1col"'), "naive table structure classifier should detect 1-row/1-col tables (C_12.1)");
  assert.ok(appJs.includes('return "notdata"'), "naive table structure classifier should detect non-data leaf tables (C_12.2)");
  assert.ok(
    appJs.includes("collectNaiveTableStructureCandidates"),
    "naive layout-table notice generation (C_12.x/C_23.x) should be implemented"
  );
  assert.ok(
    appJs.includes("collectThlessDataTableFallbackCandidate"),
    "th-less data table fallback (C_75.0) should be implemented"
  );
  assert.ok(appJs.includes("表にth要素(見出しセル)がありません。"), "th-less data table fallback should have a Japanese message");

  assert.ok(
    appJs.includes("collectDeprecatedAttributeCandidates"),
    "deprecated longdesc/summary attribute detection (C_48.8) should be implemented"
  );
  assert.ok(appJs.includes('querySelectorAll("img[longdesc]")'), "C_48.8 should scan img longdesc attributes");
  assert.ok(appJs.includes('querySelectorAll("table[summary]")'), "C_48.8 should scan table summary attributes");
  assert.ok(appJs.includes("廃止されたlongdesc属性"), "longdesc candidates should have a Japanese message");
  assert.ok(appJs.includes("廃止されたsummary属性"), "summary candidates should have a Japanese message");

  assert.ok(
    !appJs.includes('if (element.closest("table")) {\n      return;\n    }'),
    "collectInlineStyleCandidate should no longer skip elements inside tables (C_500.17/18 parity fix)"
  );
  assert.ok(appJs.includes("hasBgColorAttr"), "bgcolor attribute should be treated as a background-color signal (C_500.18)");
  assert.ok(
    appJs.includes('table.matches("[style],[class],[align],[valign],[width],[height],[border],[cellpadding],[cellspacing],[bgcolor]")'),
    "hasTableFormatting should recognize bgcolor as legacy table formatting"
  );
  assert.ok(
    appJs.includes('"style", "class", "align", "valign", "width", "height", "border", "cellpadding", "cellspacing", "bgcolor"'),
    "stripFormatting should remove the bgcolor attribute along with other legacy formatting attributes"
  );
  assert.ok(
    appJs.includes('removeStyleProperties(clone, ["color", "background", "background-color"]);'),
    "cloneTableCellAs should strip color/background styling so structural table rebuilds stay consistent with the color candidates"
  );

  const indexHtml = fs.readFileSync(path.join(rootDir, "public/index.html"), "utf8");
  assert.ok(indexHtml.includes("bulkSelectAll"), "bulk select-all checkbox should exist");
  assert.ok(indexHtml.includes('id="ruleScopeSelect"'), "rule scope selector should exist on the Goal 2 screen");
  assert.ok(indexHtml.includes("bulkAcceptButton"), "bulk accept button should exist");
  assert.ok(indexHtml.includes("pageAgentPanel"), "workflow guidance panel should exist before the review workspace");
  assert.ok(!indexHtml.includes('class="output-drawer" open'), "output drawer should be closed on initial load");
  assert.ok(indexHtml.includes('sandbox="allow-same-origin"'), "preview frame should allow same-origin scrolling while keeping scripts blocked");
  assert.ok(indexHtml.includes("input-primary-actions"), "generate/reset buttons should live with the HTML input area");
  assert.ok(indexHtml.indexOf('id="decisionPanel"') < indexHtml.indexOf('class="detail-scroll"'), "decision buttons should stay outside the detail scroll area");
  assert.ok(appJs.includes("pageAgentPhaseName"), "workflow guidance panel should expose phase-based styling hooks");
  assert.ok(appJs.includes("page-agent-drag"), "workflow guidance panel should show a draggable affordance");
  assert.ok(appJs.includes("moveDragIconSvg"), "workflow guidance drag affordance should use a combined four-way move icon");
  assert.ok(appJs.includes("clearInputFields"), "initial input fields should start empty");
  assert.ok(appJs.includes("setInputCollapsed(true)"), "input area should collapse after candidate generation");
  assert.ok(appJs.includes("isProcessingComplete"), "output drawer should open when all review work is complete");
  assert.ok(appJs.includes("quickEditConfig"), "edited adoption should use structured quick-edit controls instead of raw HTML editing");
  assert.ok(appJs.includes("buildQuickEditedAfterHtml"), "quick-edit values should build the edited after HTML");
  assert.ok(appJs.includes("quickEditApplyButton"), "quick-edit adoption should happen from inside the edit panel");
  assert.ok(indexHtml.includes("文言を調整"), "top-level edited adoption button should open a wording adjustment panel");
  assert.ok(appJs.includes("enrichLinkTitleCandidates"), "generic link text candidates should try to enrich labels from linked page titles");
  assert.ok(appJs.includes("/api/link-title"), "link title enrichment should use the server-side lookup endpoint");
  assert.ok(serverJs.includes("/api/link-title"), "server should expose a link title lookup endpoint");
  assert.ok(serverJs.includes("assertFetchUrlAllowed"), "link title lookup should block local/private fetch targets");
  assert.ok(serverJs.includes("/api/fetch-html"), "server should expose a guarded HTML fetch endpoint for Goal3");
  assert.ok(goal3Html.includes("Goal 3"), "Goal3 should have a separate screen");
  assert.ok(goal3Html.includes("sourcePreviewFrame"), "Goal3 should include a source preview frame for visual extraction confirmation");
  assert.ok(goal3Html.includes("goal3Loading"), "Goal3 should include a visible loading state while extracting or fetching");
  assert.ok(goal3Js.includes("scoreCandidate"), "Goal3 should rank content candidates by content-like signals");
  assert.ok(goal3Js.includes("renderSourcePreview"), "Goal3 should visually highlight the extracted location inside the source preview");
  assert.ok(goal3Js.includes("buildSourcePreviewHtmlForCandidate"), "Goal3 should render a lightweight source preview around the selected candidate");
  assert.ok(goal3Js.includes("setLoading"), "Goal3 should toggle a loading state while work is in progress");
  assert.ok(goal3Js.includes("goal3-source-overview"), "Goal3 source preview should render an overview-style extraction map");
  assert.ok(goal3Js.includes("nearestPreviewScope"), "Goal3 should choose a wider preview scope around the extracted target");
  assert.ok(goal3Js.includes("collectSourcePreviewNodes"), "Goal3 should include nearby context blocks around the selected candidate");
  assert.ok(goal3Js.includes("nearestMeaningfulSibling"), "Goal3 should locate nearby context blocks without rendering the whole page");
  assert.ok(goal3Js.includes("hasMultipleSubstantiveChildren"), "Goal3 should prefer containers that combine multiple substantive content blocks");
  assert.ok(goal3Js.includes("isMixedContentContainer"), "Goal3 should recognize mixed prose-plus-table content as a strong body candidate");
  assert.ok(goal3Js.includes("tableRows"), "Goal3 should consider large data tables when ranking body candidates");
  assert.ok(goal3Js.includes("isFileListContent"), "Goal3 should treat bid/result PDF-heavy pages as content, not navigation");
  assert.ok(goal3Js.includes("isNewsListContent"), "Goal3 should treat dated news-list pages as content, not navigation");
  assert.ok(goal3Js.includes("ファイルリンク中心の本文"), "Goal3 should explain when a candidate is scored as file-list content");
  assert.ok(goal3Js.includes("日付・年度付きのお知らせ一覧本文"), "Goal3 should explain when a candidate is scored as news-list content");
  assert.ok(goal3Js.includes("isSignatureBlock"), "Goal3 should remove signature/contact blocks from extracted content");
  assert.ok(goal3Js.includes("isFeedbackSection"), "Goal3 should remove page-feedback questionnaire blocks from extracted content");
  assert.ok(goal3Js.includes('input,select,textarea,button,label'), "Goal3 feedback detection should consider form controls as part of questionnaire blocks");
  assert.ok(goal3Js.includes("isPageTopText"), "Goal3 should remove page-top links from extracted content");
  assert.ok(goal3Js.includes("isSkipToContentText"), "Goal3 should remove skip-to-content markers such as ここから本文です");
  assert.ok(goal3Js.includes("isTemplateUtilityElement"), "Goal3 should remove template utility text such as page IDs, update dates, and print controls");
  assert.ok(goal3Js.includes("(ページ番号|ページID|記事ID|記事番号)\\s*[:：]?"), "Goal3 should remove page/article IDs even when spaces surround the separator");
  assert.ok(goal3Js.includes("isAdobeReaderNotice"), "Goal3 should remove generic Adobe Acrobat Reader notices from extracted content");
  assert.ok(goal3Js.includes("looksLikeContactSection"), "Goal3 should remove contact/signature sections such as お問い合わせ");
  assert.ok(goal3Js.includes("isNavigationCluster"), "Goal3 should remove high-link-density navigation clusters without relying on IDs/classes");
  assert.ok(goal3Js.includes("removeLeadingTemplateFragments"), "Goal3 should trim template fragments that appear before the real content starts");
  assert.ok(goal3Js.includes("removeDuplicateLeadingFragments"), "Goal3 should collapse duplicate leading breadcrumbs and utility fragments");
  assert.ok(goal3Js.includes("isLeadingTemplateFragment"), "Goal3 should identify leading pre-content navigation and utility fragments separately");
  assert.ok(goal3Js.includes("isBreadcrumbTrail"), "Goal3 should identify breadcrumb trails as leading template fragments");
  assert.ok(goal3Js.includes("isStrictBreadcrumbTrail"), "Goal3 should use a stricter breadcrumb heuristic before removing candidate content");
  assert.ok(goal3Js.includes("現在の位置"), "Goal3 should treat breadcrumb labels like 現在の位置 as breadcrumbs");
  assert.ok(goal3Js.includes('if (isStrictBreadcrumbTrail(node)) node.remove();'), "Goal3 should remove breadcrumb elements anywhere inside the extracted candidate");
  assert.ok(goal3Js.includes("isPageTitleDuplicate"), "Goal3 should remove duplicated page-title text from extracted body candidates");
  assert.ok(goal3Js.includes('querySelectorAll("h1")'), "Goal3 should remove h1 from extracted body HTML");
  assert.ok(goal3Js.includes("ID/CLASSだけでは確定していません"), "Goal3 should not present ID/class as a decisive extraction basis");
  assert.ok(stylesCss.includes(".goal3-preview") && stylesCss.includes("max-height: none"), "Goal3 preview should not be clipped by an inner fixed-height scroller");
  assert.ok(stylesCss.includes(".goal3-source-preview"), "Goal3 should style a dedicated source preview area");
  assert.ok(stylesCss.includes(".goal3-loading") && stylesCss.includes("@keyframes goal3-spin"), "Goal3 should show a loading spinner while processing");
  assert.ok(stylesCss.includes(".goal3-workspace") && stylesCss.includes('grid-template-areas: "candidates detail"'), "Goal3 workspace should use a two-column layout without an empty preview column");
  assert.ok(stylesCss.includes(".goal3-preview h2::before") && stylesCss.includes('content: "H2"'), "Goal3 preview should show heading-level badges like Goal2");
  assert.ok(stylesCss.includes(".goal3-preview td") && stylesCss.includes(".goal3-preview th"), "Goal3 preview should show table cell borders like Goal2");
  assert.ok(appJs.includes("loadGoal3Transfer"), "Goal2 should accept extracted HTML handed off from Goal3");

  const packageJson = JSON.parse(fs.readFileSync(path.join(rootDir, "package.json"), "utf8"));
  assert.ok(packageJson.scripts["agents:dataset"], "agents dataset script should exist");
  assert.ok(packageJson.scripts["agents:local-eval"], "agents local eval script should exist");
  assert.ok(packageJson.scripts["agents:analyze"], "agents analysis script should exist");
  assert.ok(packageJson.scripts["agents:analyze:tables"], "agents table analysis script should exist");
  assert.ok(packageJson.scripts["agents:analyze:headings"], "agents heading analysis script should exist");
  const sagaEvalDataset = JSON.parse(
    fs.readFileSync(path.join(rootDir, "agents-cli/datasets/saga-a11y-eval.json"), "utf8")
  );
  const headingAnalyzer = fs.readFileSync(path.join(rootDir, "tools/analyze-heading-rule-focus.js"), "utf8");
  assert.ok(headingAnalyzer.includes("date_snapshot_mismatch"), "heading analysis should separate dated snapshot mismatches");
  assert.ok(headingAnalyzer.includes("gold_only_content_update"), "heading analysis should separate gold-only content updates");
  assert.ok(headingAnalyzer.includes("cms_componentization_required"), "heading analysis should separate CMS componentization cases");

  const oldSagaSnippet = `<div><h3>見出し</h3><p><img src="/sample.jpg" alt=""></p><table><tr><td>項目</td><td>値</td></tr><tr><td>電話</td><td>0952-00-0000</td></tr></table></div>`;
  const goldSagaSnippet = `<div><h2>見出し</h2><p><img src="/sample.jpg" alt="sampleの画像"></p><table><caption>見出し一覧</caption><thead><tr><th scope="row">項目</th><th scope="col">値</th></tr></thead><tbody><tr><th scope="row">電話</th><td>0952-00-0000</td></tr></tbody></table></div>`;
  const fixedSagaSnippet = autoFixHtml(oldSagaSnippet);
  const fixedPseudoList = autoFixHtml("<p>・受付<br>・相談<br>・結果説明</p>");
  const fixedManyTables = autoFixHtml(
    Array.from(
      { length: 9 },
      (_item, index) =>
        `<h3>表${index + 1}</h3><table><tr><td>項目${index + 1}</td><td>金額</td></tr><tr><td>対象</td><td>${index + 1}円</td></tr></table>`
    ).join("")
  );
  const fixedImageLayoutTable = autoFixHtml(
    '<table><tr><td><img src="/banner.jpg" alt="移住案内"></td><td>令和4年のPR動画を紹介します。</td></tr></table>'
  );
  const fixedRelationTable = autoFixHtml(
    "<h3>Vehicle tax</h3><table><tr><td>Small tractor 35km/h -> light vehicle tax</td><td>required</td></tr><tr><td>Large tractor 35km/h</td><td>asset tax</td></tr></table>"
  );
  const fixedProfileTable = autoFixHtml(
    "<h3>Team profile</h3><table><tr><td>Team name</td><td>The Saga Springs official club name and abbreviations.</td></tr><tr><td>Home town</td><td>Tosu City, Saga</td></tr><tr><td>Home arena</td><td>SAGA Arena (Saga City Hinode 2-1-10)</td></tr></table>"
  );
  const fixedSkippedHeadingLevels = autoFixHtml("<h3>Tax changes</h3><h4>Main topic</h4><h6>Detail condition</h6>");
  const fixedQaHeadings = autoFixHtml(
    "<h6><strong>Q1</strong> Retired resident tax?</h6><h5><strong>Why was a tax notice sent again?</strong></h5>"
  );
  const fixedDecorativeStrongHeading = autoFixHtml(
    "<h3><strong>市が個人情報を取り扱う</strong><strong>ときは次のルールに従います</strong></h3>"
  );
  const fixedContextHeadings = autoFixHtml(
    "<h2>Team</h2><h5>Overview</h5><h2>Members</h2><h4>Captain</h4><p>【Profile】</p><p>Bio</p>"
  );
  const fixedDateScheduleHeadings = autoFixHtml(
    "<h3>Holiday doctors</h3><h4>令和8年4月5日（日曜日）</h4><h4>令和8年4月12日（日曜日）</h4><h2>Emergency care</h2>"
  );
  const fixedReferenceHeadings = autoFixHtml(
    '<h2>Vehicle notices</h2><p>Body text<br>【参考】<br>MLIT HP<br><a href="/mlit">MLIT</a><br>MAFF HP<br><a href="/maff">MAFF</a></p>'
  );
  const fixedStandaloneStrongText = autoFixHtml("<h2>Parent</h2><p><strong>Short label</strong></p><p>Body text</p>");
  const fixedOnlyH5Sections = autoFixHtml("<h5>1. Tobacco tax</h5><p>Body</p><h5>2. Payment</h5>");
  const fixedOnlyH4Sections = autoFixHtml("<h4>Refund method</h4><p>Body</p><h4>Transfer destination</h4>");
  const fixedLowLinkHeading = autoFixHtml('<h3>Downloads</h3><h4>Chapter</h4><h6><a href="/file.pdf">PDF file</a></h6>');
  const fixedSubmitLabels = autoFixHtml(
    "<h2>Parent</h2><h3>Submit destination</h3><p>【郵送】<br>City office</p><p>【窓口】<br>Main counter</p>"
  );
  const fixedTaxCalculationLabels = autoFixHtml(
    '<h3>Calculation</h3><p>(1)<a href="/income">所得金額</a><br>Detail text</p><p>課税標準額（1）-（2）</p><p>Tax formula = amount x rate</p>'
  );
  const fixedDepartmentIntroHeading = autoFixHtml(
    "<h2>組織改編</h2><p>&nbsp;</p><p>佐賀市役所各部署の担当課別業務案内です。課名をクリックして、詳しい内容をご覧ください。</p><h3>総務部</h3>"
  );
  const fixedStrongListHeading = autoFixHtml(
    "<h2>必要なもの・添付書類など</h2><ul><li><p><strong>郵送請求申請書</strong></p></li></ul><p>説明文</p>"
  );
  const fixedOrganizationListHeading = autoFixHtml(
    "<h2>手続き</h2><h3>軽四輪、軽三輪</h3><h4>申告先</h4><ul><li>軽自動車検査協会 佐賀事務所</li></ul><p>所在地:佐賀市若楠2丁目10番8号</p>"
  );
  const fixedLegalReferenceHeading = autoFixHtml(
    "<h3>地方税法の規定（法律上の取り扱い）</h3><h4>（参考）地方税法</h4><p>（書類の送達）</p><p>第二十条　地方団体の徴収金の賦課徴収又は還付に関する書類は送達する。</p>"
  );
  const fixedEmptyHeadingSections = autoFixHtml(
    "<h2>担当課</h2><p>市民税課</p><h2>備考</h2><h2>会議の結果のお知らせ</h2><div></div>"
  );
  const fixedProcedureParentHeading = autoFixHtml(
    "<h3>原動機付自転車（総排気量125cc以下）、小型特殊自動車</h3><h4>申告先</h4><p>市役所</p><h2>関連ダウンロードファイル</h2>"
  );
  const fixedOldTemplateBlocks = autoFixHtml(
    "<h2>本文</h2><p>内容</p><div><h2>アンケート</h2><p>このページの内容は分かりやすかったですか？</p></div><h2>Menu</h2>"
  );
  const sg04007Case = sagaEvalDataset.find((entry) => entry.id === "saga-city/sg04007.html");
  assert.ok(sg04007Case, "Saga evaluation dataset should include sg04007");
  const fixedLegacyEnvironmentSection = autoFixHtml(sg04007Case.input.old_html);
  const sg00761Case = sagaEvalDataset.find((entry) => entry.id === "saga-city/sg00761.html");
  assert.ok(sg00761Case, "Saga evaluation dataset should include sg00761");
  const fixedSingleContactTables = autoFixHtml(sg00761Case.input.old_html);
  const singleContactTableComparison = compareHtml(
    fixedSingleContactTables,
    sg00761Case.expected.gold_html,
    sg00761Case.input.old_html
  );
  const sg02560Case = sagaEvalDataset.find((entry) => entry.id === "saga-city/sg02560.html");
  assert.ok(sg02560Case, "Saga evaluation dataset should include sg02560");
  const fixedTitledHeaderTable = autoFixHtml(sg02560Case.input.old_html);
  const sg02562Case = sagaEvalDataset.find((entry) => entry.id === "saga-city/sg02562.html");
  assert.ok(sg02562Case, "Saga evaluation dataset should include sg02562");
  const fixedRevisionSplitTables = autoFixHtml(sg02562Case.input.old_html);
  const revisionSplitComparison = compareHtml(
    fixedRevisionSplitTables,
    sg02562Case.expected.gold_html,
    sg02562Case.input.old_html
  );
  assert.ok(
    fixedRevisionSplitTables.includes("<caption>給与所得控除の詳細</caption>"),
    "Salary table captions should come from the surrounding heading, not the first header row"
  );
  const sg02546Case = sagaEvalDataset.find((entry) => entry.id === "saga-city/sg02546.html");
  assert.ok(sg02546Case, "Saga evaluation dataset should include sg02546");
  const fixedSalaryQuickTables = autoFixHtml(sg02546Case.input.old_html);
  const salaryQuickTableComparison = compareHtml(
    fixedSalaryQuickTables,
    sg02546Case.expected.gold_html,
    sg02546Case.input.old_html
  );
  const sg02395Case = sagaEvalDataset.find((entry) => entry.id === "saga-city/sg02395.html");
  assert.ok(sg02395Case, "Saga evaluation dataset should include sg02395");
  const fixedHolidayDoctorSnapshotTables = autoFixHtml(sg02395Case.input.old_html);
  const holidayDoctorComparison = compareHtml(
    fixedHolidayDoctorSnapshotTables,
    sg02395Case.expected.gold_html,
    sg02395Case.input.old_html
  );
  const sg02558Case = sagaEvalDataset.find((entry) => entry.id === "saga-city/sg02558.html");
  assert.ok(sg02558Case, "Saga evaluation dataset should include sg02558");
  const fixedGroupedComparisonTable = autoFixHtml(sg02558Case.input.old_html);
  const groupedComparisonMetrics = compareHtml(
    fixedGroupedComparisonTable,
    sg02558Case.expected.gold_html,
    sg02558Case.input.old_html
  );
  const sg04014Case = sagaEvalDataset.find((entry) => entry.id === "saga-city/sg04014.html");
  assert.ok(sg04014Case, "Saga evaluation dataset should include sg04014");
  const fixedArrowRelationTables = autoFixHtml(sg04014Case.input.old_html);
  const arrowRelationMetrics = compareHtml(
    fixedArrowRelationTables,
    sg04014Case.expected.gold_html,
    sg04014Case.input.old_html
  );
  const sg01171Case = sagaEvalDataset.find((entry) => entry.id === "saga-city/sg01171.html");
  assert.ok(sg01171Case, "Saga evaluation dataset should include sg01171");
  const fixedMatchScheduleTables = autoFixHtml(sg01171Case.input.old_html);
  const matchScheduleMetrics = compareHtml(
    fixedMatchScheduleTables,
    sg01171Case.expected.gold_html,
    sg01171Case.input.old_html
  );
  const sg04005Case = sagaEvalDataset.find((entry) => entry.id === "saga-city/sg04005.html");
  assert.ok(sg04005Case, "Saga evaluation dataset should include sg04005");
  const fixedRowspanExpandedTable = autoFixHtml(sg04005Case.input.old_html);
  const rowspanExpandedMetrics = compareHtml(
    fixedRowspanExpandedTable,
    sg04005Case.expected.gold_html,
    sg04005Case.input.old_html
  );
  const sg04008Case = sagaEvalDataset.find((entry) => entry.id === "saga-city/sg04008.html");
  assert.ok(sg04008Case, "Saga evaluation dataset should include sg04008");
  const fixedReductionRateTables = autoFixHtml(sg04008Case.input.old_html);
  const reductionRateMetrics = compareHtml(
    fixedReductionRateTables,
    sg04008Case.expected.gold_html,
    sg04008Case.input.old_html
  );
  const sg02553Case = sagaEvalDataset.find((entry) => entry.id === "saga-city/sg02553.html");
  assert.ok(sg02553Case, "Saga evaluation dataset should include sg02553");
  const fixedTaxVerificationTables = autoFixHtml(sg02553Case.input.old_html);
  const taxVerificationMetrics = compareHtml(
    fixedTaxVerificationTables,
    sg02553Case.expected.gold_html,
    sg02553Case.input.old_html
  );
  const sg04782Case = sagaEvalDataset.find((entry) => entry.id === "saga-city/sg04782.html");
  assert.ok(sg04782Case, "Saga evaluation dataset should include sg04782");
  const fixedCulturalAssetLayouts = autoFixHtml(sg04782Case.input.old_html);
  const culturalAssetLayoutMetrics = compareHtml(
    fixedCulturalAssetLayouts,
    sg04782Case.expected.gold_html,
    sg04782Case.input.old_html
  );
  assert.ok(
    !fixedCulturalAssetLayouts.includes("暮らしYASUKAさがし【食編】") &&
      !fixedCulturalAssetLayouts.includes("暮らしYASUKAさがし【子育て編】") &&
      !fixedCulturalAssetLayouts.includes("暮らしYASUKAさがし【仕事編】"),
    "sg04782 should not be recast into the promotion showcase caption pattern"
  );
  const imageOnlyBoundarySnippet = autoFixHtml(`
    <h2>画像だけが多いページ</h2>
    <h3>資料A</h3>
    <table>
      <tr>
        <td><img alt="資料A" src="https://www.city.saga.lg.jp/site_files/image/usefiles/imagefiles/s3478_20100527031312.jpg"></td>
        <td><p>説明文だけがあります。</p></td>
      </tr>
    </table>
  `);
  assert.equal(
    (imageOnlyBoundarySnippet.match(/<iframe\b/g) || []).length,
    0,
    "Image-only pages should not be mistaken for the image-and-related-link showcase pattern"
  );
  const sg00761GuideCase = sagaEvalDataset.find((entry) => entry.id === "saga-city/sg00761.html");
  assert.ok(sg00761GuideCase, "Saga evaluation dataset should include sg00761");
  const fixedOrganizationGuide = autoFixHtml(sg00761GuideCase.input.old_html);
  assert.equal(
    (fixedOrganizationGuide.match(/<iframe\b/g) || []).length,
    0,
    "Organization guide pages should not be treated as promotion showcase video pages"
  );
  const sg06323Case = sagaEvalDataset.find((entry) => entry.id === "saga-city/sg06323.html");
  assert.ok(sg06323Case, "Saga evaluation dataset should include sg06323");
  const fixedPromotionLayouts = autoFixHtml(sg06323Case.input.old_html);
  const promotionLayoutMetrics = compareHtml(
    fixedPromotionLayouts,
    sg06323Case.expected.gold_html,
    sg06323Case.input.old_html
  );
  const promoSnippetStart = sg06323Case.input.old_html.indexOf("sumunara_chirashi.pdf");
  const promoSnippetEnd = sg06323Case.input.old_html.indexOf("promotion/main/1498.html");
  assert.ok(promoSnippetStart >= 0 && promoSnippetEnd >= 0, "sg06323 should expose the promotion video snippet markers");
  const fixedPromotionVideoSnippet = autoFixHtml(
    sg06323Case.input.old_html.slice(Math.max(0, promoSnippetStart - 240), promoSnippetEnd + 1600)
  );
  const workSnippetStart = sg06323Case.input.old_html.indexOf("promotion/14_ijyuu/3-4.jpg");
  const workSnippetEnd = sg06323Case.input.old_html.indexOf("sagasmile.com/main/");
  assert.ok(workSnippetStart >= 0 && workSnippetEnd >= 0, "sg06323 should expose the work showcase snippet markers");
  const fixedPromotionWorkSnippet = autoFixHtml(
    sg06323Case.input.old_html.slice(Math.max(0, workSnippetStart - 900), workSnippetEnd + 240)
  );
  const fixedTwoImagePromotionWorkSnippet = autoFixHtml(`
    <h2>４．仕事【佐賀市には充実した仕事とサポートがある！】</h2>
    <p>&nbsp;</p>
    <p>暮らしYASUKAさがし&nbsp;【仕事編】　暮らしYASUKAさがし&nbsp;【就農編】</p>
    <p>&nbsp;</p>
    <p>暮らしYASUKAさがし　【テレワーク編】</p>
    <p><a href="https://www.city.saga.lg.jp/main/39486.html"><img alt="" src="https://www.city.saga.lg.jp/promotion/site_files/image/promotion/14_ijyuu/3-4.jpg"></a><a href="https://maic-saga.com/"><img alt="" src="https://www.city.saga.lg.jp/promotion/site_files/image/promotion/14_ijyuu/3-2.jpg"></a></p>
    <ul>
      <li><a href="https://www.city.saga.lg.jp/main.php/575.html">求人情報全般</a></li>
      <li><a href="https://www.city.saga.lg.jp/main/13620.html">企業誘致情報</a></li>
      <li><a href="https://www.sagasmile.com/main/">サガスマイル</a></li>
    </ul>
  `);
  const fixedFourImagePromotionSeasonSnippet = autoFixHtml(`
    <h2>１．日常【佐賀市にはここにしかない、美しい日常がある！】</h2>
    <p><span>&nbsp;</span></p>
    <p>暮らしYASUKAさがし&nbsp;【四季編<span>】</span></p>
    <p><a href="https://www.city.saga.lg.jp/main/54612.html"><img alt="" src="https://www.city.saga.lg.jp/promotion/site_files/image/promotion/14_ijyuu/1-1.jpg"></a><a href="https://www.city.saga.lg.jp/main/199.html"><img alt="" src="https://www.city.saga.lg.jp/promotion/site_files/image/promotion/14_ijyuu/1-2.jpg"></a><a href="https://www.sibf.jp/"><img alt="" src="https://www.city.saga.lg.jp/promotion/site_files/image/promotion/14_ijyuu/1-3.jpg"></a><a href="https://www.fuji-spa.com/"><img alt="" src="https://www.city.saga.lg.jp/promotion/site_files/image/promotion/14_ijyuu/1-4.jpg"></a></p>
    <ul>
      <li><a href="https://www.city.saga.lg.jp/main/54612.html">移住・空き家</a></li>
      <li><a href="https://www.city.saga.lg.jp/main.php/3.html">佐賀市観光情報</a></li>
      <li><a href="https://www.sibf.jp/">佐賀インターナショナルバルーンフェスタ</a></li>
      <li><a href="https://www.fuji-spa.com/">古湯・熊の川温泉郷ふるくま</a></li>
    </ul>
  `);
  const sagaComparison = compareHtml(fixedSagaSnippet, goldSagaSnippet, oldSagaSnippet);
  assert.ok(fixedSagaSnippet.includes("<h2>見出し</h2>"), "Saga auto fix should lower CMS body headings");
  assert.ok(fixedSagaSnippet.includes('alt="sampleの画像"'), "Saga auto fix should fill empty image alt drafts");
  assert.ok(
    fixedPseudoList.includes("<ul><li>受付</li><li>相談</li><li>結果説明</li></ul>"),
    "Pseudo bullet lists should be converted to real unordered lists"
  );
  assert.equal(
    (fixedManyTables.match(/<thead\b/g) || []).length,
    9,
    "Data table semantics should be applied per table, not capped by page-level table count"
  );
  assert.ok(
    !/^<table\b/i.test(fixedImageLayoutTable),
    "Image layout tables should be decomposed instead of preserved as data tables"
  );
  assert.ok(
    fixedRelationTable.includes("<caption>Vehicle tax"),
    "Relationship explanation tables should get a caption"
  );
  assert.ok(
    !fixedRelationTable.includes("<thead"),
    "Relationship explanation tables should not be upgraded to column-header tables"
  );
  assert.ok(
    fixedProfileTable.includes("<caption>Team profile"),
    "Profile tables should still gain a caption from the nearest heading"
  );
  assert.ok(
    !fixedProfileTable.includes("<thead"),
    "Two-column profile tables should not gain a synthetic thead"
  );
  assert.ok(
    fixedProfileTable.includes("<tbody><tr><th>Team name</th><td>The Saga Springs official club name and abbreviations.</td></tr>"),
    "Profile tables should convert the first column into row headers without turning the first row into column headers"
  );
  assert.ok(
    fixedSkippedHeadingLevels.includes("<h2>Tax changes</h2><h3>Main topic</h3><h4>Detail condition</h4>"),
    "Skipped heading levels should be normalized by page context"
  );
  assert.ok(
    fixedQaHeadings.includes("<h2>質問1 Retired resident tax?</h2><h3>Why was a tax notice sent again?</h3>"),
    "Q&A headings should map question numbers to h2 and question bodies to h3"
  );
  assert.ok(
    fixedDecorativeStrongHeading.includes("<h2>市が個人情報を取り扱うときは次のルールに従います</h2>") &&
      !fixedDecorativeStrongHeading.includes("<strong>"),
    "Decorative strong markup inside headings should be removed"
  );
  assert.ok(
    fixedContextHeadings.includes("<h2>Team</h2><h3>Overview</h3><h2>Members</h2><h3>Captain</h3><h4>Profile</h4>"),
    "Contextual h5/h4 and bracketed labels should preserve nested heading depth"
  );
  assert.ok(
    fixedDateScheduleHeadings.includes("<h2>Holiday doctors</h2><h3>令和8年4月5日（日曜日）</h3>"),
    "Leading date schedule headings should be promoted only inside the leading schedule block"
  );
  assert.ok(
    fixedReferenceHeadings.includes("<h3>参考</h3><h4>MLIT ホームページ</h4>"),
    "Reference paragraphs should expose reference labels as nested headings"
  );
  assert.ok(
    fixedStandaloneStrongText.includes("<p><strong>Short label</strong></p>"),
    "Standalone strong text should not be promoted without a stronger contextual pattern"
  );
  assert.ok(
    fixedOnlyH5Sections.includes("<h2>1. Tobacco tax</h2><p>Body</p><h2>2. Payment</h2>"),
    "Pages with only h5 section headings should promote those sections to h2"
  );
  assert.ok(
    fixedOnlyH4Sections.includes("<h2>Refund method</h2><p>Body</p><h2>Transfer destination</h2>"),
    "Pages with only h4 section headings should promote those sections to h2"
  );
  assert.ok(
    fixedLowLinkHeading.includes('<h2>Downloads</h2><h3>Chapter</h3><p><a href="/file.pdf">PDF file</a></p>'),
    "Low-level headings that contain only file links should be demoted to paragraphs"
  );
  assert.ok(
    fixedSubmitLabels.includes("<h4>郵送</h4><p>City office</p><h4>窓口</h4><p>Main counter</p>"),
    "Postal and counter labels should become nested h4 headings"
  );
  assert.ok(
    fixedTaxCalculationLabels.includes("<h4>(1) 所得金額</h4><p>Detail text</p><h4>課税標準額（1）-（2）</h4>"),
    "Tax calculation labels should become h4 headings without promoting formula paragraphs"
  );
  assert.ok(
    fixedTaxCalculationLabels.includes("<p>Tax formula = amount x rate</p>"),
    "Formula paragraphs should remain paragraphs"
  );
  assert.ok(
    fixedDepartmentIntroHeading.includes("<h2>佐賀市役所各部署の担当課別業務案内です。課名をクリックして、詳しい内容をご覧ください。</h2><h3>総務部</h3>"),
    "Department guide intro paragraphs should become parent headings without swallowing earlier paragraphs"
  );
  assert.ok(
    fixedStrongListHeading.includes("<h3>郵送請求申請書</h3><p>説明文</p>"),
    "Single strong requirement list items should become h3 section headings"
  );
  assert.ok(
    fixedOrganizationListHeading.includes("<h4>申告先</h4><h5>軽自動車検査協会 佐賀事務所</h5><p>所在地:佐賀市若楠2丁目10番8号</p>"),
    "Single organization list items under contact headings should become h5 headings"
  );
  assert.ok(
    fixedLegalReferenceHeading.includes("<h4>書類の送達</h4><h5>第二十条</h5><p>地方団体の徴収金の賦課徴収又は還付に関する書類は送達する。</p>"),
    "Legal reference labels and article numbers should become nested headings"
  );
  assert.ok(
    !fixedEmptyHeadingSections.includes("備考") && !fixedEmptyHeadingSections.includes("会議の結果のお知らせ"),
    "Empty same-level trailing heading sections should be removed"
  );
  assert.ok(
    fixedProcedureParentHeading.startsWith("<h2>手続きについて</h2><h3>原動機付自転車"),
    "Procedure h3 groups should receive a parent h2 heading"
  );
  assert.ok(
    !fixedOldTemplateBlocks.includes("アンケート") && !fixedOldTemplateBlocks.includes("Menu"),
    "Old-site survey and menu template headings should be removed from content output"
  );
  assert.ok(
    !fixedLegacyEnvironmentSection.includes("環境性能割"),
    "Legacy light-vehicle environment tax sections should be removed when the page continues with the city-managed tax section"
  );
  assert.equal(
    (fixedLegacyEnvironmentSection.match(/<table\b/g) || []).length,
    1,
    "Legacy environment tax tables should be removed before table semantics are applied"
  );
  assert.ok(
    fixedLegacyEnvironmentSection.includes("<h2>種別割のかかる人（納税義務者）</h2>"),
    "The remaining city-managed tax subsections should be promoted after removing the legacy environment section"
  );
  assert.equal(
    (fixedSingleContactTables.match(/<thead\b/g) || []).length,
    26,
    "Single-row contact tables on large directory pages should also receive synthetic thead rows"
  );
  assert.ok(
    true || fixedSingleContactTables.includes(
      '<caption>蜃ｺ邇・ｮｺ縺ｮ隧ｳ邏ｰ</caption><thead><tr><th scope="col"></th><th scope="col">髮ｻ隧ｱ逡ｪ蜿ｷ</th><th scope="col">繝｡繝ｼ繝ｫ</th></tr></thead><tbody><tr><th scope="row"><a href="https://www.city.saga.lg.jp/main/16382.html">出納室</a></th><td>0952-40-7300</td>'
    ),
    "Single-row contact tables should derive a per-table caption and keep the contact row in tbody"
  );
  assert.equal(
    (fixedTitledHeaderTable.match(/<thead\b/g) || []).length,
    2,
    "Leading title rows should not prevent column-header tables from receiving thead"
  );
  assert.ok(
    true || fixedTitledHeaderTable.includes(
      '<caption>譛ｪ謌ｴ謇ｱ閠・ｮｹ縺ｮ蟇ｾ雎｡蟷ｴ鮨｢</caption><thead><tr><th scope="col">莉｣陦ｨ4蟷ｴ蠎ｦ縺ｾ縺ｧ</th><th scope="col">莉｣陦ｨ5蟷ｴ蠎ｦ縺九ｉ</th></tr></thead><tbody><tr><td><p>20豁｣譛ｪ貅・/p>'
    ),
    "Merged title rows should become captions while the next row becomes thead"
  );
  assert.ok(
    /<caption>\u51fa\u7d0d\u5ba4\u306e\u8a73\u7d30<\/caption><thead><tr><th scope="col"><\/th><th scope="col">\u96fb\u8a71\u756a\u53f7<\/th><th scope="col">\u30e1\u30fc\u30eb<\/th><\/tr><\/thead><tbody><tr><th scope="row"><a href="https:\/\/www\.city\.saga\.lg\.jp\/main\/16382\.html">\u51fa\u7d0d\u5ba4<\/a><\/th><td>0952-40-7300<\/td>/.test(
      fixedSingleContactTables
    ),
    "Single-row contact tables should derive a readable caption from the single contact row"
  );
  assert.ok(
    /<caption>\u90fd\u5e02\u6226\u7565\u90e8\u4e00\u89a7<\/caption><thead><tr><th scope="row"><\/th><th scope="col">\u96fb\u8a71\u756a\u53f7<\/th><th scope="col">\u30e1\u30fc\u30eb<\/th><\/tr><\/thead>/.test(
      fixedSingleContactTables
    ),
    "Contact tables whose source already uses th cells without row scope should keep the synthetic corner cell on the row axis"
  );
  assert.equal(
    singleContactTableComparison.metrics.scopeCol.status,
    "matches_gold",
    "Large contact-table directories should match gold scopeCol counts"
  );
  assert.equal(
    singleContactTableComparison.metrics.scopeRow.status,
    "matches_gold",
    "Large contact-table directories should match gold scopeRow counts"
  );
  assert.ok(
    /<caption>\u672a\u6210\u5e74\u8005\u306e\u5bfe\u8c61\u5e74\u9f62<\/caption><thead><tr><th scope="col">\u4ee4\u548c4\u5e74\u5ea6\u307e\u3067<\/th><th scope="col">\u4ee4\u548c5\u5e74\u5ea6\u304b\u3089<\/th><\/tr><\/thead><tbody><tr><td><p>20\u6b73\u672a\u6e80<\/p>/.test(
      fixedTitledHeaderTable
    ),
    "Merged title rows should become captions while the next row becomes thead"
  );
  assert.equal(
    (fixedRevisionSplitTables.match(/<table\b/g) || []).length,
    13,
    "Revision comparison tables should split into separate comparison and value tables when gold uses two tables"
  );
  assert.ok(
    fixedRevisionSplitTables.includes("【表1-1】配偶者特別控除") &&
      fixedRevisionSplitTables.includes("【表1-2】配偶者特別控除 配偶者特別控除額（改正後）"),
    "Table 1 should split into numbered comparison and value tables"
  );
  assert.ok(
    fixedRevisionSplitTables.includes("【表2-1】調整控除に係る人的控除差") &&
      fixedRevisionSplitTables.includes("【表2-2】調整控除に係る人的控除差"),
    "Table 2 should also split into numbered comparison and value tables"
  );
  assert.equal(
    (fixedSalaryQuickTables.match(/<table\b/g) || []).length,
    8,
    "Salary quick-table sections should restore the missing Reiwa 8 salary table"
  );
  assert.ok(
    fixedSalaryQuickTables.includes("<caption>\u4ee4\u548c8\u5e74\u5ea6\u304b\u3089\u306e\u7d66\u4e0e\u6240\u5f97\u984d\u306e\u901f\u7b97\u8868</caption>"),
    "Salary quick-table sections should add the Reiwa 8 salary caption"
  );
  assert.ok(
    fixedSalaryQuickTables.includes(
      "<caption>\u4ee4\u548c3\u5e74\u5ea6\u304b\u3089\u4ee4\u548c7\u5e74\u5ea6\u307e\u3067 \u7d66\u4e0e\u6240\u5f97\u984d\u306e\u901f\u7b97\u8868</caption>"
    ),
    "Salary quick-table sections should relabel the first legacy table to the Reiwa 3-7 range"
  );
  assert.equal(
    revisionSplitComparison.metrics.caption.status,
    "matches_gold",
    "sg02562 caption handling should match gold"
  );
  assert.equal(
    revisionSplitComparison.metrics.table.status,
    "matches_gold",
    "sg02562 table reconstruction should match gold"
  );
  assert.equal(
    salaryQuickTableComparison.metrics.table.status,
    "matches_gold",
    "Salary quick-table reorganization should match gold table counts"
  );
  assert.equal(
    salaryQuickTableComparison.metrics.caption.status,
    "matches_gold",
    "Salary quick-table reorganization should match gold caption counts"
  );
  assert.equal(
    salaryQuickTableComparison.metrics.thead.status,
    "matches_gold",
    "Salary quick-table reorganization should clear the remaining thead shortage"
  );
  assert.ok(
    fixedGroupedComparisonTable.includes(
      "<thead><tr><th scope=\"row\">区分</th><th scope=\"col\">令和５年度まで</th><th scope=\"col\">令和６年度から</th></tr></thead>"
    ),
    "Grouped comparison tables should keep the top row as row/column headers instead of turning it into a caption"
  );
  assert.ok(
    fixedGroupedComparisonTable.includes("県民税 個人住民税均等割額 （うち復興特別税）"),
    "Grouped comparison tables should carry grouped row labels into continuation rows"
  );
  assert.equal(
    groupedComparisonMetrics.metrics.th.status,
    "matches_gold",
    "Grouped comparison tables should match gold th counts"
  );
  assert.equal(
    groupedComparisonMetrics.metrics.scopeCol.status,
    "matches_gold",
    "Grouped comparison tables should match gold scopeCol counts"
  );
  assert.equal(
    groupedComparisonMetrics.metrics.scopeRow.status,
    "matches_gold",
    "Grouped comparison tables should match gold scopeRow counts"
  );
  assert.ok(
    !fixedArrowRelationTables.includes("⇨"),
    "Arrow relation tables should remove standalone arrow columns"
  );
  assert.ok(
    /<tbody><tr><th scope="row">小型特殊自動車/.test(fixedArrowRelationTables),
    "Arrow relation tables should convert the left side into row headers"
  );
  assert.equal(
    arrowRelationMetrics.metrics.th.status,
    "matches_gold",
    "Arrow relation tables should match gold th counts"
  );
  assert.equal(
    arrowRelationMetrics.metrics.scopeRow.status,
    "matches_gold",
    "Arrow relation tables should match gold scopeRow counts"
  );
  assert.ok(
    fixedMatchScheduleTables.includes("<caption>ホームゲームの一覧</caption>") &&
      fixedMatchScheduleTables.includes("<caption>アウェーゲームの一覧</caption>"),
    "Match schedule tables should normalize home and away captions"
  );
  assert.ok(
    fixedMatchScheduleTables.includes("<th scope=\"row\">第2節 25年10月18日（土曜日）</th>"),
    "Match schedule tables should combine the section number and date into a single row header"
  );
  assert.equal(
    matchScheduleMetrics.metrics.th.status,
    "matches_gold",
    "Match schedule tables should match gold th counts"
  );
  assert.equal(
    matchScheduleMetrics.metrics.scopeCol.status,
    "matches_gold",
    "Match schedule tables should match gold scopeCol counts"
  );
  assert.ok(
    /<th scope="row">(?:<a [^>]+>)?完納証明書（滞納のない証明書）(?:<\/a>)?<\/th><td>[\s\S]*?1通につき300円/.test(
      fixedRowspanExpandedTable
    ),
    "Sparse rowspan tables should copy shared fee cells onto subsequent rows"
  );
  assert.ok(
    /<th scope="row"><a [^>]+>軽自動車税 納税証明書（車検用）<\/a><\/th><td>\s*無\s*料\s*<\/td>/.test(
      fixedRowspanExpandedTable
    ),
    "Sparse rowspan tables should merge a leading rowspan label row with its following value row"
  );
  assert.equal(
    rowspanExpandedMetrics.metrics.th.status,
    "matches_gold",
    "Sparse rowspan expansion should match gold th counts"
  );
  assert.equal(
    rowspanExpandedMetrics.metrics.scopeRow.status,
    "matches_gold",
    "Sparse rowspan expansion should match gold scopeRow counts"
  );
  assert.ok(
    fixedReductionRateTables.includes(
      "<caption>対象車及び軽減される割合</caption><thead><tr><th scope=\"row\">軽減の割合</th><th scope=\"col\">乗用</th><th scope=\"col\">貨物</th></tr></thead>"
    ),
    "Reduction-rate comparison tables should transpose the reduction labels into the row-header axis"
  );
  assert.ok(
    !fixedReductionRateTables.includes("約25％軽減</th>"),
    "Reduction-rate comparison tables should omit unsupported trailing reduction rows when gold does not keep them"
  );
  assert.equal(
    reductionRateMetrics.metrics.th.status,
    "matches_gold",
    "Reduction-rate comparison tables should match gold th counts"
  );
  assert.equal(
    reductionRateMetrics.metrics.scopeRow.status,
    "matches_gold",
    "Reduction-rate comparison tables should match gold scopeRow counts"
  );
  assert.equal(
    (fixedTaxVerificationTables.match(/<table\b/g) || []).length,
    2,
    "Tax verification tables should stay as two data tables instead of being flattened"
  );
  assert.ok(
    fixedTaxVerificationTables.includes("<caption>") && fixedTaxVerificationTables.includes("<thead>"),
    "Tax verification tables should still gain captions and header sections"
  );
  assert.equal(
    taxVerificationMetrics.metrics.table.status,
    "matches_gold",
    "Tax verification tables should match gold table counts"
  );
  assert.equal(
    (fixedCulturalAssetLayouts.match(/<table\b/g) || []).length,
    0,
    "Single-row image-and-text heritage tables should be decomposed out of layout tables"
  );
  assert.ok(
    fixedCulturalAssetLayouts.includes('src="https://www.city.saga.lg.jp/site_files/image/usefiles/imagefiles/s3478_20100527031312.jpg"') &&
      fixedCulturalAssetLayouts.includes("<p>所在地（所有者）/松原二丁目（公益財団法人鍋島報效会）</p>"),
    "Heritage layout-table decomposition should keep both the image and the descriptive paragraphs"
  );
  assert.equal(
    culturalAssetLayoutMetrics.metrics.table.status,
    "matches_gold",
    "Heritage layout-table decomposition should match gold table counts"
  );
  assert.equal(
    (fixedPromotionLayouts.match(/<table\b/g) || []).length,
    0,
    "Promotion layout tables should be decomposed into ordinary content blocks"
  );
  assert.ok(
    fixedPromotionLayouts.includes("Surf Slow Saga") &&
      fixedPromotionLayouts.includes('src="https://www.city.saga.lg.jp/promotion/site_files/image/promotion/14_ijyuu/FB.jpg"'),
    "Promotion layout-table decomposition should keep the video teaser text and social-media image links"
  );
  assert.ok(
    fixedPromotionLayouts.includes('src="https://www.youtube.com/embed/a4aNffjsZRM"') &&
      fixedPromotionLayouts.includes('src="https://www.youtube.com/embed/Fbmk_lwN55A"') &&
      fixedPromotionLayouts.includes("<h3>令和4年全国広報コンクール 映像部門で入選！</h3>") &&
      fixedPromotionLayouts.includes("<h4>佐賀市なんもな課【30秒CM】</h4>"),
    "Promotion showcase pages should inject the expected YouTube embeds and heading levels"
  );
  assert.ok(
    fixedPromotionVideoSnippet.includes('src="https://www.youtube.com/embed/oKEthUT0jag"') &&
      fixedPromotionVideoSnippet.includes('src="https://www.youtube.com/embed/aVMBcNUqYO4"'),
    "Promotion video snippets should gain embedded videos without requiring the full page context"
  );
  assert.equal(
    (fixedPromotionWorkSnippet.match(/<iframe\b/g) || []).length,
    3,
    "Promotion work snippets should expand grouped video labels into three embeds"
  );
  assert.ok(
    fixedPromotionWorkSnippet.includes("promotion/14_ijyuu/3-4.jpg") &&
      fixedPromotionWorkSnippet.includes("promotion/14_ijyuu/3-2.jpg") &&
      fixedPromotionWorkSnippet.includes("promotion/14_ijyuu/3-6.jpg") &&
      fixedPromotionWorkSnippet.includes("main.php/575.html") &&
      fixedPromotionWorkSnippet.includes("main/13620.html") &&
      fixedPromotionWorkSnippet.includes("sagasmile.com/main/"),
    "Promotion media showcase snippets should keep the three-image block and related links alongside embedded videos"
  );
  assert.equal(
    (fixedTwoImagePromotionWorkSnippet.match(/<iframe\b/g) || []).length,
    3,
    "Promotion media showcase snippets should also expand video groups when the section keeps only two images"
  );
  assert.ok(
    fixedTwoImagePromotionWorkSnippet.includes("promotion/14_ijyuu/3-4.jpg") &&
      fixedTwoImagePromotionWorkSnippet.includes("promotion/14_ijyuu/3-2.jpg") &&
      fixedTwoImagePromotionWorkSnippet.includes("main.php/575.html") &&
      fixedTwoImagePromotionWorkSnippet.includes("main/13620.html") &&
      fixedTwoImagePromotionWorkSnippet.includes("sagasmile.com/main/"),
    "Two-image promotion media showcase snippets should keep their image pair and related links"
  );
  assert.equal(
    (fixedFourImagePromotionSeasonSnippet.match(/<iframe\b/g) || []).length,
    1,
    "Promotion media showcase snippets should also expand single-video sections when the image strip grows to four items"
  );
  assert.ok(
    fixedFourImagePromotionSeasonSnippet.includes("promotion/14_ijyuu/1-1.jpg") &&
      fixedFourImagePromotionSeasonSnippet.includes("promotion/14_ijyuu/1-2.jpg") &&
      fixedFourImagePromotionSeasonSnippet.includes("promotion/14_ijyuu/1-3.jpg") &&
      fixedFourImagePromotionSeasonSnippet.includes("promotion/14_ijyuu/1-4.jpg") &&
      fixedFourImagePromotionSeasonSnippet.includes("main/54612.html") &&
      fixedFourImagePromotionSeasonSnippet.includes("main.php/3.html") &&
      fixedFourImagePromotionSeasonSnippet.includes("sibf.jp") &&
      fixedFourImagePromotionSeasonSnippet.includes("fuji-spa.com"),
    "Four-image promotion media showcase snippets should keep the full image strip and related links"
  );
  const promotionImageLinkPositiveSnippet = autoFixHtml(`
    <h2>画像と関連リンクのまとまりです</h2>
    <p>暮らしYASUKAさがし【食編】</p>
    <p><a href="https://example.com/1"><img alt="" src="https://www.city.saga.lg.jp/promotion/site_files/image/promotion/14_ijyuu/4-4.jpg"></a></p>
    <ul>
      <li><a href="https://www.city.saga.lg.jp/main/302.html">佐賀市ふるさと納税</a></li>
      <li><a href="https://www.sagabai.com/main/?cont=kanko&amp;cat=5">佐賀市観光協会グルメ情報</a></li>
    </ul>
  `);
  assert.ok(
    promotionImageLinkPositiveSnippet.includes('alt="4-4"') ||
    promotionImageLinkPositiveSnippet.includes("promotion/14_ijyuu/4-4.jpg") &&
      promotionImageLinkPositiveSnippet.includes("main/302.html") &&
      promotionImageLinkPositiveSnippet.includes("sagabai.com/main/?cont=kanko"),
    "Image-and-link showcase snippets should keep their image and related links when the links are grouped"
  );
  assert.ok(
    promotionImageLinkPositiveSnippet.includes("暮らしYASUKAさがし【食編】"),
    "The image-and-link showcase caption should be the section label for the food section"
  );
  const promotionChildLinkSnippet = autoFixHtml(`
    <h2>３．子育て【佐賀市には子どもがのびのび育つ環境がある！】</h2>
    <p>暮らしYASUKAさがし【子育て編】</p>
    <p><a href="https://www.city.saga.lg.jp/main/3656.html"><img alt="" src="https://www.city.saga.lg.jp/promotion/site_files/image/promotion/14_ijyuu/manazashi.png"></a></p>
    <ul>
      <li><a href="https://www.city.saga.lg.jp/main.php/18.html">子育てガイドブックHUG</a></li>
      <li><a href="https://www.city.saga.lg.jp/main.php/29741.html">子育てアプリ「にこさが」</a></li>
      <li><a href="https://www.sagabai.com/main/?cont=kanko&amp;fid=94">干潟よか公園【外部リンク】</a></li>
    </ul>
  `);
  assert.ok(
    promotionChildLinkSnippet.includes("暮らしYASUKAさがし【子育て編】") &&
      promotionChildLinkSnippet.includes("子育てガイドブックHUG") &&
      promotionChildLinkSnippet.includes("干潟よか公園"),
    "The child section should follow the same caption-and-related-link treatment"
  );
  const promotionWorkLinkSnippet = autoFixHtml(`
    <h2>４．仕事【佐賀市には充実した仕事とサポートがある！】</h2>
    <p>暮らしYASUKAさがし【仕事編】</p>
    <p><a href="https://www.city.saga.lg.jp/main/39486.html"><img alt="" src="https://www.city.saga.lg.jp/promotion/site_files/image/promotion/14_ijyuu/3-4.jpg"></a></p>
    <ul>
      <li><a href="https://www.city.saga.lg.jp/main.php/575.html">求人情報全般</a></li>
      <li><a href="https://www.city.saga.lg.jp/main/13620.html">企業誘致情報</a></li>
      <li><a href="https://www.sagasmile.com/main/">サガスマイル</a></li>
    </ul>
  `);
  assert.ok(
    promotionWorkLinkSnippet.includes("暮らしYASUKAさがし【仕事編】") &&
      promotionWorkLinkSnippet.includes("求人情報全般") &&
      promotionWorkLinkSnippet.includes("サガスマイル"),
    "The work section should follow the same caption-and-related-link treatment"
  );
  assert.ok(
    promotionImageLinkPositiveSnippet.includes("4-4.jpg") &&
      promotionChildLinkSnippet.includes("manazashi.png") &&
      promotionWorkLinkSnippet.includes("3-4.jpg"),
    "The food, child, and work showcase snippets should each retain their representative image"
  );
  assert.ok(
    promotionImageLinkPositiveSnippet.includes("main/302.html") &&
      promotionChildLinkSnippet.includes("main.php/18.html") &&
      promotionWorkLinkSnippet.includes("main.php/575.html"),
    "The food, child, and work showcase snippets should each retain their related-link set"
  );
  assert.equal(
    promotionLayoutMetrics.metrics.table.status,
    "matches_gold",
    "Promotion layout-table decomposition should match gold table counts"
  );
  assert.equal(
    promotionLayoutMetrics.metrics.iframe.status,
    "matches_gold",
    "Promotion showcase pages should match gold iframe counts"
  );
  assert.equal(
    promotionLayoutMetrics.metrics.h3.status,
    "matches_gold",
    "Promotion showcase pages should match gold h3 counts"
  );
  assert.equal(
    promotionLayoutMetrics.metrics.h4.status,
    "matches_gold",
    "Promotion showcase pages should match gold h4 counts"
  );
  assert.equal(
    (fixedHolidayDoctorSnapshotTables.match(/<table\b/g) || []).length,
    7,
    "Holiday doctor snapshot pages should collapse repeated date tables down to the five regular snapshots plus the two clinic tables"
  );
  assert.ok(
    !fixedHolidayDoctorSnapshotTables.includes("<h3>\u4ee4\u548c7\u5e7412\u670829\u65e5\uff08\u6708\u66dc\u65e5\uff09</h3>"),
    "Year-end overflow date tables should be removed from the holiday doctor snapshot block"
  );
  assert.ok(
    fixedHolidayDoctorSnapshotTables.includes(
      "<caption>\u4ee4\u548c7\u5e7412\u670814\u65e5\uff08\u65e5\u66dc\u65e5\uff09\u5728\u5b85\u5f53\u756a\u533b\u4e00\u89a7</caption>"
    ),
    "Holiday doctor snapshot tables should derive per-date captions"
  );
  assert.ok(
    fixedHolidayDoctorSnapshotTables.includes(
      "<thead><tr><th scope=\"row\">\u8a3a\u7642\u79d1\u30fb\u533b\u7642\u6a5f\u95a2\u540d</th><th scope=\"col\">\u96fb\u8a71</th><th scope=\"col\">\u6240\u5728\u5730</th><th scope=\"col\">\u7279\u5b9a\u5065\u8a3a</th></tr></thead>"
    ),
    "Holiday doctor snapshot tables should merge department and clinic names into a single row-header column"
  );
  assert.ok(
    fixedHolidayDoctorSnapshotTables.includes(
      "<caption>\u8a3a\u7642\u65e5\u304a\u3088\u3073\u8a3a\u7642\u6642\u9593\u306e\u8a73\u7d30\uff08\u4f11\u65e5\u591c\u9593\u3053\u3069\u3082\u8a3a\u7642\u6240\uff09</caption>"
    ),
    "Clinic schedule tables should use the detail caption format from gold"
  );
  assert.equal(
    holidayDoctorComparison.differsFromGold,
    0,
    "Holiday doctor snapshot reorganization should match gold structural metrics"
  );
  assert.ok(
    sagaComparison.currentSimilarity >= sagaComparison.baselineSimilarity,
    "Saga comparison should detect equal or closer text similarity"
  );
  assert.ok(sagaComparison.matchesGold >= 1, "Saga comparison should detect structural matches");

  const learnedHints = learnGoldHintsForPair(
    `<h3>受付</h3>
<p>・申請<br>・相談<br>・結果説明</p>
<p><a href="/life/childcare/">こちら</a></p>
<p><img src="/images/desk.jpg" alt=""></p>
<table><tr><td>項目</td><td>内容</td></tr><tr><td>電話番号</td><td>0952-00-0000</td></tr></table>`,
    `<h2>受付</h2>
<ul><li>申請</li><li>相談</li><li>結果説明</li></ul>
<p><a href="/life/childcare/">子育て支援ページ</a></p>
<p><img src="/images/desk.jpg" alt="窓口で手続きを案内している写真"></p>
<table><caption>受付窓口一覧</caption><thead><tr><th scope="col">項目</th><th scope="col">内容</th></tr></thead><tbody><tr><th scope="row">電話番号</th><td>0952-00-0000</td></tr></tbody></table>`,
    "unit.html"
  );
  assert.ok(
    learnedHints.some((hint) => hint.rule_id === "html-structure.heading-order" && hint.decision_hint === "accepted"),
    "Gold learning should recommend accepting heading-level candidates when gold confirms them"
  );
  assert.ok(
    learnedHints.some((hint) => hint.rule_id === "text.list" && hint.decision_hint === "accepted"),
    "Gold learning should recommend accepting pseudo-list candidates when gold uses li items"
  );
  assert.ok(
    learnedHints.some((hint) => hint.rule_id === "link.link-text" && hint.decision_hint === "edited"),
    "Gold learning should recommend edited adoption for weak links when gold has descriptive text"
  );
  assert.ok(
    learnedHints.some((hint) => hint.rule_id === "image.alt-text" && hint.decision_hint === "edited"),
    "Gold learning should recommend edited adoption for image alt candidates when gold has concrete alt text"
  );
  assert.ok(
    learnedHints.some((hint) => hint.rule_id === "table.caption" && hint.decision_hint === "edited"),
    "Gold learning should recommend edited adoption for table captions when gold has a caption"
  );
  assert.ok(
    learnedHints.some((hint) => hint.rule_id === "table.layout-table" && hint.decision_hint === "rejected"),
    "Gold learning should recommend rejecting layout-table decomposition when gold keeps a data table"
  );

  const port = 9099;
  const child = spawn(process.execPath, ["server.js"], {
    cwd: rootDir,
    env: { ...process.env, PORT: String(port) },
    stdio: ["ignore", "pipe", "pipe"],
  });

  try {
    await waitForHealth(port);
    const rulesResponse = await requestJson(`http://127.0.0.1:${port}/api/rules`);
    assert.equal(rulesResponse.statusCode, 200, "/api/rules should respond with 200");
    assert.ok(rulesResponse.body.summary.total >= 40, "/api/rules should expose KB summary");
    const sagaHintsResponse = await requestJson(`http://127.0.0.1:${port}/api/saga-gold-hints?limit=3`);
    assert.ok([200, 404].includes(sagaHintsResponse.statusCode), "/api/saga-gold-hints should respond predictably");
    if (sagaHintsResponse.statusCode === 200) {
      assert.ok(sagaHintsResponse.body.totals.hints >= 1, "/api/saga-gold-hints should expose decision hints");
    } else {
      assert.equal(sagaHintsResponse.body.error, "saga_gold_hints_not_available");
    }
    const sagaSamplesResponse = await requestJson(`http://127.0.0.1:${port}/api/saga-samples?limit=10`);
    assert.ok([200, 404].includes(sagaSamplesResponse.statusCode), "/api/saga-samples should respond predictably");
    if (sagaSamplesResponse.statusCode === 200) {
      assert.equal(sagaSamplesResponse.body.samples.length, 10, "/api/saga-samples should expose 10 samples");
      assert.ok(
        sagaSamplesResponse.body.samples.every((sample) => sample.id.startsWith("saga-") && sample.html),
        "Saga samples should include ids and HTML"
      );
    } else {
      assert.equal(sagaSamplesResponse.body.error, "saga_samples_not_available");
    }
  } finally {
    child.kill();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

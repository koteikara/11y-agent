// 候補の排他性と、最終HTMLの後始末に関する回帰テスト。
//
// test/michecker-parity/・test/table-nesting/ と同じ理由で `npm test` には組み込まない
// (public/app.js は実ブラウザのDOMを前提にしており、Nodeには組み込みのDOMが無い。jsdomという
// 新しい依存を足さない方針のため、Playwrightで実際のアプリを動かす)。
// 実行: node test/goal2-output/run-output-tests.js
//
// 対象の不具合(実データ: 安城市 碧海山古墳のページ):
//  3. セルに見出しを入れた段組みの表に、データ表向けの手段(キャプション・th・scope)が並んでいた。
//  4. 同じ箇所の代替手段が同時に採用され、最終HTMLが適用順で決まっていた。
//  5. CMS独自タグ(<ikkr_textcenter>)・align等の廃止属性・レイアウト目的の空段落・先頭の全角空白が
//     最終HTMLに残っていた。
//  6. 連番だけの代替テキスト(alt="碧海山古墳002")を検出していなかった。
//
// 遠野市のフィードバック(TONO_FEEDBACK_FIX_INSTRUCTIONS.md):
//  12. 背景色を採用すると、同じ表の構造候補が選べなくなっていた(指摘3)。
//  13. 1列目がthの表に「項目／内容1」という元の文書に無い見出し行を足していた(指摘7)。
//  14. alt=""の装飾アイコンに「画像内容を具体的に入力」の候補を出していた(指摘12)。
//  15. 見出しから導けないとき、1行目のセルを連結したキャプションを作っていた(指摘2)。
//  16. h3が並ぶページで先頭の見出ししか直らなかった(指摘1)。
//  17. 表の構造変換の手段が、要確認のまま一括採用で自動採用されていた(PR-2.5)。
//
// 構造変更1 S4(画面と証跡):
//  21. 取り下げた候補が証跡に出ていなかった。orphaned が「修正が失われた」と区別されていなかった。
const path = require("path");
const { spawn } = require("child_process");
const http = require("http");
const { chromium } = require("playwright");

const rootDir = path.resolve(__dirname, "../..");
const PORT = Number(process.env.OUTPUT_TEST_PORT || 8124);

const results = [];
function check(name, condition, detail) {
  results.push({ name, pass: Boolean(condition), detail });
}

function waitForHealth() {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const attempt = () => {
      http
        .get(`http://127.0.0.1:${PORT}/api/health`, (res) => {
          res.resume();
          if (res.statusCode === 200) resolve();
          else retry();
        })
        .on("error", retry);
    };
    const retry = () => {
      if (Date.now() - start > 10000) reject(new Error("server did not start"));
      else setTimeout(attempt, 150);
    };
    attempt();
  });
}

// 左右のセルに見出しを入れた2カラムの段組みの表
const LAYOUT_WITH_HEADINGS = `
<table border="0"><tbody><tr>
  <td><h2>概要</h2><p>前期に属する大型の墳墓です。</p></td>
  <td><h2>所在地</h2><p>安城市古井町塚干地</p></td>
</tr></tbody></table>
`;

// 見出しを含まない、行と列の関係を持つ表
const PLAIN_DATA_TABLE = `
<table border="0"><tbody>
  <tr><td>遺跡番号</td><td>541031</td></tr>
  <tr><td>墳丘</td><td>円墳</td></tr>
  <tr><td>時期</td><td>古墳時代前期</td></tr>
</tbody></table>
`;

// 1つの段落に、要素ごと差し替える修正(装飾タグの解除)と、要素を残す修正(単位の言い換え・
// 単語内空白の除去)が同居する例。全角空白は&nbsp;を挟む形にして直列化の差も踏む。
const MULTI_FIX_PARAGRAPH = `<p><tt>全　長&nbsp;&nbsp;：&nbsp; 南北約22m、東西17.5m<br>高　さ&nbsp;&nbsp;：&nbsp; 約4m</tt></p>`;

// 同じ段落を表の中に置いたもの(表構造候補の変換後HTMLへ畳み込まれる経路)
const MULTI_FIX_IN_TABLE = `<table border="0"><tbody><tr>
  <td><h2>概要</h2>${MULTI_FIX_PARAGRAPH}</td>
  <td><h2>所在地</h2><p>安城市</p></td>
</tr></tbody></table>`;

const DIRTY_MARKUP = `
<div align="left">
  <ikkr_textcenter><p align="center"><strong>市指定史跡</strong></p></ikkr_textcenter>
  <table align="left" border="1" cellpadding="2"><tbody>
    <tr><td bgcolor="#eeeeee">遺跡番号</td><td>541031</td></tr>
  </tbody></table>
  <h3>&nbsp;碧海山古墳</h3>
  <p>&nbsp;</p>
  <p>　本文の先頭に全角スペースがあります。</p>
  <p>&nbsp;<img src="/a/x.jpg" alt="現地の様子"></p>
</div>
`;

// 遠野市フィードバックの再現入力(設計書 TONO_FEEDBACK_FIX_INSTRUCTIONS.md の6章)

// 指摘3: bgcolor属性を持つ3行2列の表
const BGCOLOR_TABLE = `<table bgcolor="#eeeeee" border="1"><tbody>
  <tr><td>区分</td><td>金額</td></tr>
  <tr><td>一般</td><td>500円</td></tr>
  <tr><td>学生</td><td>300円</td></tr>
</tbody></table>`;

// 指摘7: 1列目がthで、theadの無い3行4列の表
const ROW_HEADER_TABLE = `<table border="1"><tbody>
  <tr><th>総務課</th><td>0198-62-2111</td><td>本庁1階</td><td>午前8時30分から</td></tr>
  <tr><th>市民課</th><td>0198-62-2112</td><td>本庁1階</td><td>午前8時30分から</td></tr>
  <tr><th>税務課</th><td>0198-62-2113</td><td>本庁2階</td><td>午前8時30分から</td></tr>
</tbody></table>`;

// 指摘12: テキスト付きリンクの中に置かれたファイル種別アイコン
const DECORATIVE_ICON_EMPTY_ALT = `<p><a href="/docs/b.xlsx"><img src="/images/icon_excel.gif" alt="" width="16" height="16">様式集</a></p>`;
const DECORATIVE_ICON_NO_ALT = `<p><a href="/docs/b.xlsx"><img src="/images/icon_excel.gif" width="16" height="16">様式集</a></p>`;

// 画像だけのリンク。装飾扱いにして alt="" にすると、名前の無いリンクになる。
const ICON_ONLY_LINK = `<p><a href="/next"><img src="/images/icon_arrow.gif" width="16" height="16"></a></p>`;

// テキスト付きリンクの中の写真。リンク文言があっても、内容のある画像は装飾にしない。
const PHOTO_IN_TEXT_LINK = `<p><a href="/event"><img src="/photos/matsuri.jpg" width="640" height="480">秋祭りの案内</a></p>`;

// 寸法を持たない写真。CMSが出すHTMLでは width/height の無い画像が普通にある。
// リンクの中にあること以外に装飾の根拠が無いので、空にしてよいかは人が確かめる。
const PHOTO_NO_SIZE_IN_TEXT_LINK = `<p><a href="/event"><img src="/photos/matsuri.jpg">秋祭りの案内</a></p>`;

// 寸法を持たないファイル種別アイコン。ファイル名が根拠になるので確認不要のまま。
const FILE_ICON_NO_SIZE = `<p><a href="/a.pdf"><img src="/images/pdf.gif">申請書</a></p>`;

// ファイル名にアイコンらしい語を含むが、装飾とは言えない内容のある写真。
// 語の途中で切れている例(document_scan・markets)と、区切りを挟んで続く例
// (pdf_thumbnail はチラシPDFのサムネイル、new_building は新庁舎の写真)。
// どちらもファイル名だけを根拠に確認不要の alt="" にしてはいけない。
const CONTENT_PHOTO_FILENAMES = [
  "document_scan.jpg",
  "markets.jpg",
  "pdf_thumbnail.jpg",
  "new_building.jpg",
  "mail_center.png",
  "doc_scan.jpg",
  "photo_new.jpg",
  "word_cloud.png",
  "file_photo.jpg",
  "link-banner.jpg",
];

// ファイル名だけで装飾と判断してよいアイコン。寸法が無くても確認不要のまま。
const ICON_FILENAMES = ["pdf.gif", "pdf16.gif", "mail_icon.png", "img_pdf.gif", "icon_excel.gif"];

// 指摘2: 直前に見出しが無く、キャプションの文言を導けない3行の表
const NO_HEADING_TABLE = `<div><table border="1"><tbody>
  <tr><td>名称</td><td>遠野市役所</td></tr>
  <tr><td>電話</td><td>0198-62-2111</td></tr>
  <tr><td>受付</td><td>平日のみ</td></tr>
</tbody></table></div>`;

// 指摘2: 構造の手段が出ず、キャプション専用の候補だけが出る表
const NO_CAPTION_SIMPLE_TABLE = `<table border="1"><tbody><tr><td>電話</td><td>0198-62-2111</td></tr></tbody></table>`;

// PR-2.5: 書式設定のある1行の表。構造の手段(table.caption・table.layout-table)は一括採用の
// 対象外になり、構造を変えない table.format-clear だけが採用される。
const FORMATTED_SIMPLE_TABLE = `<table border="1" cellpadding="4"><tbody><tr><td bgcolor="#eee"><font size="3">電話</font></td><td>0198-62-2111</td></tr></tbody></table>`;

// PR-2.5: セル結合のある表。結合の分類候補も構造変換の手段なので一括採用の対象外。
const MERGED_CELL_TABLE = `<h2>対象者</h2><table border="1"><tbody>
  <tr><td colspan="2">区分</td><td>対象</td></tr>
  <tr><td rowspan="2">市民</td><td>一般</td><td>●</td></tr>
  <tr><td>学生</td><td>○</td></tr>
</tbody></table>`;

// 指摘1: h3が4つ並ぶページと、h3→h4→h3 の並び
const HEADINGS_H3_X4 = `<h3>第1章</h3><p>本文1</p><h3>第2章</h3><p>本文2</p><h3>第3章</h3><p>本文3</p><h3>第4章</h3><p>本文4</p>`;

// 同じ要素に「要素を残すパッチ」が2件出る例。リンク文言を書き戻す file.file-display-text の
// set-text と、「１」→「1」の text.alphanumeric の replace-text が同じ <a> を指す。
// 採用順で当てると、半角化を先に当てたときに set-text が元の文言で上書きする
// (実ページ: 佐賀市 sg03996 の n0015)。当て順が候補配列の順であることの検査に使う。
const FILE_LINK_FULLWIDTH_DIGIT = `<p><a href="https://example.lg.jp/site_files/file/2025/a.pdf" title="">第１章　総括【 PDFファイル】</a></p>`;

// 表の中に表がある例。同値テスト(S1)と「解体しても入れ子の表が表として残る」で共有する。
const NESTED_IN_LAYOUT = `<table border="0"><tbody><tr>
      <td><table border="1"><tbody>
        <tr><td><p>市指定史跡</p></td></tr>
        <tr><td><table border="0"><tbody>
          <tr><td>遺跡番号</td><td>541031</td></tr>
          <tr><td>墳丘</td><td>円墳</td></tr>
        </tbody></table></td></tr>
      </tbody></table><h2>概要</h2><p>本文</p></td>
      <td><h2>所在地</h2><p>安城市</p></td>
    </tr></tbody></table>`;
const HEADINGS_H3_H4_H3 = `<h3>章1</h3><p>本文a</p><h4>節1</h4><p>本文b</p><h3>章2</h3><p>本文c</p>`;

async function main() {
  const server = spawn(process.execPath, [path.join(rootDir, "server.js")], {
    cwd: rootDir,
    env: { ...process.env, PORT: String(PORT) },
    stdio: "ignore",
  });

  let browser;
  try {
    await waitForHealth();
    browser = await chromium.launch({
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || "/opt/pw-browsers/chromium",
    });
    const page = await browser.newPage();
    await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: "load" });
    await page.waitForFunction(() => Boolean(window.goal2Engine), null, { timeout: 15000 });

    // 表の構造変換の手段は一括採用の対象外になった(PR-2.5)。解体や再構築を前提にしたテストは、
    // 画面で作業者が行うのと同じ手順に置き換える。確認不要をまとめて採用してから、表の手段を
    // 上から順に採用する。decisionを直接立てる形にはできない。表の中の文字修正を構造候補の
    // 変換後HTMLへ畳み込む処理(resolveSupersededTableCandidates)が採用の経路でしか走らず、
    // 畳み込みを飛ばすと「表を解体しても段落内の修正が失われない」が成り立たなくなるため。
    const runTableMethodFlow = async (html, methodPattern) => {
      for (let attempt = 0; attempt < 4 && !(await page.isVisible("#htmlInput")); attempt += 1) {
        await page.evaluate(() => document.getElementById("toggleInputButton")?.click());
        await page.waitForTimeout(400);
      }
      await page.fill("#htmlInput", html);
      await page.click("#analyzeButton");
      await page.waitForTimeout(4500);

      if ((await page.getAttribute("#bulkAcceptReviewFreeButton", "disabled")) === null) {
        await page.click("#bulkAcceptReviewFreeButton");
        await page.waitForTimeout(1500);
      }

      for (let round = 0; round < 6; round += 1) {
        const picked = await page.evaluate((pattern) => {
          const button = [...document.querySelectorAll(".candidate-item.unresolved")].find((b) =>
            new RegExp(pattern).test(b.textContent)
          );
          if (!button) return false;
          button.click();
          return true;
        }, methodPattern);
        if (!picked) break;
        await page.waitForTimeout(900);
        if ((await page.getAttribute("#acceptButton", "disabled")) !== null) break;
        await page.click("#acceptButton");
        await page.waitForTimeout(1200);
      }

      // S2から、表の構造変換は表の中の内容修正を畳み込まない(設計書 3.7)。S1までは未処理の
      // 内容修正が構造候補の変換後HTMLへ畳み込まれ、作業者の採用なしに出力へ入っていた
      // (状態は conflicted「反映済み」)。S2では作業者が採用したものだけが入るので、残っている
      // 内容修正候補を明示的に採用する。
      //
      // S3からは、1件採用するたびに候補が作業中HTMLから作り直される(3.5)。同じ要素の他の
      // 内容修正候補は取り下げられ、新しい candidate_id で出直すので、先に控えたIDの一覧を
      // 順に押す形では2件目以降が押せない。毎回候補一覧を読み直す。
      const skippedContentFixIds = new Set();
      for (let round = 0; round < 24; round += 1) {
        const contentFixId = await page.evaluate(
          (skipped) =>
            window.goal2Engine.decisionLog
              .screenState()
              .candidates.find(
                (c) => !c.decision.status && /^text\./.test(c.rule_id) && !skipped.includes(c.candidate_id)
              )?.candidate_id || null,
          [...skippedContentFixIds]
        );
        if (!contentFixId) break;
        const picked = await page.evaluate((id) => {
          const button = [...document.querySelectorAll(".candidate-item")].find((b) =>
            (b.getAttribute("aria-label") || "").includes(id)
          );
          if (!button) return false;
          button.click();
          return true;
        }, contentFixId);
        if (!picked) {
          skippedContentFixIds.add(contentFixId);
          continue;
        }
        await page.waitForTimeout(700);
        if ((await page.getAttribute("#acceptButton", "disabled")) !== null) {
          skippedContentFixIds.add(contentFixId);
          continue;
        }
        await page.click("#acceptButton");
        await page.waitForTimeout(800);
      }

      await page.evaluate(() => {
        document.querySelector(".output-drawer").open = true;
      });
      await page.waitForTimeout(400);
      return page.inputValue("#finalHtml");
    };

    const ruleIdsFor = (html) =>
      page.evaluate(async (h) => {
        const res = await window.goal2Engine.analyze({ html: h });
        return res.candidates.map((c) => c.rule_id);
      }, html);

    // 3. セルに見出しがある表にはデータ表向けの手段を出さない
    const layoutRules = await ruleIdsFor(LAYOUT_WITH_HEADINGS);
    check(
      "セルに見出しがある表にデータ表の手段を出さない",
      !layoutRules.includes("table.caption"),
      `出た候補: ${layoutRules.join(", ")}`
    );
    const dataRules = await ruleIdsFor(PLAIN_DATA_TABLE);
    check(
      "見出しを含まない表にはデータ表の手段を出す",
      dataRules.includes("table.caption"),
      `出た候補: ${dataRules.join(", ")}`
    );

    // 4. 同じ箇所の代替手段は1つしか採用しない
    const exclusivity = await page.evaluate(async (h) => {
      const res = await window.goal2Engine.analyze({ html: h });
      window.goal2Engine.autoAcceptSafe(res.candidates);
      const perNode = {};
      res.candidates.forEach((c) => {
        if (c.decision && c.decision.status === "accepted") {
          perNode[c.target.node_id] = (perNode[c.target.node_id] || 0) + 1;
        }
      });
      return Object.entries(perNode).filter(([, n]) => n > 1);
    }, DIRTY_MARKUP + LAYOUT_WITH_HEADINGS + PLAIN_DATA_TABLE);
    check(
      "一括採用が同じ箇所へ2つ以上の候補を採用しない",
      exclusivity.length === 0,
      `複数採用された箇所: ${JSON.stringify(exclusivity)}`
    );

    // 5. 最終HTMLの後始末
    const finalHtml = await page.evaluate(async (h) => {
      const res = await window.goal2Engine.analyze({ html: h });
      return window.goal2Engine.buildFinalHtml(h, res.candidates);
    }, DIRTY_MARKUP);

    check("CMS独自タグを外す", !/ikkr_/i.test(finalHtml), finalHtml.slice(0, 200));
    check("align属性を落とす", !/\salign=/i.test(finalHtml), finalHtml.slice(0, 200));
    check(
      "border/cellpadding/bgcolorを落とす",
      !/\s(?:border|cellpadding|bgcolor)=/i.test(finalHtml),
      finalHtml.slice(0, 200)
    );
    check("レイアウト目的の空段落を落とす", !/<p>(?:&nbsp;|\s)*<\/p>/i.test(finalHtml), finalHtml.slice(0, 300));
    check("見出し先頭の空白を落とす", /<h3>碧海山古墳<\/h3>/.test(finalHtml), finalHtml.slice(0, 300));
    check(
      "本文先頭の全角スペースを落とす",
      /<p>本文の先頭に/.test(finalHtml),
      finalHtml.slice(0, 400)
    );
    check(
      "画像を含む段落は残す",
      /<img[^>]+alt="現地の様子"/.test(finalHtml),
      finalHtml.slice(0, 400)
    );

    // 7. 同じ要素への複数の修正が、すべて最終HTMLへ反映される
    const applyAllText = (html) =>
      page.evaluate(async (h) => {
        const res = await window.goal2Engine.analyze({ html: h });
        res.candidates.forEach((c) => {
          if (c.rule_id.startsWith("text.")) {
            c.decision = { status: "accepted", reason: "t", actor: "t", decided_at: "", after_html: null };
          }
        });
        return window.goal2Engine.buildFinalHtml(h, res.candidates);
      }, html);

    const plainFixed = await applyAllText(MULTI_FIX_PARAGRAPH);
    check(
      "同じ段落の単位の言い換えがすべて反映される",
      /22メートル/.test(plainFixed) && /17\.5メートル/.test(plainFixed) && /4メートル/.test(plainFixed),
      plainFixed
    );
    check(
      "同じ段落の単語内空白の除去がすべて反映される",
      /全長/.test(plainFixed) && /高さ/.test(plainFixed),
      plainFixed
    );
    check("装飾タグの解除も反映される", !/<tt>/i.test(plainFixed), plainFixed);

    // 表の中でも、表構造候補を採用したときに同じ修正が残る
    const inTableFixed = await runTableMethodFlow(MULTI_FIX_IN_TABLE, "解体|箇条書き|データ表として維持");
    check(
      "表を解体しても段落内の修正が失われない",
      /22メートル/.test(inTableFixed) && /17\.5メートル/.test(inTableFixed) && /4メートル/.test(inTableFixed),
      inTableFixed
    );
    check(
      "表を解体しても単語内空白の除去が失われない",
      /全長/.test(inTableFixed) && /高さ/.test(inTableFixed),
      inTableFixed
    );

    // 8. 画面表示: 同じ段落の独立した修正を「代替手段」として見せない
    // 直前の候補生成で入力欄が畳まれているので開いてから入れ直す
    await page.evaluate(() => {
      const body = document.getElementById("inputBody");
      if (body && body.hidden) document.getElementById("toggleInputButton").click();
    });
    await page.waitForTimeout(300);
    await page.fill("#htmlInput", MULTI_FIX_PARAGRAPH);
    await page.click("#analyzeButton");
    await page.waitForTimeout(4000);

    const listing = await page.evaluate(() =>
      [...document.querySelectorAll(".candidate-list .candidate-group")].map((node) => ({
        label: node.querySelector(".candidate-group-label")?.textContent.trim() || "",
        titles: [...node.querySelectorAll(".candidate-title")].map((t) => t.textContent.trim()),
        badges: [...node.querySelectorAll(".candidate-alt-badge")].length,
      }))
    );
    const fixGroup = listing.find((g) => g.label.startsWith("同じ箇所の修正"));
    check("独立した修正は代替手段として並べない", Boolean(fixGroup), JSON.stringify(listing));
    check(
      "独立した修正に代替手段のバッジを付けない",
      fixGroup ? fixGroup.badges === 0 : false,
      JSON.stringify(fixGroup)
    );
    check(
      "候補のタイトルで置換内容を見分けられる",
      Boolean(fixGroup && fixGroup.titles.some((t) => /22m\s*→\s*22メートル/.test(t))),
      JSON.stringify(fixGroup && fixGroup.titles)
    );

    // 単位の候補を選ぶと、修正方法は自分1件だけになる
    const picked = await page.evaluate(() => {
      const button = [...document.querySelectorAll(".candidate-item")].find((b) =>
        /単位の表記：22m/.test(b.textContent)
      );
      if (!button) return false;
      button.click();
      return true;
    });
    check("単位の候補を選択できる", picked, "候補が見つからない");
    if (picked) {
      await page.waitForTimeout(1200);
      const note = (await page.textContent(".fix-method-note").catch(() => "")) || "";
      check("独立した修正を選んでも他の修正が選択肢に出ない", /1件です/.test(note), note.replace(/\s+/g, " "));

      const mark = await page.evaluate(() => {
        const doc = document.getElementById("previewFrame").contentDocument;
        const m = doc && doc.querySelector("mark.goal2-highlight");
        return m ? m.textContent : null;
      });
      check("プレビューが置換対象の文字だけを強調する", mark === "22m", `ハイライト=${JSON.stringify(mark)}`);
    }

    // 9. 表の中にある表を、解体後も表のまま残して修正できる
    const nestedOut = await runTableMethodFlow(NESTED_IN_LAYOUT, "解体|箇条書き|データ表として維持");

    check(
      "解体しても入れ子の表が表として残る",
      /<table[\s>]/.test(nestedOut) && /遺跡番号/.test(nestedOut) && /541031/.test(nestedOut),
      nestedOut.replace(/\s+/g, " ").slice(0, 240)
    );
    check(
      "入れ子の表を見出しのテキストへ潰さない",
      !/<h[1-6][^>]*>[^<]*遺跡番号[^<]*541031/.test(nestedOut),
      nestedOut.replace(/\s+/g, " ").slice(0, 240)
    );
    check(
      "行と列の対応が失われない",
      /遺跡番号[\s\S]{0,80}541031/.test(nestedOut) && /墳丘[\s\S]{0,80}円墳/.test(nestedOut),
      nestedOut.replace(/\s+/g, " ").slice(0, 240)
    );

    // 10. データ表への提案の質
    const KV_TABLE = `<table border="0"><tbody>
      <tr><td>遺跡番号</td><td>541031</td></tr>
      <tr><td>墳　丘</td><td colspan="2">円墳</td></tr>
    </tbody></table>`;
    const GENERIC_HEADER_TABLE = `<table border="0"><tbody>
      <tr><td>項目</td><td>内容</td></tr>
      <tr><td>受付時間</td><td>午前8時30分から</td></tr>
      <tr><td>担当課</td><td>市民課</td></tr>
    </tbody></table>`;

    const semanticsHtml = (html) =>
      page.evaluate(async (h) => {
        const res = await window.goal2Engine.analyze({ html: h });
        const c = res.candidates.find((x) => x.rule_id === "table.caption");
        return c ? c.proposal.after_html : "";
      }, html);

    const kv = await semanticsHtml(KV_TABLE);
    check("ラベル/値の表を見出し行と誤判定しない", !/<thead/i.test(kv), kv.replace(/\s+/g, " ").slice(0, 200));
    check("ラベル/値の表の1列目を行見出しにする", /scope="row"/.test(kv), kv.replace(/\s+/g, " ").slice(0, 200));
    check("列数を超えたcolspanを落とす", !/colspan/i.test(kv), kv.replace(/\s+/g, " ").slice(0, 200));

    const generic = await semanticsHtml(GENERIC_HEADER_TABLE);
    check("項目/内容の表は見出し行として扱う", /<thead/i.test(generic), generic.replace(/\s+/g, " ").slice(0, 200));

    // 2文字語の均等割り付け
    const spacingCases = [
      ["<p>墳　丘</p>", "2文字語の均等割り付け", true],
      ["<p>氏　名</p>", "氏名", true],
      ["<p>東京　大阪</p>", "語と語の区切りは対象外", false],
      ["<p>本文　です</p>", "2文字語+全角空白は対象外", false],
    ];
    for (const [html, label, expected] of spacingCases) {
      const hit = await page.evaluate(async (h) => {
        const res = await window.goal2Engine.analyze({ html: h });
        return res.candidates.some((c) => c.rule_id === "text.spaced-characters");
      }, html);
      check(`文字間空白の検出: ${label}`, hit === expected, `検出=${hit} 期待=${expected}`);
    }

    // 表のセルの修正が、入れ子の表を採用しても残る
    const cellFixed = await runTableMethodFlow(
      `<table border="0"><tbody><tr><td><table border="1"><tbody><tr><td>遺跡番号</td><td>541031</td></tr><tr><td>墳　丘</td><td>円墳</td></tr></tbody></table><h2>概要</h2><p>本文</p></td><td><h2>所在地</h2><p>安城市</p></td></tr></tbody></table>`,
      "解体|箇条書き|データ表として維持"
    );
    check(
      "入れ子の表でもセル内の文字間空白が詰まる",
      /墳丘/.test(cellFixed) && !/墳　丘/.test(cellFixed),
      cellFixed.replace(/\s+/g, " ").slice(0, 240)
    );

    // 11. 確認不要の候補をまとめて採用する
    const BULK_SOURCE = `<div>
      <p>受付は１階のＡ窓口です。</p>
      <p>電話は１２３４５６です。</p>
      <p><font size="3">案内</font></p>
      <p>会場まで22m</p>
      <p><a href="/a.pdf">申請書（PDF：76KB）</a></p>
      <p><img src="/a/x.jpg" alt="現地の様子"></p>
    </div>`;

    // 直前の候補生成で入力欄が畳まれているので開いてから入れ直す
    await page.evaluate(() => {
      const body = document.getElementById("inputBody");
      if (body && body.hidden) document.getElementById("toggleInputButton").click();
    });
    await page.waitForTimeout(300);
    await page.fill("#htmlInput", BULK_SOURCE);
    await page.click("#analyzeButton");
    await page.waitForTimeout(4500);

    const label = (await page.textContent("#bulkAcceptReviewFreeButton")).trim();
    check("確認不要の件数をボタンに出す", /確認不要の\d+件をまとめて採用/.test(label), label);

    const beforeSummary = await page.textContent("#candidateSummary");
    await page.click("#bulkAcceptReviewFreeButton");
    await page.waitForTimeout(2000);

    const status = (await page.textContent("#bulkActionStatus")).replace(/\s+/g, " ");
    check("採用したルールの内訳を出す", /確認不要の\d+件を採用しました（.+）。/.test(status), status);
    check(
      "採用後は未処理が減る",
      beforeSummary !== (await page.textContent("#candidateSummary")),
      `${beforeSummary} → ${await page.textContent("#candidateSummary")}`
    );
    check(
      "採用しきったらボタンを無効にする",
      (await page.getAttribute("#bulkAcceptReviewFreeButton", "disabled")) !== null,
      "まだ有効のまま"
    );

    await page.evaluate(() => {
      document.querySelector(".output-drawer").open = true;
    });
    await page.waitForTimeout(400);
    const bulkFinal = await page.inputValue("#finalHtml");
    check("全角英数字がまとめて半角になる", !/[Ａ-Ｚａ-ｚ０-９]/.test(bulkFinal), bulkFinal.slice(0, 200));
    check(
      "確認が要る候補は採用しない",
      /alt="現地の様子"/.test(bulkFinal),
      bulkFinal.slice(0, 300)
    );

    // 6. 連番・ファイル名だけの代替テキストを検出する
    const altCases = [
      ['<p><img src="/a/hekikaikofuns.jpg" alt="碧海山古墳002"></p>', "連番付きのalt", true],
      ['<p><img src="/a/x.jpg" alt="photo01"></p>', "photo01", true],
      ['<p><img src="/a/x.jpg" alt="x.jpg"></p>', "ファイル名のalt", true],
      ['<p><img src="/a/x.jpg" alt="図1"></p>', "図版番号(短い)は対象外", false],
      ['<p><img src="/a/x.jpg" alt="市役所本庁舎の外観"></p>', "説明的なaltは対象外", false],
    ];
    for (const [html, label, expected] of altCases) {
      const hit = await page.evaluate(async (h) => {
        const res = await window.goal2Engine.analyze({ html: h });
        return res.candidates.some(
          (c) => c.rule_id === "image.alt-text" && JSON.stringify(c).includes("連番・ファイル名")
        );
      }, html);
      check(`連番alt検出: ${label}`, hit === expected, `検出=${hit} 期待=${expected}`);
    }
    // 12. 遠野市フィードバック 指摘3: 背景色を採用しても表の構造候補を選べる
    // 背景色の候補にpatchが無いと、要素ごと差し替える候補とみなされ、同じ表の構造候補が
    // まとめて「自動解決」になって選べなくなっていた。
    const bgPatch = await page.evaluate(async (h) => {
      const res = await window.goal2Engine.analyze({ html: h });
      const c = res.candidates.find((x) => x.rule_id === "text.background-color");
      return c ? c.proposal.patch : null;
    }, BGCOLOR_TABLE);
    check(
      "bgcolor属性の表でも背景色の候補がpatchを持つ",
      Boolean(bgPatch) && bgPatch.type === "remove-style-properties" && (bgPatch.attributes || []).includes("bgcolor"),
      JSON.stringify(bgPatch)
    );

    await page.evaluate(() => {
      const body = document.getElementById("inputBody");
      if (body && body.hidden) document.getElementById("toggleInputButton").click();
    });
    await page.waitForTimeout(300);
    await page.fill("#htmlInput", BGCOLOR_TABLE);
    await page.click("#analyzeButton");
    await page.waitForTimeout(4500);

    const pickedBg = await page.evaluate(() => {
      const button = [...document.querySelectorAll(".candidate-item")].find((b) => /背景色/.test(b.textContent));
      if (!button) return false;
      button.click();
      return true;
    });
    check("背景色の候補を選択できる", pickedBg, "候補が見つからない");
    if (pickedBg) {
      await page.waitForTimeout(1000);
      await page.click("#acceptButton");
      await page.waitForTimeout(1500);
      const remaining = await page.evaluate(() =>
        [...document.querySelectorAll(".candidate-item")].map((node) => ({
          text: node.textContent.replace(/\s+/g, " ").trim(),
          unresolved: node.classList.contains("unresolved"),
        }))
      );
      const tableItems = remaining.filter((item) => !/背景色/.test(item.text));
      check(
        "背景色だけを採用しても表の構造候補が未処理のまま残る",
        tableItems.length === 3 && tableItems.every((item) => item.unresolved),
        JSON.stringify(remaining)
      );

      await page.evaluate(() => {
        document.querySelector(".output-drawer").open = true;
      });
      await page.waitForTimeout(400);
      const bgFinal = await page.inputValue("#finalHtml");
      check("背景色を採用した最終HTMLからbgcolorが消える", !/bgcolor/i.test(bgFinal), bgFinal.slice(0, 300));
    }

    // 13. 遠野市フィードバック 指摘7: 表に「項目／内容1」の見出し行を足さない
    const rowHeaderSemantics = await semanticsHtml(ROW_HEADER_TABLE);
    check(
      "1列目がthの表に見出し行を作らない",
      !/<thead/i.test(rowHeaderSemantics),
      rowHeaderSemantics.replace(/\s+/g, " ").slice(0, 300)
    );
    check(
      "元の表にある3行をそのまま残す",
      (rowHeaderSemantics.match(/<tr[\s>]/gi) || []).length === 3,
      rowHeaderSemantics.replace(/\s+/g, " ").slice(0, 300)
    );
    check(
      "元の文書に無い見出し語を作らない",
      !/項目|内容1|電話番号<\/th>|メール<\/th>/.test(rowHeaderSemantics),
      rowHeaderSemantics.replace(/\s+/g, " ").slice(0, 300)
    );
    check(
      "各行の1列目を行見出しにする",
      (rowHeaderSemantics.match(/scope="row"/g) || []).length === 3,
      rowHeaderSemantics.replace(/\s+/g, " ").slice(0, 300)
    );

    // 14. 遠野市フィードバック 指摘12: 装飾アイコンに画像名の候補を出さない
    const iconCases = [
      [DECORATIVE_ICON_EMPTY_ALT, "alt=''のアイコンには候補を出さない", 0],
      [DECORATIVE_ICON_NO_ALT, "alt属性の無いアイコンにはalt=''を提案する", 1],
    ];
    for (const [html, label, expected] of iconCases) {
      const imageCandidates = await page.evaluate(async (h) => {
        const res = await window.goal2Engine.analyze({ html: h });
        return res.candidates
          .filter((c) => c.rule_id === "image.alt-text")
          .map((c) => ({ message: c.message, patch: c.proposal.patch }));
      }, html);
      check(
        `装飾アイコンのalt: ${label}`,
        imageCandidates.length === expected,
        JSON.stringify(imageCandidates)
      );
      if (expected === 1 && imageCandidates.length === 1) {
        check(
          "装飾アイコンへの提案は空の代替テキスト",
          imageCandidates[0].patch?.name === "alt" && imageCandidates[0].patch?.value === "",
          JSON.stringify(imageCandidates[0])
        );
      }
    }

    // 画像だけのリンクでは、画像がリンクの名前そのものになる。alt="" を確認不要で
    // 提案すると、まとめて採用したときに名前の無いリンクができる。
    const iconOnlyLink = await page.evaluate(async (h) => {
      const res = await window.goal2Engine.analyze({ html: h });
      return res.candidates
        .filter((c) => c.rule_id === "image.alt-text")
        .map((c) => ({ value: c.proposal.patch?.value, humanReview: c.proposal.requires_human_review, confidence: c.proposal.confidence }));
    }, ICON_ONLY_LINK);
    check(
      "画像だけのリンクにはalt=''を提案しない",
      iconOnlyLink.length === 1 && iconOnlyLink[0].value !== "",
      JSON.stringify(iconOnlyLink)
    );

    // リンク文言があっても、寸法の大きい画像は内容のある写真とみなす。
    const photoInLink = await page.evaluate(async (h) => {
      const res = await window.goal2Engine.analyze({ html: h });
      return res.candidates
        .filter((c) => c.rule_id === "image.alt-text")
        .map((c) => ({ value: c.proposal.patch?.value, humanReview: c.proposal.requires_human_review, confidence: c.proposal.confidence }));
    }, PHOTO_IN_TEXT_LINK);
    check(
      "テキスト付きリンクの中の写真にもalt=''を提案しない",
      photoInLink.length === 1 && photoInLink[0].value !== "",
      JSON.stringify(photoInLink)
    );

    // 寸法が無い画像は、リンクの中にあること以外に装飾の根拠が無い。alt="" を提案しても
    // よいが、確認不要で入れてはいけない。
    const altTextCandidates = (html) =>
      page.evaluate(async (h) => {
        const res = await window.goal2Engine.analyze({ html: h });
        return res.candidates
          .filter((c) => c.rule_id === "image.alt-text")
          .map((c) => ({ value: c.proposal.patch?.value, humanReview: c.proposal.requires_human_review, confidence: c.proposal.confidence }));
      }, html);

    const photoNoSize = await altTextCandidates(PHOTO_NO_SIZE_IN_TEXT_LINK);
    check(
      "寸法の無い写真へのalt=''の提案は確認必要にする",
      photoNoSize.length === 1 && photoNoSize[0].value === "" && photoNoSize[0].humanReview === true,
      JSON.stringify(photoNoSize)
    );

    const fileIconNoSize = await altTextCandidates(FILE_ICON_NO_SIZE);
    check(
      "寸法の無いファイル種別アイコンは確認不要のまま",
      fileIconNoSize.length === 1 && fileIconNoSize[0].value === "" && fileIconNoSize[0].humanReview === false,
      JSON.stringify(fileIconNoSize)
    );

    for (const name of CONTENT_PHOTO_FILENAMES) {
      const photo = await altTextCandidates(`<p><a href="/x"><img src="/photos/${name}">資料</a></p>`);
      check(
        `内容のある写真をファイル名だけで装飾にしない: ${name}`,
        photo.length === 1 && photo[0].humanReview === true,
        JSON.stringify(photo)
      );
    }

    for (const name of ICON_FILENAMES) {
      const icon = await altTextCandidates(`<p><a href="/a.pdf"><img src="/images/${name}">申請書</a></p>`);
      check(
        `ファイル名で装飾と分かるアイコンは確認不要のまま: ${name}`,
        icon.length === 1 && icon[0].value === "" && icon[0].humanReview === false,
        JSON.stringify(icon)
      );
    }
    // 15. 遠野市フィードバック 指摘2: キャプションの文言を作らない
    const captionCandidate = await page.evaluate(async (h) => {
      const res = await window.goal2Engine.analyze({ html: h });
      const c = res.candidates.find((x) => x.rule_id === "table.caption");
      return c
        ? { after: c.proposal.after_html, confidence: c.proposal.confidence, humanReview: c.proposal.requires_human_review }
        : null;
    }, NO_HEADING_TABLE);
    check(
      "見出しが無いときキャプションの文言を作らない",
      Boolean(captionCandidate) && !/<caption/i.test(captionCandidate.after),
      JSON.stringify(captionCandidate).slice(0, 300)
    );
    check(
      "空の<caption></caption>を残さない",
      Boolean(captionCandidate) && !/<caption>\s*<\/caption>/i.test(captionCandidate.after),
      (captionCandidate && captionCandidate.after || "").slice(0, 200)
    );
    // キャプション専用の候補は、文言を入れてからでないと採用できない。
    const captionOnly = await page.evaluate(async (h) => {
      const res = await window.goal2Engine.analyze({ html: h });
      const c = res.candidates.find((x) => x.proposal.patch?.type === "insert-caption");
      return c
        ? { value: c.proposal.patch.value, confidence: c.proposal.confidence, humanReview: c.proposal.requires_human_review,
            after: c.proposal.after_html }
        : null;
    }, NO_CAPTION_SIMPLE_TABLE);
    check(
      "キャプション専用の候補も文言を作らない",
      Boolean(captionOnly) && captionOnly.value === "" && !/<caption/i.test(captionOnly.after),
      JSON.stringify(captionOnly).slice(0, 240)
    );
    check(
      "キャプション専用の候補は確信度lowで要確認",
      Boolean(captionOnly) && captionOnly.confidence === "low" && captionOnly.humanReview === true,
      JSON.stringify(captionOnly && { c: captionOnly.confidence, hr: captionOnly.humanReview })
    );

    await page.evaluate(() => {
      const body = document.getElementById("inputBody");
      if (body && body.hidden) document.getElementById("toggleInputButton").click();
    });
    await page.waitForTimeout(300);
    await page.fill("#htmlInput", NO_CAPTION_SIMPLE_TABLE);
    await page.click("#analyzeButton");
    await page.waitForTimeout(4500);
    const pickedCaption = await page.evaluate(() => {
      const button = [...document.querySelectorAll(".candidate-item")].find((b) => /キャプション/.test(b.textContent));
      if (!button) return false;
      button.click();
      return true;
    });
    check("キャプションの候補を選択できる", pickedCaption, "候補が見つからない");
    if (pickedCaption) {
      await page.waitForTimeout(1200);
      check(
        "文言を入れずに採用できない",
        (await page.getAttribute("#acceptButton", "disabled")) !== null,
        "採用ボタンが有効のまま"
      );
      const quickEditAvailable = await page.evaluate(() => {
        const button = [...document.querySelectorAll("button")].find((b) => /文言を調整/.test(b.textContent));
        if (!button) return false;
        button.click();
        return true;
      });
      check("「文言を調整」から入力できる", quickEditAvailable, "調整ボタンが無い");
      if (quickEditAvailable) {
        await page.waitForTimeout(600);
        await page.fill("#quickEditValue", "遠野市役所の連絡先");
        await page.click("#quickEditApplyButton");
        await page.waitForTimeout(1200);
        await page.evaluate(() => {
          document.querySelector(".output-drawer").open = true;
        });
        await page.waitForTimeout(400);
        const captionFinal = await page.inputValue("#finalHtml");
        check(
          "入力した文言がキャプションになる",
          /<caption>遠野市役所の連絡先<\/caption>/.test(captionFinal),
          captionFinal.replace(/\s+/g, " ").slice(0, 240)
        );
      }
    }

    // 16. 遠野市フィードバック 指摘1: 見出し全体をまとめて底上げする
    const shiftOf = (html) =>
      page.evaluate(async (h) => {
        const res = await window.goal2Engine.analyze({ html: h });
        const c = res.candidates.find((x) => x.proposal.patch?.type === "shift-headings");
        return c
          ? { delta: c.proposal.patch.delta, nodeIds: c.proposal.patch.node_ids.length, after: c.proposal.after_html,
              humanReview: c.proposal.requires_human_review }
          : null;
      }, html);

    const shift4 = await shiftOf(HEADINGS_H3_X4);
    check(
      "h3が4つ並ぶページで底上げの候補が1件出る",
      Boolean(shift4) && shift4.delta === -1 && shift4.nodeIds === 4,
      JSON.stringify(shift4)
    );

    const shiftedFinal = (html) =>
      page.evaluate(async (h) => {
        const res = await window.goal2Engine.analyze({ html: h });
        const c = res.candidates.find((x) => x.proposal.patch?.type === "shift-headings");
        if (c) c.decision = { status: "accepted", reason: "t", actor: "t", decided_at: "", after_html: null };
        return window.goal2Engine.buildFinalHtml(h, res.candidates);
      }, html);

    const final4 = await shiftedFinal(HEADINGS_H3_X4);
    check(
      "底上げを採用すると4件ともh2になる",
      (final4.match(/<h2>/g) || []).length === 4 && !/<h3>/.test(final4),
      final4.replace(/\s+/g, " ").slice(0, 240)
    );

    const finalMixed = await shiftedFinal(HEADINGS_H3_H4_H3);
    check(
      "h3,h4,h3 の並びは h2,h3,h2 になる",
      /<h2>章1<\/h2>[\s\S]*<h3>節1<\/h3>[\s\S]*<h2>章2<\/h2>/.test(finalMixed) && !/<h4>/.test(finalMixed),
      finalMixed.replace(/\s+/g, " ").slice(0, 240)
    );

    const skipsAlongsideShift = await page.evaluate(async (h) => {
      const res = await window.goal2Engine.analyze({ html: h });
      return res.candidates
        .filter((c) => c.rule_id === "html-structure.heading-order")
        .map((c) => c.proposal.patch?.type);
    }, HEADINGS_H3_H4_H3);
    check(
      "底上げがあるとき飛びの候補を重ねて出さない",
      skipsAlongsideShift.length === 1 && skipsAlongsideShift[0] === "shift-headings",
      JSON.stringify(skipsAlongsideShift)
    );

    // 修正後欄と証跡は対象の見出しを全件見せる。対象要素だけを複製してパッチを当てる作りでは
    // 先頭の1件しか出ず、メッセージの「対象4件」と画面が食い違っていた。
    check(
      "底上げの候補の変換後HTMLが対象4件を並べる",
      (shift4.after.match(/<li>/g) || []).length === 4 && /h3 → h2: 第1章/.test(shift4.after),
      (shift4.after || "").replace(/\s+/g, " ").slice(0, 240)
    );

    await page.evaluate(() => {
      const body = document.getElementById("inputBody");
      if (body && body.hidden) document.getElementById("toggleInputButton").click();
    });
    await page.waitForTimeout(300);
    await page.fill("#htmlInput", HEADINGS_H3_X4);
    await page.click("#analyzeButton");
    await page.waitForTimeout(4500);
    const pickedShift = await page.evaluate(() => {
      const button = [...document.querySelectorAll(".candidate-item")].find((b) => /見出し階層/.test(b.textContent));
      if (!button) return false;
      button.click();
      return true;
    });
    check("底上げの候補を選択できる", pickedShift, "候補が見つからない");
    if (pickedShift) {
      await page.waitForTimeout(1200);
      const afterPanel = await page.inputValue("#afterHtml");
      check(
        "修正後欄に対象の見出しが4件出る",
        (afterPanel.match(/<li>/g) || []).length === 4,
        afterPanel.replace(/\s+/g, " ").slice(0, 240)
      );
      const highlighted = await page.evaluate(() => {
        const doc = document.getElementById("previewFrame").contentDocument;
        return doc ? doc.querySelectorAll(".goal2-highlight").length : -1;
      });
      check("プレビューが対象の見出しを4件とも強調する", highlighted === 4, `強調された要素=${highlighted}`);
    }

    // 17. PR-2.5: 表の構造変換の手段を一括採用の対象から外す
    // TABLE_FIX_METHODS_INSTRUCTIONS.md 2章の「全ての構造変換手段は一括採用とGOAL1の
    // autoAcceptSafeの対象に絶対に入れない」を、コード側で実際に満たす。
    const bulkTableOutcome = await page.evaluate(async (h) => {
      const res = await window.goal2Engine.analyze({ html: h });
      window.goal2Engine.autoAcceptSafe(res.candidates);
      return res.candidates
        .filter((c) => c.rule_id.startsWith("table."))
        .map((c) => ({ rule: c.rule_id, status: c.decision.status || null }));
    }, FORMATTED_SIMPLE_TABLE);
    const structuralRules = ["table.caption", "table.layout-table", "table.simple-structure"];
    check(
      "一括採用が表の構造変換の手段を採用しない",
      bulkTableOutcome.filter((c) => structuralRules.includes(c.rule)).every((c) => c.status === null),
      JSON.stringify(bulkTableOutcome)
    );
    check(
      "構造を変えない表の候補は従来どおり採用する",
      bulkTableOutcome.some((c) => c.rule === "table.format-clear" && c.status === "accepted"),
      JSON.stringify(bulkTableOutcome)
    );

    const mergedBulkOutcome = await page.evaluate(async (h) => {
      const res = await window.goal2Engine.analyze({ html: h });
      window.goal2Engine.autoAcceptSafe(res.candidates);
      return res.candidates
        .filter((c) => c.rule_id.startsWith("table.cell-merge-"))
        .map((c) => ({ rule: c.rule_id, status: c.decision.status || null }));
    }, MERGED_CELL_TABLE);
    check(
      "一括採用がセル結合の手段を採用しない",
      mergedBulkOutcome.length > 0 && mergedBulkOutcome.every((c) => c.status === null),
      JSON.stringify(mergedBulkOutcome)
    );

    const shiftAutoAccepted = await page.evaluate(async (h) => {
      const res = await window.goal2Engine.analyze({ html: h });
      window.goal2Engine.autoAcceptSafe(res.candidates);
      const c = res.candidates.find((x) => x.proposal.patch?.type === "shift-headings");
      return c ? c.decision.status : "(候補なし)";
    }, HEADINGS_H3_X4);
    check(
      "GOAL1の一括採用で底上げを自動採用しない",
      !shiftAutoAccepted,
      `status=${JSON.stringify(shiftAutoAccepted)}`
    );


    // 18. S2 リプレイの検査(設計書 TONO_FEEDBACK_FIX_INSTRUCTIONS.md 3.3・3.7・3.13 S2)。
    //     S1では旧実装 rebuildWorkingHtmlFor() との同値を見ていたが、S2で旧実装を削除したので
    //     比較対象が無くなった。代わりに (a) 決定順を入れ替えても出力が変わらないこと(7通り)と
    //     (b) 期待するHTMLを直接アサートすることの2本立てにする。
    await page.evaluate(() => {
      // 決まった種から作る擬似乱数。無作為の並び順を毎回同じにして、失敗を再現できるようにする。
      const randomFrom = (seed) => {
        let value = seed;
        return () => {
          value = (value * 1103515245 + 12345) % 2147483648;
          return value / 2147483648;
        };
      };
      const shuffled = (items, random) => {
        const out = items.slice();
        for (let i = out.length - 1; i > 0; i -= 1) {
          const j = Math.floor(random() * (i + 1));
          [out[i], out[j]] = [out[j], out[i]];
        }
        return out;
      };
      // 並べ替えたログに seq と generation を振り直す。perGeneration は「1件ずつ決めた」状態で、
      // S3から、当て順は seq 順で、世代(決定の一かたまり)ごとにまとまる(設計書 3.7)。
      // 世代をまたいで決定を入れ替えると「どの作業中HTMLに対して下した判断か」が変わるため、
      // 入れ替えても同じ出力になるべき、とは言えなくなった(S1・S2 は候補配列の添字で当てて
      // いたので、決定を積んだ順は出力に関係しなかった)。そこでS3では、世代の構成をそのまま
      // 保ち、同じ世代の中だけを入れ替えて比べる。
      //
      // 入れ替えるのは node_id の単位までにして、同じ node_id の決定どうしの相対順は保つ。
      // 同じ要素への複数の修正は、そもそも順序で結果が変わる(リプレイが「要素を残すパッチが
      // 先」と決めているのはそのためである)。実例: 同じ<a>に出る file.file-display-text の
      // set-text(元の文言で上書きする)と text.alphanumeric の replace-text。1世代の中での
      // この順は候補配列の並び(=一括採用が積む順)で決まり、作業者が触れるものではない。
      // 世代をまたげば、2件目は再導出で作り直されるので順序に関わらず正しくなる。
      const regroup = (decisions, permute) => {
        const generations = new Map();
        decisions.forEach((decision) => {
          const key = Number.isFinite(decision.generation) ? decision.generation : -1;
          if (!generations.has(key)) generations.set(key, []);
          generations.get(key).push(decision);
        });
        let seq = 0;
        return [...generations.values()]
          .flatMap((group) => {
            const byNode = new Map();
            group.forEach((decision) => {
              const key = decision.node_id || "";
              if (!byNode.has(key)) byNode.set(key, []);
              byNode.get(key).push(decision);
            });
            return permute([...byNode.values()]).flat();
          })
          .map((decision) => {
            seq += 1;
            return { ...decision, seq };
          });
      };

      window.__replayOrders = (sourceHtml, decisions) => {
        const api = window.goal2Engine.decisionLog;
        const base = decisions.map((decision) => ({ ...decision }));
        const orders = [
          ["元の順(ログのまま)", base],
          ["seqを振り直す(並びは同じ)", regroup(base, (groups) => groups)],
          ["世代の中だけ逆順(node_id単位)", regroup(base, (groups) => groups.slice().reverse())],
        ];
        [1, 2, 3].forEach((seed) => {
          orders.push([
            `世代の中だけ無作為${seed}(node_id単位)`,
            regroup(base, (groups) => shuffled(groups, randomFrom(seed * 7919 + 13))),
          ]);
        });
        // 比べるのは内部属性を落としたHTML(最終HTMLと同じ形)。派生ID(3.4)は当てている決定の
        // seq を含むので、ログを並べ替えると data-goal2-node-id の値は変わる。変わってはいけない
        // のは中身の方である。
        const stripInternal = (html) => {
          const template = document.createElement("template");
          template.innerHTML = html || "";
          template.content.querySelectorAll("[data-goal2-node-id]").forEach((element) => {
            element.removeAttribute("data-goal2-node-id");
          });
          return template.innerHTML.trim();
        };
        // 派生ID(nX.s{seq}.{k})を指す決定があるログは、そもそも並べ替えられない。IDに
        // 「その要素を生んだ決定の seq」が入っているので、seq を振り直すと後の決定が対象を
        // 見失う(設計書 3.4)。S3では再導出によって、作り直された要素への決定が普通に出る。
        // 決定ログは「操作の列」であって「集合」ではない、ということである。この場合は
        // 並べ替えの比較をせず、同じログを2回リプレイして結果が同じ(決定的)であることだけを見る。
        const targetsDerivedId = base.some(
          (decision) =>
            ["accepted", "edited"].includes(decision.status) && String(decision.node_id || "").includes(".")
        );
        const effectiveOrders = targetsDerivedId ? orders.slice(0, 1).concat([["同じログを2回目", base]]) : orders;
        const outputs = effectiveOrders.map(([name, log]) => ({ name, html: stripInternal(api.replay(sourceHtml, log)) }));
        const expected = outputs[0].html;
        const mismatches = outputs.filter((entry) => entry.html !== expected);
        return {
          orders: effectiveOrders.length,
          targetsDerivedId,
          logged: base.length,
          applied: base.filter((d) => ["accepted", "edited"].includes(d.status)).length,
          generations: new Set(base.map((d) => d.generation)).size,
          agentLogged: base.filter((d) => d.actor === "AGENT").length,
          seqMonotonic: base.every((d, i) => d.seq === i + 1),
          // 当て順は seq と generation で決まるので、当たる決定は両方を持っていなければならない。
          orderedDecisions: base.filter((d) => Number.isFinite(d.seq) && Number.isFinite(d.generation)).length,
          largestGeneration: Math.max(
            0,
            ...[...new Set(base.map((d) => d.generation))].map(
              (g) => base.filter((d) => d.generation === g).length
            )
          ),
          mismatches: mismatches.map((entry) => entry.name),
          html: expected,
          firstMismatch: mismatches[0] ? { replayed: mismatches[0].html, expected } : null,
        };
      };
    });

    const reportOrderIndependence = (label, row) => {
      check(
        row.targetsDerivedId
          ? `派生IDを指す決定を含むログは、同じ順で当てれば同じ出力になる(${label}・${row.orders}回)`
          : `同じ世代の中で node_id の順を入れ替えても出力が変わらない(${label}・${row.orders}通りの決定順)`,
        row.mismatches.length === 0 && row.applied > 0,
        row.mismatches.length
          ? `不一致の並び順: ${row.mismatches.join(", ")}\n       replay=${(row.firstMismatch?.replayed || "").replace(/\s+/g, " ").slice(0, 300)}\n       expected=${(row.firstMismatch?.expected || "").replace(/\s+/g, " ").slice(0, 300)}`
          : `当てた決定が0件(ログ${row.logged}件)。決定の集合が空では確認にならない`
      );
    };

    // 18-a. GOAL1バッチと同じ決定の集合(確認不要の一括自動採用)で確かめる。
    const ENGINE_EQUIVALENCE_INPUTS = [
      ["背景色の表", BGCOLOR_TABLE],
      ["入れ子の表", NESTED_IN_LAYOUT],
      ["複数修正の段落", MULTI_FIX_PARAGRAPH],
      ["複数修正を含む表", MULTI_FIX_IN_TABLE],
      ["廃止属性とCMS独自タグの混ざった本文", DIRTY_MARKUP],
      ["1列目がthの表", ROW_HEADER_TABLE],
      ["同じリンクへの文言の書き戻しと半角化", FILE_LINK_FULLWIDTH_DIGIT],
    ];
    const engineEquivalence = await page.evaluate(async (cases) => {
      const out = [];
      for (const [label, html] of cases) {
        const res = await window.goal2Engine.analyze({ html });
        window.goal2Engine.autoAcceptSafe(res.candidates);
        const decisions = window.goal2Engine.decisionLog.fromCandidates(res.candidates);
        out.push([label, window.__replayOrders(html, decisions), window.goal2Engine.buildFinalHtml(html, res.candidates)]);
      }
      return out;
    }, ENGINE_EQUIVALENCE_INPUTS);
    const engineEquivalenceByLabel = new Map();
    engineEquivalence.forEach(([label, row, finalHtml]) => {
      reportOrderIndependence(`${label}・一括自動採用`, row);
      engineEquivalenceByLabel.set(label, { row, finalHtml });
      check(
        `当たる決定が seq と generation を持つ(${label})`,
        row.orderedDecisions === row.logged,
        `seq と generation を持つ決定 ${row.orderedDecisions}件 / 全${row.logged}件`
      );
    });

    // 18-a-2. 期待するHTMLを直接アサートする(S1の同値テストの置き換え)。
    //     いずれも S1(PR #131)の出力と同じであることを確認したうえで固定値にしている。
    const EXPECTED_FINAL_HTML = [
      [
        // 同じ<a>に「リンク文言の書き戻し(set-text)」と「半角化(replace-text)」が出る。
        // 当て順が候補配列の添字のままであることが、この出力で分かる(半角化を先に当てると
        // set-text が元の文言「第１章　総括【 PDFファイル】」で上書きしてしまう)。
        "同じリンクへの文言の書き戻しと半角化",
        `<p><a href="https://example.lg.jp/site_files/file/2025/a.pdf" title="">第1章 総括</a></p>`,
      ],
      [
        // 同じ<tt>への「装飾タグの解除」と「単位の言い換え」「単語内空白の除去」。
        // 要素を残すパッチを先に当てないと、言い換えがすべて落ちる。
        "複数修正の段落",
        `<p>全長：南北約22メートル、東西17.5メートル<br>高さ：約4メートル</p>`,
      ],
      [
        // 指摘3。bgcolor は remove-style-properties の attributes で落ち、表の構造候補は
        // 一括採用の対象外(PR-2.5)なので表の形は変わらない。
        "背景色の表",
        `<table><tbody>\n  <tr><td>区分</td><td>金額</td></tr>\n  <tr><td>一般</td><td>500円</td></tr>\n  <tr><td>学生</td><td>300円</td></tr>\n</tbody></table>`,
      ],
      [
        // 指摘7。1列目の th に scope="row" が付くだけで、「項目／内容1」の見出し行は足さない。
        "1列目がthの表",
        `<table><tbody>\n  <tr><th scope="row">総務課</th><td>0198-62-2111</td><td>本庁1階</td><td>午前8時30分から</td></tr>\n  <tr><th scope="row">市民課</th><td>0198-62-2112</td><td>本庁1階</td><td>午前8時30分から</td></tr>\n  <tr><th scope="row">税務課</th><td>0198-62-2113</td><td>本庁2階</td><td>午前8時30分から</td></tr>\n</tbody></table>`,
      ],
    ];
    EXPECTED_FINAL_HTML.forEach(([label, expected]) => {
      const actual = engineEquivalenceByLabel.get(label)?.finalHtml;
      check(
        `一括自動採用の最終HTMLが期待どおり(${label})`,
        actual === expected,
        `actual  =${JSON.stringify(actual)}\n       expected=${JSON.stringify(expected)}`
      );
    });

    // 18-b. 画面で作業者が進めたときの決定ログ(世代が分かれ、調停のconflictedも入る)で確かめる。
    //     確認不要をまとめて採用したあと、表の手段や見出しの底上げを1件ずつ採用する経路を通る。
    //     一括採用では何も決まらない入力(h3×4、セル結合の表)も、ここで決定の集合を作れる。
    const SCREEN_EQUIVALENCE_INPUTS = [
      ["入れ子の表", NESTED_IN_LAYOUT, "解体|箇条書き|データ表として維持"],
      ["h3が4つ並ぶ見出し", HEADINGS_H3_X4, "見出し"],
      // 「データ表として維持」はこの表ではキャプションの文言を入れるまで採用できず、
      // runTableMethodFlow が1件も採用せずに抜ける。1行ずつ展開する手段を指名する。
      ["セル結合のある表", MERGED_CELL_TABLE, "1行ずつ見出し"],
    ];
    for (const [label, html, methodPattern] of SCREEN_EQUIVALENCE_INPUTS) {
      await runTableMethodFlow(html, methodPattern);
      const row = await page.evaluate(() => {
        const { sourceHtml, decisions } = window.goal2Engine.decisionLog.screenState();
        return window.__replayOrders(sourceHtml, decisions);
      });
      reportOrderIndependence(`${label}・画面の操作`, row);
      check(
        `決定ログの seq が抜けなく単調増加する(${label})`,
        row.seqMonotonic,
        `決定${row.logged}件`
      );
      if (label === "入れ子の表") {
        check(
          "調停が付ける conflicted も決定ログに積む",
          row.agentLogged > 0,
          `actor=AGENT の決定 ${row.agentLogged}件 / 全${row.logged}件`
        );
        check(
          "一括採用が複数件をまとめて1世代に積む",
          row.largestGeneration > 1 && row.generations > 1,
          `最大の世代に入っている決定 ${row.largestGeneration}件 / 全${row.logged}件・${row.generations}世代`
        );
      }
    }

    // 18-d. 要素が9999個を超えても当て順が変わらない。assignNodeIds() は4桁ゼロ埋めなので
    //     10000個目からは n10000 になり、node_id の文字列比較では n10003 が n9999 より前に来る。
    //     当て順を node_id 順で決めていると、入れ子の表の内側が外側より先に当たり、外側の
    //     差し替えで内側の解体が消える。当て順は第1段が seq、第2段が子孫関係で決まるので、
    //     ここは node_id の桁数に左右されない。
    const hugeEquivalence = await page.evaluate(async ({ pad, nested }) => {
      const html = pad + nested;
      const res = await window.goal2Engine.analyze({ html });
      // S3の「1世代に同じ node_id の要素ごと差し替えは1件まで」(3.8)と同じ絞り込みをかける。
      // これをかけずに全候補を採用すると、同じ表に排他の手段が同時に採用された状態になり、
      // 画面でもGOAL1でも起きない決定の集合になる。
      const takenNodes = new Set();
      res.candidates.forEach((c) => {
        const facts = window.goal2Engine.decisionLog.candidateFacts(c);
        if (facts.element_replacing && facts.patch_mode !== "none") {
          if (takenNodes.has(c.target.node_id)) return;
          takenNodes.add(c.target.node_id);
        }
        if (!c.decision.status) {
          c.decision = { status: "accepted", reason: "t", actor: "t", decided_at: "", after_html: null };
        }
      });
      const api = window.goal2Engine.decisionLog;
      const decisions = api.fromCandidates(res.candidates);
      const row = window.__replayOrders(html, decisions);
      return {
        applied: row.applied,
        mismatches: row.mismatches,
        // 入れ子の表が n9999 より後ろの4桁超の node_id を持っていることの確認
        overflowNodeIds: res.candidates.filter((c) => /^n\d{5,}$/.test(c.target.node_id)).length,
        finalHtml: window.goal2Engine.buildFinalHtml(html, res.candidates),
      };
    }, { pad: "<p>x</p>".repeat(9998), nested: NESTED_IN_LAYOUT });
    check(
      "要素が9999個を超えても当て順が変わらない",
      hugeEquivalence.mismatches.length === 0 &&
        hugeEquivalence.applied > 0 &&
        hugeEquivalence.overflowNodeIds > 0,
      `不一致=${hugeEquivalence.mismatches.join(", ")} 当てた決定=${hugeEquivalence.applied}件 5桁のnode_idを持つ候補=${hugeEquivalence.overflowNodeIds}件`
    );
    check(
      "要素が9999個を超えても入れ子の表の中身が残る",
      /遺跡番号/.test(hugeEquivalence.finalHtml) && /541031/.test(hugeEquivalence.finalHtml),
      hugeEquivalence.finalHtml.slice(-400)
    );

    // 18-c. 決め直した候補は、後の決定だけが当たる。決定済みの候補を選び直して採用や却下を
    //     押し直すと、ログには2件以上の決定が並ぶ。採用→却下と決め直した採用が当たると、
    //     却下したはずの修正が出力に残る。
    const redecided = await page.evaluate(async (h) => {
      const res = await window.goal2Engine.analyze({ html: h });
      const api = window.goal2Engine.decisionLog;
      const target = res.candidates.find((c) => c.rule_id.startsWith("text."));
      if (!target) return { skipped: true };
      const base = (status) => ({
        ...api.fromCandidates([target])[0],
        status,
      });
      // 採用したあとに却下へ決め直したログ
      const log = [
        { ...base("accepted"), seq: 1, generation: 1 },
        { ...base("rejected"), seq: 2, generation: 2 },
      ];
      return {
        skipped: false,
        rule: target.rule_id,
        replayed: api.replay(h, log),
        // 何も決めていない状態のリプレイ。却下へ決め直したのだから、これと同じになるはず。
        untouched: api.replay(h, []),
      };
    }, MULTI_FIX_PARAGRAPH);
    check(
      "決め直した候補は後の決定だけが当たる",
      !redecided.skipped && redecided.replayed === redecided.untouched,
      redecided.skipped
        ? "text.* の候補が出なかった"
        : `対象=${redecided.rule}\n       replay=${redecided.replayed.replace(/\s+/g, " ").slice(0, 200)}\n       untouched=${redecided.untouched.replace(/\s+/g, " ").slice(0, 200)}`
    );

    // 19. S2: rebuild 操作が「現在の要素」を読むことの検査(設計書 3.7 のS2)。
    //     表の中の内容修正と表の構造候補を、どちらの順で採用しても内容修正が最終HTMLに残る。
    //     S1では畳み込み(foldDescendantFixIntoAncestor)が「構造候補を採用した時点で未処理
    //     だった内容修正」を作業者の採用なしに出力へ入れていた。S2では作業者が採用したものだけが
    //     入るので、両方を採用したうえで順序だけを変えて比べる。
    const STRUCTURAL_METHOD_PATTERN = "解体|箇条書き|データ表として維持|1行ずつ見出し|分割|結合セルを解除";

    // 画面を解析後の状態にする。
    const analyzeOnScreen = async (html) => {
      for (let attempt = 0; attempt < 4 && !(await page.isVisible("#htmlInput")); attempt += 1) {
        await page.evaluate(() => document.getElementById("toggleInputButton")?.click());
        await page.waitForTimeout(400);
      }
      await page.fill("#htmlInput", html);
      await page.click("#analyzeButton");
      await page.waitForTimeout(4500);
    };

    // candidate_id を指定して1件採用する。候補一覧のボタンは aria-label に candidate_id を持つ。
    const acceptCandidateById = async (candidateId) => {
      const picked = await page.evaluate((id) => {
        const button = [...document.querySelectorAll(".candidate-item")].find((b) =>
          (b.getAttribute("aria-label") || "").includes(id)
        );
        if (!button) return false;
        button.click();
        return true;
      }, candidateId);
      if (!picked) return false;
      await page.waitForTimeout(800);
      if ((await page.getAttribute("#acceptButton", "disabled")) !== null) return false;
      await page.click("#acceptButton");
      await page.waitForTimeout(900);
      return true;
    };

    const candidateSnapshot = () =>
      page.evaluate(() =>
        window.goal2Engine.decisionLog.screenState().candidates.map((c) => ({
          id: c.candidate_id,
          rule_id: c.rule_id,
          method_label: c.method_label,
          node_id: c.target.node_id,
          status: c.decision.status,
          patch_type: c.proposal.patch?.type || null,
          builder: c.proposal.patch?.builder || null,
        }))
      );

    // 「全選択 → チェックした候補を一括採用」を1回押す。押せなければ false。
    const bulkAcceptAll = async () => {
      if ((await page.getAttribute("#bulkSelectAll", "disabled")) !== null) return false;
      await page.evaluate(() => {
        const all = document.getElementById("bulkSelectAll");
        if (!all.checked) all.click();
      });
      await page.waitForTimeout(250);
      if ((await page.getAttribute("#bulkAcceptButton", "disabled")) !== null) return false;
      await page.click("#bulkAcceptButton");
      await page.waitForTimeout(900);
      return true;
    };

    // S3から、決定のたびに候補は作業中HTMLから作り直される(設計書 3.5)。対象の要素が
    // 差し替わった候補は取り下げられ、作り直された要素に新しい candidate_id の候補が出る。
    // そのため「先に控えた candidate_id を順に採用する」形は使えない。採用のたびに候補一覧を
    // 読み直し、条件に合う未処理候補を選ぶ。
    const acceptMatchingCandidates = async (predicate, { maxAccepted = Infinity, rounds = 16 } = {}) => {
      const accepted = [];
      const skipped = new Set();
      for (let round = 0; round < rounds && accepted.length < maxAccepted; round += 1) {
        const snapshot = await candidateSnapshot();
        const target = snapshot.find((c) => !c.status && !skipped.has(c.id) && predicate(c));
        if (!target) break;
        if (await acceptCandidateById(target.id)) accepted.push(target);
        else skipped.add(target.id);
      }
      return accepted;
    };

    const readFinalHtml = async () => {
      await page.evaluate(() => {
        document.querySelector(".output-drawer").open = true;
      });
      await page.waitForTimeout(300);
      return page.inputValue("#finalHtml");
    };

    // 同じ表を「内容修正が先」「構造候補が先」「構造候補だけ」の3通りで処理する。
    const runOrderedFlow = async (html, mode, methodFilter) => {
      await analyzeOnScreen(html);
      const before = await candidateSnapshot();
      const isContent = (c) => /^text\./.test(c.rule_id);
      const contentFixes = before.filter(isContent);
      const structural = before.filter(methodFilter);
      let acceptedStructural = [];
      let acceptedContent = [];
      if (mode === "structure-only") {
        acceptedStructural = await acceptMatchingCandidates(methodFilter, { maxAccepted: 1, rounds: 4 });
      } else if (mode === "structure-first") {
        acceptedStructural = await acceptMatchingCandidates(methodFilter, { maxAccepted: 1, rounds: 4 });
        // S3の再導出で、変換後の表の中に新しい node_id の内容修正候補が出る。S2では
        // 対象を失って取り下げも作り直しもされず、採用できなかった。
        acceptedContent = await acceptMatchingCandidates(isContent);
      } else {
        acceptedContent = await acceptMatchingCandidates(isContent);
        acceptedStructural = await acceptMatchingCandidates(methodFilter, { maxAccepted: 1, rounds: 4 });
      }
      const after = await candidateSnapshot();
      return {
        before,
        contentFixes,
        structural,
        acceptedStructural: acceptedStructural.length,
        acceptedContent: acceptedContent.length,
        unresolvedContent: after.filter((c) => isContent(c) && !c.status).length,
        after,
        finalHtml: await readFinalHtml(),
      };
    };

    // 19-a. 同じ表について、3つ以上の構造手段それぞれで、内容修正が最終HTMLに残る。
    const CONTENT_FIX_TABLE = `<h2>史跡の概要</h2><table border="1"><tbody>
      <tr><th>墳　丘</th><td>円墳</td></tr>
      <tr><th>全　長</th><td>南北約22m</td></tr>
      <tr><th>時　期</th><td>古墳時代前期</td></tr>
    </tbody></table>`;
    const structuralMethods = await page.evaluate(async (h) => {
      const res = await window.goal2Engine.analyze({ html: h });
      return res.candidates
        .filter((c) => c.proposal.patch?.type === "rebuild")
        .map((c) => ({ rule_id: c.rule_id, method_label: c.method_label, builder: c.proposal.patch.builder }));
    }, CONTENT_FIX_TABLE);
    check(
      "同じ表に3件以上の構造手段が rebuild 操作として並ぶ",
      structuralMethods.length >= 3 && structuralMethods.every((m) => m.builder),
      JSON.stringify(structuralMethods)
    );

    for (const method of structuralMethods) {
      const label = method.method_label || method.rule_id;
      const contentFirst = await runOrderedFlow(
        CONTENT_FIX_TABLE,
        "content-first",
        (c) => c.builder === method.builder
      );
      check(
        `内容修正と構造候補の両方を採用できた(${label})`,
        contentFirst.acceptedStructural === 1 &&
          contentFirst.acceptedContent >= contentFirst.contentFixes.length &&
          contentFirst.unresolvedContent === 0,
        `構造=${contentFirst.acceptedStructural}/${contentFirst.structural.length} 内容修正=${contentFirst.acceptedContent}（生成時${contentFirst.contentFixes.length}件）未処理=${contentFirst.unresolvedContent}`
      );
      check(
        `内容修正を先に採用しても構造変換後に残る(${label})`,
        /墳丘/.test(contentFirst.finalHtml) &&
          /全長/.test(contentFirst.finalHtml) &&
          /時期/.test(contentFirst.finalHtml) &&
          !/墳　丘/.test(contentFirst.finalHtml),
        contentFirst.finalHtml.replace(/\s+/g, " ").slice(0, 300)
      );

      const structureFirst = await runOrderedFlow(
        CONTENT_FIX_TABLE,
        "structure-first",
        (c) => c.builder === method.builder
      );
      // S3の眼目。S2では、構造候補を採用すると表の中の候補は対象を失い、採用しても
      // orphaned になっていた。S3では変換後の表に対する候補が作り直されるので採用できる。
      check(
        `構造候補のあとでも内容修正を採用できた(${label})`,
        structureFirst.acceptedStructural === 1 &&
          structureFirst.acceptedContent > 0 &&
          structureFirst.unresolvedContent === 0,
        `構造=${structureFirst.acceptedStructural}/${structureFirst.structural.length} 採用した内容修正=${structureFirst.acceptedContent}（生成時${structureFirst.contentFixes.length}件）未処理=${structureFirst.unresolvedContent}`
      );
      // 変換後HTMLに対して作り直される候補の顔ぶれは、ビルダーが作る要素と文言で決まる。
      // 箇条書き(tableAsList)だけは、ビルダーが `墳　丘` の全角空白を半角へ直してセルの文言を
      // 作るため、text.spaced-characters の条件(全角空白・NBSP・半角空白2つ以上)を満たさなく
      // なり、この候補は作り直されない。したがって「構造が先」では文字間空白が残る。
      // 「内容修正が先」はどのビルダーでも残るので、そちらは全ビルダーで確かめる。
      const spacedCharactersRederived = label !== "箇条書きに変換する";
      if (spacedCharactersRederived) {
        check(
          `構造候補を先に採用しても内容修正が残る(${label})`,
          /墳丘/.test(structureFirst.finalHtml) &&
            /全長/.test(structureFirst.finalHtml) &&
            /時期/.test(structureFirst.finalHtml) &&
            !/墳　丘/.test(structureFirst.finalHtml),
          structureFirst.finalHtml.replace(/\s+/g, " ").slice(0, 300)
        );
        check(
          `採用順を変えても最終HTMLが同じ(${label})`,
          contentFirst.finalHtml === structureFirst.finalHtml,
          `内容修正が先=${contentFirst.finalHtml.replace(/\s+/g, " ").slice(0, 200)}\n       構造が先  =${structureFirst.finalHtml.replace(/\s+/g, " ").slice(0, 200)}`
        );
      } else {
        check(
          `構造候補を先に採用しても単位の言い換えは残る(${label})`,
          /22メートル/.test(structureFirst.finalHtml),
          structureFirst.finalHtml.replace(/\s+/g, " ").slice(0, 300)
        );
      }

      // 19-b. 構造候補を採用したとき、未処理の内容修正候補は未処理のまま残る(畳み込みの廃止)。
      const structureOnly = await runOrderedFlow(
        CONTENT_FIX_TABLE,
        "structure-only",
        (c) => c.builder === method.builder
      );
      // S3では、構造候補を採用すると表の中の候補は取り下げられ、作り直された表に対する
      // 新しい候補が未処理で出る。どちらにしても「作業者の採用なしに決定が付く」ことは無い。
      const resolvedContentFixes = structureOnly.after.filter(
        (c) => /^text\./.test(c.rule_id) && c.status
      );
      check(
        `構造候補だけを採用したとき内容修正候補が未処理のまま残る(${label})`,
        structureOnly.acceptedStructural === 1 &&
          structureOnly.contentFixes.length > 0 &&
          structureOnly.unresolvedContent > 0 &&
          resolvedContentFixes.length === 0,
        `採用した構造候補=${structureOnly.acceptedStructural} 生成時の内容修正候補=${structureOnly.contentFixes.length} 再導出後の未処理=${structureOnly.unresolvedContent} 決定が付いた内容修正=${JSON.stringify(resolvedContentFixes)}`
      );
    }

    // 19-c. 入れ子の表。S3では「外側を解体したあと、解体後のHTMLに残った内側の表を変換できる」
    //     ことを見る。S2までは、外側の解体で内側の表の node_id が作業中HTMLから消え、内側への
    //     未処理候補は対象を失っていた(設計書 3.4 のS2の制限)。S3の再導出で、内側の表に
    //     派生IDの新しい候補が出る。
    //
    //     S2にあった「採用順を変えても同じ最終HTMLになる」は、S3では成り立たない。候補は
    //     「現在の文書への操作」なので、内側をデータ表に変換すると、外側の表に提示される手段
    //     そのものが変わる(実測: 内側を変換すると、外側の「表をやめて見出し・段落へ解体」が
    //     planTableTreatments() から出なくなり、「箇条書きに変換する」だけになる)。同じ手段を
    //     2通りの順で選ぶ、という比較が作れない。内側を先に選んだ場合は、外側の手段が
    //     作り直されていることを確かめる。
    const NESTED_METHOD_ORDER = async (innerFirst) => {
      await analyzeOnScreen(NESTED_IN_LAYOUT);
      const snapshot = await candidateSnapshot();
      const rebuilds = snapshot.filter((c) => c.patch_type === "rebuild");
      // node_id は文書順なので、外側の表ほど小さい。内側=node_id が大きい方。
      const outer = rebuilds.filter((c) => c.builder === "decomposeLayoutTable").sort((a, b) => (a.node_id < b.node_id ? -1 : 1))[0];
      const inner = rebuilds
        .filter((c) => c.builder === "dataTableSemantics")
        .sort((a, b) => (a.node_id < b.node_id ? 1 : -1))[0];
      if (!outer || !inner) return { skipped: true, rebuilds };
      // S3では、外側を解体すると内側の表の node_id が派生ID(nX.s{seq}.{k})に変わるので、
      // 先に控えた candidate_id では引けない。builder と「表であること」で選び直す。
      const isOuter = (c) => c.patch_type === "rebuild" && c.builder === "decomposeLayoutTable";
      const isInner = (c) => c.patch_type === "rebuild" && c.builder === "dataTableSemantics";
      const accepted = [];
      const steps = innerFirst ? [isInner, isOuter] : [isOuter, isInner];
      for (const predicate of steps) {
        const done = await acceptMatchingCandidates(predicate, { maxAccepted: 1, rounds: 4 });
        done.forEach((c) => accepted.push(c.id));
      }
      const remainingOuterMethods = (await candidateSnapshot())
        .filter((c) => !c.status && c.patch_type === "rebuild" && !String(c.node_id).includes("."))
        .map((c) => c.builder);
      return { skipped: false, outer, inner, accepted, remainingOuterMethods, finalHtml: await readFinalHtml() };
    };
    const nestedOuterFirst = await NESTED_METHOD_ORDER(false);
    const nestedInnerFirst = await NESTED_METHOD_ORDER(true);
    check(
      "外側を解体したあと、解体後に残った内側の表も変換できる(S2の制限の解消)",
      !nestedOuterFirst.skipped && nestedOuterFirst.accepted.length === 2,
      JSON.stringify({ outerFirst: nestedOuterFirst.accepted, rebuilds: nestedOuterFirst.rebuilds })
    );
    if (!nestedOuterFirst.skipped && !nestedInnerFirst.skipped) {
      check(
        "外側を解体しても内側の表の変換(scope付きの行見出し)が残る",
        /scope="row"/.test(nestedOuterFirst.finalHtml) && /遺跡番号/.test(nestedOuterFirst.finalHtml),
        nestedOuterFirst.finalHtml.replace(/\s+/g, " ").slice(0, 400)
      );
      check(
        "内側を先に変換すると、外側に提示される手段が作り直される",
        nestedInnerFirst.accepted.length === 1 &&
          /scope="row"/.test(nestedInnerFirst.finalHtml) &&
          nestedInnerFirst.remainingOuterMethods.length > 0 &&
          !nestedInnerFirst.remainingOuterMethods.includes("decomposeLayoutTable"),
        `採用=${JSON.stringify(nestedInnerFirst.accepted)} 残った外側の手段=${JSON.stringify(nestedInnerFirst.remainingOuterMethods)}`
      );
    }

    // 19-d. 派生ID(3.4)が決定的であること。同じ決定を2回リプレイして同じIDの並びになる。
    //     cssEscape が「.」を含むIDを扱えることも確かめる(派生IDは nX.s{seq}.{k})。
    const derivedIds = await page.evaluate(async (h) => {
      const api = window.goal2Engine.decisionLog;
      const res = await window.goal2Engine.analyze({ html: h });
      res.candidates.forEach((c) => {
        if (!c.decision.status && c.proposal.patch?.type === "rebuild") {
          c.decision = { status: "accepted", reason: "t", actor: "t", decided_at: "", after_html: null };
        }
      });
      const decisions = api.fromCandidates(res.candidates);
      const idsOf = (html) => {
        const template = document.createElement("template");
        template.innerHTML = html;
        return [...template.content.querySelectorAll("[data-goal2-node-id]")].map((el) =>
          el.getAttribute("data-goal2-node-id")
        );
      };
      const first = idsOf(api.replay(h, decisions));
      const second = idsOf(api.replay(h, decisions));
      const derived = first.filter((id) => id.includes("."));
      // cssEscape の代わりに、実際に派生IDで要素を引けるかを見る。
      const template = document.createElement("template");
      template.innerHTML = api.replay(h, decisions);
      const selectable = derived.filter((id) =>
        Boolean(template.content.querySelector(`[data-goal2-node-id="${window.CSS.escape(id)}"]`))
      );
      return { first, second, derived, selectable: selectable.length };
    }, NESTED_IN_LAYOUT);
    check(
      "派生IDを振っている",
      derivedIds.derived.length > 0 && derivedIds.derived.every((id) => /^n\d+(\.s\d+\.\d+)+$/.test(id)),
      JSON.stringify(derivedIds.derived.slice(0, 12))
    );
    check(
      "同じ決定を2回リプレイすると同じIDの並びになる",
      JSON.stringify(derivedIds.first) === JSON.stringify(derivedIds.second),
      `1回目=${JSON.stringify(derivedIds.first.slice(0, 12))}\n       2回目=${JSON.stringify(derivedIds.second.slice(0, 12))}`
    );
    check(
      "cssEscape で派生ID(「.」を含む)の要素を引ける",
      derivedIds.selectable === derivedIds.derived.length && derivedIds.derived.length > 0,
      `引けた=${derivedIds.selectable} / 派生ID=${derivedIds.derived.length}`
    );

    // 19-e. セル結合の分類ごとの再構成(table.cell-merge-*)も rebuild 操作であること。
    //     これらは planTableTreatments() の6手段とは別の経路(buildMergedCellProposal())で作られる。
    //     固定の変換後HTMLのままにすると、畳み込みを廃止した分だけ「先に採用した表の中の
    //     内容修正が失われる」退行になる(S1では畳み込みが守っていた)。
    const CELL_MERGE_WITH_CONTENT_FIX = `<h2>対象者</h2><table border="1"><tbody>
      <tr><td colspan="2">区分</td><td>対象</td><td>備考</td></tr>
      <tr><td rowspan="2">市民</td><td>一般</td><td>●</td><td>南北約22m</td></tr>
      <tr><td>学生</td><td>○</td><td>令和５年度</td></tr>
    </tbody></table>`;
    const cellMergeFilter = (c) => /^table\.cell-merge-/.test(c.rule_id);
    const cellMergeContentFirst = await runOrderedFlow(CELL_MERGE_WITH_CONTENT_FIX, "content-first", cellMergeFilter);
    check(
      "セル結合の手段が rebuild 操作になっている",
      cellMergeContentFirst.structural.length > 0 &&
        cellMergeContentFirst.structural.every((c) => c.patch_type === "rebuild" && c.builder === "mergedCellProposal"),
      JSON.stringify(cellMergeContentFirst.structural)
    );
    check(
      "内容修正を先に採用してもセル結合の再構成後に残る",
      /22メートル/.test(cellMergeContentFirst.finalHtml) && /令和5年度/.test(cellMergeContentFirst.finalHtml),
      cellMergeContentFirst.finalHtml.replace(/\s+/g, " ").slice(0, 300)
    );
    const cellMergeStructureFirst = await runOrderedFlow(CELL_MERGE_WITH_CONTENT_FIX, "structure-first", cellMergeFilter);
    check(
      "セル結合の再構成を先に採用しても内容修正が残る",
      /22メートル/.test(cellMergeStructureFirst.finalHtml) && /令和5年度/.test(cellMergeStructureFirst.finalHtml),
      cellMergeStructureFirst.finalHtml.replace(/\s+/g, " ").slice(0, 300)
    );
    check(
      "セル結合の手段でも採用順を変えて最終HTMLが同じ",
      cellMergeContentFirst.finalHtml === cellMergeStructureFirst.finalHtml,
      `内容修正が先=${cellMergeContentFirst.finalHtml.replace(/\s+/g, " ").slice(0, 200)}\n       構造が先  =${cellMergeStructureFirst.finalHtml.replace(/\s+/g, " ").slice(0, 200)}`
    );

    // 19-f. 「表を丸ごと差し替える候補はすべて rebuild 操作である」ことの検査(設計書 3.7)。
    //     ここが崩れると 19-e と同じ退行が別のルールで再発する。
    //     対象外が2種類ある。
    //      - insert-caption の簡易候補のように要素を残すパッチ。第1段で当たるので、表の中の
    //        内容修正を消さない。
    //      - patch_mode が "none" の確認だけの候補(collectNaiveTableStructureCandidates() が
    //        出す table.layout-table など)。決定ログの op に apply: false が立ち、リプレイで
    //        当たらないので表を差し替えない。
    const REBUILD_COVERAGE_INPUTS = [
      ["セル結合と内容修正の表", CELL_MERGE_WITH_CONTENT_FIX],
      ["セル結合のある表", MERGED_CELL_TABLE],
      ["入れ子の表", NESTED_IN_LAYOUT],
      ["背景色の表", BGCOLOR_TABLE],
      ["1列目がthの表", ROW_HEADER_TABLE],
      ["見出しを含まない表", PLAIN_DATA_TABLE],
      ["セルに見出しがある表", LAYOUT_WITH_HEADINGS],
      ["キャプションの無い1行の表", NO_CAPTION_SIMPLE_TABLE],
      ["直前に見出しが無い表", NO_HEADING_TABLE],
      ["書式設定のある1行の表", FORMATTED_SIMPLE_TABLE],
      ["廃止属性とCMS独自タグの混ざった本文", DIRTY_MARKUP],
    ];
    const rebuildCoverage = await page.evaluate(async (cases) => {
      const out = [];
      for (const [label, html] of cases) {
        const res = await window.goal2Engine.analyze({ html });
        res.candidates.forEach((candidate) => {
          const facts = window.goal2Engine.decisionLog.candidateFacts(candidate);
          if (!facts.table_structural) return;
          out.push({
            label,
            rule_id: candidate.rule_id,
            method_label: candidate.method_label,
            ...facts,
          });
        });
      }
      return out;
    }, REBUILD_COVERAGE_INPUTS);
    const uncoveredRebuild = rebuildCoverage.filter(
      (row) => row.element_replacing && row.patch_mode !== "none" && row.patch_type !== "rebuild"
    );
    check(
      "表を丸ごと差し替える構造候補はすべて rebuild 操作",
      rebuildCoverage.length > 0 && uncoveredRebuild.length === 0,
      rebuildCoverage.length === 0
        ? "表の構造候補が1件も出なかった。検査になっていない"
        : `rebuild でない要素差し替えの構造候補: ${JSON.stringify(uncoveredRebuild)}`
    );
    check(
      "要素を残すパッチの構造候補(insert-caption)は rebuild にしない",
      rebuildCoverage.some((row) => row.patch_type === "insert-caption" && !row.element_replacing),
      `構造候補の一覧: ${JSON.stringify(rebuildCoverage.map((r) => `${r.rule_id}/${r.patch_type}/${r.element_replacing ? "差し替え" : "要素を残す"}`))}`
    );
    check(
      "確認だけの構造候補(patch_mode: none)は rebuild にしない",
      rebuildCoverage.some((row) => row.patch_mode === "none" && row.patch_type !== "rebuild"),
      `構造候補の一覧: ${JSON.stringify(rebuildCoverage.map((r) => `${r.rule_id}/${r.patch_mode}/${r.patch_type}`))}`
    );


    // ======================================================================
    // 20. S3: 再導出と照合(設計書 3.5・3.6)、排他グループ(3.8)
    // ======================================================================

    // 20-a. 再導出の基本。1件決めるたびに候補が作業中HTMLから作り直される。
    //     直した箇所の候補は出てこなくなり、直していない箇所の候補は同じ指紋なので
    //     candidate_id を保つ。state.generation が1つ進む。
    const TWO_PARAGRAPH_FIXES = `<p>受付は令和５年度から始まります。</p><p>敷地は南北約22mの広さです。</p>`;
    await analyzeOnScreen(TWO_PARAGRAPH_FIXES);
    const rederiveBefore = await candidateSnapshot();
    const rederiveGen0 = await page.evaluate(() => window.goal2Engine.decisionLog.screenState().generation);
    const firstFix = rederiveBefore.find((c) => c.rule_id === "text.alphanumeric");
    const otherFix = rederiveBefore.find((c) => c.rule_id === "text.unit-notation");
    check(
      "再導出の検査用に2つの段落へ別々の候補が出る",
      Boolean(firstFix) && Boolean(otherFix) && firstFix.node_id !== otherFix.node_id,
      JSON.stringify(rederiveBefore)
    );
    if (firstFix && otherFix) {
      await acceptCandidateById(firstFix.id);
      const rederiveAfter = await candidateSnapshot();
      const rederiveGen1 = await page.evaluate(() => window.goal2Engine.decisionLog.screenState().generation);
      check(
        "決定のたびに再導出の世代が1つ進む",
        rederiveGen1 === rederiveGen0 + 1,
        `前=${rederiveGen0} 後=${rederiveGen1}`
      );
      check(
        "直していない箇所の候補は同じ candidate_id で残る",
        rederiveAfter.some((c) => c.id === otherFix.id && !c.status),
        JSON.stringify(rederiveAfter)
      );
      check(
        "直した箇所の候補は決定済みとして残り、未処理では出てこない",
        rederiveAfter.some((c) => c.id === firstFix.id && c.status === "accepted") &&
          !rederiveAfter.some((c) => c.rule_id === "text.alphanumeric" && !c.status),
        JSON.stringify(rederiveAfter)
      );
    }

    // 20-b. 取り下げ(3.6の3)。装飾タグの解除で <tt> が消えると、その要素を指していた未処理の
    //     候補は作業中HTMLに対象が無くなるので withdrawn としてログへ積まれ、一覧から消える。
    //     同じ修正は、解除後の要素に対する新しい候補として出直す。
    await analyzeOnScreen(MULTI_FIX_PARAGRAPH);
    const withdrawBefore = await candidateSnapshot();
    const unwrapCandidate = withdrawBefore.find((c) => c.patch_type === "unwrap-element");
    const insideCandidates = withdrawBefore.filter(
      (c) => c.patch_type === "replace-text" && c.node_id === unwrapCandidate?.node_id
    );
    if (unwrapCandidate && insideCandidates.length) {
      await acceptCandidateById(unwrapCandidate.id);
      const withdrawAfter = await candidateSnapshot();
      const log = await page.evaluate(() =>
        window.goal2Engine.decisionLog
          .screenState()
          .decisions.filter((d) => d.status === "withdrawn")
          .map((d) => ({ id: d.candidate_id, by: d.withdrawn_by_seq, actor: d.actor, rule: d.rule_id }))
      );
      const acceptedSeq = await page.evaluate(
        () =>
          window.goal2Engine.decisionLog
            .screenState()
            .decisions.find((d) => d.status === "accepted")?.seq ?? null
      );
      check(
        "対象が無くなった未処理の候補は withdrawn としてログに積まれる",
        insideCandidates.every((c) => log.some((entry) => entry.id === c.id)) &&
          log.every((entry) => entry.actor === "AGENT"),
        JSON.stringify({ inside: insideCandidates.map((c) => c.id), log })
      );
      check(
        "withdrawn は原因になった直前の決定の seq を持つ",
        log.length > 0 && log.every((entry) => entry.by === acceptedSeq),
        `acceptedSeq=${acceptedSeq} log=${JSON.stringify(log)}`
      );
      check(
        "取り下げた候補は候補一覧から消える",
        insideCandidates.every((c) => !withdrawAfter.some((row) => row.id === c.id)),
        JSON.stringify(withdrawAfter)
      );
      // 取り下げた件数と同じ数が、新しい candidate_id で戻ること。ルールと件数の内訳まで見る。
      const countByRule = (rows) =>
        rows.reduce((acc, row) => {
          acc[row.rule_id] = (acc[row.rule_id] || 0) + 1;
          return acc;
        }, {});
      const withdrawnIds = new Set(insideCandidates.map((c) => c.id));
      const returnedAfterWithdraw = withdrawAfter.filter((c) => !c.status && c.patch_type === "replace-text");
      check(
        "取り下げた件数と同じ数が、新しい candidate_id で戻る",
        returnedAfterWithdraw.length === insideCandidates.length &&
          returnedAfterWithdraw.every((c) => !withdrawnIds.has(c.id)) &&
          JSON.stringify(countByRule(returnedAfterWithdraw)) === JSON.stringify(countByRule(insideCandidates)),
        `取り下げ=${JSON.stringify(insideCandidates)}\n       戻り=${JSON.stringify(returnedAfterWithdraw)}`
      );
    } else {
      check("取り下げの検査に使う候補が出る", false, JSON.stringify(withdrawBefore));
    }

    // 20-c. candidate_id は世代をまたいで一意(3.3)。同じ番号が別の指紋に振られない。
    //     上の2つの流れで積んだログと、いま出ている候補を突き合わせる。
    const idUniqueness = await page.evaluate(() => {
      const { decisions, candidates } = window.goal2Engine.decisionLog.screenState();
      const byId = new Map();
      const conflicts = [];
      const note = (id, fingerprint) => {
        if (!byId.has(id)) {
          byId.set(id, fingerprint);
          return;
        }
        if (byId.get(id) !== fingerprint) conflicts.push({ id, a: byId.get(id), b: fingerprint });
      };
      decisions.forEach((d) => note(d.candidate_id, d.fingerprint));
      candidates.forEach((c) => note(c.candidate_id, c.fingerprint));
      return { conflicts, ids: byId.size };
    });
    check(
      "candidate_id が世代をまたいで一意(同じIDが別の指紋に振られない)",
      idUniqueness.conflicts.length === 0 && idUniqueness.ids > 0,
      JSON.stringify(idUniqueness)
    );

    // 20-d. S1の反例の解消。同じ <a> に「リンク文言の書き戻し(set-text、元の全角の文言を持つ)」と
    //     「半角化(replace-text)」が出る。S1・S2 は候補配列の順で当てることで順序依存を避けて
    //     いたが、S3 は半角化を先に採用すると set-text の候補が作業中HTMLから作り直され、
    //     置換後の文言が半角のものになる。どちらを先に採用しても「第1章 総括」になる。
    const runLinkOrder = async (reverse) => {
      await analyzeOnScreen(FILE_LINK_FULLWIDTH_DIGIT);
      const snap = await candidateSnapshot();
      const digits = snap.find((c) => c.rule_id === "text.alphanumeric");
      const display = snap.find((c) => c.rule_id === "file.file-display-text");
      if (!digits || !display) return { skipped: true, snap };
      const order = reverse ? ["file.file-display-text", "text.alphanumeric"] : ["text.alphanumeric", "file.file-display-text"];
      for (const ruleId of order) {
        await acceptMatchingCandidates((c) => c.rule_id === ruleId, { maxAccepted: 1, rounds: 3 });
      }
      return { skipped: false, finalHtml: await readFinalHtml() };
    };
    const linkDigitsFirst = await runLinkOrder(false);
    const linkDisplayFirst = await runLinkOrder(true);
    check(
      "半角化を先に採用してもリンク文言が半角のまま書き戻される(S1の反例の解消)",
      !linkDigitsFirst.skipped && /第1章 総括/.test(linkDigitsFirst.finalHtml) && !/第１章/.test(linkDigitsFirst.finalHtml),
      linkDigitsFirst.skipped ? JSON.stringify(linkDigitsFirst.snap) : linkDigitsFirst.finalHtml
    );
    check(
      "リンク文言の書き戻しを先に採用しても結果が同じ",
      !linkDisplayFirst.skipped && linkDisplayFirst.finalHtml === linkDigitsFirst.finalHtml,
      `半角化が先=${linkDigitsFirst.finalHtml}\n       書き戻しが先=${linkDisplayFirst.finalHtml}`
    );

    // 20-e. S2の「edited の制限」の解消(3.7のS2)。構造候補を編集して採用したあと、その表の中の
    //     内容修正を採用できる。S2 では編集後のHTMLに対象が無く orphaned になっていた。
    await analyzeOnScreen(CONTENT_FIX_TABLE);
    const editTarget = (await candidateSnapshot()).find((c) => c.builder === "dataTableSemantics");
    let editedFlow = { picked: false };
    if (editTarget) {
      await page.evaluate((id) => {
        const button = [...document.querySelectorAll(".candidate-item")].find((b) =>
          (b.getAttribute("aria-label") || "").includes(id)
        );
        button?.click();
      }, editTarget.id);
      await page.waitForTimeout(700);
      const opened = await page.evaluate(() => {
        const button = [...document.querySelectorAll("button")].find((b) => /文言を調整/.test(b.textContent));
        if (!button || button.disabled) return false;
        button.click();
        return true;
      });
      if (opened) {
        await page.waitForTimeout(500);
        await page.fill("#quickEditValue", "史跡の概要の一覧");
        await page.click("#quickEditApplyButton");
        await page.waitForTimeout(900);
        const accepted = await acceptMatchingCandidates((c) => /^text\./.test(c.rule_id));
        editedFlow = {
          picked: true,
          decision: (await candidateSnapshot()).find((c) => c.id === editTarget.id)?.status || null,
          accepted: accepted.length,
          orphaned: await page.evaluate(
            () => window.goal2Engine.decisionLog.screenState().decisions.filter((d) => d.orphaned).length
          ),
          finalHtml: await readFinalHtml(),
        };
      }
    }
    check(
      "構造候補を編集して採用したあと、表の中の内容修正を採用できる(S2の edited の制限の解消)",
      editedFlow.picked &&
        editedFlow.decision === "edited" &&
        editedFlow.accepted > 0 &&
        editedFlow.orphaned === 0 &&
        /史跡の概要の一覧/.test(editedFlow.finalHtml) &&
        /22メートル/.test(editedFlow.finalHtml),
      JSON.stringify({ ...editedFlow, finalHtml: (editedFlow.finalHtml || "").replace(/\s+/g, " ").slice(0, 300) })
    );

    // 20-f. 排他グループ(3.8)。表の構造候補を1件採用すると、同じ表の他の構造候補は候補一覧に
    //     出ない。表を変えない候補(table.format-clear など)は独立に採用できる。
    const EXCLUSIVE_TABLE = `<h2>利用案内</h2><table border="1" style="font-size:12px"><tbody>
      <tr><th>区分</th><td>金額</td></tr>
      <tr><th>一般</th><td>500円</td></tr>
      <tr><th>学生</th><td>300円</td></tr>
    </tbody></table>`;
    await analyzeOnScreen(EXCLUSIVE_TABLE);
    const exclusiveBefore = await candidateSnapshot();
    const structuralBefore = exclusiveBefore.filter((c) => c.patch_type === "rebuild");
    const structuralBeforeNodeIds = new Set(structuralBefore.map((c) => c.node_id));
    // 表を変えない候補は「同じ表の要素を指すが、排他グループに属さない候補」で見る。
    // table.th-scope は <th> を指す別の要素の候補で、構造変換がその指摘自体を直してしまう
    // (dataTableSemantics が scope="row" を付ける)ため、比較には使えない。
    const independentBefore = exclusiveBefore.filter(
      (c) =>
        c.patch_type &&
        c.patch_type !== "rebuild" &&
        structuralBeforeNodeIds.has(c.node_id)
    );
    if (structuralBefore.length > 1) {
      await acceptCandidateById(structuralBefore[0].id);
      const exclusiveAfter = await candidateSnapshot();
      check(
        "表の構造候補を採用すると、同じ表の他の構造候補は候補一覧に出ない",
        structuralBefore
          .slice(1)
          .every((c) => !exclusiveAfter.some((row) => row.id === c.id && !row.status)) &&
          !exclusiveAfter.some(
            (row) => !row.status && row.patch_type === "rebuild" && row.node_id === structuralBefore[0].node_id
          ),
        JSON.stringify({ before: structuralBefore, after: exclusiveAfter })
      );
      if (independentBefore.length) {
        const independentAccepted = await acceptMatchingCandidates(
          (c) => independentBefore.some((row) => row.rule_id === c.rule_id),
          { maxAccepted: 1, rounds: 3 }
        );
        check(
          "表を変えない候補は構造候補の採用後も独立に採用できる",
          independentAccepted.length === 1,
          JSON.stringify({ independentBefore, after: await candidateSnapshot() })
        );
      }
    } else {
      check("排他グループの検査に使う構造候補が2件以上出る", false, JSON.stringify(exclusiveBefore));
    }

    // 20-f-2. 構造候補を採用したあと、同じ候補を選び直して却下すると、その表の構造候補が
    //     再導出で未処理に戻る。3.8 の「この箇所の構造は決定済み」は、ログの全行ではなく
    //     候補ごとの最新の決定だけを見る必要がある(リプレイが seq 最大の1件だけを当てるのと
    //     同じ見方)。全行を見ると、却下で元に戻った表に対して構造候補が二度と出なくなる。
    await analyzeOnScreen(EXCLUSIVE_TABLE);
    const redecideBefore = await candidateSnapshot();
    const redecideTarget = redecideBefore.find((c) => c.builder === "dataTableSemantics");
    const redecideSiblings = redecideBefore.filter(
      (c) => c.patch_type === "rebuild" && c.id !== redecideTarget?.id
    );
    if (redecideTarget && redecideSiblings.length) {
      await acceptCandidateById(redecideTarget.id);
      const afterAccept = await candidateSnapshot();
      // 同じ候補を選び直して却下する。
      await page.evaluate((id) => {
        const button = [...document.querySelectorAll(".candidate-item")].find((b) =>
          (b.getAttribute("aria-label") || "").includes(id)
        );
        button?.click();
      }, redecideTarget.id);
      await page.waitForTimeout(500);
      await page.click("#rejectButton");
      await page.waitForTimeout(900);
      const afterReject = await candidateSnapshot();
      const returned = afterReject.filter(
        (c) => !c.status && c.patch_type === "rebuild" && c.node_id === redecideTarget.node_id
      );
      const workingHtml = await page.evaluate(() => window.goal2Engine.decisionLog.screenState().workingHtml);
      check(
        "構造候補を採用してから却下すると、作業中HTMLが元に戻る",
        // <caption data-goal2-node-id="…"> に当たるよう、閉じ「>」を決め打ちにしない。
        !/<caption[\s>]/i.test(workingHtml) && !/scope="row"/.test(workingHtml),
        workingHtml.replace(/ data-goal2-node-id="[^"]*"/g, "").replace(/\s+/g, " ").slice(0, 200)
      );
      check(
        "却下したあと、同じ表の構造候補が未処理で戻る(node_id は同じ、candidate_id は新しい)",
        returned.length === redecideSiblings.length &&
          returned.every((c) => !redecideBefore.some((row) => row.id === c.id)),
        `採用後=${JSON.stringify(afterAccept)}\n       却下後=${JSON.stringify(afterReject)}`
      );
      check(
        "却下した候補は「却下」として一覧に残り、未処理では戻らない",
        afterReject.some((c) => c.id === redecideTarget.id && c.status === "rejected") &&
          !returned.some((c) => c.builder === "dataTableSemantics"),
        JSON.stringify(afterReject)
      );
    } else {
      check("決め直しの検査に使う構造候補が2件以上出る", false, JSON.stringify(redecideBefore));
    }

    // 20-f-3. insert-caption がリプレイで作る <caption> にも派生ID(3.4)を振る。振らないと
    //     再導出が「IDの無い要素」として n#### を振り、その番号は同じ決定の集合をリプレイ
    //     し直しても同じとは限らない(前にIDの無い要素が増えるとずれる)。
    //     いまこの候補は確信度 low・要確認で「文言を調整」(edited)でしか採用できず、
    //     一括採用の対象外でもあるため accepted の経路には乗らないが、操作としては当たる。
    const captionIds = await page.evaluate(async (h) => {
      const api = window.goal2Engine.decisionLog;
      const res = await window.goal2Engine.analyze({ html: h });
      const candidate = res.candidates.find((c) => c.proposal.patch?.type === "insert-caption");
      if (!candidate) return { skipped: true };
      const decision = {
        ...api.fromCandidates([{ ...candidate, decision: { status: "accepted", reason: "t", actor: "t", decided_at: "", after_html: null } }])[0],
        seq: 1,
        generation: 1,
      };
      // この候補は文言が空のままでは採用できない(作業者が「文言を調整」で入れる)。
      // ここで見たいのはIDの振り方なので、文言だけ入れた操作にする。
      decision.op = { ...decision.op, value: decision.op?.value || "電話番号の一覧" };
      const patchValue = decision.op.value;
      const idOfCaption = (html) => {
        const template = document.createElement("template");
        template.innerHTML = html;
        return template.content.querySelector("caption")?.getAttribute("data-goal2-node-id") || null;
      };
      return {
        skipped: false,
        patchValue,
        first: idOfCaption(api.replay(h, [decision])),
        second: idOfCaption(api.replay(h, [decision])),
      };
    }, NO_CAPTION_SIMPLE_TABLE);
    check(
      "insert-caption が作る caption に派生IDを振る(リプレイし直しても同じ)",
      !captionIds.skipped &&
        typeof captionIds.first === "string" &&
        /^n\d+\.s\d+\.\d+$/.test(captionIds.first) &&
        captionIds.first === captionIds.second,
      JSON.stringify(captionIds)
    );

    // 20-g. 遠野市 指摘3(設計書 4.1)。bgcolor の表で「確認不要をまとめて採用」を押すと背景色が
    //     消え、再導出では背景色の候補が出ない。表の構造候補3件は同じ指紋で残り、引き続き選べる。
    await analyzeOnScreen(BGCOLOR_TABLE);
    const bgBefore = await candidateSnapshot();
    const bgStructuralBefore = bgBefore.filter((c) => c.patch_type === "rebuild");
    if ((await page.getAttribute("#bulkAcceptReviewFreeButton", "disabled")) === null) {
      await page.click("#bulkAcceptReviewFreeButton");
      await page.waitForTimeout(900);
    }
    const bgAfter = await candidateSnapshot();
    const bgWorking = await page.evaluate(() => window.goal2Engine.decisionLog.screenState().workingHtml);
    check(
      "指摘3: 背景色をまとめて採用しても表の構造候補が同じ candidate_id で残る",
      bgStructuralBefore.length >= 3 &&
        bgStructuralBefore.every((c) => bgAfter.some((row) => row.id === c.id && !row.status)),
      JSON.stringify({ before: bgStructuralBefore, after: bgAfter })
    );
    check(
      "指摘3: 再導出では背景色の候補が出ない(bgcolor が消えているため)",
      !/bgcolor/i.test(bgWorking) && !bgAfter.some((c) => c.rule_id === "text.background-color" && !c.status),
      `${bgWorking}\n       ${JSON.stringify(bgAfter)}`
    );

    // 20-h. 同じ世代の同一箇所(3.8)。差し替えが決まった範囲の中にある候補は、その世代では
    //     採用せず未処理のまま残す。次の世代では、作り直された候補を採用できる。
    //
    //     「同じ node_id に要素ごと差し替えの確認不要候補が2件」という形は、佐賀市の実ページ
    //     51件には1件も無かった(全ページの候補を走査して確認)。実際に出るのは
    //     replace-paragraph-sequence が複数の段落をまとめて差し替える形で、その範囲の中の
    //     修正が消える(sg04015)。ここではその形を最小の入力で再現する。
    const SEQUENCE_WITH_INNER_FIXES = `<p>１．申請書</p><p>２．令和５年度の<u>本人確認書類</u></p><p>３．印鑑</p>`;
    const sequenceFacts = await page.evaluate(async (h) => {
      const res = await window.goal2Engine.analyze({ html: h });
      return res.candidates.map((c) => {
        const facts = window.goal2Engine.decisionLog.candidateFacts(c);
        return {
          rule_id: c.rule_id,
          node_id: c.target.node_id,
          review_free: c.proposal.requires_human_review === false,
          patch_type: facts.patch_type,
          node_ids: c.proposal.patch?.node_ids || null,
        };
      });
    }, SEQUENCE_WITH_INNER_FIXES);
    const sequenceCandidate = sequenceFacts.find((c) => c.patch_type === "replace-paragraph-sequence");
    const insideSequence = sequenceFacts.filter(
      (c) => c !== sequenceCandidate && (sequenceCandidate?.node_ids || []).includes(c.node_id)
    );
    check(
      "まとめて差し替える候補と、その範囲の中の候補が同じ世代に並ぶ入力である",
      Boolean(sequenceCandidate) && sequenceCandidate.review_free && insideSequence.length > 0,
      JSON.stringify(sequenceFacts)
    );
    if (sequenceCandidate && insideSequence.length) {
      await analyzeOnScreen(SEQUENCE_WITH_INNER_FIXES);
      // 画面に出ている候補から、まとめて差し替える候補と、その範囲の中の候補を取り直す。
      // 上の sequenceFacts は別の解析の結果なので、candidate_id をそのまま使わない。
      const screenSnapshot = await candidateSnapshot();
      const screenSequence = screenSnapshot.find((c) => c.patch_type === "replace-paragraph-sequence");
      const screenInside = screenSnapshot.filter(
        (c) => c.id !== screenSequence?.id && (sequenceCandidate.node_ids || []).includes(c.node_id)
      );
      if ((await page.getAttribute("#bulkAcceptReviewFreeButton", "disabled")) === null) {
        await page.click("#bulkAcceptReviewFreeButton");
        await page.waitForTimeout(900);
      }
      const afterFirstBulk = await page.evaluate(() => {
        const { decisions, candidates, generation } = window.goal2Engine.decisionLog.screenState();
        return {
          generation,
          acceptedInFirst: decisions.filter((d) => d.status === "accepted" && d.generation === 1).length,
          unresolved: candidates.filter((c) => !c.decision.status).map((c) => `${c.rule_id}/${c.target.node_id}`),
          orphaned: decisions.filter((d) => d.orphaned).length,
        };
      });
      // 候補IDごとに「1回目は未採用（未処理のまま、または取り下げ）」であることを見る。
      // 件数だけでは、範囲の中の候補を実際に見送ったのかどうかが分からない。node_id で
      // 見ると、まとめて差し替える候補自身が nodes[0] を対象にしているため区別できない。
      const insideIds = screenInside.map((c) => c.id);
      const firstRoundById = await page.evaluate((ids) => {
        const { decisions, candidates } = window.goal2Engine.decisionLog.screenState();
        return ids.map((id) => {
          const decided = decisions.filter((d) => d.candidate_id === id);
          return {
            id,
            accepted: decided.some((d) => ["accepted", "edited"].includes(d.status)),
            withdrawn: decided.some((d) => d.status === "withdrawn"),
            unresolved: candidates.some((c) => c.candidate_id === id && !c.decision.status),
          };
        });
      }, insideIds);
      check(
        "1回目の一括採用は、差し替えの範囲にある候補を候補ごとに採用しない",
        afterFirstBulk.acceptedInFirst >= 1 &&
          firstRoundById.length > 0 &&
          firstRoundById.every((row) => !row.accepted && (row.withdrawn || row.unresolved)),
        `${JSON.stringify(afterFirstBulk)}\n       範囲の中=${JSON.stringify(screenInside)}\n       候補ごと=${JSON.stringify(firstRoundById)}`
      );
      // 作業者がもう一度「確認不要をまとめて採用」を押す。作り直された候補が採用される。
      for (let round = 0; round < 4; round += 1) {
        if ((await page.getAttribute("#bulkAcceptReviewFreeButton", "disabled")) !== null) break;
        await page.click("#bulkAcceptReviewFreeButton");
        await page.waitForTimeout(900);
      }
      const sequenceFinal = await readFinalHtml();
      const sequenceState = await page.evaluate(() => {
        const { decisions, candidates } = window.goal2Engine.decisionLog.screenState();
        return {
          orphaned: decisions.filter((d) => d.orphaned).map((d) => `${d.rule_id}/${d.node_id}`),
          unresolved: candidates.filter((c) => !c.decision.status).length,
          // 2世代目以降に採用された候補。1回目に見送った修正が、新しいIDで当たったことを見る。
          acceptedAfterFirstGeneration: decisions
            .filter((d) => d.status === "accepted" && d.generation > 1)
            .map((d) => d.candidate_id),
        };
      });
      check(
        "次の世代で作り直された候補が新しい candidate_id で採用される",
        sequenceState.acceptedAfterFirstGeneration.length > 0 &&
          sequenceState.acceptedAfterFirstGeneration.every(
            (id) => !screenInside.some((c) => c.id === id)
          ),
        JSON.stringify(sequenceState)
      );
      check(
        "次の世代で作り直された候補を採用でき、範囲の中の修正が最終HTMLに残る",
        /令和5年度/.test(sequenceFinal) &&
          !/令和５年度/.test(sequenceFinal) &&
          !/<u[\s>]/i.test(sequenceFinal) &&
          sequenceState.orphaned.length === 0,
        `${sequenceFinal.replace(/\s+/g, " ").slice(0, 300)}\n       ${JSON.stringify(sequenceState)}`
      );
    }

    // 20-k. 同じ置換前文字列が同じ要素に2回以上あるとき、1件採用しても残りの出現が消えない(3.6)。
    //     replace-text は要素の中の最初の一致だけを直すので、採用後も2つ目の「22m」は残る。
    //     再導出はこれを同じ指紋の候補として出すが、決定済みプールに消費されると一覧から
    //     消えてしまう。当て終わった文字の置換は fresh を消費しない、という規則で救う。
    const REPEATED_REPLACEMENT = `<p>長さ22m、幅22mです。</p>`;
    await analyzeOnScreen(REPEATED_REPLACEMENT);
    const repeatedBefore = await candidateSnapshot();
    const repeatedFirst = repeatedBefore.find((c) => c.rule_id === "text.unit-notation");
    check(
      "同じ置換前文字列が2回出る入力で、生成時の候補は1件にまとまる",
      Boolean(repeatedFirst) &&
        repeatedBefore.filter((c) => c.rule_id === "text.unit-notation").length === 1,
      JSON.stringify(repeatedBefore)
    );
    if (repeatedFirst) {
      await acceptCandidateById(repeatedFirst.id);
      const repeatedAfter = await candidateSnapshot();
      const returned = repeatedAfter.filter((c) => !c.status && c.rule_id === "text.unit-notation");
      check(
        "1件採用したあと、残りの出現が新しい candidate_id で未処理として出る",
        returned.length === 1 &&
          returned[0].id !== repeatedFirst.id &&
          returned[0].node_id === repeatedFirst.node_id &&
          repeatedAfter.some((c) => c.id === repeatedFirst.id && c.status === "accepted"),
        JSON.stringify(repeatedAfter)
      );
      if (returned.length === 1) {
        await acceptCandidateById(returned[0].id);
        const repeatedFinal = await readFinalHtml();
        check(
          "2件目も採用すると、両方の出現が言い換えられる",
          /長さ22メートル、幅22メートル/.test(repeatedFinal) && !/22m/.test(repeatedFinal),
          repeatedFinal
        );
      }
    }

    // 20-k-2. 却下した候補は再導出でよみがえらない(既存の規則)。上と同じ入力で確かめる。
    await analyzeOnScreen(REPEATED_REPLACEMENT);
    const rejectTarget = (await candidateSnapshot()).find((c) => c.rule_id === "text.unit-notation");
    if (rejectTarget) {
      await page.evaluate((id) => {
        const button = [...document.querySelectorAll(".candidate-item")].find((b) =>
          (b.getAttribute("aria-label") || "").includes(id)
        );
        button?.click();
      }, rejectTarget.id);
      await page.waitForTimeout(400);
      await page.click("#rejectButton");
      await page.waitForTimeout(800);
      const afterRejectSnapshot = await candidateSnapshot();
      check(
        "却下した文字の置換は再導出でよみがえらない",
        afterRejectSnapshot.some((c) => c.id === rejectTarget.id && c.status === "rejected") &&
          !afterRejectSnapshot.some((c) => !c.status && c.rule_id === "text.unit-notation"),
        JSON.stringify(afterRejectSnapshot)
      );
    }

    // 20-l. merge-following-note が消す側の段落(note_node_id)とその子孫も、差し替えの範囲に
    //     入れる(3.8)。入れないと、統合の決定が消した段落の中の候補が同じ世代に採用され、
    //     対象を失う(orphaned)。画面では次の世代の候補で直せるが、GOAL1 の単一パスでは
    //     全角が残ったまま「採用済み」の記録だけが残る。
    const NOTE_RANGE = `<p>申請（※）が必要です。</p><p>※<span>令和５年度</span>の書類</p>`;
    await analyzeOnScreen(NOTE_RANGE);
    const noteBefore = await candidateSnapshot();
    const mergeCandidate = noteBefore.find((c) => c.patch_type === "merge-following-note");
    const insideNote = noteBefore.find(
      (c) => c.rule_id === "text.alphanumeric" && c.id !== mergeCandidate?.id
    );
    check(
      "統合の候補と、消される段落の中の候補が同じ世代に並ぶ入力である",
      Boolean(mergeCandidate) && Boolean(insideNote),
      JSON.stringify(noteBefore)
    );
    if (mergeCandidate && insideNote) {
      await bulkAcceptAll();
      const noteAfterFirst = await page.evaluate(() => {
        const { decisions, candidates } = window.goal2Engine.decisionLog.screenState();
        return {
          decisions: decisions.map((d) => ({ id: d.candidate_id, st: d.status, orphaned: d.orphaned })),
          candidates: candidates.map((c) => ({ id: c.candidate_id, rule: c.rule_id, st: c.decision.status })),
        };
      });
      const insideDecision = noteAfterFirst.decisions.find((d) => d.id === insideNote.id);
      check(
        "1回目の一括採用で、消される段落の中の候補は採用されない",
        noteAfterFirst.decisions.some((d) => d.id === mergeCandidate.id && d.st === "accepted") &&
          (!insideDecision || insideDecision.st === "withdrawn") &&
          !noteAfterFirst.decisions.some((d) => d.orphaned),
        JSON.stringify(noteAfterFirst)
      );
      const returnedInside = noteAfterFirst.candidates.filter(
        (c) => !c.st && c.rule === "text.alphanumeric"
      );
      check(
        "同じ修正が、統合後の要素に対する新しい candidate_id の候補として出直す",
        returnedInside.length === 1 && returnedInside[0].id !== insideNote.id,
        JSON.stringify(noteAfterFirst.candidates)
      );
      await bulkAcceptAll();
      const noteFinal = await readFinalHtml();
      check(
        "2回目の一括採用で、統合後の半角化が最終HTMLに残る",
        /令和5年度/.test(noteFinal) && !/令和５年度/.test(noteFinal) && /申請（令和5年度の書類）/.test(noteFinal),
        noteFinal
      );
    }

    // 20-m. 範囲の規則が候補配列の並び順に依存しないこと(3.8)。1世代分の採用計画を、候補配列の
    //     並びと、その逆順の両方で作り、同じ結果になることを確かめる。3つの形で見る。
    //       (a) 同じ要素に、要素を残す修正と固定HTMLの差し替えが並ぶ
    //       (b) 差し替えが消す段落の中(祖先からの包含)に修正がある
    //       (c) replace-paragraph-sequence がまとめる複数の段落の中に修正がある
    //     1段で回していたときは (a) で、内容修正が先に並ぶため両方採用してしまい、差し替えの
    //     固定の変換後HTMLが先の修正を上書きしていた。
    const GUARD_ORDER_CASES = [
      ["同じ要素", `<p>令和５年度の申請（※）が必要です。</p><p>※書類を添付</p>`, "text.note-symbol", "text.alphanumeric"],
      ["祖先からの包含", `<p>申請（※）が必要です。</p><p>※<span>令和５年度</span>の書類</p>`, "text.note-symbol", "text.alphanumeric"],
      ["まとめて差し替える段落", `<p>１．申請書</p><p>２．令和５年度の<u>本人確認書類</u></p><p>３．印鑑</p>`, "text.list", "text.alphanumeric"],
    ];
    const guardOrder = await page.evaluate(async (cases) => {
      const out = [];
      for (const [label, html, claimerRule, insideRule] of cases) {
        const res = await window.goal2Engine.analyze({ html });
        const forward = window.goal2Engine.decisionLog.planGeneration(res.candidates);
        const backward = window.goal2Engine.decisionLog.planGeneration(res.candidates.slice().reverse());
        const claimer = res.candidates.filter((c) => c.rule_id === claimerRule);
        const inside = res.candidates.filter((c) => c.rule_id === insideRule);
        out.push({
          label,
          forward: forward.slice().sort(),
          backward: backward.slice().sort(),
          claimer: claimer.map((c) => c.candidate_id),
          inside: inside.map((c) => c.candidate_id),
          total: res.candidates.length,
        });
      }
      return out;
    }, GUARD_ORDER_CASES);
    guardOrder.forEach((row) => {
      check(
        `1世代の採用計画が候補配列の並び順に依存しない(${row.label})`,
        JSON.stringify(row.forward) === JSON.stringify(row.backward),
        JSON.stringify(row)
      );
      // 範囲を主張した候補は採用され、その範囲の中の候補は(要素を残すパッチでも、別の
      // 差し替えでも)次の世代へ回る。「まとめて差し替える段落」では、範囲の中にある
      // text.decoration-lines の解除も同じ理由で次の世代へ回る。
      check(
        `差し替えは採用され、範囲の中の修正は次の世代へ回る(${row.label})`,
        row.claimer.length > 0 &&
          row.claimer.every((id) => row.forward.includes(id)) &&
          row.inside.length > 0 &&
          row.inside.every((id) => !row.forward.includes(id)),
        JSON.stringify(row)
      );
    });

    // 20-m-2. (a) の形を画面の経路で通す。1回目の一括採用で統合だけが当たり、半角化は次の
    //     世代の候補として残る。2回目で両方が最終HTMLに入る。
    const MERGE_SAME_NODE = `<p>令和５年度の申請（※）が必要です。</p><p>※書類を添付</p>`;
    await analyzeOnScreen(MERGE_SAME_NODE);
    const mergeSameBefore = await candidateSnapshot();
    const mergeSameFix = mergeSameBefore.find((c) => c.rule_id === "text.alphanumeric");
    const mergeSameMerge = mergeSameBefore.find((c) => c.patch_type === "merge-following-note");
    check(
      "同じ要素に内容修正と統合の候補が並び、内容修正が先に並ぶ入力である",
      Boolean(mergeSameFix) &&
        Boolean(mergeSameMerge) &&
        mergeSameFix.node_id === mergeSameMerge.node_id &&
        mergeSameBefore.indexOf(mergeSameFix) < mergeSameBefore.indexOf(mergeSameMerge),
      JSON.stringify(mergeSameBefore)
    );
    if (mergeSameFix && mergeSameMerge) {
      await bulkAcceptAll();
      const mergeSameAfter = await candidateSnapshot();
      check(
        "1回目の一括採用で統合だけが当たり、半角化は未処理のまま残る",
        mergeSameAfter.some((c) => c.id === mergeSameMerge.id && c.status === "accepted") &&
          mergeSameAfter.some((c) => c.rule_id === "text.alphanumeric" && !c.status),
        JSON.stringify(mergeSameAfter)
      );
      await bulkAcceptAll();
      const mergeSameFinal = await readFinalHtml();
      check(
        "2回目の一括採用で、統合と半角化の両方が最終HTMLに入る",
        /令和5年度の申請（書類を添付）/.test(mergeSameFinal) && !/令和５年度/.test(mergeSameFinal),
        mergeSameFinal
      );
    }

    // 20-j. conflicted を新しく作る経路が無いこと(3.8・3.14)。値は過去の証跡CSVとの互換のため
    //     残すが、S3以降は誰も書き込まない。ソースを読んで代入の形が無いことを確かめる。
    const appSource = require("fs").readFileSync(path.join(rootDir, "public/app.js"), "utf8");
    const conflictedAssignments = appSource
      .split("\n")
      .map((line, index) => ({ line: line.trim(), no: index + 1 }))
      .filter(
        (row) =>
          /conflicted/.test(row.line) &&
          !row.line.startsWith("//") &&
          /(status\s*[:=]\s*"conflicted"|=\s*"conflicted")/.test(row.line)
      );
    check(
      "conflicted を新しく作る経路がソースに無い",
      conflictedAssignments.length === 0,
      JSON.stringify(conflictedAssignments)
    );

    // 20-i. sg04015(3.13 で S3 送りになった1件)。replace-paragraph-sequence の固定の変換後HTMLが、
    //     同じ範囲に先に当たった修正を元のHTMLで上書きしていた。S3 では再導出で変換後HTMLが
    //     作業中HTMLから作り直されるので、先に採用した半角化が残る。
    const sg04015Html = require("../../agents-cli/datasets/saga-a11y-eval.json").find((entry) =>
      String(entry.id).includes("sg04015")
    )?.input?.old_html;
    check("sg04015 の入力HTMLをデータセットから取れる", Boolean(sg04015Html), "見つからない");
    if (sg04015Html) {
      await analyzeOnScreen(sg04015Html);
      // sg04015 の text.list は requires_human_review が false なので、「確認不要をまとめて採用」に
      // 含まれる。差し替えの範囲にある候補は1回目では採用されず未処理で残るので、作業者が
      // もう一度押す。押すたびに再導出が走り、作り直された候補が採用される。
      let bulkRounds = 0;
      for (; bulkRounds < 6; bulkRounds += 1) {
        if ((await page.getAttribute("#bulkAcceptReviewFreeButton", "disabled")) !== null) break;
        await page.click("#bulkAcceptReviewFreeButton");
        await page.waitForTimeout(1200);
      }
      const listAccepted = await page.evaluate(() =>
        window.goal2Engine.decisionLog
          .screenState()
          .decisions.filter((d) => d.status === "accepted" && d.rule_id === "text.list")
      );
      const sg04015Final = await readFinalHtml();
      const sg04015Orphaned = await page.evaluate(() =>
        window.goal2Engine.decisionLog
          .screenState()
          .decisions.filter((d) => d.orphaned)
          .map((d) => `${d.rule_id}/${d.node_id}`)
      );
      check(
        "sg04015: 箇条書き化を採用しても、半角化(令和5年度)が残る",
        listAccepted.length > 0 && /令和5年度/.test(sg04015Final) && !/令和５年度/.test(sg04015Final),
        `採用した text.list=${listAccepted.length}件 一括採用${bulkRounds}回 orphaned=${JSON.stringify(sg04015Orphaned)}\n       ${
          (sg04015Final.match(/.{0,40}令和.{0,20}/g) || []).slice(0, 6).join(" / ")
        }`
      );
    }

    // ======================================================================
    // 21. S4: 画面と証跡(設計書 3.10・3.11)
    // ======================================================================

    // 証跡JSON(出力欄)を読む。
    const readEvidenceJson = async () => {
      await page.evaluate(() => {
        document.querySelector(".output-drawer").open = true;
      });
      await page.waitForTimeout(200);
      return JSON.parse(await page.inputValue("#evidenceOutput"));
    };

    // 「CSV」ボタンが作る証跡CSVを、ダウンロードさせずに取り出す。
    const readEvidenceCsv = () =>
      page.evaluate(async () => {
        const originalCreate = URL.createObjectURL;
        const originalRevoke = URL.revokeObjectURL;
        const originalClick = HTMLAnchorElement.prototype.click;
        let captured = null;
        URL.createObjectURL = (blob) => {
          captured = blob;
          return "blob:captured";
        };
        URL.revokeObjectURL = () => {};
        HTMLAnchorElement.prototype.click = function () {};
        try {
          document.getElementById("downloadCsvButton").click();
        } finally {
          URL.createObjectURL = originalCreate;
          URL.revokeObjectURL = originalRevoke;
          HTMLAnchorElement.prototype.click = originalClick;
        }
        return captured ? captured.text() : "";
      });

    // すべてのセルを "" で囲む csvCell() の出力を読む。セルの中の改行と "" に対応する。
    const parseCsv = (text) => {
      const rows = [];
      let row = [];
      let cell = "";
      let quoted = false;
      for (let i = 0; i < text.length; i += 1) {
        const ch = text[i];
        if (quoted) {
          if (ch === '"' && text[i + 1] === '"') {
            cell += '"';
            i += 1;
          } else if (ch === '"') {
            quoted = false;
          } else {
            cell += ch;
          }
        } else if (ch === '"') {
          quoted = true;
        } else if (ch === ",") {
          row.push(cell);
          cell = "";
        } else if (ch === "\n") {
          row.push(cell);
          rows.push(row);
          row = [];
          cell = "";
        } else if (ch !== "\r") {
          cell += ch;
        }
      }
      if (cell || row.length) {
        row.push(cell);
        rows.push(row);
      }
      return rows;
    };

    // main(S3)の証跡CSVの23列。S4 はこの後ろに5列を足すだけで、名前も順序も変えない。
    const MAIN_EVIDENCE_CSV_COLUMNS = [
      "page_session_id",
      "candidate_id",
      "rule_id",
      "category",
      "processing_class",
      "status",
      "confidence",
      "requires_human_review",
      "patch_mode",
      "ai_image_name",
      "ai_image_name_inserted",
      "ai_image_name_source",
      "decision_reason",
      "actor",
      "decided_at",
      "before_html",
      "after_html",
      "related_wcag",
      "related_jis",
      "kb_source",
      "miChecker_status",
      "miChecker_classification",
      "unresolved_reason",
    ];
    const S4_EVIDENCE_CSV_COLUMNS = ["generation", "decision_seq", "withdrawn_by_seq", "orphaned", "orphaned_kind"];

    // 21-a. 取り下げた候補を証跡に戻す(3.11)。装飾タグの解除で <tt> の中の候補が取り下げられる。
    //     証跡の JSON と CSV に withdrawn の行が出て、withdrawn_by_seq は原因の決定の行の
    //     decision_seq と一致する。before_html は写しから取るので空でない。
    await analyzeOnScreen(MULTI_FIX_PARAGRAPH + `<p>受付は令和５年度から始まります。</p>`);
    const s4Before = await candidateSnapshot();
    const s4Unwrap = s4Before.find((c) => c.patch_type === "unwrap-element");
    const s4Inherited = s4Before.find((c) => c.rule_id === "text.alphanumeric");
    const s4Inside = s4Before.filter((c) => c.patch_type === "replace-text" && c.node_id === s4Unwrap?.node_id);
    check(
      "S4の検査用に、解除の候補・中の文字の候補・別の段落の候補が出る",
      Boolean(s4Unwrap) && Boolean(s4Inherited) && s4Inside.length > 0,
      JSON.stringify(s4Before)
    );
    if (s4Unwrap && s4Inherited && s4Inside.length) {
      await acceptCandidateById(s4Unwrap.id);
      const s4After = await candidateSnapshot();
      const evidence = await readEvidenceJson();
      const rowsById = new Map(evidence.candidates.map((row) => [row.candidate_id, row]));
      const withdrawnRows = evidence.candidates.filter((row) => row.status === "withdrawn");
      const causeRow = rowsById.get(s4Unwrap.id);
      check(
        "取り下げた候補が証跡JSONに withdrawn の行として出る",
        s4Inside.every((c) => rowsById.get(c.id)?.status === "withdrawn") && withdrawnRows.length === s4Inside.length,
        JSON.stringify(evidence.candidates.map((row) => [row.candidate_id, row.status]))
      );
      check(
        "withdrawn_by_seq は原因の決定の行の decision_seq と一致する",
        Boolean(causeRow) &&
          causeRow.status === "accepted" &&
          Number.isInteger(causeRow.decision_seq) &&
          withdrawnRows.every((row) => row.withdrawn_by_seq === causeRow.decision_seq),
        JSON.stringify({ cause: causeRow && causeRow.decision_seq, withdrawn: withdrawnRows.map((r) => r.withdrawn_by_seq) })
      );
      check(
        "取り下げの行は before_html・理由・担当・日時を持ち、decision_seq は取り下げの seq",
        withdrawnRows.every(
          (row) =>
            typeof row.before_html === "string" &&
            row.before_html.length > 0 &&
            row.actor === "AGENT" &&
            Boolean(row.decision_reason) &&
            Boolean(row.decided_at) &&
            evidence.decision_log.some(
              (entry) => entry.seq === row.decision_seq && entry.status === "withdrawn" && entry.candidate_id === row.candidate_id
            )
        ),
        JSON.stringify(withdrawnRows.map((r) => [r.candidate_id, r.before_html?.slice(0, 20), r.actor, r.decision_seq]))
      );
      check(
        "取り下げの行は現在の一覧の後ろに seq 順で並ぶ",
        (() => {
          const statuses = evidence.candidates.map((row) => row.status);
          const firstWithdrawn = statuses.indexOf("withdrawn");
          const seqs = withdrawnRows.map((row) => row.decision_seq);
          return (
            firstWithdrawn === evidence.candidates.length - withdrawnRows.length &&
            seqs.every((seq, index) => index === 0 || seqs[index - 1] < seq)
          );
        })(),
        JSON.stringify(evidence.candidates.map((row) => [row.candidate_id, row.status, row.decision_seq]))
      );
      check(
        "completion の total・unresolved は現在の一覧だけを数え、withdrawn に件数が出る",
        evidence.completion.total === s4After.length &&
          evidence.completion.unresolved === s4After.filter((c) => !c.status).length &&
          evidence.completion.withdrawn === withdrawnRows.length,
        JSON.stringify(evidence.completion)
      );
      check(
        "決定済みの候補は現在の一覧に残るので、証跡にも決定済みとして出る(3.11 のログ上の決定済み)",
        causeRow?.status === "accepted" && causeRow.orphaned === false && causeRow.orphaned_kind === null,
        JSON.stringify(causeRow)
      );
      check(
        "未処理の行は decision_seq・withdrawn_by_seq・orphaned・orphaned_kind が null",
        evidence.candidates
          .filter((row) => row.status === "unresolved")
          .every(
            (row) =>
              row.decision_seq === null &&
              row.withdrawn_by_seq === null &&
              row.orphaned === null &&
              row.orphaned_kind === null
          ),
        JSON.stringify(evidence.candidates.filter((row) => row.status === "unresolved"))
      );

      // CSV: 先頭23列が main と同じ名前・順序で、その後ろに新しい5列。取り下げの行も出る。
      const csvRows = parseCsv(await readEvidenceCsv());
      const header = csvRows[0] || [];
      check(
        "証跡CSVの先頭23列は main と同じ名前・順序で、その後ろに新しい5列が並ぶ",
        JSON.stringify(header.slice(0, 23)) === JSON.stringify(MAIN_EVIDENCE_CSV_COLUMNS) &&
          JSON.stringify(header.slice(23)) === JSON.stringify(S4_EVIDENCE_CSV_COLUMNS),
        JSON.stringify(header)
      );
      const column = (name) => header.indexOf(name);
      const csvWithdrawn = csvRows.slice(1).filter((row) => row[column("status")] === "withdrawn");
      const csvCause = csvRows.slice(1).find((row) => row[column("candidate_id")] === s4Unwrap.id);
      check(
        "証跡CSVにも withdrawn の行が出て、withdrawn_by_seq が原因の行の decision_seq と一致する",
        csvWithdrawn.length === withdrawnRows.length &&
          Boolean(csvCause) &&
          csvWithdrawn.every(
            (row) =>
              row[column("withdrawn_by_seq")] === csvCause[column("decision_seq")] &&
              row[column("before_html")].length > 0
          ),
        JSON.stringify({ withdrawn: csvWithdrawn.map((r) => r.slice(23)), cause: csvCause && csvCause.slice(23) })
      );
      check(
        "新しい列の真偽値と空は既存の列と同じ書き方(true/false、null は空)",
        csvCause?.[column("orphaned")] === "false" &&
          csvCause?.[column("orphaned_kind")] === "" &&
          csvWithdrawn.every((row) => row[column("orphaned")] === "" && row[column("generation")] === "0") &&
          ["true", "false"].includes(csvCause?.[column("requires_human_review")]),
        JSON.stringify(csvCause)
      );

      // 21-b. 「再確認」バッジ(3.10)。再導出で生まれた未処理の候補に付き、前の候補から
      //     引き継いだ候補(別の段落の半角化、generation 0)と決定済みの候補には付かない。
      const rowLabels = await page.$$eval(".candidate-item", (buttons) =>
        buttons.map((b) => ({
          label: b.getAttribute("aria-label") || "",
          badge: Boolean(b.querySelector(".candidate-recheck-badge")),
        }))
      );
      const labelOf = (id) => rowLabels.find((row) => row.label.includes(id));
      const reborn = s4After.filter((c) => !c.status && !s4Before.some((row) => row.id === c.id));
      check(
        "新しい世代の未処理候補に「再確認」のバッジが付き、aria-label にも入る",
        reborn.length > 0 &&
          reborn.every((c) => labelOf(c.id)?.badge && /、再確認/.test(labelOf(c.id)?.label || "")),
        JSON.stringify({ reborn: reborn.map((c) => c.id), rowLabels })
      );
      check(
        "前の候補から引き継いだ候補と決定済みの候補には「再確認」が付かない",
        labelOf(s4Inherited.id) &&
          !labelOf(s4Inherited.id).badge &&
          !/再確認/.test(labelOf(s4Inherited.id).label) &&
          labelOf(s4Unwrap.id) &&
          !labelOf(s4Unwrap.id).badge,
        JSON.stringify(rowLabels)
      );
      if (reborn.length) {
        await acceptCandidateById(reborn[0].id);
        const rebornBadge = await page.evaluate((id) => {
          const button = [...document.querySelectorAll(".candidate-item")].find((b) =>
            (b.getAttribute("aria-label") || "").includes(id)
          );
          return button ? { badge: Boolean(button.querySelector(".candidate-recheck-badge")), label: button.getAttribute("aria-label") } : null;
        }, reborn[0].id);
        check(
          "再導出で生まれた候補も、決定すると「再確認」が外れる",
          Boolean(rebornBadge) && !rebornBadge.badge && !/再確認/.test(rebornBadge.label),
          JSON.stringify(rebornBadge)
        );
      }

      // 21-c. 取り下げた候補の折りたたみ(3.10)。件数と各行が出て、中から候補を選べない。
      const withdrawnPanel = await page.evaluate(() => {
        const host = document.getElementById("withdrawnCandidates");
        const details = host?.querySelector("details");
        return {
          hidden: host ? host.hidden : true,
          summary: details?.querySelector("summary")?.textContent || "",
          items: [...(host?.querySelectorAll(".withdrawn-item") || [])].map((item) => ({
            id: item.dataset.candidateId,
            title: item.querySelector(".withdrawn-title")?.textContent || "",
            cause: item.querySelector(".withdrawn-cause")?.textContent || "",
          })),
          controls: host ? host.querySelectorAll("button, input, select, textarea, [role=button], [tabindex]").length : -1,
        };
      });
      check(
        "取り下げた候補の折りたたみに「取り下げた候補 N件」と各行が出る",
        !withdrawnPanel.hidden &&
          withdrawnPanel.summary === `取り下げた候補 ${withdrawnRows.length}件` &&
          withdrawnPanel.items.length === withdrawnRows.length &&
          withdrawnPanel.items.every((item) => item.title && withdrawnRows.some((row) => row.candidate_id === item.id)),
        JSON.stringify(withdrawnPanel)
      );
      check(
        "取り下げの原因は、原因の決定の候補名と決定の種類で示す",
        withdrawnPanel.items.every((item) => /^「.+」の採用の後$/.test(item.cause) && item.cause.includes("下線")),
        JSON.stringify(withdrawnPanel.items)
      );
      const selectedBefore = await page.evaluate(() => document.querySelector('.candidate-item[aria-selected="true"]')?.getAttribute("aria-label") || null);
      await page.evaluate(() => {
        const details = document.querySelector("#withdrawnCandidates details");
        if (details) details.open = true;
        document.querySelector("#withdrawnCandidates .withdrawn-item")?.click();
      });
      await page.waitForTimeout(300);
      const selectedAfter = await page.evaluate(() => document.querySelector('.candidate-item[aria-selected="true"]')?.getAttribute("aria-label") || null);
      check(
        "折りたたみの中の候補は選択も決定もできない(操作できる要素が無く、押しても選択が変わらない)",
        withdrawnPanel.controls === 0 && selectedBefore === selectedAfter,
        JSON.stringify({ controls: withdrawnPanel.controls, selectedBefore, selectedAfter })
      );
    }

    // 21-d. 一括採用が原因の取り下げは「一括採用 N件の後」と示す。注記の統合(merge-following-note)が
    //     消す段落の中の半角化は、範囲の規則(3.8)で1回目には採用されず、統合で対象が消えて
    //     取り下げになる。同じ一括採用で別の段落の半角化も採用されるので、その世代の決定は2件ある。
    await analyzeOnScreen(`<p>申請（※）が必要です。</p><p>※<span>令和５年度</span>の書類</p><p>受付は令和５年度から始まります。</p>`);
    await bulkAcceptAll();
    const bulkWithdrawn = await page.evaluate(() => {
      const { decisions } = window.goal2Engine.decisionLog.screenState();
      const withdrawn = decisions.filter((d) => d.status === "withdrawn");
      const cause = decisions.find((d) => d.seq === withdrawn[0]?.withdrawn_by_seq);
      const sameGeneration = cause
        ? decisions.filter((d) => d.generation === cause.generation && d.status !== "withdrawn").length
        : 0;
      return {
        withdrawn: withdrawn.length,
        sameGeneration,
        causes: [...document.querySelectorAll("#withdrawnCandidates .withdrawn-cause")].map((e) => e.textContent),
      };
    });
    check(
      "一括採用が原因の取り下げは「一括採用 N件の後」と示す",
      bulkWithdrawn.withdrawn > 0 &&
        bulkWithdrawn.sameGeneration >= 2 &&
        bulkWithdrawn.causes.length === bulkWithdrawn.withdrawn &&
        bulkWithdrawn.causes.every((text) => text === `一括採用 ${bulkWithdrawn.sameGeneration}件の後`),
      JSON.stringify(bulkWithdrawn)
    );

    // 21-e. 決め直し。採用→却下と決め直した候補の行は decision_seq が却下の seq になり、
    //     decision_log には両方の行がある。構造候補の中の内容修正を採用してから構造候補を却下すると、
    //     内容修正の決定は対象(派生ID)を失って orphaned になるが、分類は target-replaced で、
    //     同じ内容修正が元の表の要素への未処理候補として出直す。
    const S4_TABLE = `<h2>利用案内</h2><table border="1"><tbody>
      <tr><th>区分</th><td>金額</td></tr>
      <tr><th>一般</th><td>５００円</td></tr>
      <tr><th>学生</th><td>300円</td></tr>
    </tbody></table>`;
    await analyzeOnScreen(S4_TABLE);
    const tableBefore = await candidateSnapshot();
    const tableStructural = tableBefore.find((c) => c.builder === "dataTableSemantics");
    const tableFixBefore = tableBefore.find((c) => c.rule_id === "text.alphanumeric");
    if (tableStructural && tableFixBefore) {
      await acceptCandidateById(tableStructural.id);
      const tableMid = await candidateSnapshot();
      const derivedFix = tableMid.find((c) => c.rule_id === "text.alphanumeric" && !c.status);
      check(
        "構造候補の採用後、表の中の内容修正が派生IDの対象に作り直される",
        Boolean(derivedFix) && /\.s\d+\./.test(derivedFix.node_id),
        JSON.stringify(tableMid)
      );
      if (derivedFix) {
        await acceptCandidateById(derivedFix.id);
        await page.evaluate((id) => {
          const button = [...document.querySelectorAll(".candidate-item")].find((b) =>
            (b.getAttribute("aria-label") || "").includes(id)
          );
          button?.click();
        }, tableStructural.id);
        await page.waitForTimeout(500);
        await page.click("#rejectButton");
        await page.waitForTimeout(900);
        const tableAfter = await candidateSnapshot();
        const evidence = await readEvidenceJson();
        const structuralRow = evidence.candidates.find((row) => row.candidate_id === tableStructural.id);
        const structuralLog = evidence.decision_log.filter((entry) => entry.candidate_id === tableStructural.id);
        const rejectEntry = structuralLog.find((entry) => entry.status === "rejected");
        check(
          "採用→却下と決め直した候補の行は、decision_seq が却下の seq になる",
          structuralRow?.status === "rejected" && Boolean(rejectEntry) && structuralRow.decision_seq === rejectEntry.seq,
          JSON.stringify({ structuralRow, structuralLog })
        );
        check(
          "decision_log には決め直した候補の採用と却下の両方の行がある",
          structuralLog.length === 2 &&
            structuralLog[0].status === "accepted" &&
            structuralLog[1].status === "rejected" &&
            structuralLog[0].seq < structuralLog[1].seq &&
            structuralLog.every((entry) => !("op" in entry) && !("after_html" in entry)),
          JSON.stringify(structuralLog)
        );
        const fixRow = evidence.candidates.find((row) => row.candidate_id === derivedFix.id);
        check(
          "構造候補を決め直したために対象を失った内容修正は orphaned_kind が target-replaced",
          fixRow?.status === "accepted" && fixRow.orphaned === true && fixRow.orphaned_kind === "target-replaced",
          JSON.stringify(fixRow)
        );
        const reissued = tableAfter.filter(
          (c) => c.rule_id === "text.alphanumeric" && !c.status && c.node_id === tableFixBefore.node_id
        );
        check(
          "同じ内容修正が、元に戻った表の要素への未処理候補として出直す",
          reissued.length === 1 && reissued[0].id !== tableFixBefore.id && reissued[0].id !== derivedFix.id,
          JSON.stringify(tableAfter)
        );
        const tableView = await page.evaluate((id) => {
          const button = [...document.querySelectorAll(".candidate-item")].find((b) =>
            (b.getAttribute("aria-label") || "").includes(id)
          );
          button?.click();
          return {
            lostBadges: document.querySelectorAll(".candidate-lost-badge").length,
            summary: document.getElementById("candidateSummary").textContent,
          };
        }, derivedFix.id);
        await page.waitForTimeout(400);
        const tableMeta = await page.textContent("#candidateMeta");
        check(
          "target-replaced は「未反映」のバッジを付けず、詳細欄で修正が失われていないと説明する",
          tableView.lostBadges === 0 &&
            !/未反映/.test(tableView.summary) &&
            /作り直されました/.test(tableMeta) &&
            /失われておらず/.test(tableMeta),
          JSON.stringify({ tableView, tableMeta: tableMeta.replace(/\s+/g, " ").slice(0, 400) })
        );
      }
    } else {
      check("決め直しの検査に使う構造候補と内容修正が出る", false, JSON.stringify(tableBefore));
    }

    // 21-f. orphaned_kind の3分類を、決定ログの窓口で1件ずつ作る。
    const orphanKinds = await page.evaluate(() => {
      const engine = window.goal2Engine.decisionLog;
      const source = `<p>受付は令和５年度から始まります。</p>`;
      const base = (seq, extra) => ({
        seq,
        generation: seq,
        candidate_id: `cand_t${seq}`,
        rule_id: "test.rule",
        status: "accepted",
        after_html: null,
        withdrawn_by_seq: null,
        orphaned: false,
        ...extra,
      });
      const run = (decisions, candidates = {}) => {
        engine.replay(source, decisions);
        return decisions.map((d) => ({
          seq: d.seq,
          orphaned: Boolean(d.orphaned),
          kind: engine.orphanedKind(d, decisions, candidates[d.candidate_id]),
        }));
      };
      return {
        // 通知だけの候補(patch_mode "none" → op.apply false)。対象が無くても HTML は元から変えない。
        noopApplyFalse: run([
          base(1, { node_id: "n9999", op: { type: "set-attribute", name: "lang", value: "ja", apply: false } }),
        ]),
        // 変換後HTMLが変換前と同じ候補。
        noopSameHtml: run(
          [base(1, { node_id: "n9999", op: { type: "replace-html", after_html: "<p>同じ</p>" } })],
          { cand_t1: { proposal: { patch_mode: "auto", before_html: "<p>同じ</p>", after_html: "<p>同じ</p>" } } }
        ),
        // 存在しない node_id への採用。修正は最終HTMLに入らない。
        lost: run([base(1, { node_id: "n9999", op: { type: "set-attribute", name: "lang", value: "ja" } })]),
        // 派生IDの参照先の決定はいま効いているが、それ自体が orphaned(要素が作られなかった)。
        lostDerived: run([
          base(1, { node_id: "n9998", op: { type: "replace-html", after_html: "<div><p>x</p></div>" } }),
          base(2, { node_id: "n9998.s1.1", op: { type: "set-attribute", name: "lang", value: "ja" } }),
        ]),
        // 派生IDの参照先の決定が、同じ候補の後の却下で効かなくなった。
        replaced: run([
          base(1, { candidate_id: "cand_s", node_id: "n0001", op: { type: "replace-html", after_html: "<div><p>x</p></div>" } }),
          base(2, { node_id: "n0001.s1.1", op: { type: "set-attribute", name: "lang", value: "ja" } }),
          base(3, { candidate_id: "cand_s", node_id: "n0001", status: "rejected", op: null }),
        ]),
        // 当たった決定は分類しない。
        applied: run([base(1, { node_id: "n0001", op: { type: "set-attribute", name: "lang", value: "ja" } })]),
      };
    });
    check(
      "orphaned_kind: 通知だけの候補(op.apply が false)は no-op",
      orphanKinds.noopApplyFalse[0].orphaned && orphanKinds.noopApplyFalse[0].kind === "no-op",
      JSON.stringify(orphanKinds.noopApplyFalse)
    );
    check(
      "orphaned_kind: 変換後HTMLが変換前と同じ候補は no-op",
      orphanKinds.noopSameHtml[0].orphaned && orphanKinds.noopSameHtml[0].kind === "no-op",
      JSON.stringify(orphanKinds.noopSameHtml)
    );
    check(
      "orphaned_kind: 存在しない node_id への採用は lost",
      orphanKinds.lost[0].orphaned && orphanKinds.lost[0].kind === "lost",
      JSON.stringify(orphanKinds.lost)
    );
    check(
      "orphaned_kind: 派生IDの参照先が効いていて、それ自体が orphaned なら target-replaced ではなく lost",
      orphanKinds.lostDerived[1].orphaned && orphanKinds.lostDerived[1].kind === "lost",
      JSON.stringify(orphanKinds.lostDerived)
    );
    check(
      "orphaned_kind: 派生IDの参照先の決定が決め直しで効かなくなったら target-replaced",
      orphanKinds.replaced[1].orphaned && orphanKinds.replaced[1].kind === "target-replaced",
      JSON.stringify(orphanKinds.replaced)
    );
    check(
      "orphaned_kind: 当たった決定は分類しない(null)",
      !orphanKinds.applied[0].orphaned && orphanKinds.applied[0].kind === null,
      JSON.stringify(orphanKinds.applied)
    );

    // 21-g. lost の表示。画面の決定ログの1件を「存在しない要素への採用」に書き換えて再描画し、
    //     候補の行の「最終HTMLに未反映」バッジ、要約の件数、詳細欄の説明を見る。完了判定は変えない。
    await analyzeOnScreen(`<p>受付は令和５年度から始まります。</p>`);
    const lostTarget = (await candidateSnapshot()).find((c) => c.rule_id === "text.alphanumeric");
    if (lostTarget) {
      await acceptCandidateById(lostTarget.id);
      const lostView = await page.evaluate((id) => {
        const { decisions } = window.goal2Engine.decisionLog.screenState();
        const decision = decisions.find((d) => d.candidate_id === id && d.status === "accepted");
        decision.node_id = "n9999";
        decision.orphaned = true;
        const button = [...document.querySelectorAll(".candidate-item")].find((b) =>
          (b.getAttribute("aria-label") || "").includes(id)
        );
        button.click();
        const row = [...document.querySelectorAll(".candidate-item")].find((b) =>
          (b.getAttribute("aria-label") || "").includes(id)
        );
        return {
          badge: Boolean(row?.querySelector(".candidate-lost-badge")),
          label: row?.getAttribute("aria-label") || "",
          summary: document.getElementById("candidateSummary").textContent,
          pill: document.getElementById("completionPill").textContent,
        };
      }, lostTarget.id);
      await page.waitForTimeout(300);
      const lostMeta = await page.textContent("#candidateMeta");
      const lostEvidence = await readEvidenceJson();
      const lostRow = lostEvidence.candidates.find((row) => row.candidate_id === lostTarget.id);
      check(
        "lost の決定を持つ候補の行に「最終HTMLに未反映」のバッジが付き、aria-label にも入る",
        lostView.badge && /最終HTMLに未反映/.test(lostView.label),
        JSON.stringify(lostView)
      );
      check(
        "候補一覧の上の要約に「最終HTMLに未反映 N件」が出る",
        /最終HTMLに未反映 1件/.test(lostView.summary),
        lostView.summary
      );
      check(
        "詳細欄に lost の説明が出る",
        /最終HTMLに入っていません/.test(lostMeta),
        lostMeta.replace(/\s+/g, " ").slice(0, 400)
      );
      check(
        "lost が残っていても完了判定は変えない(3.10)",
        lostView.pill === "完了可" && lostEvidence.completion.complete === true && lostRow?.orphaned_kind === "lost",
        JSON.stringify({ pill: lostView.pill, completion: lostEvidence.completion, lostRow })
      );
    } else {
      check("lost の表示の検査に使う候補が出る", false, "text.alphanumeric が出ない");
    }

    // 21-h. GOAL1(goal2Engine.buildEvidence)は決定ログを渡さないので、新しいキーは null
    //     (generation だけは候補の値)。goal1.js の CSV(13列)は変えない。
    const goal1Evidence = await page.evaluate(async (h) => {
      const engine = window.goal2Engine;
      const result = await engine.analyze({ html: h });
      engine.autoAcceptSafe(result.candidates);
      const finalHtml = engine.buildFinalHtml(h, result.candidates);
      return engine.buildEvidence(
        {
          sessionId: "goal1_test",
          pageTitle: "",
          oldUrl: "",
          generatedAt: result.generatedAt,
          ruleScopeMode: "kb",
          sourceHtml: h,
          candidates: result.candidates,
          notices: result.notices,
        },
        finalHtml
      );
    }, MULTI_FIX_PARAGRAPH + `<p>受付は令和５年度から始まります。</p>`);
    check(
      "GOAL1の証跡は、決定ログ由来の新しいキーが null で、generation は候補の値",
      goal1Evidence.candidates.length > 0 &&
        goal1Evidence.candidates.every(
          (row) =>
            row.generation === 0 &&
            row.decision_seq === null &&
            row.withdrawn_by_seq === null &&
            row.orphaned === null &&
            row.orphaned_kind === null
        ) &&
        goal1Evidence.decision_log === null &&
        goal1Evidence.completion.withdrawn === null &&
        goal1Evidence.candidates.some((row) => row.status === "accepted"),
      JSON.stringify({
        rows: goal1Evidence.candidates.map((row) => [row.status, row.generation, row.decision_seq, row.orphaned]),
        log: goal1Evidence.decision_log,
        completion: goal1Evidence.completion,
      })
    );
    const goal1Source = require("fs").readFileSync(path.join(rootDir, "public/goal1.js"), "utf8");
    const goal1Header = (/function downloadEvidenceCsv\(\)[\s\S]*?const header = \[([\s\S]*?)\];/.exec(goal1Source) || [])[1] || "";
    check(
      "goal1.js の証跡CSVの見出し(13列)は変わらない",
      JSON.stringify([...goal1Header.matchAll(/"([^"]+)"/g)].map((m) => m[1])) ===
        JSON.stringify([
          "移行管理ID",
          "ページ名",
          "URL",
          "カテゴリ",
          "candidate_id",
          "rule_id",
          "category",
          "processing_class",
          "status",
          "confidence",
          "requires_human_review",
          "decision_reason",
          "actor",
        ]),
      goal1Header
    );

  } finally {
    if (browser) await browser.close();
    server.kill();
  }

  let failed = 0;
  results.forEach((r) => {
    if (r.pass) {
      console.log(`  ok   ${r.name}`);
    } else {
      failed += 1;
      console.log(`  FAIL ${r.name}\n       ${r.detail || ""}`);
    }
  });
  console.log(`\n=== ${results.length - failed} passed, ${failed} failed ===`);
  process.exit(failed ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

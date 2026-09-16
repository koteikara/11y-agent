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

// 指摘1: h3が4つ並ぶページと、h3→h4→h3 の並び
const HEADINGS_H3_X4 = `<h3>第1章</h3><p>本文1</p><h3>第2章</h3><p>本文2</p><h3>第3章</h3><p>本文3</p><h3>第4章</h3><p>本文4</p>`;
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
    const inTableFixed = await page.evaluate(async (h) => {
      const res = await window.goal2Engine.analyze({ html: h });
      window.goal2Engine.autoAcceptSafe(res.candidates);
      return window.goal2Engine.buildFinalHtml(h, res.candidates);
    }, MULTI_FIX_IN_TABLE);
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

    const nestedOut = await page.evaluate(async (h) => {
      const res = await window.goal2Engine.analyze({ html: h });
      window.goal2Engine.autoAcceptSafe(res.candidates);
      return window.goal2Engine.buildFinalHtml(h, res.candidates);
    }, NESTED_IN_LAYOUT);

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
    const cellFixed = await page.evaluate(async (h) => {
      const res = await window.goal2Engine.analyze({ html: h });
      window.goal2Engine.autoAcceptSafe(res.candidates);
      return window.goal2Engine.buildFinalHtml(h, res.candidates);
    }, `<table border="0"><tbody><tr><td><table border="1"><tbody><tr><td>遺跡番号</td><td>541031</td></tr><tr><td>墳　丘</td><td>円墳</td></tr></tbody></table><h2>概要</h2><p>本文</p></td><td><h2>所在地</h2><p>安城市</p></td></tr></tbody></table>`);
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

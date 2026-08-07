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

async function main() {
  const server = spawn(process.execPath, [path.join(rootDir, "server.js")], {
    cwd: rootDir,
    env: { ...process.env, PORT: String(PORT) },
    stdio: "ignore",
  });

  let browser;
  try {
    await waitForHealth();
    browser = await chromium.launch();
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

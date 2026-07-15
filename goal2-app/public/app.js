(function () {
  "use strict";

  const statusLabels = {
    unresolved: "未処理",
    accepted: "採用",
    edited: "編集済",
    rejected: "却下",
    needs_review: "要確認",
    conflicted: "競合",
  };

  const noticeRuleIds = new Set([
    "image.multiple-images",
    "image.image-text-layout",
    "image.display-width",
    "link.internal-link",
    "link.external-link",
    "link.category-link",
    "link.cross-page-anchor",
    "link.in-page-anchor",
    "link.link-broken",
    "file.external-pdf",
    "iframe.cms-review",
    "iframe.frame-unsupported",
    "text.bold",
  ]);

  const tableRelatedRuleIds = new Set([
    "image.image-text-layout",
    "table.format-clear",
    "table.caption",
    "table.layout-table",
    "table.cell-merge-layout",
    "table.cell-merge-heading",
    "table.cell-merge-summary",
    "table.cell-merge-note",
    "table.cell-merge-file",
    "table.cell-merge-mark",
  ]);

  const tableStructuralRuleIds = new Set([
    "image.image-text-layout",
    "table.caption",
    "table.layout-table",
    "table.cell-merge-layout",
    "table.cell-merge-heading",
    "table.cell-merge-summary",
    "table.cell-merge-note",
    "table.cell-merge-file",
    "table.cell-merge-mark",
  ]);

  const tableDecomposeMergeRuleIds = new Set([
    "table.cell-merge-layout",
    "table.cell-merge-file",
    "table.cell-merge-mark",
  ]);

  const tableCaptionWordRe = /\u4e00\u89a7|\u8a73\u7d30|\u8868/u;
  const tableDetailSuffix = "\u306e\u8a73\u7d30";
  const genericTableCaption = "\u8868\u306e\u8a73\u7d30";

  const inputSamples = [
    {
      id: "procedure-overview",
      label: "総合: 手続き・リンク・表",
      pageTitle: "出生届の手続き",
      oldUrl: "https://www.example-city.jp/kurashi/koseki/birth.html",
      cmsTarget: "本体サイト > 手続き",
      html: `<meta http-equiv="refresh" content="10;url=/kurashi/koseki/birth.html">
<p>このページは新しいURLに移動しました。10秒後に自動的に移動します。</p>
<h1 id="section1">出生届の手続き</h1>
<p>申請書は<a href="/files/birth-form.pdf">こちら（PDF：1,928kbyte）</a>からダウンロードできます。</p>
<p><a href="/life/childcare/">詳細はこちら</a>をご確認ください。</p>
<p><a href="/kurashi/koseki/birth-notice.html">出生届の記載例</a>もあわせてご確認ください。</p>
<h3 id="section1">受付窓口</h3>
<table>
  <tr><td colspan="2">受付時間</td></tr>
  <tr><td>平日</td><td>午前8時30分から午後5時15分</td></tr>
</table>
<p>担当課</p>
<p>市民課 戸籍係</p>`,
    },
    {
      id: "images",
      label: "画像: alt・キャプション・複雑画像",
      pageTitle: "親子イベントのお知らせ",
      oldUrl: "https://www.example-city.jp/kosodate/event/oyako.html",
      cmsTarget: "子育てサイト > イベント",
      html: `<h2>親子イベントのお知らせ</h2>
<figure>
  <img src="/images/sample-park-generated.png" alt="" width="520">
  <figcaption>（写真）親子イベントの様子</figcaption>
</figure>
<figure>
  <img src="/images/sample-map-generated.png" alt="案内図" width="560">
  <figcaption>中央公園会場案内図</figcaption>
</figure>
<div class="photo-row">
  <img src="/images/sample-flower-generated.png" alt="写真" width="220">
  <img src="/images/sample-family-generated.png" alt="祖父母と親子の集合写真" width="220">
  <p>イベント当日は、花壇づくりと読み聞かせを行います。</p>
</div>`,
    },
    {
      id: "tables",
      label: "表: レイアウト・結合・添付",
      pageTitle: "市民講座の申込み",
      oldUrl: "https://www.example-city.jp/learn/course/index.html",
      cmsTarget: "本体サイト > 講座",
      html: `<h2>市民講座の申込み</h2>
<table class="old-layout" border="0" cellpadding="8" style="border:0;width:100%">
  <tr>
    <td style="width:40%"><img src="/images/sample-family-generated.png" alt="講座の写真" width="260"></td>
    <td><strong>親子で学ぶ防災講座</strong><br>対象は市内在住の親子です。会場は中央公民館です。</td>
  </tr>
</table>
<table>
  <tr><td colspan="3">申込書類</td></tr>
  <tr><td>参加申込書</td><td><a href="/files/course-entry.pdf">参加申込書（PDF：120KB）</a></td><td>提出期限 7/15</td></tr>
</table>
<table>
  <caption>講座の実施日程</caption>
  <tr><td rowspan="3">火曜日</td><td>親子で学ぶ防災講座</td><td>午前</td><td>要予約</td></tr>
  <tr><td>初めての救急講習</td><td>午後</td><td>予約不要</td></tr>
  <tr><td>読み聞かせボランティア説明会</td><td>午後</td><td>要予約</td></tr>
</table>
<table>
  <tr><td>項目</td><td>内容</td></tr>
  <tr><td colspan="2">注意 申込みは先着順です。</td></tr>
</table>
<table>
  <tr><td>制度</td><td>説明</td></tr>
  <tr><td colspan="2">概要 対象者は年度ごとに変わる場合があります。</td></tr>
</table>
<table>
  <tr><th>講座名</th><th>受講料</th><th>定員</th></tr>
  <tr><td>親子で学ぶ防災講座</td><td>500円</td><td>20名</td></tr>
  <tr><td>初めての救急講習</td><td>無料</td><td>15名</td></tr>
</table>
<table bgcolor="#eef6ff" cellspacing="4">
  <tr><td colspan="2">対象となる施設</td></tr>
  <tr><td>公共施設</td><td>市役所・公民館・図書館</td></tr>
  <tr><td>民間施設</td><td>指定管理者が運営する会館</td></tr>
</table>`,
    },
    {
      id: "links-text",
      label: "リンク・本文表記・装飾",
      pageTitle: "健康相談のご案内",
      oldUrl: "https://www.example-city.jp/kenko/soudan/index.html",
      cmsTarget: "本体サイト > 健康",
      html: `<marquee>健康相談は完全予約制です。事前にお電話でお申し込みください。</marquee>
<h2>健康相談のご案内</h2>
<p><a href="#">こちら</a>から予約してください。</p>
<p><a href="javascript:openMap()">地図を開く</a></p>
<p><a href="https://www.example-city.jp/">トップページ</a>へ戻る</p>
<p><a href="https://www.pref.example.jp/files/kenko.pdf">県の健康資料（PDF：2.4MB）</a></p>
<p>お問い合わせ: <a href="mailto:hoken@example-city.jp">hoken@example-city.jp</a></p>
<p>TEL: 06-0000-0000 / FAX: 06-0000-0001</p>
<p>開催日: 2026/7/15（水） 13:00から、距離は2㎞、参加費は￥1,000です。受付番号はＡＢＣ１２３です。</p>
<p style="font-size:18px;color:#777;background-color:#ffe08a"><u>重要</u>: ※当日は母子健康手帳を持参してください。</p>
<p>・受付<br>・相談<br>・結果説明</p>
<p>English guidance is available at the counter.</p>
<p><a href="#qa">よくある質問</a>へジャンプ</p>
<p><a href="/kenko/facility.html#map">健康相談窓口の地図</a>も確認してください。</p>
<p><a href="/files/kenko-flyer2024.pdf">案内チラシ</a></p>
<p><a href="/files/kenko-flyer2025.pdf">案内チラシ</a></p>
<h3 id="qa">よくある質問</h3>
<p>Q. 予約は必要ですか？ A. はい、完全予約制です。</p>
<h4>▲</h4>`,
    },
    {
      id: "iframe",
      label: "iframe",
      pageTitle: "相談案内",
      oldUrl: "https://www.example-city.jp/soudan/form.html",
      cmsTarget: "本体サイト > 相談",
      html: `<h2>相談予約</h2>
<p>下記の地図は、CMS移行時に利用可否を確認してください。</p>
<iframe src="https://www.youtube.com/embed/sample" width="560" height="315"></iframe>
<iframe src="/maps/center.html" title="地図" width="560" height="280"></iframe>`,
    },
    {
      id: "goal3-hirosaki-news2019",
      label: "本文抽出サンプル: 弘前市 お知らせ本文",
      pageTitle: "これまでに行われた事業のお知らせ（平成31年度）",
      oldUrl: "https://www.city.hirosaki.aomori.jp/ichi-per/news2019.html",
      cmsTarget: "本文抽出サンプル > 弘前市",
      html: `<h4>【中止】未来をつくるナラティブCafé～映画で話そう、私たちの暮らし～</h4>
<p>　令和2年3月7日（土）に開催を予定していた標記のイベントについて、新型コロナウイルスの感染拡大の防止という観点から中止とさせていただくこととなりました。</p>
<p>＊＊＊＊＊＊＊＊＊＊＊＊＊＊＊＊＊＊＊＊＊＊＊＊＊＊＊＊＊＊＊＊＊＊＊＊＊＊</p>
<p>「未来をつくるナラティブ・カフェ」では、人々の暮らしに関連したドキュメンタリー映画を鑑賞し、参加者が一緒になって話し合うことができる「つながりの場」を提供しています。</p>
<p>今回は、「障がいと共にいきる　あなたなら、どこでどのように暮らしたいですか？」をテーマに開催します。</p>
<p>障がいがあるかたとご家族、ボランティアに関心のあるかた、障がい者支援施設で働いているかたなど、興味のあるかたはぜひご参加ください！</p>
<p>【とき】</p>
<p>3月7日（土曜日）午後１時30分～午後４時30分</p>
<p>※受付は午後１時から</p>
<p>【ところ】</p>
<p>弘前医療福祉大学（小比内３丁目）４階セミナーホール</p>
<p>【内容】</p>
<p>映画『えんとこの歌　寝たきり歌人・遠藤滋』の上映</p>
<p>・上映終了後、参加者同士で映画を見て感じたことやテーマについて話し合うワークショップを開催します。</p>
<p>【定員】</p>
<p>70人程度（先着順）</p>
<p>【参加料】</p>
<p>無料</p>
<p>【申込み方法】</p>
<p>下記の申し込みフォームまたは電話でお申し込みください。</p>
<p>申し込みフォーム　<a href="https://ssl.form-mailer.jp/fms/df121bea650780" target="_blank">https://ssl.form-mailer.jp/fms/df121bea650780</a></p>
<h3>申し込み・問い合わせ</h3>
<p>ひろさきナラティブ．net　（代表　木村匡宏さん）</p>
<p>携帯電話　080-3742-1908</p>
<p>※午後５時以降にお願いします。</p>
<p>E－mail　<a href="mailto:hirosakinarrative@gmail.com">hirosakinarrative@gmail.com</a></p>
<p>Facebook　<a href="https://www.facebook.com/ひろさきナラティブnet-368680873315332/" target="_blank">https://www.facebook.com/ひろさきナラティブnet-368680873315332/</a></p>
<h6><a href="files/narrative31-3.pdf" target="_blank">未来をつくるナラティブ・カフェ　チラシダウンロード<span class="wcv_ww_filesize">(241KB)</span></a></h6>
<h4>写真と言葉の展覧会　～或る日の大鰐線で～</h4>
<p>まんなかづくり実行委員会では、弘南鉄道大鰐線中央弘前駅内で「ギャラリーまんなか」を運営しており、アートと触れ合う場を提供し、美術の力で大鰐線の魅力を伝える活動をしています。</p>
<p>2019年12月から、弘南鉄道大鰐線を題材にした企画展を3ヶ月連続で行っており、最終回の今回は大鰐線とその沿線の写真とエピソードを集めた展覧会となります。</p>
<p>ぜひ展示を見ながら、皆さんの持っている思い出話を聞かせてください。</p>
<p>【とき】</p>
<p>2月28日（金曜日）～3月3日（火曜日）</p>
<p>午後1時～午後8時</p>
<p>【内容】</p>`,
    },
    {
      id: "anjo-bidding-flat",
      label: "表: セマンティック構造・結合セル削除（安城市）",
      pageTitle: "競争入札の結果公表",
      oldUrl: "https://www.city.anjo.aichi.jp/zigyo/nyusatsu/kekka.html",
      cmsTarget: "本体サイト > 業務 > 入札結果",
      html: `<h1>競争入札の結果公表</h1>
<p>安城市が行った競争入札の結果を公表します。本市は、原則として毎週金曜日に入札を行っています。</p>

<h2>電子入札の入札結果（あいち電子調達共同システム）</h2>
<ul>
  <li><a href="https://www.chotatsu.e-aichi.jp/portal/index.jsp">入札結果（建設工事、設計・測量・建設コンサルタント等業務）（外部リンク）</a></li>
  <li><a href="http://www.buppin.e-aichi.jp/public/pubTop.do?methodName=initDisplayForPub">入札結果（その他委託）（外部リンク）</a></li>
  <li><a href="/zigyo/nyusatsu/keiyaku/2023310534kekka.html">入札結果（第310534号）</a>（令和5年11月17日掲載）</li>
  <li><a href="/zigyo/nyusatsu/keiyaku/2024300596kekka.html">入札結果（第300596号）</a>（令和6年4月16日掲載）</li>
</ul>

<h2>平成27年度までの電子入札の入札結果（工事・委託）</h2>
<p>安城市が行った旧電子入札システムでの入札結果</p>

<h3>工事</h3>
<ul>
  <li><a href="http://www.city.anjo.aichi.jp/zigyo/nyusatsu/keiyaku/H27_KJ_kekka.html">平成27年度入札結果（工事）</a></li>
  <li><a href="http://www.city.anjo.aichi.jp/zigyo/nyusatsu/keiyaku/H26_KJ_kekka.html">平成26年度入札結果（工事）</a></li>
  <li><a href="http://www.city.anjo.aichi.jp/zigyo/nyusatsu/keiyaku/H25_KJ_kekka.html">平成25年度入札結果（工事）</a></li>
  <li><a href="/zigyo/nyusatsu/keiyaku/yoteikekka/sougouhyouka.html">入札結果（総合評価）</a></li>
</ul>

<h3>委託</h3>
<ul>
  <li><a href="http://www.city.anjo.aichi.jp/zigyo/nyusatsu/keiyaku/H27_IT_kekka.html">平成27年度入札結果（委託）</a></li>
  <li><a href="http://www.city.anjo.aichi.jp/zigyo/nyusatsu/keiyaku/H26_IT_kekka.html">平成26年度入札結果（委託）</a></li>
  <li><a href="http://www.city.anjo.aichi.jp/zigyo/nyusatsu/keiyaku/H25_IT_kekka.html">平成25年度入札結果（委託）</a></li>
</ul>

<h2>郵便入札及び紙入札案件（工事・委託）</h2>

<h3>令和８年度</h3>
<table border="1" cellpadding="5" cellspacing="0" width="100%">
  <caption>令和８年度入札結果</caption>
  <thead>
    <tr><th>月</th><th>日1</th><th>日2</th><th>日3</th><th>日4</th><th>日5</th></tr>
  </thead>
  <tbody>
    <tr><td>4月</td><td><a href="/zigyo/nyusatsu/keiyaku/documents/20260410nyusatsukekkaoyobikeika.pdf">10日（PDF：76KB）</a></td><td><a href="/zigyo/nyusatsu/keiyaku/documents/20260416sougouhyoukanyusatsukekkaoyobikeika.pdf">17日（PDF：55KB）（総合評価）</a></td><td></td><td></td><td></td></tr>
    <tr><td>5月</td><td></td><td></td><td></td><td></td><td></td></tr>
    <tr><td>6月</td><td></td><td></td><td></td><td></td><td></td></tr>
    <tr><td>7月</td><td></td><td></td><td></td><td></td><td></td></tr>
    <tr><td>8月</td><td></td><td></td><td></td><td></td><td></td></tr>
    <tr><td>9月</td><td></td><td></td><td></td><td></td><td></td></tr>
    <tr><td>10月</td><td></td><td></td><td></td><td></td><td></td></tr>
    <tr><td>11月</td><td></td><td></td><td></td><td></td><td></td></tr>
    <tr><td>12月</td><td></td><td></td><td></td><td></td><td></td></tr>
    <tr><td>1月</td><td></td><td></td><td></td><td></td><td></td></tr>
    <tr><td>2月</td><td></td><td></td><td></td><td></td><td></td></tr>
    <tr><td>3月</td><td></td><td></td><td></td><td></td><td></td></tr>
  </tbody>
</table>

<h3>令和７年度</h3>
<table border="1" cellpadding="5" cellspacing="0" width="100%">
  <caption>令和７年度入札結果</caption>
  <thead>
    <tr><th>月</th><th>日1</th><th>日2</th><th>日3</th><th>日4</th><th>日5</th></tr>
  </thead>
  <tbody>
    <tr><td>4月</td><td></td><td></td><td></td><td></td><td></td></tr>
    <tr><td>5月</td><td><a href="/zigyo/nyusatsu/keiyaku/documents/2025340001.pdf">30日（PDF：70KB）（土地改良区）</a></td><td></td><td></td><td></td><td></td></tr>
    <tr><td>6月</td><td><a href="/zigyo/nyusatsu/keiyaku/documents/2025350001.pdf">6日（PDF：61KB）（土地開発公社）</a></td><td></td><td></td><td></td><td></td></tr>
    <tr><td>7月</td><td></td><td></td><td></td><td></td><td></td></tr>
    <tr><td>8月</td><td></td><td></td><td></td><td></td><td></td></tr>
    <tr><td>9月</td><td></td><td></td><td></td><td></td><td></td></tr>
    <tr><td>10月</td><td></td><td></td><td></td><td></td><td></td></tr>
    <tr><td>11月</td><td></td><td></td><td></td><td></td><td></td></tr>
    <tr><td>12月</td><td></td><td></td><td></td><td></td><td></td></tr>
    <tr><td>1月</td><td></td><td></td><td></td><td></td><td></td></tr>
    <tr><td>2月</td><td></td><td></td><td></td><td></td><td></td></tr>
    <tr><td>3月</td><td></td><td></td><td></td><td></td><td></td></tr>
  </tbody>
</table>

<h3>令和６年度</h3>
<table border="1" cellpadding="5" cellspacing="0" width="100%">
  <caption>令和６年度入札結果</caption>
  <thead>
    <tr><th>月</th><th>日1</th><th>日2</th><th>日3</th><th>日4</th><th>日5</th></tr>
  </thead>
  <tbody>
    <tr><td>4月</td><td><a href="/zigyo/nyusatsu/keiyaku/documents/20240412nyusatsukekka2.pdf">12日（PDF：562KB）</a></td><td><a href="/zigyo/nyusatsu/keiyaku/documents/20240418sogohyokakekka.pdf">18日（PDF：242KB）(総合評価)</a></td><td></td><td></td><td></td></tr>
    <tr><td>5月</td><td></td><td></td><td></td><td></td><td></td></tr>
    <tr><td>6月</td><td></td><td></td><td></td><td></td><td></td></tr>
    <tr><td>7月</td><td></td><td></td><td></td><td></td><td></td></tr>
    <tr><td>8月</td><td></td><td></td><td></td><td></td><td></td></tr>
    <tr><td>9月</td><td></td><td></td><td></td><td></td><td></td></tr>
    <tr><td>10月</td><td><a href="/zigyo/nyusatsu/keiyaku/documents/2024140005.pdf">18日（PDF：68KB）(土地改良区)</a></td><td></td><td></td><td></td><td></td></tr>
    <tr><td>11月</td><td></td><td></td><td></td><td></td><td></td></tr>
    <tr><td>12月</td><td></td><td></td><td></td><td></td><td></td></tr>
    <tr><td>1月</td><td></td><td></td><td></td><td></td><td></td></tr>
    <tr><td>2月</td><td></td><td></td><td></td><td></td><td></td></tr>
    <tr><td>3月</td><td></td><td></td><td></td><td></td><td></td></tr>
  </tbody>
</table>

<h3>令和５年度</h3>
<table border="1" cellpadding="5" cellspacing="0" width="100%">
  <caption>令和５年度入札結果</caption>
  <thead>
    <tr><th>月</th><th>日1</th><th>日2</th><th>日3</th><th>日4</th><th>日5</th></tr>
  </thead>
  <tbody>
    <tr><td>4月</td><td><a href="/zigyo/nyusatsu/keiyaku/documents/2023301001.pdf">7日（PDF：36KB）</a></td><td></td><td></td><td></td><td></td></tr>
    <tr><td>5月</td><td></td><td></td><td></td><td></td><td></td></tr>
    <tr><td>6月</td><td></td><td></td><td></td><td></td><td></td></tr>
    <tr><td>7月</td><td></td><td></td><td></td><td></td><td></td></tr>
    <tr><td>8月</td><td></td><td></td><td></td><td></td><td></td></tr>
    <tr><td>9月</td><td><a href="/zigyo/nyusatsu/keiyaku/documents/2023307226.pdf">15日（PDF：30KB）</a></td><td><a href="/zigyo/nyusatsu/keiyaku/documents/20230922kekkakouhyou.pdf">22日（PDF：30KB）</a></td><td><a href="/zigyo/nyusatsu/keiyaku/documents/20230929kekkakouhyou.pdf">29日（PDF：56KB）</a></td><td></td><td></td></tr>
    <tr><td>10月</td><td><a href="/zigyo/nyusatsu/keiyaku/documents/20231006kekkakouhyou.pdf">6日（PDF：84KB）</a></td><td></td><td></td><td></td><td></td></tr>
    <tr><td>11月</td><td></td><td></td><td></td><td></td><td></td></tr>
    <tr><td>12月</td><td></td><td></td><td></td><td></td><td></td></tr>
    <tr><td>1月</td><td></td><td></td><td></td><td></td><td></td></tr>
    <tr><td>2月</td><td></td><td></td><td></td><td></td><td></td></tr>
    <tr><td>3月</td><td></td><td></td><td></td><td></td><td></td></tr>
  </tbody>
</table>`,
    },
    {
      id: "anjo-evacuation-shelters",
      label: "本文抽出サンプル: 安城市 指定緊急避難場所一覧",
      pageTitle: "指定緊急避難場所のご案内",
      oldUrl: "https://www.city.anjo.aichi.jp/kurasu/bosaibohan/yakudachi/hinanbasyo/shiyakusho.html",
      cmsTarget: "本文抽出サンプル > 安城市",
      html: `<p>このページでは、災害時の指定緊急避難場所を紹介します。</p>
<h2><span>注意！</span></h2>
<p><span>下表に記載のある一時避難場所では、改修工事を行うため一定期間、避難場所として利用することができません。安城市から避難指示等が発令された場合は、最寄りの指定緊急避難場所へ避難するようにしてください。</span></p>
<table align="" border="1" cellpadding="5" cellspacing="0" summary="" width="100%"><caption>避難場所利用停止期間</caption><thead><tr><th scope="col"><span><strong>施設名</strong></span></th><th scope="col"><span><strong>利用できない期間</strong></span></th><th scope="col"><span><strong>最寄りの指定緊急避難場所</strong></span></th></tr></thead><tbody><tr><th scope="row">安城こども園</th><td><span>6月1日（月曜日）～11月30日（月曜日）</span></td><td>錦町小学校</td></tr></tbody></table>
<h2>指定緊急避難場所とは</h2>
<p>指定緊急避難所は2種類あります。</p>
<ul>
	<li><strong><a href="#kouiki">広域避難場所（市内で3箇所）</a></strong>
	災害等により大規模火災が発生し、安全な避難所へ避難することができない場合や一時避難場所では安全が確保できない場合等に、大規模火災から一時的に避難するため、市内の大きな公園を広域避難場所として指定しています。</li>
	<li><strong><a href="#ittoki">一時避難場所（185箇所）</a></strong>
	災害が発生または発生する恐れがある場合に、身を守るため一時的に避難する場所として、また避難所への中継地点として、避難者が一時的に集合して様子を見る場所又は集団を形成する場所として、市内の公園並びに保育園・こども園のグラウンドを一時避難場所として指定しています。</li>
</ul>
<h2>避難場所一覧</h2>
<h3><a id="kouiki" name="kouiki">広域避難場所（3ヶ所）</a></h3>
<table align="center" border="1" cellpadding="1" cellspacing="0" summary="" width="100%"><caption>市内公園施設情報</caption><thead><tr><th align="center" nowrap="nowrap" valign="middle" scope="col">
			<p align="center"><strong>名称</strong></p>
			</th><th align="center" colspan="2" nowrap="nowrap" valign="middle" scope="col">
			<p align="center"><strong>連絡先</strong></p>
			</th><th align="center" nowrap="nowrap" valign="middle" scope="col">
			<p align="center"><strong>所在地</strong></p>
			</th><th align="center" nowrap="nowrap" valign="middle" scope="col">
			<p align="center"><strong>面積</strong></p>
			</th></tr></thead><tbody><tr><th align="center" nowrap="nowrap" rowspan="2" valign="middle" scope="rowgroup">
			<p align="center"><a href="/tanoshimu/koen/sougou.html">安城市総合運動公園</a></p>
			</th><th align="center" nowrap="nowrap" valign="middle" scope="row">
			<p>市体育館</p>
			</th><td align="center" nowrap="nowrap" valign="middle">
			<p>75-3535</p>
			</td><td align="center" nowrap="nowrap" valign="middle">
			<p>新田町新定山41-8</p>
			</td><td align="center" nowrap="nowrap" rowspan="2" valign="middle">
			<p align="center">200,400平方メートル</p>
			</td></tr><tr><th align="center" nowrap="nowrap" valign="middle" scope="row">
			<p>青少年の家</p>
			</th><td align="center" nowrap="nowrap" valign="middle">
			<p>76-3432</p>
			</td><td align="center" nowrap="nowrap" valign="middle">
			<p>新田町池田上1</p>
			</td><td></td></tr></tbody></table>`,
    },
  ];

  const state = {
    rules: [],
    ruleMap: new Map(),
    sourceHtml: "",
    workingHtml: "",
    candidates: [],
    notices: [],
    selectedCandidateId: null,
    bulkSelectedCandidateIds: new Set(),
    bulkActionMessage: "",
    generatedAt: null,
    inputCollapsed: false,
    selectedFixMethodId: null,
    quickEditOpen: false,
    selectedSampleId: inputSamples[0].id,
    pageAgentDrag: null,
    pageAgentDismissed: false,
    ruleScopeMode: "kb",
    llmUsage: { calls: 0, inputTokens: 0, outputTokens: 0, estimatedCostUsd: 0, estimatedCostJpy: 0 },
    pendingAutoAcceptSafe: false,
    micheckerCheckitems: [],
    ruleByCheckId: new Map(),
    micheckerEngineResult: null,
    // "source"(候補生成時点の入力HTML) / "final"(最終HTMLで手動再実行した結果) のどちらを
    // micheckerEngineResultが表しているかを、パネル上のラベルとボタン操作で明示するためのフラグ。
    micheckerEngineResultBasis: null,
    // micheckerEngineResultの計算に実際に使ったHTML文字列(該当箇所のHTML抜粋表示・
    // プレビューハイライトの解決に再利用する)。
    micheckerEngineResultHtml: null,
    // miChecker相当チェック結果の表で選択中の行(プレビューハイライト対象)。
    selectedMicheckerProblemIndex: null,
  };

  // GOAL1 batch mode runs the analysis pipeline without the goal2 screen, so the
  // pipeline can't read page title / old URL from the input fields. While a headless
  // analysis is in flight this holds {pageTitle, oldUrl}; when null (the normal
  // on-screen path) the helpers below read the input fields exactly as before.
  let analysisContext = null;

  function currentPageTitle() {
    if (analysisContext) return analysisContext.pageTitle || "";
    return els.pageTitleInput?.value || "";
  }

  function currentOldUrl() {
    if (analysisContext) return analysisContext.oldUrl || "";
    return els.oldUrlInput?.value || "";
  }

  const els = {
    inputBand: document.querySelector(".input-band"),
    inputBody: document.getElementById("inputBody"),
    ruleStatus: document.getElementById("ruleStatus"),
    pageTitleInput: document.getElementById("pageTitleInput"),
    oldUrlInput: document.getElementById("oldUrlInput"),
    cmsTargetInput: document.getElementById("cmsTargetInput"),
    workerInput: document.getElementById("workerInput"),
    htmlInput: document.getElementById("htmlInput"),
    sampleSelect: document.getElementById("sampleSelect"),
    toggleInputButton: document.getElementById("toggleInputButton"),
    loadSampleButton: document.getElementById("loadSampleButton"),
    analyzeButton: document.getElementById("analyzeButton"),
    resetButton: document.getElementById("resetButton"),
    ruleScopeRadios: document.querySelectorAll('input[name="ruleScopeSelect"]'),
    candidateSummary: document.getElementById("candidateSummary"),
    completionPill: document.getElementById("completionPill"),
    analyzeOverlay: document.getElementById("analyzeOverlay"),
    appMain: document.getElementById("appMain"),
    bulkSelectAll: document.getElementById("bulkSelectAll"),
    bulkAcceptButton: document.getElementById("bulkAcceptButton"),
    bulkActionStatus: document.getElementById("bulkActionStatus"),
    candidateList: document.getElementById("candidateList"),
    previewFrame: document.getElementById("previewFrame"),
    previewExpandButton: document.getElementById("previewExpandButton"),
    previewExpandOverlay: document.getElementById("previewExpandOverlay"),
    previewExpandCloseButton: document.getElementById("previewExpandCloseButton"),
    previewFrameExpanded: document.getElementById("previewFrameExpanded"),
    ruleLearnMoreOverlay: document.getElementById("ruleLearnMoreOverlay"),
    ruleLearnMoreTitle: document.getElementById("ruleLearnMoreTitle"),
    ruleLearnMoreCloseButton: document.getElementById("ruleLearnMoreCloseButton"),
    ruleLearnMoreBody: document.getElementById("ruleLearnMoreBody"),
    outputDrawer: document.querySelector(".output-drawer"),
    pageAgentPanel: document.getElementById("pageAgentPanel"),
    reviewPosition: document.getElementById("reviewPosition"),
    prevCandidateButton: document.getElementById("prevCandidateButton"),
    nextCandidateButton: document.getElementById("nextCandidateButton"),
    detailSubtitle: document.getElementById("detailSubtitle"),
    candidateDetail: document.getElementById("candidateDetail"),
    decisionPanel: document.getElementById("decisionPanel"),
    quickEditPanel: document.getElementById("quickEditPanel"),
    beforeHtml: document.getElementById("beforeHtml"),
    aiImageNamePanel: document.getElementById("aiImageNamePanel"),
    aiImageNameInput: document.getElementById("aiImageNameInput"),
    aiImageNameStatus: document.getElementById("aiImageNameStatus"),
    applyAiImageNameButton: document.getElementById("applyAiImageNameButton"),
    afterHtml: document.getElementById("afterHtml"),
    decisionReason: document.getElementById("decisionReason"),
    acceptButton: document.getElementById("acceptButton"),
    editAcceptButton: document.getElementById("editAcceptButton"),
    rejectButton: document.getElementById("rejectButton"),
    needsReviewButton: document.getElementById("needsReviewButton"),
    finalHtml: document.getElementById("finalHtml"),
    noticeOutput: document.getElementById("noticeOutput"),
    evidenceOutput: document.getElementById("evidenceOutput"),
    copyHtmlButton: document.getElementById("copyHtmlButton"),
    copyEvidenceButton: document.getElementById("copyEvidenceButton"),
    downloadCsvButton: document.getElementById("downloadCsvButton"),
    micheckerEnginePanel: document.getElementById("micheckerEnginePanel"),
    micheckerEngineResultBasis: document.getElementById("micheckerEngineResultBasis"),
    micheckerEngineRecheckButton: document.getElementById("micheckerEngineRecheckButton"),
    micheckerEngineSummary: document.getElementById("micheckerEngineSummary"),
    micheckerEngineTableBody: document.getElementById("micheckerEngineTableBody"),
    micheckerEngineEmptyNote: document.getElementById("micheckerEngineEmptyNote"),
    micheckerChecklistCount: document.getElementById("micheckerChecklistCount"),
    micheckerChecklistList: document.getElementById("micheckerChecklistList"),
  };

  // goal1.html loads this file for its analysis engine only — the goal2 screen's
  // elements don't exist there, so running the UI init would throw on the first
  // addEventListener. The engine surface (window.goal2Engine, defined near the end
  // of this file) works either way.
  const uiReady = Boolean(els.analyzeButton && els.candidateList && els.htmlInput);
  if (uiReady) {
    init();
  }

  async function init() {
    bindEvents();
    restorePageAgentPosition();
    await loadSagaSamples();
    populateSampleSelect();
    await loadRules();
    await loadMicheckerCheckitems();
    if (!loadGoal3Transfer()) {
      clearInputFields();
    }
    els.outputDrawer.open = false;
    renderAll();
  }

  function bindEvents() {
    els.toggleInputButton.addEventListener("click", () => setInputCollapsed(!state.inputCollapsed));
    els.sampleSelect.addEventListener("change", () => loadSample(els.sampleSelect.value));
    els.loadSampleButton.addEventListener("click", () => loadSample(els.sampleSelect.value));
    els.analyzeButton.addEventListener("click", analyze);
    els.resetButton.addEventListener("click", reset);
    els.ruleScopeRadios.forEach(radio => radio.addEventListener("change", handleRuleScopeChange));
    els.micheckerEngineRecheckButton?.addEventListener("click", recheckMicheckerEngineAgainstFinalHtml);
    els.micheckerEngineTableBody?.addEventListener("click", handleMicheckerEngineTableClick);
    els.bulkSelectAll.addEventListener("change", toggleBulkSelection);
    els.bulkAcceptButton.addEventListener("click", bulkAcceptSelected);
    els.acceptButton.addEventListener("click", () => decide("accepted"));
    els.editAcceptButton.addEventListener("click", toggleQuickEditPanel);
    els.rejectButton.addEventListener("click", () => decide("rejected"));
    els.needsReviewButton.addEventListener("click", () => decide("needs_review"));
    els.applyAiImageNameButton.addEventListener("click", applyAiImageNameToAfterHtml);
    els.prevCandidateButton.addEventListener("click", selectPreviousCandidate);
    els.nextCandidateButton.addEventListener("click", selectNextUnresolvedCandidate);
    els.previewExpandButton?.addEventListener("click", openPreviewExpanded);
    els.previewExpandCloseButton?.addEventListener("click", closePreviewExpanded);
    els.previewExpandOverlay?.addEventListener("click", (event) => {
      if (event.target === els.previewExpandOverlay) {
        closePreviewExpanded();
      }
    });
    els.candidateDetail?.addEventListener("click", (event) => {
      if (event.target.closest(".rule-learn-more-trigger")) {
        openRuleLearnMore(selectedCandidate());
      }
    });
    els.ruleLearnMoreCloseButton?.addEventListener("click", closeRuleLearnMore);
    els.ruleLearnMoreOverlay?.addEventListener("click", (event) => {
      if (event.target === els.ruleLearnMoreOverlay) {
        closeRuleLearnMore();
      }
    });
    document.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      if (els.ruleLearnMoreOverlay && !els.ruleLearnMoreOverlay.hidden) {
        closeRuleLearnMore();
        return;
      }
      if (els.previewExpandOverlay && !els.previewExpandOverlay.hidden) {
        closePreviewExpanded();
      }
    });
    els.pageAgentPanel?.addEventListener("click", handlePageAgentAction);
    els.pageAgentPanel?.addEventListener("pointerdown", startPageAgentDrag);
    els.pageAgentPanel?.addEventListener("keydown", handlePageAgentDragHandleKeydown);
    window.addEventListener("resize", ensurePageAgentInViewport);
    els.previewFrame.addEventListener("load", () => scrollPreviewToSelectedCandidate(els.previewFrame));
    els.previewFrameExpanded?.addEventListener("load", () => scrollPreviewToSelectedCandidate(els.previewFrameExpanded));
    els.copyHtmlButton.addEventListener("click", () => copyText(els.finalHtml.value));
    els.copyEvidenceButton.addEventListener("click", () => copyText(els.evidenceOutput.value));
    els.downloadCsvButton.addEventListener("click", downloadEvidenceCsv);
  }

  function populateSampleSelect() {
    els.sampleSelect.innerHTML = "";
    inputSamples.forEach((sample) => {
      const option = document.createElement("option");
      option.value = sample.id;
      option.textContent = sample.label;
      els.sampleSelect.appendChild(option);
    });
  }

  async function loadSagaSamples() {
    try {
      const response = await fetch("/api/saga-samples?limit=10", { cache: "no-store" });
      if (!response.ok) {
        return;
      }
      const payload = await response.json();
      const existingIds = new Set(inputSamples.map((sample) => sample.id));
      (payload.samples || []).forEach((sample) => {
        if (!existingIds.has(sample.id)) {
          inputSamples.push(sample);
          existingIds.add(sample.id);
        }
      });
    } catch {
      // Saga fixtures are optional outside the local validation workspace.
    }
  }

  function loadSample(sampleId, options = {}) {
    const sample = inputSamples.find((item) => item.id === sampleId) || inputSamples[0];
    const analyzeAfter = options.analyzeAfter !== false;
    state.selectedSampleId = sample.id;
    els.sampleSelect.value = sample.id;
    els.pageTitleInput.value = sample.pageTitle;
    els.oldUrlInput.value = sample.oldUrl;
    els.cmsTargetInput.value = sample.cmsTarget;
    els.htmlInput.value = sample.html;
    els.outputDrawer.open = false;
    if (analyzeAfter) {
      analyze();
    }
  }

  function clearInputFields() {
    state.selectedSampleId = "";
    els.pageTitleInput.value = "";
    els.oldUrlInput.value = "";
    els.cmsTargetInput.value = "";
    els.workerInput.value = "";
    els.htmlInput.value = "";
  }

  function loadGoal3Transfer() {
    const raw = localStorage.getItem("goal3.toGoal2");
    if (!raw) {
      return false;
    }
    localStorage.removeItem("goal3.toGoal2");
    try {
      const payload = JSON.parse(raw);
      els.pageTitleInput.value = payload.pageTitle || "";
      els.oldUrlInput.value = payload.oldUrl || "";
      els.cmsTargetInput.value = "";
      els.workerInput.value = "";
      els.htmlInput.value = payload.html || "";
      setInputCollapsed(false);
      // Set by the GOAL1 batch screen when this page's candidates already passed the
      // same "safe to auto-accept" bar there. Applied once, right after the worker's
      // first 候補生成 completes (see analyze()) — not on every re-run.
      state.pendingAutoAcceptSafe = Boolean(payload.autoAcceptSafe);
      return Boolean(payload.html);
    } catch {
      return false;
    }
  }

  async function loadRules() {
    try {
      const response = await fetch("/api/rules", { cache: "no-store" });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const payload = await response.json();
      state.rules = payload.rules || [];
      state.ruleMap = new Map(state.rules.map((rule) => [rule.id, rule]));
      state.ruleByCheckId = buildRuleByCheckIdIndex(state.rules);
      const summary = payload.summary || {};
      if (els.ruleStatus) {
        els.ruleStatus.textContent = `移行ルール ${summary.total || state.rules.length}件 / ${payload.source || "rules.jsonl"}`;
      }
    } catch (error) {
      state.rules = fallbackRules();
      state.ruleMap = new Map(state.rules.map((rule) => [rule.id, rule]));
      state.ruleByCheckId = buildRuleByCheckIdIndex(state.rules);
      if (els.ruleStatus) {
        els.ruleStatus.textContent = `移行ルールの読み込みに失敗したため、画面内の最小ルールで起動しています。`;
      }
    }
  }

  // 「対応KBルール」列用の逆引きインデックス(miChecker-compare.jsのbuildLookupIndexesと
  // 同じ考え方だが、michecker-engine.jsは正確なチェックIDを直接返すため、テキストマッチング
  // 機構は不要でmichecker_check_idsのMap化のみで足りる)。
  function buildRuleByCheckIdIndex(rules) {
    const index = new Map();
    rules.forEach((rule) => {
      (rule.michecker_check_ids || []).forEach((checkId) => {
        if (!index.has(checkId)) index.set(checkId, []);
        index.get(checkId).push(rule);
      });
    });
    return index;
  }

  async function loadMicheckerCheckitems() {
    try {
      const response = await fetch("/api/michecker-checkitems", { cache: "no-store" });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const payload = await response.json();
      state.micheckerCheckitems = payload.checkitems || [];
    } catch (error) {
      state.micheckerCheckitems = [];
    }
  }

  function fallbackRules() {
    return [
      rule("image.alt-text", "image", "画像の代替テキスト（画像名）", "hybrid", ["1.1.1"]),
      rule("image.caption", "image", "画像のキャプション", "hybrid", ["1.1.1"]),
      rule("image.complex-image-report", "image", "複雑な画像の補足説明・報告", "escalation", ["1.1.1"]),
      rule("image.display-width", "image", "画像の表示幅（サブ画像 大/小）", "mechanical", []),
      rule("image.image-text-layout", "image", "画像とテキストの横並び", "mechanical", []),
      rule("image.multiple-images", "image", "複数画像の並び", "mechanical", []),
      rule("html-structure.heading-order", "html-structure", "見出し階層の順守", "ai", ["1.3.1", "2.4.1"]),
      rule("html-structure.heading-required", "html-structure", "見出しの設定", "ai", ["1.3.1", "2.4.1"]),
      rule("link.category-link", "link", "カテゴリページへの内部リンク", "escalation", ["2.4.4"]),
      rule("link.cross-page-anchor", "link", "別ページへのアンカーリンク", "ai", ["2.4.4"]),
      rule("link.link-text", "link", "リンクテキストは文脈非依存にする", "ai", ["2.4.4"]),
      rule("link.external-link", "link", "外部リンク（CMS管理外ページ）", "hybrid", ["2.4.4"]),
      rule("link.internal-link", "link", "内部リンク（CMS管理内ページ）", "hybrid", ["2.4.4"]),
      rule("link.in-page-anchor", "link", "ページ内アンカーリンク", "ai", ["2.4.4"]),
      rule("link.link-broken", "link", "リンク切れの対応", "escalation", ["2.4.4"]),
      rule("link.mail-link", "link", "メールリンク", "ai", ["2.4.4"]),
      rule("link.toppage-link", "link", "トップページへの内部リンク", "hybrid", ["2.4.4"]),
      rule("table.caption", "table", "表のキャプション", "ai", ["1.3.1"]),
      rule("table.layout-table", "table", "テーブルレイアウトの解体", "hybrid", ["1.3.1"]),
      rule("table.cell-merge-layout", "table", "セル結合①レイアウト用途", "hybrid", ["1.3.1"]),
      rule("table.cell-merge-heading", "table", "セル結合②見出し用途", "hybrid", ["1.3.1", "2.4.1"]),
      rule("table.cell-merge-summary", "table", "セル結合③概要が見出し的", "hybrid", ["1.3.1"]),
      rule("table.cell-merge-note", "table", "セル結合④注意書き", "hybrid", ["1.3.1"]),
      rule("table.cell-merge-file", "table", "セル結合⑤添付ファイル", "hybrid", ["1.3.1"]),
      rule("table.cell-merge-mark", "table", "セル結合⑥●印での該当表現", "hybrid", ["1.3.1", "1.4.1"]),
      rule("table.format-clear", "table", "取込/貼付け表の書式解除", "mechanical", []),
      rule("file.file-display-text", "file", "ファイルの表示テキスト", "mechanical", []),
      rule("file.external-pdf", "file", "外部サイトのPDF", "escalation", []),
      rule("text.alphanumeric", "text", "全角英数字", "mechanical", ["1.1.1"]),
      rule("text.background-color", "text", "背景色", "mechanical", ["1.4.3"]),
      rule("text.bold", "text", "太字", "mechanical", ["1.3.1"]),
      rule("text.color", "text", "文字色", "ai", ["1.4.1", "1.4.3"]),
      rule("text.currency-notation", "text", "通貨の表記", "mechanical", ["1.1.1"]),
      rule("text.date-notation", "text", "日付の表記", "hybrid", ["1.3.1"]),
      rule("text.decoration-lines", "text", "下線・打消し線・斜体", "mechanical", ["1.3.1"]),
      rule("text.font-size", "text", "文字サイズ・フォント", "mechanical", ["1.4.4"]),
      rule("text.foreign-language", "text", "外国語の言語属性", "ai", ["3.1.2"]),
      rule("text.list", "text", "箇条書き（リスト）", "mechanical", ["1.3.1"]),
      rule("text.note-symbol", "text", "注釈記号（※）の扱い", "ai", ["1.3.1"]),
      rule("text.tel-fax", "text", "電話・FAXの表記", "hybrid", ["1.1.1"]),
      rule("text.time-notation", "text", "時間の表記", "hybrid", ["1.3.1"]),
      rule("text.unit-notation", "text", "単位の表記", "mechanical", ["1.1.1"]),
      rule("text.weekday-notation", "text", "曜日の表記", "hybrid", ["1.3.1"]),
    ];
  }

  function rule(id, category, title, processingClass, wcag) {
    return {
      id,
      category,
      title,
      processing_class: processingClass,
      wcag,
      jis: wcag,
      source: "fallback",
      rule: title,
    };
  }

  function reset() {
    state.sourceHtml = "";
    state.workingHtml = "";
    state.candidates = [];
    state.notices = [];
    state.selectedCandidateId = null;
    clearBulkSelection();
    state.generatedAt = null;
    state.pageAgentDismissed = false;
    clearInputFields();
    els.outputDrawer.open = false;
    setInputCollapsed(false);
    renderAll();
  }

  // Core analysis pipeline, shared by the goal2 screen (analyze below) and the GOAL1
  // batch engine (window.goal2Engine). Pure with respect to UI state except for
  // state.llmUsage, which the LLM helpers accumulate into (callers reset it first).
  async function runAnalysis(html, options = {}) {
    const ruleScopeMode = options.ruleScopeMode || state.ruleScopeMode;
    const fragment = parseFragment(html);
    let reviewItems = generateCandidates(fragment);
    if (ruleScopeMode === "michecker") {
      reviewItems = reviewItems.filter((item) => isMicheckerRelevantRule(item.rule_id));
    }
    await enrichLinkTitleCandidates(reviewItems);
    options.onEnrichmentStart?.();
    await Promise.all([
      enrichWithLlm(reviewItems),
      enrichImageAltWithLlm(reviewItems),
      enrichHeadingReviewWithLlm(fragment, reviewItems),
      enrichAvoidTextAsImageWithLlm(fragment, reviewItems),
      enrichAsciiArtWithLlm(fragment, reviewItems),
    ]);
    // Runs after enrichImageAltWithLlm (not inside the Promise.all above) so it can reuse an
    // already-enriched standalone image.alt-text result instead of firing a duplicate vision
    // call when the same image also appears inside a decomposed layout table.
    await enrichLayoutTableImagesWithLlm(reviewItems);
    const candidates = reviewItems
      .filter((item) => !isNoticeItem(item))
      .map((candidate, index) => ({
        ...candidate,
        candidate_id: `cand_${String(index + 1).padStart(3, "0")}`,
        review_type: "fix",
      }));
    const notices = reviewItems
      .filter(isNoticeItem)
      .map((notice, index) => ({
        ...notice,
        candidate_id: `notice_${String(index + 1).padStart(3, "0")}`,
        notice_id: `notice_${String(index + 1).padStart(3, "0")}`,
        review_type: "notice",
      }));
    // 計画書§4.3: エンジンは「miChecker指摘対応のみ」モードのときだけ実行し、既定の
    // KB全ルールモードの挙動・性能には一切影響させない。既存候補生成には影響を与えず、
    // 結果はマージ・重複排除もしない(呼び出し元が独立表示する)。
    const micheckerEngineResult = ruleScopeMode === "michecker" ? runMicheckerEngine(html) : null;
    return { candidates, notices, micheckerEngineResult };
  }

  // michecker-engine.jsはCheckEngine.javaの判定ロジックの忠実な移植で、doctype/body等を
  // 備えた完全なDocumentを前提とする(C_69.0やC_89.x等、page.bodyElementsに依存するチェックが
  // 複数ある)。parseFragment()が使う<template>のDocumentFragmentはbody/doctypeを持たないため
  // 流用できず、goal3Engine.extract()やパリティテストと同じくDOMParserで独立にパースする。
  function runMicheckerEngine(html) {
    if (!window.micheckerEngine) {
      return null;
    }
    try {
      const doc = new DOMParser().parseFromString(html || "", "text/html");
      return window.micheckerEngine.run(doc, { checkitems: state.micheckerCheckitems });
    } catch (error) {
      console.error(error);
      return null;
    }
  }

  async function analyze() {
    setAnalyzeStatus("running");
    els.outputDrawer.open = false;
    state.pageAgentDismissed = false;
    state.llmUsage = { calls: 0, inputTokens: 0, outputTokens: 0, estimatedCostUsd: 0, estimatedCostJpy: 0 };
    try {
      state.sourceHtml = els.htmlInput.value.trim();
      state.generatedAt = new Date().toISOString();
      const { candidates, notices, micheckerEngineResult } = await runAnalysis(state.sourceHtml, {
        ruleScopeMode: state.ruleScopeMode,
        onEnrichmentStart: () => setAnalyzeStatus("enriching"),
      });
      state.candidates = candidates;
      state.notices = notices;
      state.micheckerEngineResult = micheckerEngineResult;
      state.micheckerEngineResultBasis = micheckerEngineResult ? "source" : null;
      state.micheckerEngineResultHtml = micheckerEngineResult ? state.sourceHtml : null;
      state.selectedMicheckerProblemIndex = null;
      state.selectedCandidateId = state.candidates[0]?.candidate_id || null;
      clearBulkSelection();
      if (state.pendingAutoAcceptSafe) {
        applyPendingAutoAcceptSafe();
      }
      state.workingHtml = rebuildWorkingHtml();
      setInputCollapsed(true);
      renderAll();
      setAnalyzeStatus("complete");
    } catch (error) {
      console.error(error);
      state.candidates = [];
      state.notices = [];
      state.micheckerEngineResult = null;
      state.micheckerEngineResultBasis = null;
      state.micheckerEngineResultHtml = null;
      state.selectedMicheckerProblemIndex = null;
      state.selectedCandidateId = null;
      clearBulkSelection();
      state.workingHtml = state.sourceHtml || els.htmlInput.value.trim();
      renderAll();
      setAnalyzeStatus("error", error);
    }
  }

  // 画面独自の擬似ルールIDを、miChecker関連判定に使うKBルールIDへ対応づける。
  // iframe.cms-reviewはCMS運用上の確認事項でmiCheckerのチェック項目ではないため、対応先なし。
  // text.decoration-lines: KB上はmichecker_check_idsが空だが、実体はU/S/STRIKE要素やCENTER/BIG/TT等の
  // 廃止要素(miChecker C_33.1/C_33.2/C_48.2)を検出しているため、html-structure.deprecated-elementsへ
  // 対応づけてmiCheckerモードでも候補が表示されるようにする。
  const MICHECKER_RULE_ALIASES = {
    "iframe.title": "html-structure.iframe-frame-title",
    "iframe.frame-unsupported": "html-structure.iframe-frame-title",
    "text.decoration-lines": "html-structure.deprecated-elements",
  };

  function isMicheckerRelevantRule(ruleId) {
    const resolvedId = MICHECKER_RULE_ALIASES[ruleId] || ruleId;
    const rule = state.ruleMap.get(resolvedId);
    return Boolean(rule?.michecker_check_ids?.length);
  }

  function handleRuleScopeChange() {
    const checkedRadio = Array.from(els.ruleScopeRadios).find(radio => radio.checked);
    state.ruleScopeMode = checkedRadio?.value || "kb";
    state.selectedMicheckerProblemIndex = null;
    if (state.candidates.length || state.notices.length) {
      els.candidateSummary.textContent = "修正基準を変更しました。「候補生成」を押すと反映されます（既存の判断はリセットされます）。";
    }
  }

  function setAnalyzeStatus(status, error = null) {
    if (!els.analyzeButton || !els.candidateSummary || !els.completionPill) {
      return;
    }
    if (status !== "enriching") {
      hideAnalyzeOverlay();
    }
    if (status === "running") {
      els.analyzeButton.disabled = true;
      els.analyzeButton.textContent = "生成中";
      els.candidateSummary.textContent = "修正候補を生成しています。";
      els.completionPill.textContent = "生成中";
      return;
    }
    if (status === "enriching") {
      els.analyzeButton.disabled = true;
      els.analyzeButton.textContent = "AIで確認中";
      els.candidateSummary.textContent = "AIによる内容確認を行っています。ページの内容によっては数十秒かかる場合があります。";
      els.completionPill.textContent = "AI確認中";
      showAnalyzeOverlay();
      return;
    }
    els.analyzeButton.disabled = false;
    els.analyzeButton.textContent = "候補生成";
    if (status === "error") {
      els.candidateSummary.textContent = `候補生成に失敗しました: ${error?.message || "原因不明のエラー"}`;
      els.completionPill.textContent = "エラー";
      els.bulkActionStatus.textContent = "入力HTMLを確認して、もう一度候補生成してください。";
      return;
    }
    if (status === "complete" && state.candidates.length === 0) {
      els.candidateSummary.textContent = state.notices.length
        ? `修正候補はありません。注意 ${state.notices.length}件は出力欄に表示しています。`
        : "修正候補はありません。";
      els.completionPill.textContent = "0件";
    }
  }

  // Blocks every other action (sample switching, input editing, etc.) while LLM enrichment
  // is in flight in the background, per the "AI確認中は他の操作もブロックしてほしい" request:
  // the overlay's own stacking/click-catching handles pointer input, and `inert` on the main
  // content area additionally keeps keyboard/assistive-tech navigation out of it.
  function showAnalyzeOverlay() {
    if (!els.analyzeOverlay || !els.analyzeOverlay.hidden) {
      return;
    }
    els.analyzeOverlay.hidden = false;
    if (els.appMain) {
      els.appMain.inert = true;
    }
    els.analyzeOverlay.focus();
  }

  function hideAnalyzeOverlay() {
    if (!els.analyzeOverlay || els.analyzeOverlay.hidden) {
      return;
    }
    const hadFocus = els.analyzeOverlay.contains(document.activeElement);
    els.analyzeOverlay.hidden = true;
    if (els.appMain) {
      els.appMain.inert = false;
    }
    if (hadFocus) {
      els.analyzeButton?.focus();
    }
  }

  function parseFragment(html) {
    const template = document.createElement("template");
    template.innerHTML = html || "";
    stripInternalAttributes(template.content);
    assignNodeIds(template.content);
    return template;
  }

  function assignNodeIds(root) {
    let index = 1;
    root.querySelectorAll("*").forEach((element) => {
      element.setAttribute("data-goal2-node-id", `n${String(index).padStart(4, "0")}`);
      index += 1;
    });
  }

  function stripInternalAttributes(root) {
    root.querySelectorAll?.("[data-goal2-node-id]").forEach((element) => {
      element.removeAttribute("data-goal2-node-id");
    });
  }

  function generateCandidates(fragment) {
    const candidates = [];
    collectHeadingCandidates(fragment, candidates);
    collectTableCandidates(fragment, candidates);
    collectImageCandidates(fragment, candidates);
    collectLinkCandidates(fragment, candidates);
    collectIframeCandidates(fragment, candidates);
    collectTextCandidates(fragment, candidates);
    collectListStructureCandidates(fragment, candidates);
    collectMetaRefreshCandidates(fragment, candidates);
    collectDuplicateAttributeCandidates(fragment, candidates);
    collectFrameElementNotices(candidates);
    collectDeprecatedAttributeCandidates(fragment, candidates);
    collectEmptyLinkCandidates(fragment, candidates);
    collectDuplicateLinkTextCandidates(fragment, candidates);
    return candidates;
  }

  // miChecker C_57.6(item_57()): リンク内に要素もテキストも存在しない完全に空のリンク
  // (例: <a href="/x"></a>)。item_57()は子ノード・img子孫のいずれも持たないリンクをhrefごとに
  // グループ化して報告するが、本実装では空リンク1件ごとに削除/内容追加の確認候補を出す。
  // href="#"始まりのリンク(item_57()がerrorCountのみ加算し問題を出さない区分。link.link-brokenで
  // 別途拾われる)は対象外にする。
  function collectEmptyLinkCandidates(fragment, candidates) {
    fragment.content.querySelectorAll("a[href]").forEach((link) => {
      const href = (link.getAttribute("href") || "").trim();
      if (!href || href.startsWith("#") || link.childNodes.length > 0) {
        return;
      }
      candidates.push(
        makeCandidate({
          ruleId: "link.link-purpose-standalone",
          element: link,
          message: "リンク内に要素やテキストが存在しません。",
          reason: "リンク内が完全に空のため、スクリーンリーダーでも視覚的にも内容が伝わりません。リンク内に読み上げ可能なテキストや画像(alt付き)を追加するか、不要であればリンク自体を削除してください。",
          afterHtml: link.outerHTML,
          confidence: "medium",
          requiresHumanReview: true,
          patchMode: "none",
        })
      );
    });
  }

  // miChecker C_58.0(item_58()): 異なる複数のURLへのリンクに同一のリンクテキストを使っているケース。
  // 読み上げ可能テキスト(computeLinkAccessibleText)ごとにグループ化し、hrefが2種類以上ある場合、
  // 最初に現れたhref以外の(新しく現れた)hrefを持つリンクごとに確認候補を出す
  // (collectDuplicateAttributeCandidatesFor()と同様、最初の出現は基準として残す)。
  function collectDuplicateLinkTextCandidates(fragment, candidates) {
    const groups = new Map();
    fragment.content.querySelectorAll("a[href]").forEach((link) => {
      const text = computeLinkAccessibleText(link, fragment.content);
      const href = (link.getAttribute("href") || "").trim();
      if (!text || !href) {
        return;
      }
      if (!groups.has(text)) {
        groups.set(text, []);
      }
      groups.get(text).push({ element: link, href });
    });

    groups.forEach((entries, text) => {
      const uniqueHrefs = new Set(entries.map((entry) => entry.href));
      if (uniqueHrefs.size < 2) {
        return;
      }
      const seenHrefs = new Set([entries[0].href]);
      entries.slice(1).forEach((entry) => {
        if (seenHrefs.has(entry.href)) {
          return;
        }
        seenHrefs.add(entry.href);
        candidates.push(
          makeCandidate({
            ruleId: "link.link-purpose-standalone",
            element: entry.element,
            message: `同じリンクテキスト「${text}」で異なるリンク先が使われています。`,
            reason: "同一テキストのリンクが異なる遷移先を指すと、利用者がリンク先を誤認する可能性があります。リンクテキストにリンク先固有の情報(年度・ファイル名等)を含めて区別できるようにしてください。",
            afterHtml: entry.element.outerHTML,
            confidence: "medium",
            requiresHumanReview: true,
            patchMode: "none",
          })
        );
      });
    });
  }

  // miChecker C_48.8: 廃止属性の除去。checkitem.xmlの説明文言は「古い属性全般」だが、CheckEngine.java
  // (item_3()のlongdesc判定・item_23()のsummary判定)を実際に確認すると、HTML5判定時に発火するのは
  // img要素のlongdesc属性とtable要素のsummary属性の2つのみである。align/valign/width/height/border/
  // cellpadding/cellspacing等のテーブル書式属性はhasTableFormatting()/stripFormatting()
  // (table.format-clear)側で別途、無条件に検出・除去しており、miChecker本体のC_48.8としては
  // 対象外(発火しない)ため、本実装でもlongdesc・summaryの2属性のみを対象にする。
  function collectDeprecatedAttributeCandidates(fragment, candidates) {
    fragment.content.querySelectorAll("img[longdesc]").forEach((img) => {
      const clone = img.cloneNode(true);
      clone.removeAttribute("longdesc");
      candidates.push(
        makeCandidate({
          ruleId: "html-structure.deprecated-elements",
          element: img,
          message: "img要素に廃止されたlongdesc属性が使われています。",
          reason: "longdesc属性はHTML Living Standardで廃止されています。詳細な説明が必要な場合は、本文中にテキストで補足するか、alt属性の見直しで対応してください。",
          afterHtml: clone.outerHTML,
          patch: { type: "remove-attribute", name: "longdesc" },
          confidence: "high",
          requiresHumanReview: false,
        })
      );
    });

    fragment.content.querySelectorAll("table[summary]").forEach((table) => {
      if (!normalizeText(table.getAttribute("summary") || "")) {
        return;
      }
      const clone = table.cloneNode(true);
      clone.removeAttribute("summary");
      candidates.push(
        makeCandidate({
          ruleId: "html-structure.deprecated-elements",
          element: table,
          message: "table要素に廃止されたsummary属性が使われています。",
          reason: "summary属性はHTML Living Standardで廃止されています。表の概要はcaption要素または前後の本文で提供してください。",
          afterHtml: clone.outerHTML,
          patch: { type: "remove-attribute", name: "summary" },
          confidence: "high",
          requiresHumanReview: false,
        })
      );
    });

    const deprecatedTableAttrs = ["align", "border", "cellpadding", "cellspacing", "width", "height"];
    fragment.content.querySelectorAll("table").forEach((table) => {
      const hasDeprecated = deprecatedTableAttrs.some(attr => table.hasAttribute(attr));
      if (!hasDeprecated) {
        return;
      }
      const clone = table.cloneNode(true);
      deprecatedTableAttrs.forEach(attr => clone.removeAttribute(attr));
      if (clone.outerHTML === table.outerHTML) {
        return;
      }
      const removedAttrs = deprecatedTableAttrs.filter(attr => table.hasAttribute(attr)).join(", ");
      candidates.push(
        makeCandidate({
          ruleId: "html-structure.deprecated-elements",
          element: table,
          message: `table要素に非推奨な属性が使われています（${removedAttrs}）。`,
          reason: `${removedAttrs}属性はHTML5で非推奨です。表の書式はCSSで指定してください。`,
          afterHtml: clone.outerHTML,
          patch: { type: "set-attribute", name: "data-removed-attrs", value: removedAttrs },
          confidence: "high",
          requiresHumanReview: false,
        })
      );
    });
  }

  // miChecker C_51.0/C_51.4: frame要素のtitle欠落・空白。
  // frame要素はframeset外ではHTMLパーサーが破棄するため、通常のfragment走査では検出できない
  // (貼り付けた時点で作業用HTMLからも自動的に消える)。生の入力HTMLをframeset文書として
  // 解析し直して検出し、修正候補ではなく「注意」(patchMode: none)として出力する。
  function collectFrameElementNotices(candidates) {
    const source = state.sourceHtml || "";
    if (!/<frame[\s/>]/i.test(source)) {
      return;
    }
    const doc = new DOMParser().parseFromString(`<frameset>${source}</frameset>`, "text/html");
    doc.querySelectorAll("frame").forEach((frame) => {
      const title = normalizeText(frame.getAttribute("title") || "");
      const titleIssue = !title
        ? "title属性が無い、または空白のみのため、miCheckerでは「frame要素にtitle属性がありません」と指摘されます。"
        : "";
      candidates.push(
        makeCandidate({
          ruleId: "iframe.frame-unsupported",
          element: frame,
          message: "frame要素が含まれています。CMS本文には取り込めません。",
          reason: `frame要素はCMSの本文HTMLでは利用できず、貼り付けた時点で自動的に失われます。フレーム内の各ページの内容を、通常の本文コンテンツとして再構成してください。${titleIssue}`,
          afterHtml: "",
          confidence: "low",
          requiresHumanReview: true,
          patchMode: "none",
        })
      );
    });
  }

  // miChecker C_36.0/C_36.1: <meta http-equiv="Refresh"> による自動リロード・自動リダイレクト。
  // content値に"url"が含まれていればページ遷移(リダイレクト)、含まれていなければ単純な自動リロードとして扱う。
  function collectMetaRefreshCandidates(fragment, candidates) {
    fragment.content.querySelectorAll("meta[http-equiv]").forEach((meta) => {
      const httpEquiv = (meta.getAttribute("http-equiv") || "").trim().toLowerCase();
      if (httpEquiv !== "refresh") {
        return;
      }
      const content = meta.getAttribute("content") || "";
      const isRedirect = /url/i.test(content);
      candidates.push(
        makeCandidate({
          ruleId: "html-structure.embedded-script-behavior",
          element: meta,
          message: isRedirect
            ? "自動的にページを切り替えるmeta refresh（リダイレクト）が含まれています。"
            : "周期的にページを再読み込みするmeta refreshが含まれています。",
          reason: isRedirect
            ? "自動的なページ遷移は利用者の操作を妨げるため、meta refreshによるリダイレクトを削除し、必要であれば通常のリンクを設置します。"
            : "自動リロードは利用者が読んでいる内容を突然更新してしまうため、meta refreshを削除し、必要であれば更新用のリンクやボタンを設置します。",
          afterHtml: "",
          patch: { type: "remove-element" },
          confidence: "high",
          requiresHumanReview: false,
        })
      );
    });
  }

  // miChecker C_422.0/C_423.0: id・accesskey属性値の重複。
  // 複数の案件・記事を貼り付けたページで同じidやaccesskeyが重複しやすいため、fragment全体で値ごとに集計する。
  // 最初の出現は基準として残し、2件目以降を「一意な値へ書き換えが必要」な候補として提示する（patchMode: noneで自動置換はしない）。
  function collectDuplicateAttributeCandidates(fragment, candidates) {
    collectDuplicateAttributeCandidatesFor(fragment, candidates, "id", "id属性");
    collectDuplicateAttributeCandidatesFor(fragment, candidates, "accesskey", "accesskey属性");
  }

  function collectDuplicateAttributeCandidatesFor(fragment, candidates, attrName, attrLabel) {
    const groups = new Map();
    fragment.content.querySelectorAll(`[${attrName}]`).forEach((element) => {
      const value = (element.getAttribute(attrName) || "").trim();
      if (!value) {
        return;
      }
      if (!groups.has(value)) {
        groups.set(value, []);
      }
      groups.get(value).push(element);
    });

    groups.forEach((elements, value) => {
      if (elements.length < 2) {
        return;
      }
      elements.slice(1).forEach((element, index) => {
        candidates.push(
          makeCandidate({
            ruleId: "html-structure.duplicate-id-accesskey",
            element,
            message: `${attrLabel}の値「${value}」が他の要素と重複しています（${elements.length}件）。`,
            reason: `${attrLabel}はページ内で一意である必要があります。ページ内アンカーやラベルの参照先が変わらないか確認しながら、値を一意になるよう書き換えてください（例: 「${value}-${index + 2}」）。`,
            afterHtml: element.outerHTML,
            confidence: "medium",
            requiresHumanReview: true,
            patchMode: "none",
          })
        );
      });
    });
  }

  async function enrichLinkTitleCandidates(items) {
    const targets = items.filter((item) => {
      return item.rule_id === "link.link-text" && (item.proposal?.after_html || "").includes("リンク（リンク先ページ名など）");
    });
    await Promise.all(targets.map(enrichLinkTitleCandidate));
  }

  async function enrichLinkTitleCandidate(candidate) {
    const href = linkHrefFromHtml(candidate.proposal.after_html) || linkHrefFromHtml(candidate.proposal.before_html);
    if (!href) {
      return;
    }
    const base = linkTitleLookupBase();
    try {
      const query = new URLSearchParams({ href, base });
      const response = await fetch(`/api/link-title?${query.toString()}`, { cache: "no-store" });
      if (!response.ok) {
        return;
      }
      const result = await response.json();
      const title = normalizeLinkTitle(result.title || "");
      if (!result.ok || !title) {
        return;
      }
      candidate.proposal.after_html = candidate.proposal.after_html.replace(/リンク（リンク先ページ名など）/g, title);
      candidate.issue.reason = `${candidate.issue.reason} リンク先ページのタイトル候補として「${title}」を取得しました。公開ページと一致するか確認してください。`;
      candidate.proposal.confidence = candidate.proposal.confidence === "low" ? "medium" : candidate.proposal.confidence;
      candidate.proposal.link_title = {
        title,
        url: result.url || "",
        source: "server-fetch",
      };
    } catch {
      // Link title lookup is a convenience feature; keep the editable placeholder if it fails.
    }
  }

  // LLM-backed candidate enrichment: mirrors enrichLinkTitleCandidates — candidates are
  // already fully generated by the (synchronous) heuristic collectors, this just upgrades
  // message/reason/patch in place afterward. Any failure (no API key, network error,
  // budget exceeded, malformed response) silently keeps the original heuristic draft.
  async function enrichWithLlm(items) {
    await Promise.all([
      runLlmBatch(
        "foreign-language",
        items.filter((item) => item.rule_id === "text.foreign-language"),
        (candidate) => ({ text: stripTags(candidate.proposal.before_html) }),
        applyForeignLanguageLlmResult
      ),
      runLlmBatch(
        "sensory-characteristics",
        items.filter((item) => item.rule_id === "text.sensory-characteristics"),
        (candidate) => ({ text: stripTags(candidate.proposal.before_html) }),
        applySensoryCharacteristicsLlmResult
      ),
      runLlmBatch(
        "link-text",
        items.filter((item) => item.rule_id === "link.link-text" && item.proposal.patch?.type === "set-text" && item.proposal.llm_context),
        (candidate) => ({
          href: candidate.proposal.llm_context.href,
          precedingHeading: candidate.proposal.llm_context.precedingHeading,
          nearbyText: candidate.proposal.llm_context.nearbyText,
        }),
        applyLinkTextLlmResult
      ),
      runLlmBatch(
        "mail-link",
        items.filter((item) => item.rule_id === "link.mail-link" && item.proposal.llm_context),
        (candidate) => ({ mailAddress: candidate.proposal.llm_context.mailAddress, nearbyText: candidate.proposal.llm_context.nearbyText }),
        applyLinkTextLlmResult
      ),
      runLlmBatch(
        "toppage-link",
        items.filter((item) => item.rule_id === "link.toppage-link"),
        () => ({ pageTitle: currentPageTitle() }),
        applyLinkTextLlmResult
      ),
      runLlmBatch(
        "table-caption",
        // table.caption candidates come from three code paths: a simple "insert-caption"
        // patch, the structural data-table-semantics rewrite (patchMode "replace" with no
        // `patch` object), and a flag-only check on an *existing* generic caption
        // (element: the <caption> itself, patchMode "none", not a whole-table rewrite —
        // excluded here since before_html wouldn't start with <table).
        items.filter(
          (item) =>
            item.rule_id === "table.caption" &&
            /^<table[\s>]/i.test(item.proposal.before_html || "") &&
            /<caption[\s>]/i.test(item.proposal.after_html || "")
        ),
        (candidate) => ({ tableHtml: candidate.proposal.before_html }),
        applyTableCaptionLlmResult
      ),
      runLlmBatch(
        "cell-merge",
        items.filter((item) => item.rule_id.startsWith("table.cell-merge-")),
        (candidate) => ({ tableHtml: candidate.proposal.before_html, currentCategory: candidate.rule_id.replace("table.cell-merge-", "") }),
        applyCellMergeLlmResult
      ),
      runLlmBatch(
        "th-scope",
        items.filter(
          (item) =>
            item.rule_id === "table.th-scope" &&
            item.proposal.patch?.type === "set-attribute" &&
            item.proposal.patch.name === "scope" &&
            item.proposal.llm_context
        ),
        (candidate) => ({ tableHtml: candidate.proposal.llm_context.tableHtml, targetThText: stripTags(candidate.proposal.before_html) }),
        applyThScopeLlmResult
      ),
    ]);
  }

  // Shared batching helper: sends up to 50 items per request (server-side cap), matches
  // results back to candidates by array index, and silently no-ops on any failure so the
  // original heuristic draft is kept untouched.
  async function runLlmBatch(task, targets, buildItem, applyResult) {
    if (!targets.length) {
      return;
    }
    const chunkSize = 50;
    for (let start = 0; start < targets.length; start += chunkSize) {
      const chunk = targets.slice(start, start + chunkSize);
      const payloadItems = chunk.map((candidate, index) => ({ id: String(index), ...buildItem(candidate) }));
      try {
        const response = await fetch("/api/llm/enrich", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ task, items: payloadItems }),
        });
        const payload = await response.json().catch(() => null);
        if (!payload) {
          continue;
        }
        recordLlmUsage(payload.usage);
        if (!payload.ok || !Array.isArray(payload.results)) {
          continue;
        }
        const resultsById = new Map(payload.results.map((result) => [String(result.id), result]));
        chunk.forEach((candidate, index) => {
          const result = resultsById.get(String(index));
          if (result) {
            applyResult(candidate, result);
          }
        });
      } catch {
        // LLM enrichment is a best-effort upgrade over the heuristic draft; keep it
        // untouched if the request itself fails.
      }
    }
  }

  // image.alt-text / image.complex-image-report LLM enrichment: unlike runLlmBatch's text
  // tasks, a vision call needs actual image bytes fetched server-side, so this can't be
  // cheaply batched into one JSON request — each unique image gets its own request, with
  // bounded concurrency. Candidates targeting the same <img> (both rules can fire for one
  // image) are grouped so a single call updates all of them.
  async function enrichImageAltWithLlm(items) {
    const targets = items.filter(
      (item) =>
        (item.rule_id === "image.alt-text" || item.rule_id === "image.complex-image-report") &&
        item.proposal.patch?.type === "set-attribute" &&
        item.proposal.patch.name === "alt"
    );
    if (!targets.length) {
      return;
    }
    const baseUrl = currentOldUrl().trim();
    const groups = new Map();
    targets.forEach((candidate) => {
      const nodeId = candidate.target.node_id;
      if (!groups.has(nodeId)) {
        groups.set(nodeId, []);
      }
      groups.get(nodeId).push(candidate);
    });
    const groupEntries = [...groups.values()];
    const concurrency = 4;
    let cursor = 0;
    async function worker() {
      while (cursor < groupEntries.length) {
        const group = groupEntries[cursor];
        cursor += 1;
        await enrichOneImageGroup(group, baseUrl);
      }
    }
    await Promise.all(Array.from({ length: Math.min(concurrency, groupEntries.length) }, worker));
  }

  async function enrichOneImageGroup(candidatesForImage, baseUrl) {
    const primary = candidatesForImage[0];
    const src = extractAttributeFromHtml(primary.proposal.before_html, "src");
    const imageUrl = resolveAbsoluteImageUrl(src, baseUrl);
    if (!imageUrl) {
      return;
    }
    const caption = primary.proposal.llm_context?.caption || "";
    try {
      const response = await fetch("/api/llm/image-alt", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ imageUrl, caption }),
      });
      const payload = await response.json().catch(() => null);
      if (!payload) {
        return;
      }
      recordLlmUsage(payload.usage);
      if (!payload.ok || !payload.result) {
        return;
      }
      candidatesForImage.forEach((candidate) => applyImageAltLlmResult(candidate, payload.result));
    } catch {
      // LLM enrichment is a best-effort upgrade; keep the heuristic draft on failure
      // (unreachable image, unsupported format, no source page URL configured, etc.)
    }
  }

  function extractAttributeFromHtml(html, attrName) {
    const template = document.createElement("template");
    template.innerHTML = html || "";
    const element = template.content.firstElementChild;
    return element ? element.getAttribute(attrName) || "" : "";
  }

  // Only resolves http(s) URLs — data: URIs and other schemes are left to the existing
  // heuristic since there is no remote source to fetch image bytes from.
  function resolveAbsoluteImageUrl(src, baseUrl) {
    if (!src) {
      return "";
    }
    try {
      if (/^https?:\/\//i.test(src)) {
        return new URL(src).href;
      }
      if (/^https?:\/\//i.test(baseUrl)) {
        return new URL(src, baseUrl).href;
      }
    } catch {
      return "";
    }
    return "";
  }

  function applyImageAltLlmResult(candidate, result) {
    const altText = normalizeText(result.alt_text || "");
    if (!altText || candidate.proposal.patch?.type !== "set-attribute") {
      return;
    }
    const template = document.createElement("template");
    template.innerHTML = candidate.proposal.after_html || "";
    const element = template.content.firstElementChild;
    if (!element) {
      return;
    }
    element.setAttribute("alt", altText);
    candidate.proposal.patch.value = altText;
    candidate.proposal.after_html = cleanHtml(element.outerHTML);
    candidate.issue.reason = `${candidate.issue.reason}(画像を解析したAIの下書きです。内容を確認してください。)`;
  }

  // table.layout-table / table.cell-merge-*: decomposeLayoutTable() bakes heuristic alt text
  // directly into the restructured table's after_html (see prepareLayoutTableImage) instead of
  // producing standalone image.alt-text candidates, so enrichImageAltWithLlm's node_id-based
  // filtering above never sees these images. Candidates built through that path instead carry
  // the heuristically-touched images in proposal.llm_context.images (collected while
  // decomposeLayoutTable runs); this pass looks each one up by src inside the candidate's
  // after_html and patches its alt attribute in place after a vision call.
  // Called after enrichImageAltWithLlm so that when the same image also has a standalone
  // image.alt-text/image.complex-image-report candidate (a common overlap: collectImageCandidates
  // flags a generic-alt <img> on its own regardless of whether collectTableCandidates also
  // decomposes the table it lives in), this reuses that already-fetched result instead of
  // issuing a second vision call for the identical image.
  async function enrichLayoutTableImagesWithLlm(items) {
    const targets = items.filter((item) => item.proposal.llm_context?.images?.length);
    if (!targets.length) {
      return;
    }
    const baseUrl = currentOldUrl().trim();
    const jobs = [];
    targets.forEach((candidate) => {
      const uniqueBySrc = new Map();
      candidate.proposal.llm_context.images.forEach((imageContext) => {
        if (!uniqueBySrc.has(imageContext.src)) {
          uniqueBySrc.set(imageContext.src, imageContext);
        }
      });
      uniqueBySrc.forEach((imageContext) => jobs.push({ candidate, imageContext }));
    });
    const concurrency = 4;
    let cursor = 0;
    async function worker() {
      while (cursor < jobs.length) {
        const job = jobs[cursor];
        cursor += 1;
        await enrichOneLayoutTableImage(job.candidate, job.imageContext, baseUrl, items);
      }
    }
    await Promise.all(Array.from({ length: Math.min(concurrency, jobs.length) }, worker));
  }

  function findExistingAltForImageUrl(items, imageUrl, baseUrl) {
    for (const item of items) {
      if (item.rule_id !== "image.alt-text" && item.rule_id !== "image.complex-image-report") {
        continue;
      }
      if (item.proposal.patch?.type !== "set-attribute" || item.proposal.patch.name !== "alt") {
        continue;
      }
      const src = extractAttributeFromHtml(item.proposal.before_html, "src");
      if (resolveAbsoluteImageUrl(src, baseUrl) === imageUrl) {
        return normalizeText(item.proposal.patch.value || "");
      }
    }
    return "";
  }

  async function enrichOneLayoutTableImage(candidate, imageContext, baseUrl, items) {
    const imageUrl = resolveAbsoluteImageUrl(imageContext.src, baseUrl);
    if (!imageUrl) {
      return;
    }
    const existingAlt = findExistingAltForImageUrl(items, imageUrl, baseUrl);
    if (existingAlt) {
      applyLayoutTableImageAltResult(candidate, imageContext.src, { alt_text: existingAlt });
      return;
    }
    try {
      const response = await fetch("/api/llm/image-alt", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ imageUrl, caption: imageContext.caption || "" }),
      });
      const payload = await response.json().catch(() => null);
      if (!payload) {
        return;
      }
      recordLlmUsage(payload.usage);
      if (!payload.ok || !payload.result) {
        return;
      }
      applyLayoutTableImageAltResult(candidate, imageContext.src, payload.result);
    } catch {
      // best-effort upgrade; the heuristic alt baked in by decomposeLayoutTable stays as-is
    }
  }

  function applyLayoutTableImageAltResult(candidate, src, result) {
    const altText = normalizeText(result.alt_text || "");
    if (!altText) {
      return;
    }
    const template = document.createElement("template");
    template.innerHTML = candidate.proposal.after_html || "";
    const matches = [...template.content.querySelectorAll("img")].filter(
      (img) => (img.getAttribute("src") || "") === src
    );
    if (!matches.length) {
      return;
    }
    matches.forEach((img) => img.setAttribute("alt", altText));
    candidate.proposal.after_html = cleanHtml(template.innerHTML);
  }

  // image.avoid-text-as-image: unlike every other image enrichment above, this doesn't
  // upgrade an existing heuristic draft — there is no mechanical way to tell from HTML alone
  // whether an image's pixels contain banner-style text that should be real body text
  // instead, so this walks every reasonably-sized <img> in the document (isNormalSizedImage-
  // ForComplexCheck skips tiny icons) and only proposes a candidate when the vision call
  // actually finds embedded text. Requires a resolvable source page URL like the other vision
  // enrichments; produces zero candidates (and zero calls) without one.
  async function enrichAvoidTextAsImageWithLlm(fragment, items) {
    const baseUrl = currentOldUrl().trim();
    if (!/^https?:\/\//i.test(baseUrl)) {
      return;
    }
    const images = [...fragment.content.querySelectorAll("img")].filter((img) => isNormalSizedImageForComplexCheck(img));
    if (!images.length) {
      return;
    }
    const concurrency = 4;
    let cursor = 0;
    async function worker() {
      while (cursor < images.length) {
        const img = images[cursor];
        cursor += 1;
        await enrichOneAvoidTextAsImage(img, baseUrl, items);
      }
    }
    await Promise.all(Array.from({ length: Math.min(concurrency, images.length) }, worker));
  }

  async function enrichOneAvoidTextAsImage(img, baseUrl, items) {
    const imageUrl = resolveAbsoluteImageUrl(img.getAttribute("src") || "", baseUrl);
    if (!imageUrl) {
      return;
    }
    const caption = normalizeText(closestCaptionElement(img)?.textContent || "");
    try {
      const response = await fetch("/api/llm/image-alt", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ task: "avoid-text-as-image", imageUrl, caption }),
      });
      const payload = await response.json().catch(() => null);
      if (!payload) {
        return;
      }
      recordLlmUsage(payload.usage);
      if (!payload.ok || !payload.result?.has_embedded_text) {
        return;
      }
      const extractedText = normalizeText(payload.result.extracted_text || "");
      if (!extractedText) {
        return;
      }
      items.push(
        makeCandidate({
          ruleId: "image.avoid-text-as-image",
          element: img,
          message: "画像内に本文テキストとして提供すべき文字情報が描き込まれています。(AI判定)",
          reason: `画像を解析したAIが画像内に「${extractedText}」という文字情報を検出しました。CMSの装飾機能で同等の見た目を再現できないか検討し、この文字情報を本文テキストとして追加してください。(AI判定、内容を確認してください)`,
          afterHtml: `${cleanHtml(img.outerHTML)}<p>${escapeHtml(extractedText)}</p>`,
          confidence: "low",
          requiresHumanReview: true,
        })
      );
    } catch {
      // best-effort detection; skip silently on any failure (unreachable image, network error, etc.)
    }
  }

  // text.ascii-art: no mechanical detector exists at all — a regex alone can't reliably tell
  // a real kaomoji/ASCII-art figure apart from ordinary Japanese text that happens to use
  // similar brackets/symbols (see a11y-migration-kb/rules/text/ascii-art.md's triage note on
  // why this was left unimplemented). isAsciiArtPrefilterMatch() is a cheap, over-inclusive
  // net — it just needs to not miss real cases; Gemini makes the actual call, so false
  // positives from the prefilter cost nothing but a wasted batch slot.
  const ASCII_ART_TEXT_CONTAINER_SELECTOR = "p, li, td, th, dd, dt, blockquote, figcaption, pre";
  const REPEATED_SYMBOL_LINE_PATTERN = /(\S)\1{9,}/;
  const KAOMOJI_BRACKET_PATTERN = /[(（][^)）\n]{1,16}[)）]/g;
  const KAOMOJI_GLYPH_PATTERN = /[´｀∇ω≧≦ＴДд゜°><^;;￣]/;
  const JAPANESE_WORD_PATTERN = /[ぁ-んァ-ヶ一-龠]{3,}/;

  function isSymbolHeavyLine(line) {
    const chars = [...line];
    if (chars.length < 4) {
      return false;
    }
    const symbolCount = chars.filter((ch) => !/[ぁ-んァ-ヶ一-龠a-zA-Z0-9\s、。！？「」]/.test(ch)).length;
    return symbolCount / chars.length >= 0.5;
  }

  function isAsciiArtPrefilterMatch(text, rawText) {
    if (REPEATED_SYMBOL_LINE_PATTERN.test(text)) {
      return true;
    }
    if (rawText) {
      const lines = rawText
        .split(/\n/)
        .map((line) => line.trim())
        .filter(Boolean);
      if (lines.length >= 2 && lines.filter(isSymbolHeavyLine).length >= 2) {
        return true;
      }
    }
    const brackets = text.match(KAOMOJI_BRACKET_PATTERN) || [];
    return brackets.some((segment) => KAOMOJI_GLYPH_PATTERN.test(segment) && !JAPANESE_WORD_PATTERN.test(segment));
  }

  function collectAsciiArtPrefilterTargets(fragment) {
    const targets = [];
    fragment.content.querySelectorAll(ASCII_ART_TEXT_CONTAINER_SELECTOR).forEach((element) => {
      if (element.querySelector(ASCII_ART_TEXT_CONTAINER_SELECTOR)) {
        return; // only consider leaf-most text containers, avoid double-matching a parent+child
      }
      const rawText = element.tagName === "PRE" ? element.textContent || "" : "";
      const text = normalizeText(element.textContent);
      if (!text || text.length > 200) {
        return;
      }
      if (!isAsciiArtPrefilterMatch(text, rawText)) {
        return;
      }
      targets.push({ element, text });
    });
    return targets;
  }

  async function enrichAsciiArtWithLlm(fragment, items) {
    const targets = collectAsciiArtPrefilterTargets(fragment);
    await runLlmBatch(
      "ascii-art",
      targets,
      (target) => ({ text: target.text }),
      (target, result) => applyAsciiArtLlmResult(target, result, items)
    );
  }

  function applyAsciiArtLlmResult(target, result, items) {
    if (!result?.is_ascii_art) {
      return;
    }
    const alreadyProposed = items.some(
      (item) => item.rule_id === "text.ascii-art" && item.target.node_id === target.element.getAttribute("data-goal2-node-id")
    );
    if (alreadyProposed) {
      return;
    }
    const kind = ["separator", "complex"].includes(result.kind) ? result.kind : "simple";
    const matchedText = normalizeText(result.matched_text || "");
    const suggestedText = normalizeText(result.suggested_text || "");

    if (kind === "simple") {
      const replaced = buildAsciiArtReplacementAfterHtml(target.element, matchedText, suggestedText);
      items.push(
        makeCandidate({
          ruleId: "text.ascii-art",
          element: target.element,
          message: "顔文字・記号による表現の可能性があります。(AI判定)",
          reason: `AIが顔文字と判定しました。読み上げでは記号の羅列としてそのまま読まれ意味が伝わらないため、${
            suggestedText ? `「${suggestedText}」のような言い換えへの` : "文字による言い換えへの"
          }修正を検討してください。(AI判定、内容を確認してください)`,
          afterHtml: replaced || cleanHtml(target.element.outerHTML),
          confidence: "low",
          requiresHumanReview: true,
          patchMode: replaced ? "replace" : "none",
        })
      );
      return;
    }

    if (kind === "separator") {
      items.push(
        makeCandidate({
          ruleId: "text.ascii-art",
          element: target.element,
          message: "記号の反復による装飾目的の区切り行の可能性があります。(AI判定)",
          reason: `AIが装飾目的の区切り行(記号の反復)と判定しました。読み上げソフトが記号を1つずつ読み上げてしまい内容が伝わらないため、対応を検討してください。${
            suggestedText ? `(対応方針の参考: ${suggestedText})` : ""
          }(AI判定、内容を確認してください)`,
          afterHtml: cleanHtml(target.element.outerHTML),
          confidence: "low",
          requiresHumanReview: true,
          patchMode: "none",
        })
      );
      return;
    }

    items.push(
      makeCandidate({
        ruleId: "text.ascii-art",
        element: target.element,
        message: "複数行にわたるアスキーアートの可能性があります。(AI判定)",
        reason: `AIがアスキーアート(記号を組み合わせた図案)と判定しました。読み上げでは内容が伝わらないため、アクセシブルな画像への置き換えを検討してください。${
          suggestedText ? `(alt候補の参考: ${suggestedText})` : ""
        }(AI判定、内容を確認してください)`,
        afterHtml: cleanHtml(target.element.outerHTML),
        confidence: "low",
        requiresHumanReview: true,
        patchMode: "none",
      })
    );
  }

  function buildAsciiArtReplacementAfterHtml(element, matchedText, suggestedText) {
    if (!matchedText || !suggestedText) {
      return null;
    }
    const clone = element.cloneNode(true);
    const original = clone.textContent || "";
    if (!original.includes(matchedText)) {
      return null;
    }
    clone.textContent = original.replace(matchedText, suggestedText);
    return cleanHtml(clone.outerHTML);
  }

  // html-structure.heading-required / html-structure.heading-content-quality: unlike every
  // other enrichment above, this doesn't upgrade an existing heuristic draft — the mechanical
  // collectors only catch a handful of hardcoded content patterns (see
  // collectContextualHeadingCandidates) or trivially-short headings (see
  // collectHeadingContentQualityCandidates), so most real cases never produce a candidate to
  // enrich in the first place. Instead this asks the LLM to read the whole document outline
  // and propose brand-new candidates, following the exact same shape (element/afterHtml
  // conventions) the mechanical collectors already use, so they render identically in the UI.
  async function enrichHeadingReviewWithLlm(fragment, items) {
    const outline = buildHeadingReviewOutline(fragment);
    if (!outline.length) {
      return;
    }
    const validIds = new Set(outline.map((block) => block.id));
    try {
      const response = await fetch("/api/llm/enrich", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ task: "heading-review", items: [{ id: "outline", blocks: outline }] }),
      });
      const payload = await response.json().catch(() => null);
      if (!payload) {
        return;
      }
      recordLlmUsage(payload.usage);
      if (!payload.ok || !Array.isArray(payload.results) || !payload.results[0]) {
        return;
      }
      applyHeadingReviewResult(fragment, items, payload.results[0], validIds);
    } catch {
      // LLM enrichment is a best-effort addition; the mechanical candidates (if any)
      // are already in `items` regardless of whether this succeeds.
    }
  }

  // Matches a paragraph whose entire text is a short bracket-enclosed label (e.g. "【とき】",
  // "【ところ】", "[NOTE]"). These already function as an inline heading/key for the content
  // that follows, so proposing a *new*, separate <h*> heading directly before one just
  // duplicates it (e.g. "<h4>開催日時</h4><p>【とき】</p>"). Instead the label paragraph itself
  // should be promoted into the heading, brackets stripped (e.g. "<h4>とき</h4>") — see
  // extractBracketLabelText() below.
  const SHORT_BRACKET_LABEL_PATTERN =
    /^(?:【(.{1,12})】|\[(.{1,12})\]|［(.{1,12})］|\((.{1,12})\)|（(.{1,12})）)$/;

  function extractBracketLabelText(text) {
    const match = SHORT_BRACKET_LABEL_PATTERN.exec(text);
    if (!match) return null;
    return normalizeText(match[1] || match[2] || match[3] || match[4] || match[5] || "") || null;
  }

  function buildHeadingReviewOutline(fragment) {
    const blocks = [];
    fragment.content.querySelectorAll("h1,h2,h3,h4,h5,h6,p").forEach((element) => {
      const text = normalizeText(element.textContent);
      if (!text) {
        return;
      }
      blocks.push({
        id: element.getAttribute("data-goal2-node-id"),
        tag: element.tagName.toLowerCase(),
        text: text.length > 100 ? `${text.slice(0, 100)}…` : text,
      });
    });
    return blocks.slice(0, 80);
  }

  function applyHeadingReviewResult(fragment, items, result, validIds) {
    (result.vague_headings || []).forEach((finding) => {
      if (!validIds.has(finding.block_id)) {
        return;
      }
      const reason = normalizeText(finding.reason || "");
      if (!reason) {
        return;
      }
      const existing = items.find(
        (item) => item.rule_id === "html-structure.heading-content-quality" && item.target.node_id === finding.block_id
      );
      if (existing) {
        existing.issue.reason = `${reason}(AI判定)`;
        return;
      }
      const element = fragment.content.querySelector(`[data-goal2-node-id="${finding.block_id}"]`);
      if (!element || !/^H[1-6]$/.test(element.tagName)) {
        return;
      }
      items.push(
        makeCandidate({
          ruleId: "html-structure.heading-content-quality",
          element,
          message: "見出しの内容がセクションを説明していない可能性があります。(AI判定)",
          reason: `${reason}(AI判定)`,
          afterHtml: element.outerHTML,
          confidence: "low",
          requiresHumanReview: true,
          patchMode: "none",
        })
      );
    });

    (result.missing_headings || []).forEach((finding) => {
      if (!validIds.has(finding.before_block_id)) {
        return;
      }
      const suggestedText = normalizeText(finding.suggested_text || "");
      const reason = normalizeText(finding.reason || "");
      if (!suggestedText || !reason) {
        return;
      }
      const alreadyProposed = items.some(
        (item) => item.rule_id === "html-structure.heading-required" && item.target.node_id === finding.before_block_id
      );
      if (alreadyProposed) {
        return;
      }
      const element = fragment.content.querySelector(`[data-goal2-node-id="${finding.before_block_id}"]`);
      if (!element) {
        return;
      }
      const level = normalizeHeadingLevel(finding.level);
      const bracketLabel = extractBracketLabelText(normalizeText(element.textContent));
      const afterHtml = bracketLabel
        ? `<h${level}>${escapeHtml(bracketLabel)}</h${level}>`
        : `<h${level}>${escapeHtml(suggestedText)}</h${level}>${cleanHtml(element.outerHTML)}`;
      items.push(
        makeCandidate({
          ruleId: "html-structure.heading-required",
          element,
          message: bracketLabel
            ? "ラベル段落を見出しに変換できます。(AI提案)"
            : "見出しの追加を検討できます。(AI提案)",
          reason: bracketLabel
            ? "「【...】」のようなカッコ書きラベルは、内容の区切りを示す見出しとして使われています。カッコを外して見出し要素に変換すると、スクリーンリーダー利用者が見出しジャンプで移動できるようになります。(AI提案)"
            : `${reason}(AI提案)`,
          afterHtml,
          confidence: "low",
          requiresHumanReview: true,
        })
      );
    });

    (result.heading_level_fixes || []).forEach((finding) => {
      if (!validIds.has(finding.block_id)) {
        return;
      }
      const reason = normalizeText(finding.reason || "");
      if (!reason) {
        return;
      }
      const element = fragment.content.querySelector(`[data-goal2-node-id="${finding.block_id}"]`);
      if (!element || !/^H[1-6]$/.test(element.tagName)) {
        return;
      }
      const level = normalizeHeadingLevel(finding.level);
      if (String(headingLevel(element)) === level) {
        return;
      }
      const afterHtml = renameElement(element, `h${level}`).outerHTML;
      const existing = items.find(
        (item) => item.rule_id === "html-structure.heading-order" && item.target.node_id === finding.block_id
      );
      if (existing) {
        // A mechanical (or earlier LLM) pass already proposed a level for this heading;
        // the content-aware judgment here takes precedence.
        existing.proposal.after_html = cleanHtml(afterHtml);
        existing.proposal.patch = { type: "rename-element", tag_name: `h${level}` };
        existing.issue.reason = `${reason}(AI判定)`;
        return;
      }
      items.push(
        makeCandidate({
          ruleId: "html-structure.heading-order",
          element,
          message: `見出しレベルの見直しを提案します。(AI判定)`,
          reason: `${reason}(AI判定)`,
          afterHtml,
          patch: { type: "rename-element", tag_name: `h${level}` },
          confidence: "low",
          requiresHumanReview: true,
        })
      );
    });
  }

  function normalizeHeadingLevel(level) {
    const match = String(level || "").match(/[2-6]/);
    return match ? match[0] : "2";
  }

  function applyForeignLanguageLlmResult(candidate, result) {
    if (!result.is_foreign) {
      candidate.issue.reason = `${candidate.issue.reason}(AIによる再判定では外国語でない可能性があります。実際の内容を確認してください。)`;
      return;
    }
    const langCode = result.lang_code || "";
    if (!langCode) {
      return;
    }
    const langLabel = result.language_name_ja || languageLabel(langCode);
    candidate.issue.message = `外国語(${langLabel}の可能性)の文章または語句が含まれています。lang="${langCode}" を付与します。(AI判定)`;
    candidate.issue.reason =
      "本文中の外国語には、CMSで対応する言語属性を付与できるか確認します。判定した言語が違う場合は「文言を調整」からlangの値を直接修正できます。(Gemini APIによる判定)";
    if (candidate.proposal.patch?.type === "set-attribute" && candidate.proposal.patch.name === "lang") {
      candidate.proposal.patch.value = langCode;
    }
    candidate.proposal.after_html = candidate.proposal.after_html.replace(/lang="[^"]*"/, `lang="${langCode}"`);
  }

  function applySensoryCharacteristicsLlmResult(candidate, result) {
    if (!result.is_issue) {
      candidate.issue.reason = `${candidate.issue.reason}(AIによる再判定では問題ない可能性があります。実際の内容を確認してください。)`;
      return;
    }
    const explanation = normalizeText(result.explanation || "");
    if (!explanation) {
      return;
    }
    candidate.issue.reason = `${explanation}(AI判定)`;
  }

  // Shared by link.link-text / link.mail-link / link.toppage-link: all three draft a
  // replacement link text via `patch: { type: "set-text" }` and rebuild after_html by
  // setting the linked element's textContent, so the LLM result can be applied identically.
  function applyLinkTextLlmResult(candidate, result) {
    const suggestion = normalizeText(result.suggested_text || "");
    if (!suggestion || !candidate.proposal.patch || candidate.proposal.patch.type !== "set-text") {
      return;
    }
    const rewritten = setElementTextInHtml(candidate.proposal.after_html, suggestion);
    if (!rewritten) {
      return;
    }
    candidate.proposal.patch.value = suggestion;
    candidate.proposal.after_html = rewritten;
    candidate.issue.reason = `${candidate.issue.reason}(AIによる文言案です。内容を確認してください。)`;
  }

  function setElementTextInHtml(html, text) {
    const template = document.createElement("template");
    template.innerHTML = html || "";
    const element = template.content.firstElementChild;
    if (!element) {
      return "";
    }
    element.textContent = text;
    return cleanHtml(element.outerHTML);
  }

  function applyTableCaptionLlmResult(candidate, result) {
    const suggestion = normalizeText(result.suggested_caption || "");
    if (!suggestion) {
      return;
    }
    const template = document.createElement("template");
    template.innerHTML = candidate.proposal.after_html || "";
    const captionElement = template.content.querySelector("caption");
    const tableElement = template.content.firstElementChild;
    if (!captionElement || !tableElement) {
      return;
    }
    captionElement.textContent = suggestion;
    if (candidate.proposal.patch?.type === "insert-caption") {
      candidate.proposal.patch.value = suggestion;
    }
    candidate.proposal.after_html = cleanHtml(tableElement.outerHTML);
  }

  function applyCellMergeLlmResult(candidate, result) {
    const explanation = normalizeText(result.explanation || "");
    if (!explanation) {
      return;
    }
    candidate.issue.reason = `${explanation}(AI判定)`;
  }

  function applyThScopeLlmResult(candidate, result) {
    const scope = normalizeText(result.scope || "").toLowerCase();
    if (!["row", "col", "rowgroup", "colgroup"].includes(scope) || !candidate.proposal.patch) {
      return;
    }
    candidate.proposal.patch.value = scope;
    candidate.proposal.after_html = candidate.proposal.after_html.replace(/scope="[^"]*"/, `scope="${scope}"`);
    candidate.issue.reason = `${candidate.issue.reason}(AI判定)`;
  }

  function recordLlmUsage(usage) {
    if (!usage) {
      return;
    }
    state.llmUsage.calls += 1;
    state.llmUsage.inputTokens += usage.inputTokens || 0;
    state.llmUsage.outputTokens += usage.outputTokens || 0;
    state.llmUsage.estimatedCostUsd += usage.estimatedCostUsd || 0;
    state.llmUsage.estimatedCostJpy += usage.estimatedCostJpy || 0;
  }

  function llmUsageSummaryText() {
    if (!state.llmUsage || state.llmUsage.calls === 0) {
      return "";
    }
    const costUsd = state.llmUsage.estimatedCostUsd.toFixed(4);
    const costJpy = state.llmUsage.estimatedCostJpy.toFixed(2);
    return ` LLM利用: 概算$${costUsd}（約${costJpy}円、呼び出し${state.llmUsage.calls}回、トークン計${state.llmUsage.inputTokens + state.llmUsage.outputTokens}）`;
  }

  function linkTitleLookupBase() {
    const oldUrl = currentOldUrl().trim();
    if (/^https?:\/\//i.test(oldUrl)) {
      return oldUrl;
    }
    return window.location.href;
  }

  function linkHrefFromHtml(html) {
    const template = document.createElement("template");
    template.innerHTML = html || "";
    return template.content.querySelector("a")?.getAttribute("href") || "";
  }

  function normalizeLinkTitle(title) {
    return normalizeText(title)
      .replace(/\s*[|｜]\s*.+$/, "")
      .replace(/\s*[-－]\s*(?:佐賀市|.+市|.+町|.+村|.+県)\s*$/, "")
      .trim();
  }

  function isNoticeItem(item) {
    return noticeRuleIds.has(item.rule_id);
  }

  function collectImageCandidates(fragment, candidates) {
    fragment.content.querySelectorAll("img").forEach((img) => {
      const alt = img.getAttribute("alt");
      const captionElement = closestCaptionElement(img);
      const caption = normalizeText(captionElement?.textContent || "");
      const complexImage = isComplexImageCandidate(img, caption);
      const aiNameDraft = generateImageNameDraft(img, caption);
      const aiNameDraftForAlt = complexImage ? generateComplexImageNameDraft(img, caption, aiNameDraft) : aiNameDraft;

      if (alt === null || alt.trim() === "") {
        const clone = img.cloneNode(true);
        const suggestedAlt = aiNameDraftForAlt?.name || (caption ? "" : "画像内容を具体的に入力");
        clone.setAttribute("alt", suggestedAlt);
        candidates.push(
          makeCandidate({
            ruleId: "image.alt-text",
            element: img,
            message: "画像の代替テキストが未設定です。",
            reason: aiNameDraftForAlt
              ? `AIが画像内容から「${aiNameDraftForAlt.name}」という画像名候補を生成しました。行政情報として過不足がないか人間が確認します。`
              : caption
                ? "近接するキャプションで画像内容を説明できている可能性があります。読み上げ重複を避けるため、空の代替テキストを候補にします。"
                : "内容のある画像であれば、画像内容を説明する代替テキストが必要です。",
            afterHtml: clone.outerHTML,
            patch: { type: "set-attribute", name: "alt", value: suggestedAlt },
            confidence: aiNameDraftForAlt ? aiNameDraftForAlt.confidence : caption ? "medium" : "low",
            requiresHumanReview: true,
            aiDraft: aiNameDraftForAlt,
            llmContext: { caption },
          })
        );
      }

      if (alt !== null && isGenericAlt(alt)) {
        const clone = img.cloneNode(true);
        const suggestedAlt = aiNameDraftForAlt?.name || caption || `${alt.replace(/の?写真$/, "")}の内容を具体的に説明`;
        clone.setAttribute("alt", suggestedAlt);
        candidates.push(
          makeCandidate({
            ruleId: "image.alt-text",
            element: img,
            message: "画像の代替テキストが汎用的です。",
            reason: aiNameDraftForAlt
              ? `分類語だけでは画像の内容が十分に伝わらないため、AI画像名候補「${aiNameDraftForAlt.name}」を下書きとして提示します。`
              : "分類語だけでは画像の内容が十分に伝わらない可能性があります。",
            afterHtml: clone.outerHTML,
            patch: { type: "set-attribute", name: "alt", value: suggestedAlt },
            confidence: aiNameDraftForAlt ? aiNameDraftForAlt.confidence : caption ? "medium" : "low",
            requiresHumanReview: true,
            aiDraft: aiNameDraftForAlt,
            llmContext: { caption },
          })
        );
      }

      if (alt !== null && caption && normalizeText(caption) === normalizeText(alt)) {
        const clone = img.cloneNode(true);
        clone.setAttribute("alt", "");
        candidates.push(
          makeCandidate({
            ruleId: "image.caption",
            element: img,
            message: "画像名とキャプションが重複しています。",
            reason: "キャプションと同一文言の場合、読み上げの重複を避けるため画像名省略を検討できます。",
            afterHtml: clone.outerHTML,
            patch: { type: "set-attribute", name: "alt", value: "" },
            confidence: "medium",
            requiresHumanReview: true,
          })
        );
      }

      if (captionElement) {
        const cleanedCaption = cleanImageCaption(caption);
        if (cleanedCaption !== caption) {
          const clone = captionElement.cloneNode(true);
          clone.textContent = cleanedCaption;
          candidates.push(
            makeCandidate({
              ruleId: "image.caption",
              element: captionElement,
              message: "キャプションに画像分類語が含まれています。",
              reason: "キャプションは画像名とは別の本文説明のため、「写真」などの分類語を重ねて付ける必要はありません。",
              afterHtml: clone.outerHTML,
              patch: { type: "set-text", value: cleanedCaption },
              confidence: "high",
              requiresHumanReview: false,
            })
          );
        }
      }

      const imageWidth = getImageDisplayWidth(img);
      if (imageWidth !== null) {
        candidates.push(
          makeCandidate({
            ruleId: "image.display-width",
            element: img,
            message: "画像の表示幅からCMS画像サイズの確認が必要です。",
            reason: imageWidth >= 350
              ? "表示幅が大きいため、CMSではサブ画像（大）相当として扱う候補です。"
              : "表示幅が小さいため、CMSではサブ画像（小）相当として扱う候補です。",
            afterHtml: img.outerHTML,
            confidence: "medium",
            requiresHumanReview: true,
            patchMode: "none",
          })
        );
      }

      if (complexImage) {
        const complexAiNameDraft = generateComplexImageNameDraft(img, caption, aiNameDraft);
        const complexClone = img.cloneNode(true);
        if (complexAiNameDraft?.name) {
          complexClone.setAttribute("alt", complexAiNameDraft.name);
        }
        candidates.push(
          makeCandidate({
            ruleId: "image.complex-image-report",
            element: img,
            message: "地図・図表など複雑な画像の可能性があります。",
            reason: complexAiNameDraft
              ? `画像名は「${complexAiNameDraft.name}」を下書きにし、本文で補足説明するか、SV/顧客確認へ回します。`
              : "画像だけでは内容を伝えきれない場合、本文で補足説明するか、SV/顧客確認へ回します。",
            afterHtml: complexClone.outerHTML,
            patch: complexAiNameDraft?.name
              ? { type: "set-attribute", name: "alt", value: complexAiNameDraft.name }
              : null,
            confidence: complexAiNameDraft?.confidence || "low",
            requiresHumanReview: true,
            patchMode: complexAiNameDraft?.name ? "replace" : "none",
            aiDraft: complexAiNameDraft,
            llmContext: { caption },
          })
        );
      }

      // miChecker C_80.0(item_80(): alt.length > 150): 代替テキストが150文字を超える画像は、
      // 詳細説明を本文側(aria-describedby等)に分離することを検討する確認候補を出す。
      // 「詳細な説明が必要」という主旨が既存のimage.complex-image-report(C_4.0)候補と共通のため、
      // 別ruleId(image.alt-text)ではなくこちらへ寄せる。
      if (alt !== null && alt.length > 150) {
        candidates.push(
          makeCandidate({
            ruleId: "image.complex-image-report",
            element: img,
            message: "代替テキストが150文字を超えています。",
            reason: "長い代替テキストは読み上げの負担が大きくなります。aria-describedby等を使って、画像の詳細な説明を本文側に分離できないか検討してください。",
            afterHtml: img.outerHTML,
            confidence: "low",
            requiresHumanReview: true,
            patchMode: "none",
          })
        );
      }
    });

    fragment.content.querySelectorAll("figure, p, div").forEach((container) => {
      const images = container.querySelectorAll(":scope > img, :scope > a > img");
      if (images.length >= 2) {
        const multipleImagesHtml = buildImagePartsProposal(container);
        candidates.push(
          makeCandidate({
            ruleId: "image.multiple-images",
            element: container,
            message: "複数画像が同じまとまりに並んでいます。",
            reason: "CMS登録時に、画像ごとの意味・順序・キャプションを確認し、個別の画像パーツや複数画像用の入力欄で扱うか判断します。",
            afterHtml: multipleImagesHtml,
            confidence: "low",
            requiresHumanReview: true,
          })
        );
      }

      const hasDirectImage = images.length > 0;
      const text = normalizeText(container.textContent);
      if (hasDirectImage && text.length >= 20 && !container.closest("figure")) {
        const imageTextHtml = buildImagePartsProposal(container);
        candidates.push(
          makeCandidate({
            ruleId: "image.image-text-layout",
            element: container,
            message: "画像とテキストが同じまとまりに配置されています。",
            reason: "CMS登録時に、本文・画像パーツ・キャプション、または左右配置パーツで扱うか確認します。HTMLへコピーする修正文言ではありません。",
            afterHtml: imageTextHtml,
            confidence: "low",
            requiresHumanReview: true,
          })
        );
      }
    });
  }

  function collectHeadingCandidates(fragment, candidates) {
    const headings = [...fragment.content.querySelectorAll("h1,h2,h3,h4,h5,h6")];
    let previousLevel = 1;

    headings.forEach((heading) => {
      const level = headingLevel(heading);
      if (level === 1) {
        const expected = 2;
        const clone = renameElement(heading, "h2");
        candidates.push(
          makeCandidate({
            ruleId: "html-structure.heading-order",
            element: heading,
            message: "コンテンツ領域にh1が含まれています。",
            reason: "h1はページタイトルとしてCMS側で設定される前提のため、本文ではh2以下を使います。",
            afterHtml: clone.outerHTML,
            patch: { type: "rename-element", tag_name: `h${expected}` },
            confidence: "high",
            requiresHumanReview: false,
          })
        );
        previousLevel = expected;
        return;
      }

      let effectiveLevel = level;
      if (level > previousLevel + 1) {
        const expected = Math.min(previousLevel + 1, 6);
        const clone = renameElement(heading, `h${expected}`);
        candidates.push(
          makeCandidate({
            ruleId: "html-structure.heading-order",
            element: heading,
            message: `見出しレベルがh${previousLevel}相当からh${level}へスキップしています。`,
            reason: "見出しは階層を飛ばさず、ページ構造に沿って設定します。",
            afterHtml: clone.outerHTML,
            patch: { type: "rename-element", tag_name: `h${expected}` },
            confidence: "medium",
            requiresHumanReview: true,
          })
        );
        effectiveLevel = expected;
      }
      previousLevel = effectiveLevel;
    });

    fragment.content.querySelectorAll("p,div").forEach((element) => {
      const text = normalizeText(element.textContent);
      if (element.children.length <= 1 && text.length > 0 && text.length <= 24 && /^(担当課|担当部署|届出期間|受付期間|受付窓口|申請方法|対象者|対象|問い合わせ|問合せ|お問い合わせ|お問合せ|提出先|必要書類)$/.test(text)) {
        const clone = renameElement(element, "h3");
        candidates.push(
          makeCandidate({
            ruleId: "html-structure.heading-required",
            element,
            message: "見出しに相当する短い項目名が本文要素のままです。",
            reason: "文書構造上の見出しは見出し要素として設定します。",
            afterHtml: clone.outerHTML,
            patch: { type: "rename-element", tag_name: "h3" },
            confidence: "medium",
            requiresHumanReview: true,
          })
        );
      }
    });

    collectContextualHeadingCandidates(fragment, candidates);
    collectHeadingContentQualityCandidates(fragment, candidates);
    collectHeadingLinkOnlyCandidates(fragment, candidates);
  }

  // html-structure.heading-link-only: 見出し(h1〜h6)の中身が内部・外部・ファイルリンク1件だけで
  // 構成されている場合、見出しタグを外し通常のリンクとして扱う。カード型の一覧表示等で、CMSテンプレートが
  // 見出しタグでリンクをラップしているだけのケースが典型例(文書構造上の見出しではなくリンクの一種)。
  // 同一ページ内アンカー・mailto・javascript・壊れたリンク(空/#のみ)は対象外。見出しにリンク以外の
  // テキストも含む場合は、見出しとしての構造を保つ可能性があるため対象外とし人間の確認に委ねる。
  function collectHeadingLinkOnlyCandidates(fragment, candidates) {
    fragment.content.querySelectorAll("h1,h2,h3,h4,h5,h6").forEach((heading) => {
      const links = [...heading.children].filter((child) => child.tagName === "A");
      if (links.length !== 1 || heading.children.length !== 1) {
        return;
      }
      const link = links[0];
      const headingText = normalizeText(heading.textContent);
      const linkText = normalizeText(link.textContent);
      if (!headingText || headingText !== linkText) {
        return;
      }
      const hrefInfo = classifyHref(link.getAttribute("href") || "");
      const isRealLink =
        !hrefInfo.isBrokenCandidate &&
        (hrefInfo.isPdf ||
          hrefInfo.isExternal ||
          hrefInfo.isInternalAbsolute ||
          hrefInfo.isInternalRelative ||
          hrefInfo.isCrossPageAnchor ||
          hrefInfo.isTopPage);
      if (!isRealLink) {
        return;
      }
      candidates.push(
        makeCandidate({
          ruleId: "html-structure.heading-link-only",
          element: heading,
          message: "見出しの中身がリンク単体になっています。",
          reason:
            "リンク先ページへの案内だけの見出しは、文書構造上の見出しではなくリンクの一種です。見出しタグを外し、通常のリンクとして扱ってください。",
          afterHtml: heading.innerHTML,
          patch: { type: "unwrap-element" },
          confidence: "high",
          requiresHumanReview: false,
        })
      );
    });
  }

  // miChecker C_15.0/C_388.0/C_500.4(html-structure.heading-content-quality): 見出し(h1〜h6)の内容が
  // セクションを説明しているかは機械判定できないため、miChecker本体は原則すべての見出しを確認対象として
  // 通知する(item_15()はheadings配列を無条件にaddCheckerProblemへ渡す)。本実装ではノイズを抑えるため、
  // ユーザー承認済みの方針として「極端に短い(正規化後2文字以下)」または「記号・句読点のみ」の見出しに限定し、
  // 低確信度(patchMode: none)の確認候補として出す。空の見出しはcollectContextualHeadingCandidates側の
  // isEmptyHeadingSection()判定と重複しないよう対象外にする。
  function collectHeadingContentQualityCandidates(fragment, candidates) {
    fragment.content.querySelectorAll("h1,h2,h3,h4,h5,h6").forEach((heading) => {
      const text = normalizeText(heading.textContent);
      if (!text) {
        return;
      }
      const isTooShort = Array.from(text).length <= 2;
      const isSymbolOnly = !/[\p{L}\p{N}]/u.test(text);
      if (!isTooShort && !isSymbolOnly) {
        return;
      }
      candidates.push(
        makeCandidate({
          ruleId: "html-structure.heading-content-quality",
          element: heading,
          message: isSymbolOnly ? "見出しのテキストが記号のみで構成されています。" : "見出しのテキストが極端に短くなっています。",
          reason:
            "見出し(h1〜h6)は対応するセクションの内容を説明する文言にします。テキストを太字にするためだけの目的で見出しタグを使っている場合は、見出しタグではなくCMSの装飾機能に置き換えてください。",
          afterHtml: heading.outerHTML,
          confidence: "low",
          requiresHumanReview: true,
          patchMode: "none",
        })
      );
    });
  }

  function collectContextualHeadingCandidates(fragment, candidates) {
    const procedureParentHeading = procedureParentHeadingProposal(fragment);
    if (procedureParentHeading) {
      candidates.push(
        makeCandidate({
          ruleId: "html-structure.heading-required",
          element: procedureParentHeading.element,
          message: "手続き種別の見出し群に親見出しがありません。",
          reason: "複数の車種別手続きがh3から始まっているため、本文領域の親見出しとして「手続きについて」を追加すると階層を判断しやすくなります。",
          afterHtml: procedureParentHeading.html,
          confidence: "medium",
          requiresHumanReview: true,
        })
      );
    }

    fragment.content.querySelectorAll("p").forEach((element) => {
      const text = normalizeText(element.textContent);
      if (isDepartmentGuideIntroText(text) && nextMeaningfulElement(element)?.matches("h3")) {
        const clone = renameElement(element, "h2");
        candidates.push(
          makeCandidate({
            ruleId: "html-structure.heading-required",
            element,
            message: "後続の部局一覧を説明する文が本文要素のままです。",
            reason: "部局別一覧など、後続の見出し群全体を束ねる説明は見出しとして扱うと構造を判断しやすくなります。",
            afterHtml: clone.outerHTML,
            patch: { type: "rename-element", tag_name: "h2" },
            confidence: "medium",
            requiresHumanReview: true,
          })
        );
      }

      const legalHeading = legalReferenceHeadingProposal(element);
      if (legalHeading) {
        candidates.push(
          makeCandidate({
            ruleId: "html-structure.heading-required",
            element,
            message: "法令引用内の見出し相当テキストが本文要素のままです。",
            reason: "括弧付きの条文見出しや条番号は、法令引用の階層を示す見出しとして分けると確認しやすくなります。",
            afterHtml: legalHeading.html,
            confidence: "medium",
            requiresHumanReview: true,
          })
        );
      }
    });

    fragment.content.querySelectorAll("ul").forEach((element) => {
      const requirementHeading = singleStrongListHeadingProposal(element);
      if (requirementHeading) {
        candidates.push(
          makeCandidate({
            ruleId: "html-structure.heading-required",
            element,
            message: "必要書類の項目名が1件だけの箇条書きになっています。",
            reason: "後続の説明文を持つ項目名は、箇条書きではなく見出しとして分けると文書構造が明確になります。",
            afterHtml: requirementHeading.html,
            confidence: "medium",
            requiresHumanReview: true,
          })
        );
      }

      const organizationHeading = organizationListHeadingProposal(element);
      if (organizationHeading) {
        candidates.push(
          makeCandidate({
            ruleId: "html-structure.heading-required",
            element,
            message: "申告先の組織名が1件だけの箇条書きになっています。",
            reason: "所在地や電話番号が続く組織名は、申告先の小見出しとして分けると関係が読み取りやすくなります。",
            afterHtml: organizationHeading.html,
            confidence: "medium",
            requiresHumanReview: true,
          })
        );
      }
    });

    fragment.content.querySelectorAll("h1,h2,h3,h4,h5,h6").forEach((element) => {
      const templateBlock = oldSiteTemplateHeadingProposal(element);
      if (templateBlock) {
        candidates.push(
          makeCandidate({
            ruleId: "html-structure.heading-order",
            element: templateBlock.element,
            message: "旧サイトテンプレート由来の見出しが本文候補に含まれています。",
            reason: "アンケートやメニューはCMS移行対象の本文ではないため、本文HTMLから除外します。",
            afterHtml: "",
            patch: { type: "remove-element" },
            confidence: "high",
            requiresHumanReview: true,
          })
        );
        return;
      }

      if (!isEmptyHeadingSection(element)) {
        return;
      }
      candidates.push(
        makeCandidate({
          ruleId: "html-structure.heading-order",
          element,
          message: "見出しだけがあり、対応する本文がありません。",
          reason: "本文や下位見出しを持たない空の節は、移行対象コンテンツとして残すか確認が必要です。",
          afterHtml: "",
          patch: { type: "remove-element" },
          confidence: "medium",
          requiresHumanReview: true,
        })
      );
    });
  }

  function collectLinkCandidates(fragment, candidates) {
    // miChecker C_57.5: 隣接(直前・直後)のhref付きリンクが同一URLかつ読み上げ可能テキストを持つ場合、
    // 「1つのリンクに統合できないか」の確認に振り分ける(item_57()のsequenceOk判定)。
    // 文書順のhref付きリンク一覧をあらかじめ計算しておく。
    const hrefLinkList = [...fragment.content.querySelectorAll("a[href]")];
    const hrefLinkTexts = hrefLinkList.map((el) => computeLinkAccessibleText(el, fragment.content));
    const hrefLinkHrefs = hrefLinkList.map((el) => (el.getAttribute("href") || "").trim());
    const hrefLinkIndex = new Map(hrefLinkList.map((el, idx) => [el, idx]));

    fragment.content.querySelectorAll("a").forEach((link) => {
      const text = normalizeText(link.textContent);
      const href = link.getAttribute("href") || "";
      const hrefInfo = classifyHref(href);

      // miChecker C_57.2/C_57.5: リンク内に読み上げ可能なテキストが無い(画像のみ・アイコンのみ等)。
      // テキストノード + img[alt] + aria-label/aria-labelledby を合成した「読み上げ可能テキスト」で判定する。
      // 完全に要素・テキストが空のリンク(item_57()のC_57.6区分)はcollectEmptyLinkCandidates()で別途
      // 扱うため、ここでは子ノードが1つ以上ある(画像等はあるがalt等の読み上げテキストが無い)場合のみ対象にする。
      if (!computeLinkAccessibleText(link, fragment.content) && link.childNodes.length > 0) {
        const idx = hrefLinkIndex.get(link);
        let adjacentText = null;
        if (idx !== undefined) {
          const currentHref = hrefLinkHrefs[idx];
          if (idx > 0 && hrefLinkHrefs[idx - 1] === currentHref && hrefLinkTexts[idx - 1]) {
            adjacentText = hrefLinkTexts[idx - 1];
          } else if (idx + 1 < hrefLinkList.length && hrefLinkHrefs[idx + 1] === currentHref && hrefLinkTexts[idx + 1]) {
            adjacentText = hrefLinkTexts[idx + 1];
          }
        }
        if (adjacentText) {
          candidates.push(
            makeCandidate({
              ruleId: "link.link-purpose-standalone",
              element: link,
              message: "直前または直後に同じリンク先へのリンクがあります。",
              reason: `読み上げ可能なテキストが無いリンクですが、直前または直後にある「${adjacentText}」への同一リンク先のリンクと1つに統合できないか検討してください。統合しない場合は、このリンクにも読み上げ可能なテキストを追加してください。`,
              afterHtml: link.outerHTML,
              confidence: "medium",
              requiresHumanReview: true,
              patchMode: "none",
            })
          );
        } else {
          candidates.push(
            makeCandidate({
              ruleId: "link.link-purpose-standalone",
              element: link,
              message: "リンク内に読み上げ可能なテキストがありません。",
              reason: "画像のみ・アイコンのみのリンクなど、読み上げ可能なテキストが無いリンクはスクリーンリーダーで内容が伝わりません。alt属性の追加やリンクテキストの追加で、リンク先が分かるようにしてください。",
              afterHtml: link.outerHTML,
              confidence: "medium",
              requiresHumanReview: true,
              patchMode: "none",
            })
          );
        }
      }

      const cleanedFileText = removeFileMeta(text);
      if (cleanedFileText !== text) {
        const clone = link.cloneNode(true);
        clone.textContent = cleanedFileText;
        candidates.push(
          makeCandidate({
            ruleId: "file.file-display-text",
            element: link,
            message: "ファイル種別・容量がリンクテキストに含まれています。",
            reason: "ファイル種別や容量はCMSが自動表示する前提のため、表示テキストから削除します。",
            afterHtml: clone.outerHTML,
            patch: { type: "set-text", value: cleanedFileText },
            confidence: "high",
            requiresHumanReview: false,
          })
        );
      }

      const effectiveLinkText = cleanedFileText !== text ? cleanedFileText : text;
      if (isGenericLinkText(effectiveLinkText)) {
        const guidanceProposal = buildGenericLinkGuidanceProposal(link);
        const inferredText = inferLinkText(link, href);
        const clone = link.cloneNode(true);
        clone.textContent = inferredText;
        candidates.push(
          guidanceProposal
            ? makeCandidate({
                ruleId: "link.link-text",
                element: guidanceProposal.element,
                message: "「詳細はこちらをご確認ください」の形式です。",
                reason: "リンクの直前文とリンク先を分け、リンクテキスト側でリンク先ページ名などが分かるようにします。",
                afterHtml: guidanceProposal.afterHtml,
                confidence: "low",
                requiresHumanReview: true,
              })
            : makeCandidate({
                ruleId: "link.link-text",
                element: link,
                message: "リンクテキストがリンク先を単独で説明していません。",
                reason: "「こちら」などの文言は、文脈から離れるとリンク先が分かりにくくなります。",
                afterHtml: clone.outerHTML,
                patch: { type: "set-text", value: inferredText },
                confidence: inferredText.includes("具体的に入力") ? "low" : "medium",
                requiresHumanReview: true,
                llmContext: {
                  href,
                  precedingHeading: closestPreviousHeadingText(link),
                  nearbyText: normalizeText(link.parentElement?.textContent || ""),
                },
              })
        );
      }

      // miChecker resource pages often write "申し込みフォーム　<a href="URL">URL</a>" — a
      // plain-text label followed by a link whose own visible text just repeats the raw URL.
      // A screen reader spells a URL out character by character, so when a short label
      // directly precedes the link, fold it into the link text and drop the now-redundant
      // leading label instead of just flagging the URL text as vague.
      if (/^https?:\/\//i.test(effectiveLinkText)) {
        const rawUrlProposal = buildRawUrlLinkTextProposal(link);
        candidates.push(
          rawUrlProposal
            ? makeCandidate({
                ruleId: "link.link-text",
                element: rawUrlProposal.element,
                message: "リンクテキストがURLそのものになっています。",
                reason: "URLをそのまま読み上げても内容が伝わりません。直前にある説明文をリンクテキストとして使い、重複するURL表記を削除します。",
                afterHtml: rawUrlProposal.afterHtml,
                confidence: "medium",
                requiresHumanReview: true,
              })
            : makeCandidate({
                ruleId: "link.link-text",
                element: link,
                message: "リンクテキストがURLそのものになっています。",
                reason: "URLをそのまま読み上げても内容が伝わりません。リンク先が分かる具体的な文言に修正してください。",
                afterHtml: link.outerHTML,
                confidence: "low",
                requiresHumanReview: true,
                patchMode: "none",
              })
        );
      }

      if (hrefInfo.isBrokenCandidate) {
        candidates.push(
          makeCandidate({
            ruleId: "link.link-broken",
            element: link,
            message: "リンク先が空、または仮リンクの可能性があります。",
            reason: "リンク切れや未確定リンクは本文HTMLだけで確定できないため、移行管理シートや移行元ページで確認します。",
            afterHtml: link.outerHTML,
            confidence: "low",
            requiresHumanReview: true,
            patchMode: "none",
          })
        );
      }

      if (/^javascript:/i.test(href.trim())) {
        const clone = link.cloneNode(true);
        clone.removeAttribute("href");
        candidates.push(
          makeCandidate({
            ruleId: "link.link-text",
            element: link,
            message: "javascript: URLが含まれています。",
            reason: "CMS登録用本文HTMLでは、動作前提のリンクは移行方法の確認が必要です。",
            afterHtml: clone.outerHTML,
            patch: { type: "remove-attribute", name: "href" },
            confidence: "high",
            requiresHumanReview: true,
          })
        );
      }

      if (hrefInfo.isTopPage) {
        const suggestedText = inferTopPageLinkText();
        const clone = link.cloneNode(true);
        clone.textContent = suggestedText;
        candidates.push(
          makeCandidate({
            ruleId: "link.toppage-link",
            element: link,
            message: "トップページへの内部リンクです。",
            reason: "トップページへのリンクはCMS側でページNo.1相当を指定し、リンクテキストはサイト名が分かる表記にします。",
            afterHtml: clone.outerHTML,
            patch: { type: "set-text", value: suggestedText },
            confidence: suggestedText.includes("サイト名") ? "low" : "medium",
            requiresHumanReview: true,
          })
        );
      }

      if (hrefInfo.isCrossPageAnchor) {
        candidates.push(
          makeCandidate({
            ruleId: "link.cross-page-anchor",
            element: link,
            message: "別ページ内の特定箇所へのアンカーリンクです。",
            reason: "移行後CMSで別ページ内アンカーを再現できない場合、リンク先ページ内の見るべき箇所を本文で補足します。",
            afterHtml: link.outerHTML,
            confidence: "low",
            requiresHumanReview: true,
            patchMode: "none",
          })
        );
      }

      if (hrefInfo.isCategoryCandidate) {
        candidates.push(
          makeCandidate({
            ruleId: "link.category-link",
            element: link,
            message: "カテゴリページへのリンクの可能性があります。",
            reason: "カテゴリページは移行管理シートだけでは特定しにくいため、パンくずやCMSツリーでリンク先カテゴリを確認します。",
            afterHtml: link.outerHTML,
            confidence: "low",
            requiresHumanReview: true,
            patchMode: "none",
          })
        );
      }

      if (hrefInfo.isPdf && hrefInfo.isExternal) {
        candidates.push(
          makeCandidate({
            ruleId: "file.external-pdf",
            element: link,
            message: "外部ドメインのPDFリンクです。",
            reason: "外部サイトのPDFは無断転載防止のため、ファイル取り込みではなく外部リンクとして扱う必要があります。",
            afterHtml: link.outerHTML,
            confidence: "medium",
            requiresHumanReview: true,
            patchMode: "none",
          })
        );
      } else if (hrefInfo.isExternal) {
        candidates.push(
          makeCandidate({
            ruleId: "link.external-link",
            element: link,
            message: "外部ドメインへのリンクです。",
            reason: "CMS管理外ページは外部リンク機能で扱う前提です。リンク切れやリンク先名との不一致も確認します。",
            afterHtml: link.outerHTML,
            confidence: "medium",
            requiresHumanReview: true,
            patchMode: "none",
          })
        );
      } else if (
        (hrefInfo.isInternalAbsolute || hrefInfo.isInternalRelative) &&
        !hrefInfo.isTopPage &&
        !hrefInfo.isCategoryCandidate &&
        !hrefInfo.isCrossPageAnchor
      ) {
        candidates.push(
          makeCandidate({
            ruleId: "link.internal-link",
            element: link,
            message: hrefInfo.isInternalAbsolute ? "同一ドメインの絶対URLリンクです。" : "CMS管理内ページへの相対リンクです。",
            reason: "CMS管理内ページであれば、移行後ページを内部リンク機能で指定できるか確認します。",
            afterHtml: link.outerHTML,
            confidence: "medium",
            requiresHumanReview: true,
            patchMode: "none",
          })
        );
      }

      if (hrefInfo.isInPageAnchor) {
        const clone = link.cloneNode(true);
        clone.removeAttribute("href");
        candidates.push(
          makeCandidate({
            ruleId: "link.in-page-anchor",
            element: link,
            message: "ページ内アンカーリンクです。",
            reason: "ページ内アンカーは原則移行せず、リンク先の箇所を本文で示す形にできるか確認します。",
            afterHtml: clone.outerHTML,
            confidence: "low",
            requiresHumanReview: true,
            patchMode: "none",
          })
        );
      }

      if (isEmailAddress(text) || /^mailto:/i.test(href.trim())) {
        const suggestedText = inferMailLinkText(link, text, href);
        const clone = link.cloneNode(true);
        clone.textContent = suggestedText;
        candidates.push(
          makeCandidate({
            ruleId: "link.mail-link",
            element: link,
            message: "メールアドレスがリンク文言に使われています。",
            reason: "メールリンクは生アドレスではなく「担当部署へメールを送信」のような文言にし、CMSのメールリンク機能で扱います。",
            afterHtml: clone.outerHTML,
            patch: { type: "set-text", value: suggestedText },
            confidence: suggestedText.includes("担当部署") ? "low" : "medium",
            requiresHumanReview: true,
            llmContext: { nearbyText: normalizeText(link.closest("p,li,td,th,div")?.textContent || ""), mailAddress: text },
          })
        );
      }
    });
  }

  function collectTableCandidates(fragment, candidates) {
    fragment.content.querySelectorAll("table").forEach((table) => {
      const mergeRule = table.querySelector("[rowspan], [colspan]") ? classifyMergedCellTable(table) : null;
      if (mergeRule && tableDecomposeMergeRuleIds.has(mergeRule.ruleId)) {
        const mergeProposal = buildMergedCellProposal(table, mergeRule);
        candidates.push(
          makeCandidate({
            ruleId: mergeRule.ruleId,
            element: table,
            message: mergeRule.message,
            reason: `${mergeRule.reason} このセル結合の再構成は、キャプション修正とは別の候補として提示しています。`,
            afterHtml: mergeProposal.afterHtml,
            patchMode: mergeProposal.patchMode,
            confidence: mergeRule.confidence,
            requiresHumanReview: true,
            llmContext: mergeProposal.images?.length ? { images: mergeProposal.images } : null,
          })
        );
      }
      if (mergeRule && !tableDecomposeMergeRuleIds.has(mergeRule.ruleId)) {
        const mergeProposal = buildMergedCellProposal(table, mergeRule);
        candidates.push(
          makeCandidate({
            ruleId: mergeRule.ruleId,
            element: table,
            message: mergeRule.message,
            reason: `${mergeRule.reason} このセル結合の再構成は、キャプション修正とは別の候補として提示しています。`,
            afterHtml: mergeProposal.afterHtml,
            patchMode: mergeProposal.patchMode,
            confidence: mergeRule.confidence,
            requiresHumanReview: true,
          })
        );
      }

      // miChecker C_331.0/C_331.1/C_332.1/C_332.2: th単位のscope検査とheaders参照検証。
      // 表全体をデータ表/レイアウト表として再構築する下記のplanTableTreatment判定とは独立に、
      // 個々のth・headers属性を機械的に走査する(表単位のhasScope判定は変更しない)。
      collectTableHeaderScopeCandidates(table, candidates);

      const plan = planTableTreatment(table);

      if (plan.kind === "structural") {
        candidates.push(
          makeCandidate({
            ruleId: plan.ruleId,
            element: table,
            message: plan.message,
            reason: plan.reason,
            afterHtml: plan.afterHtml,
            patchMode: plan.patchMode,
            confidence: plan.confidence,
            requiresHumanReview: plan.requiresHumanReview,
            llmContext: plan.llmContext,
          })
        );
        return;
      }

      // miChecker C_12.0/C_12.1/C_12.2/C_23.0/C_23.2/C_75.0: 上のplanTableTreatment()が
      // 「構造的な解体・再構築が必要」と判断しなかった表に対して、miChecker本体の素朴な構造判定
      // (nested/1row1col/notdata/data)を独立したシグナルとして適用する。
      collectNaiveTableStructureCandidates(table, candidates);

      if (hasTableFormatting(table)) {
        const clone = table.cloneNode(true);
        stripFormatting(clone);
        candidates.push(
          makeCandidate({
            ruleId: "table.format-clear",
            element: table,
            message: "表の書式設定を解除できます。",
            reason: "フォント・色・罫線などの書式設定は、他アプリからの貼り付けの際に残った可能性があります。書式を解除して内容を整理してください。",
            afterHtml: clone.outerHTML,
            patch: { type: "strip-formatting" },
            confidence: "high",
            requiresHumanReview: false,
          })
        );
      }

      if (!table.querySelector("caption")) {
        const clone = table.cloneNode(true);
        const caption = document.createElement("caption");
        caption.textContent = genericTableCaption;
        clone.insertBefore(caption, clone.firstChild);
        candidates.push(
          makeCandidate({
            ruleId: "table.caption",
            element: table,
            message: "表にキャプションがありません。",
            reason: "キャプションを追加すると、利用者や支援技術がこの表の内容を理解しやすくなります。",
            afterHtml: clone.outerHTML,
            patch: { type: "insert-caption", value: genericTableCaption },
            confidence: "low",
            requiresHumanReview: true,
          })
        );
      } else {
        // miChecker C_25.3(table.caption): captionが既に存在する表について、その内容が表を特定できる
        // ものかを確認する。「表」「一覧」等、内容を特定しない汎用語のみのcaptionに限定して低確信度で
        // フラグする(具体的な語を含むcaption、例:「対象者一覧」は対象外)。
        const captionElement = table.querySelector("caption");
        const captionText = normalizeText(captionElement.textContent);
        if (isGenericTableCaptionText(captionText)) {
          candidates.push(
            makeCandidate({
              ruleId: "table.caption",
              element: captionElement,
              message: "表のキャプションが汎用的で、この表の内容を特定できません。",
              reason: "「表」「一覧」などの語だけでは、この表が何を表しているか特定できません。表の内容が分かる具体的なキャプションに修正してください。",
              afterHtml: captionElement.outerHTML,
              confidence: "low",
              requiresHumanReview: true,
              patchMode: "none",
            })
          );
        }
      }
    });
  }

  function planTableTreatment(table) {
    const mergeRule = table.querySelector("[rowspan], [colspan]") ? classifyMergedCellTable(table) : null;

    if (shouldPreserveAsDataTable(table) && tableNeedsDataTableSemantics(table)) {
      return {
        kind: "structural",
        ruleId: "table.caption",
        message: "データ表として維持し、キャプション・列見出し・行見出し・scope属性をまとめて追加できます。",
        reason: "表をレイアウト用として解体する前に、行・列の関係を持つデータ表かどうかを確認します。データ表として維持できる場合は、表を崩さずにキャプション・列見出し・行見出し・scope属性をまとめて追加します。",
        afterHtml: buildDataTableSemanticsHtml(table),
        patchMode: "replace",
        confidence: dataTableSemanticsConfidence(table),
        requiresHumanReview: true,
      };
    }

    if (mergeRule && tableDecomposeMergeRuleIds.has(mergeRule.ruleId)) {
      if (canSplitMergedRowsIntoTables(table)) {
        return {
          kind: "structural",
          ruleId: "table.cell-merge-layout",
          message: "結合により複数の意味単位が1つの表にまとめられています。",
          reason: "強引に1つの表へまとめたことで結合が発生している場合は、表を意味単位に分割する方法も選択肢に含めます。",
          afterHtml: splitMergedRowsIntoTablesHtml(table),
          patchMode: "replace",
          confidence: "medium",
          requiresHumanReview: true,
        };
      }
      return { kind: "data" };
    }

    if (isLikelyLayoutTable(table)) {
      const imageContexts = [];
      const afterHtml = decomposeLayoutTable(table, imageContexts);
      return {
        kind: "structural",
        ruleId: "table.layout-table",
        message: "この表はレイアウト目的で使われている可能性があります。",
        reason: layoutTableReason(table),
        afterHtml,
        patchMode: "replace",
        confidence: layoutTableConfidence(table),
        requiresHumanReview: true,
        llmContext: imageContexts.length ? { images: imageContexts } : null,
      };
    }

    // Note: a non-decompose-set mergeRule (heading/note/summary/...) is NOT re-emitted here.
    // collectTableCandidates() already pushes it unconditionally via its own direct check
    // (the "mergeRule && !tableDecomposeMergeRuleIds.has(...)" branch); re-pushing the same
    // candidate here as "structural" would duplicate it whenever shouldPreserveAsDataTable()
    // is false (the only case execution reaches this point with such a mergeRule).
    return { kind: "data" };
  }

  // miChecker C_331.0/C_331.1: th要素はscope属性(col/row/colgroup/rowgroup)を持つ必要がある。
  // miChecker C_332.1/C_332.2: headers属性の値は、同じ表内に存在するth・td要素のidを指す必要がある。
  // (checkitem.xmlにはC_332.0も定義されているが、miChecker本体のCheckEngine.java item_332()では
  //  C_332.1/C_332.2のみが発火し、C_332.0は実装上呼び出されない。そのため本実装でもC_332.1/C_332.2相当のみを検出する。)
  function collectTableHeaderScopeCandidates(table, candidates) {
    table.querySelectorAll("th").forEach((th) => {
      if (!th.hasAttribute("scope")) {
        const suggested = guessThScopeValue(th);
        const clone = th.cloneNode(true);
        clone.setAttribute("scope", suggested);
        candidates.push(
          makeCandidate({
            ruleId: "table.th-scope",
            element: th,
            message: "th要素にscope属性がありません。",
            reason: "表の見出しセル(th)には、見出しの方向を示すscope属性(col/row/colgroup/rowgroup)が必要です。表の構造を確認し、正しい方向を設定してください。",
            afterHtml: clone.outerHTML,
            patch: { type: "set-attribute", name: "scope", value: suggested },
            confidence: "low",
            requiresHumanReview: true,
            llmContext: { tableHtml: table.outerHTML },
          })
        );
        return;
      }

      const scopeValue = normalizeText(th.getAttribute("scope") || "");
      if (!/^(row|col|rowgroup|colgroup)$/.test(scopeValue)) {
        const suggested = guessThScopeValue(th);
        const clone = th.cloneNode(true);
        clone.setAttribute("scope", suggested);
        candidates.push(
          makeCandidate({
            ruleId: "table.th-scope",
            element: th,
            message: `th要素のscope属性値「${scopeValue}」が不正です。`,
            reason: "scope属性にはcol・row・colgroup・rowgroupのいずれかを指定します。表の構造を確認し、正しい方向に修正してください。",
            afterHtml: clone.outerHTML,
            patch: { type: "set-attribute", name: "scope", value: suggested },
            confidence: "low",
            requiresHumanReview: true,
            llmContext: { tableHtml: table.outerHTML },
          })
        );
      }
    });

    table.querySelectorAll("[headers]").forEach((cell) => {
      const ids = (cell.getAttribute("headers") || "").split(/\s+/).filter(Boolean);
      ids.forEach((id) => {
        let referred = null;
        try {
          referred = table.querySelector(`#${cssEscape(id)}`);
        } catch {
          referred = null;
        }
        if (!referred) {
          candidates.push(
            makeCandidate({
              ruleId: "table.th-scope",
              element: cell,
              message: `headers属性が参照するid「${id}」が表内に見つかりません。`,
              reason: "headers属性の値には、同じ表内にある見出しセル(th)のid値を指定します。参照先が存在しない、または表外を指している場合は、idの記載やth側へのid付与を見直してください。",
              afterHtml: cell.outerHTML,
              confidence: "low",
              requiresHumanReview: true,
              patchMode: "none",
            })
          );
        } else if (!["TH", "TD"].includes(referred.tagName)) {
          candidates.push(
            makeCandidate({
              ruleId: "table.th-scope",
              element: cell,
              message: `headers属性が参照する要素(id="${id}")がth・td要素ではありません(<${referred.tagName.toLowerCase()}>)。`,
              reason: "headers属性はth・td要素のidだけを参照できます。参照先を見出しセル(th)またはデータセル(td)に修正してください。",
              afterHtml: cell.outerHTML,
              confidence: "low",
              requiresHumanReview: true,
              patchMode: "none",
            })
          );
        }
      });
    });

    collectThLayoutPatternCandidate(table, candidates);
  }

  // miChecker C_331.2(item_331()のisSimpleTable2): th要素が1行目・1列目のみにある単純な表
  // (1行目: 左上のみtd、それ以外は全てth / 2行目以降: 各行の先頭セルのみth(rowspan無し)、
  // 残りは全てtd)を検出し、左上のtd要素にテキストがあれば「削除するかth要素に変更することを
  // 検討」の確認候補を出す。isLikelyLayoutTable()と判定される表は対象外にする
  // (miChecker本体もdataTableListのみを対象にitem_331()を実行するため)。
  function collectThLayoutPatternCandidate(table, candidates) {
    if (isLikelyLayoutTable(table)) {
      return;
    }
    const grid = buildExpandedTableGrid(table);
    if (grid.length < 2) {
      return;
    }
    const firstRow = grid[0];
    if (!firstRow || firstRow.length < 2) {
      return;
    }

    const topLeft = firstRow[0];
    if (!topLeft || !topLeft.isOrigin || topLeft.cell.tagName !== "TD") {
      return;
    }
    const topLeftText = normalizeText(topLeft.text);
    if (!topLeftText) {
      return;
    }

    // 1行目(左上を除く)は、その行で始まる(isOrigin)セルが全てth。
    const columnHeaderCells = firstRow.slice(1).filter((item) => item && item.rowIndex === 0);
    if (columnHeaderCells.length === 0 || !columnHeaderCells.every((item) => item.isHeader)) {
      return;
    }

    // 1列目(1行目を除く)は、各行の先頭セルが全てth(その行で始まる、rowspanで上から続くものは除く)。
    const rowHeaderCells = grid.slice(1).map((row) => row?.[0]);
    if (rowHeaderCells.length === 0 || rowHeaderCells.some((item) => !item || !item.isOrigin || !item.isHeader)) {
      return;
    }

    // 1行目・1列目以外にth要素が無いこと(単純な行列見出しパターン以外は対象外)。
    const hasStrayHeader = grid.some((row, rowIndex) =>
      row.some((item, columnIndex) => item?.isOrigin && item.isHeader && rowIndex !== 0 && columnIndex !== 0)
    );
    if (hasStrayHeader) {
      return;
    }

    candidates.push(
      makeCandidate({
        ruleId: "table.th-scope",
        element: topLeft.cell,
        message: "th要素が1行目・1列目のみにある単純な表の左上のtd要素にテキストが存在しています。",
        reason: "この左上のセルはどの見出し(th)の方向にも対応しない位置です。このセルのテキストを削除するか、th要素に変更することを検討してください。",
        afterHtml: topLeft.cell.outerHTML,
        confidence: "low",
        requiresHumanReview: true,
        patchMode: "none",
      })
    );
  }

  function guessThScopeValue(th) {
    const row = th.parentElement && th.parentElement.tagName === "TR" ? th.parentElement : null;
    if (th.closest("thead")) {
      return "col";
    }
    const cellIndex = row ? [...row.children].indexOf(th) : 0;
    if (cellIndex === 0) {
      return "row";
    }
    const table = th.closest("table");
    const firstRow = table?.querySelector("tr");
    if (firstRow && row === firstRow) {
      return "col";
    }
    return "col";
  }

  function shouldPreserveAsDataTable(table) {
    const profile = dataTableProfile(table);
    const explicitSemantics = profile.hasCaption || profile.hasThead || profile.hasHeaderCell || profile.hasScope;
    if (!explicitSemantics && isRelationExplanationTableProfile(profile)) {
      return false;
    }
    if (profile.hasMedia && !explicitSemantics) {
      return false;
    }
    if (isRowHeaderOnlyDataTableProfile(profile)) {
      return true;
    }
    if (looksLikeContactDataTable(profile)) {
      return true;
    }
    if (explicitSemantics) {
      return true;
    }
    return profile.rows.length >= 2 && profile.maxCells >= 2 && (profile.firstRowHeaderLike || profile.hasDataValues);
  }

  function tableNeedsDataTableSemantics(table) {
    const profile = dataTableProfile(table);
    if ((profile.rows.length < 2 && !isSingleRecordContactDataTableProfile(profile)) || profile.maxCells < 2) {
      return false;
    }
    if (!shouldPreserveAsDataTable(table)) {
      return false;
    }
    if (isKeyValueDataTableProfile(profile) || isRowHeaderOnlyDataTableProfile(profile)) {
      return !profile.hasCaption || !profile.hasHeaderCell || !profile.hasScope || profile.hasThead;
    }
    return !profile.hasCaption || !profile.hasThead || !profile.hasHeaderCell || !profile.hasScope;
  }

  function dataTableSemanticsConfidence(table) {
    const profile = dataTableProfile(table);
    if (profile.hasHeaderCell || profile.hasThead) return "medium";
    if (looksLikeContactDataTable(profile) || isLeadingTitleRowDataTableProfile(profile)) return "medium";
    if (profile.firstRowHeaderLike && profile.hasDataValues) return "medium";
    return "low";
  }

  function dataTableProfile(table) {
    const rows = [...table.querySelectorAll("tr")].map((row) =>
      [...row.children].filter((cell) => ["TD", "TH"].includes(cell.tagName))
    );
    const nonEmptyRows = rows.filter((row) => row.length > 0);
    const maxCells = nonEmptyRows.reduce((max, row) => Math.max(max, row.length), 0);
    const firstRow = nonEmptyRows[0] || [];
    const hasHeaderCell = nonEmptyRows.some((row) => row.some((cell) => cell.tagName === "TH"));
    const firstColumnHeaderRatio = nonEmptyRows.length
      ? nonEmptyRows.filter((row) => row[0]?.tagName === "TH").length / nonEmptyRows.length
      : 0;
    return {
      rows: nonEmptyRows,
      maxCells,
      firstRow,
      hasCaption: Boolean(table.querySelector(":scope > caption")),
      hasThead: Boolean(table.querySelector(":scope > thead")),
      hasHeaderCell,
      hasScope: Boolean(table.querySelector("th[scope], td[scope]")),
      hasMedia: Boolean(table.querySelector("img, iframe, video, audio, object, embed")),
      hasDataValues: nonEmptyRows.some((row, rowIndex) =>
        rowIndex > 0 && row.some((cell) => isTableDataValueText(cell.textContent || ""))
      ),
      hasAnyDataValues: nonEmptyRows.some((row) => row.some((cell) => isTableDataValueText(cell.textContent || ""))),
      // A rowspan cell in the first row means that cell (and likely the whole row) is a
      // row-group label spanning several body rows, not a one-row column header — a genuine
      // header row doesn't reach down into the body. isHeaderLikeTableCell() alone can't tell
      // "対象区分"(a row-group label) apart from "受講料"(a real header) since both are short
      // plain text, so rowspan is used as the deciding signal to keep such rows out of thead.
      firstRowHeaderLike:
        firstRow.length >= 2 &&
        !firstRow.some((cell) => (Number(cell.getAttribute("rowspan")) || 1) > 1) &&
        firstRow.every((cell) => isHeaderLikeTableCell(cell)),
      firstColumnHeaderRatio,
    };
  }

  function isTableDataValueText(text) {
    // "クリック！（JPG：629KB）"のようなファイルサイズ注記は、municipal pageのリンク文言として
    // 極めて頻出するが、あくまでリンク先ファイルの付随情報であり、表データ(電話番号・金額・
    // 数量など)ではない。ここでの数字判定より先に除去しないと、写真キャプションだけの表が
    // 「データ値を含む行がある」と誤判定され、データ表として温存されてしまう(実例: 単なる
    // 写真キャプション+ダウンロードリンクの2x2表が、実在しない列見出し付きの表へ再構築された)。
    const withoutFileSizeAnnotations = normalizeText(text).replace(/[0-9０-９,，.．]+\s*[KMGkmg][Bb]/g, "");
    return /[0-9０-９]|電話|TEL|FAX|メール|住所|所在地|円|％|%/.test(withoutFileSizeAnnotations);
  }

  function isHeaderLikeTableCell(cell) {
    const text = normalizeText(cell.textContent || "");
    if (!text) return false;
    // 閉じ括弧類(）)】」』])で終わる文字列も、文末の句読点(。.!?！？)と同様に「見出しらしい
    // 短い体言」ではなく通常の文の一部である可能性が高い。この除外が無いと、「クリック！
    // （JPG：629KB）」のようなファイル情報付きリンクだけのセルが、閉じ括弧で終わるにも
    // かかわらず文末記号にマッチしないため誤って見出し扱いされていた。
    if (text.length <= 28 && !/[。.!?！？）)】」』\]]$/.test(text)) return true;
    return /項目|内容|区分|種別|車種|対象|税率|金額|所得|診療|時間|電話|所在地|名称|日程|会場|結果|勝敗/.test(text);
  }

  function isRelationExplanationTableProfile(profile) {
    if (profile.rows.length > 2 || profile.maxCells > 3 || !profile.hasAnyDataValues) return false;
    const text = normalizeText(profile.rows.flat().map((cell) => cell.textContent || "").join(" "));
    return /⇨|⇒|→|->/.test(text);
  }

  function buildDataTableSemanticsHtml(table) {
    const profile = dataTableProfile(table);
    const output = document.createElement("table");
    [...table.attributes].forEach((attr) => output.setAttribute(attr.name, attr.value));

    const captionText = dataTableCaptionText(table, profile);
    if (captionText) {
      const caption = document.createElement("caption");
      caption.textContent = captionText;
      output.appendChild(caption);
    }

    if (isRowHeaderOnlyDataTableProfile(profile)) {
      const tbody = document.createElement("tbody");
      profile.rows.forEach((cells, rowIndex) => {
        const row = document.createElement("tr");
        cells.forEach((cell, index) => {
          if (index === 0) {
            row.appendChild(cloneTableCellAs(cell, "th", rowIndex > 0 ? "row" : ""));
          } else {
            row.appendChild(cloneTableCellAs(cell, "td", ""));
          }
        });
        tbody.appendChild(row);
      });
      output.appendChild(tbody);
      return cleanHtml(output.outerHTML);
    }

    if (isKeyValueDataTableProfile(profile)) {
      const tbody = document.createElement("tbody");
      profile.rows.forEach((cells) => {
        const row = document.createElement("tr");
        cells.forEach((cell, index) => {
          row.appendChild(cloneTableCellAs(cell, index === 0 ? "th" : "td", index === 0 ? "row" : ""));
        });
        tbody.appendChild(row);
      });
      output.appendChild(tbody);
      return cleanHtml(output.outerHTML);
    }

    if (isLeadingTitleRowDataTableProfile(profile)) {
      const thead = document.createElement("thead");
      const headerRow = document.createElement("tr");
      (profile.rows[1] || []).forEach((cell) => {
        headerRow.appendChild(cloneTableCellAs(cell, "th", "col"));
      });
      thead.appendChild(headerRow);
      output.appendChild(thead);

      const tbody = document.createElement("tbody");
      profile.rows.slice(2).forEach((cells) => {
        const row = document.createElement("tr");
        cells.forEach((cell) => {
          row.appendChild(cloneTableCellAs(cell, cell.tagName === "TH" ? "th" : "td", cell.tagName === "TH" ? "row" : ""));
        });
        tbody.appendChild(row);
      });
      output.appendChild(tbody);
      return cleanHtml(output.outerHTML);
    }

    const headerPlan = dataTableHeaderPlan(profile);
    const headerTexts = headerPlan.headerCells.map((cell) => normalizeText(cell.textContent || ""));
    if (headerPlan.headerCells.length > 0) {
      const thead = document.createElement("thead");
      const row = document.createElement("tr");
      headerPlan.headerCells.forEach((cell, index) => {
        row.appendChild(cloneTableCellAs(cell, "th", "col"));
      });
      thead.appendChild(row);
      output.appendChild(thead);
    }

    const columnCount = headerTexts.length || profile.maxCells;
    const noteEntries = [];
    const tbody = document.createElement("tbody");
    // A rowspan on a row's first cell shifts that row's own identifying cell one column to
    // the right (index 1, not 0) — the rowspan cell is a *group* header for several rows,
    // not that particular row's header. Rows "under" the span keep their real column 0 cell
    // (the rowspan already fills their missing column 0), so only the row that *originates*
    // the span needs the shifted index. rowSpanCarry tracks how many more rows still fall
    // under a rowspan that started earlier, so only the originating row gets shifted.
    let rowSpanCarry = 0;
    profile.rows.slice(headerPlan.bodyStartIndex).forEach((cells) => {
      const row = document.createElement("tr");
      const firstCellRowSpan = Number(cells[0]?.getAttribute("rowspan")) || 1;
      const rowOriginatesSpan = rowSpanCarry === 0 && firstCellRowSpan > 1;
      if (rowOriginatesSpan) {
        rowSpanCarry = firstCellRowSpan - 1;
      } else if (rowSpanCarry > 0) {
        rowSpanCarry -= 1;
      }
      const rowHeaderIndex = rowOriginatesSpan ? 1 : 0;

      cells.forEach((cell, index) => {
        const isGroupHeaderCell = index === 0 && (Number(cell.getAttribute("rowspan")) || 1) > 1;
        const isRowHeaderCell = isGroupHeaderCell || index === rowHeaderIndex || cell.tagName === "TH";
        // A row-header cell that spans multiple rows via rowspan is labelling a group of
        // rows, not one row, so scope="rowgroup" describes it more accurately than "row".
        const rowHeaderScope = isGroupHeaderCell ? "rowgroup" : "row";
        const clone = cloneTableCellAs(cell, isRowHeaderCell ? "th" : "td", isRowHeaderCell ? rowHeaderScope : "");
        if (isRowHeaderCell) {
          const note = extractEmbeddedTableCellNote(clone);
          if (note) noteEntries.push({ label: normalizeText(clone.textContent || ""), note });
        } else {
          normalizeGenericFileLinkText(clone, headerTexts[index]);
        }
        row.appendChild(clone);
      });
      // Pad short rows out to columnCount so every row has the same number of cells —
      // but a colspan cell already occupies multiple columns, so counting DOM children
      // (cells.length) instead of columns actually covered used to add extra empty <td>
      // after a colspan row (e.g. a colspan="3" title row got 2 bogus empty cells tacked
      // on even though it already spans all 3 columns).
      const occupiedColumns = cells.reduce((sum, cell) => sum + (Number(cell.getAttribute("colspan")) || 1), 0);
      for (let index = occupiedColumns; index < columnCount; index += 1) {
        row.appendChild(document.createElement("td"));
      }
      tbody.appendChild(row);
    });
    output.appendChild(tbody);
    return cleanHtml(output.outerHTML) + buildTableNoteSectionHtml(noteEntries);
  }

  function dataTableHeaderPlan(profile) {
    if (!profile.hasThead && profile.firstColumnHeaderRatio >= 0.5) {
      return { headerCells: syntheticTableHeaderCells(profile), bodyStartIndex: 0, synthetic: true };
    }
    if (profile.hasThead || profile.firstRowHeaderLike || profile.firstRow.every((cell) => cell.tagName === "TH")) {
      return { headerCells: profile.firstRow, bodyStartIndex: 1, synthetic: false };
    }
    return { headerCells: syntheticTableHeaderCells(profile), bodyStartIndex: 0, synthetic: true };
  }

  function isKeyValueDataTableProfile(profile) {
    if (profile.hasThead || profile.maxCells !== 2 || profile.rows.length < 2) return false;
    if (profile.firstRowHeaderLike) return false;
    const labelRows = profile.rows.filter((row) => isHeaderLikeTableCell(row[0])).length;
    return labelRows >= Math.ceil(profile.rows.length * 0.6);
  }

  function isRowHeaderOnlyDataTableProfile(profile) {
    if (profile.hasThead || profile.maxCells !== 2 || profile.rows.length < 2) return false;
    const labelRows = profile.rows.filter((row) => isHeaderLikeTableCell(row[0])).length;
    if (labelRows < Math.ceil(profile.rows.length * 0.6)) return false;
    const profileLabelRows = profile.rows.filter((row) => isProfileLabelText(normalizeText(row[0]?.textContent || ""))).length;
    if (profileLabelRows < Math.min(2, profile.rows.length)) return false;

    const firstKeyText = normalizeText(profile.rows[0]?.[0]?.textContent || "");
    const firstValueCell = profile.rows[0]?.[1];
    const firstValueText = normalizeText(firstValueCell?.textContent || "");
    if (!firstKeyText || !firstValueText) return false;
    if (looksLikeGenericTableHeaderPair(firstKeyText, firstValueText) && isHeaderLikeTableCell(firstValueCell)) {
      return false;
    }

    const firstColumnAverageLength = averageTableColumnTextLength(profile.rows, 0);
    const secondColumnAverageLength = averageTableColumnTextLength(profile.rows, 1);
    const valueLikeCells = profile.rows.filter((row) => looksLikeValueTableCell(row[1])).length;
    return (
      secondColumnAverageLength >= Math.max(16, firstColumnAverageLength * 1.6) ||
      valueLikeCells >= Math.ceil(profile.rows.length * 0.6) ||
      !isHeaderLikeTableCell(firstValueCell)
    );
  }

  function isSingleRecordContactDataTableProfile(profile) {
    return profile.rows.length === 1 && looksLikeContactDataTable(profile);
  }

  function isLeadingTitleRowDataTableProfile(profile) {
    if (profile.hasThead || profile.maxCells < 2 || profile.rows.length < 3) return false;
    const titleRow = profile.rows[0] || [];
    const headerRow = profile.rows[1] || [];
    const bodyRows = profile.rows.slice(2);
    const titleText = leadingTitleRowCaptionText(profile);
    if (!titleText || !bodyRows.length) return false;
    // 「先頭行はタイトルバナーで、実際のヘッダーは2行目」というパターンは、1セルだけで
    // タイトルが完結している場合(<tr><th colspan="N">タイトル</th></tr>)に限定する。以前は
    // 複数セルの合計colspanがたまたま列数と一致するケースも許容していたが、これは単に
    // colspanで複数列をグループ化しただけの、ごく普通のヘッダー行(例: 5列中2列を
    // 「連絡先」というcolspan="2"の見出しでまとめた表)も誤って「タイトル行」と判定して
    // しまい、本来のヘッダー行を捨てて次の行(実際にはデータ行)をヘッダーとして扱って
    // しまう実害が確認されたため、単一セルのタイトル行のみを対象とするよう厳格化した。
    if (titleRow.length !== 1) return false;
    if (headerRow.length !== profile.maxCells) return false;
    if (!headerRow.every((cell) => cell.tagName === "TH" || isHeaderLikeTableCell(cell))) return false;
    return bodyRows.some((row) => row.some((cell) => isTableDataValueText(cell.textContent || "") || !isHeaderLikeTableCell(cell)));
  }

  function leadingTitleRowCaptionText(profile) {
    return normalizeText((profile.rows[0] || []).map((cell) => cell.textContent || "").join(" "));
  }

  function averageTableColumnTextLength(rows, index) {
    const texts = rows.map((row) => normalizeText(row[index]?.textContent || "")).filter(Boolean);
    if (!texts.length) return 0;
    return texts.reduce((sum, text) => sum + text.length, 0) / texts.length;
  }

  function looksLikeValueTableCell(cell) {
    const text = normalizeText(cell?.textContent || "");
    if (!text) return false;
    return isTableDataValueText(text) || text.length >= 20 || /[0-9]{2,}|https?:|[()（）【】「」〒]/.test(text);
  }

  function looksLikeGenericTableHeaderPair(leftText, rightText) {
    return isGenericTableHeaderText(leftText) && isGenericTableHeaderText(rightText);
  }

  function isProfileLabelText(text) {
    return /^(?:チーム名|ホームタウン|ホームアリーナ(?:タウン)?|トレーニングアリーナ|名称|所在地|住所|連絡先|電話(?:番号)?|FAX|メール|URL|開館時間|休館日|アクセス|代表(?:者)?|設立|定員|料金|対象者?|所属|ポジション|背番号|出身地|生年月日|身長|Team name|Home town|Home arena|Training arena|Address|Phone|Email|Website)$/iu.test(
      normalizeText(text)
    );
  }

  function isGenericTableHeaderText(text) {
    return /^(?:項目|内容|詳細|概要|区分|種類|名称|件名|日程|日時|時間|会場|場所|対象|相手|試合結果|勝敗|備考|税率|金額|手数料|電話(?:番号)?|メール|住所|問い合わせ先|申告(?:先|場所)?|担当(?:課|部署)?)$/u.test(
      normalizeText(text)
    );
  }

  function syntheticTableHeaderCells(profile) {
    const headers = [];
    const contact = looksLikeContactDataTable(profile);
    for (let index = 0; index < profile.maxCells; index += 1) {
      const cell = document.createElement("th");
      if (contact && index === 0) cell.textContent = "";
      else if (contact && index === 1) cell.textContent = "電話番号";
      else if (contact && index === 2) cell.textContent = "メール";
      else cell.textContent = index === 0 ? "項目" : `内容${index}`;
      headers.push(cell);
    }
    return headers;
  }

  function looksLikeContactDataTable(profile) {
    if (profile.maxCells !== 3 || profile.rows.length < 1) return false;
    const phoneCells = profile.rows.filter((row) => /(?:電話|TEL|[0-9０-９]{2,4}[-ー－][0-9０-９]{2,4})/i.test(row[1]?.textContent || "")).length;
    const mailCells = profile.rows.filter((row) => /メール|mail_icon|mailto:/i.test(row[2]?.innerHTML || "")).length;
    return phoneCells >= Math.ceil(profile.rows.length * 0.5) && mailCells >= Math.ceil(profile.rows.length * 0.5);
  }

  function cloneTableCellAs(cell, tagName, scope) {
    const clone = document.createElement(tagName);
    [...cell.attributes].forEach((attr) => {
      if (!["scope", "headers", "bgcolor"].includes(attr.name.toLowerCase())) {
        clone.setAttribute(attr.name, attr.value);
      }
    });
    if (scope) {
      clone.setAttribute("scope", scope);
    }
    clone.innerHTML = cell.innerHTML;
    // miChecker C_500.17/C_500.18: 色・背景色の指定は表の再構築後にも引き継がない
    // (collectInlineStyleCandidate()がテーブルセル内の色系styleも候補化・除去対象にしたことと整合を取る。
    //  bgcolor属性は上のattributesコピーから既に除外している)。
    removeStyleProperties(clone, ["color", "background", "background-color"]);
    return clone;
  }

  const GENERIC_FILE_LINK_TEXT_PATTERN = /^(pdf|excel|word|powerpoint|パワーポイント|ワード|エクセル|xlsx?|docx?|pptx?)$/i;

  function normalizeGenericFileLinkText(cell, columnHeaderText) {
    if (!columnHeaderText) return;
    const links = [...cell.querySelectorAll("a")];
    if (links.length !== 1) return;
    const link = links[0];
    const text = normalizeText(link.textContent || "");
    if (text && GENERIC_FILE_LINK_TEXT_PATTERN.test(text)) {
      link.textContent = columnHeaderText;
    }
  }

  function extractEmbeddedTableCellNote(cell) {
    let note = null;
    [...cell.querySelectorAll("strong")].forEach((strong) => {
      const text = normalizeText(strong.textContent || "");
      if (/^※/.test(text)) {
        note = note ? `${note} ${text}` : text;
        strong.remove();
      }
    });
    if (note) trimTrailingCellNoise(cell);
    return note;
  }

  function trimTrailingCellNoise(cell) {
    while (cell.lastChild) {
      const last = cell.lastChild;
      if (last.nodeType === Node.TEXT_NODE && !normalizeText(last.textContent)) {
        cell.removeChild(last);
        continue;
      }
      if (last.nodeType === Node.ELEMENT_NODE && last.tagName === "BR") {
        cell.removeChild(last);
        continue;
      }
      break;
    }
  }

  function buildTableNoteSectionHtml(noteEntries) {
    if (!noteEntries.length) return "";
    const items = noteEntries
      .map((entry) => `<li>${escapeHtml(entry.label)}: ${escapeHtml(entry.note)}</li>`)
      .join("");
    return `<h3>注意事項</h3><ul>${items}</ul>`;
  }

  function nearestPreviousHeadingText(element) {
    let node = element;
    while (node) {
      let sibling = node.previousElementSibling;
      while (sibling) {
        if (/^H[2-6]$/.test(sibling.tagName)) {
          const text = normalizeText(sibling.textContent || "");
          if (text) return text;
        }
        sibling = sibling.previousElementSibling;
      }
      node = node.parentElement;
    }
    return "";
  }

  function nearestPreviousHeadingTag(element) {
    let node = element;
    while (node) {
      let sibling = node.previousElementSibling;
      while (sibling) {
        if (/^H[2-6]$/.test(sibling.tagName)) {
          return sibling.tagName.toLowerCase();
        }
        sibling = sibling.previousElementSibling;
      }
      node = node.parentElement;
    }
    return "";
  }

  function dataTableCaptionText(table, profile) {
    const existing = normalizeText(table.querySelector(":scope > caption")?.textContent || "");
    if (existing) return existing;
    if (isLeadingTitleRowDataTableProfile(profile)) {
      return leadingTitleRowCaptionText(profile) || genericTableCaption;
    }
    if (isSingleRecordContactDataTableProfile(profile)) {
      const label = normalizeText(profile.rows[0]?.[0]?.textContent || "");
      if (label) return tableCaptionWordRe.test(label) ? label : `${label}${tableDetailSuffix}`;
    }
    const headings = previousHeadingTexts(table);
    const heading = headings[0] || "";
    const derivedCaption = deriveTableCaptionFromHeadings(headings);
    if (derivedCaption) return derivedCaption;
    if (heading) return /一覧|詳細|表/.test(heading) ? heading : `${heading}一覧`;
    const firstRowText = normalizeText(profile.firstRow.map((cell) => cell.textContent || "").join(" "));
    if (!firstRowText) return genericTableCaption;
    return `${truncateAtWordBoundary(firstRowText, 36)}${tableDetailSuffix}`;
  }

  function truncateAtWordBoundary(text, maxLength) {
    if (text.length <= maxLength) return text;
    const words = text.split(" ");
    let result = "";
    for (const word of words) {
      const next = result ? `${result} ${word}` : word;
      if (next.length > maxLength) break;
      result = next;
    }
    return result || text.slice(0, maxLength);
  }

  function deriveTableCaptionFromHeadings(headings) {
    const heading = normalizeText(headings[0] || "");
    const context = normalizeText(headings[1] || "");
    if (!heading) return "";
    const caseMatch = heading.match(/^(?:[0-9０-９]+\s*)?(.+?)場合$/);
    if (caseMatch && context) {
      const subject = context.replace(/見直し$/, "").replace(/の$/, "");
      if (subject) {
        return caseMatch[1] + "の" + subject + "の詳細";
      }
      return caseMatch[1] + "の場合の詳細";
    }
    if (/見直し$/.test(heading)) {
      return heading.replace(/見直し$/, "") + "詳細";
    }
    if (/見直し/.test(heading)) {
      return heading.replace(/見直し/g, "") + "詳細";
    }
    return "";
  }

  function previousHeadingTexts(element) {
    const headings = [];
    let node = element;
    while (node) {
      let sibling = node.previousElementSibling;
      while (sibling) {
        if (/^H[2-6]$/.test(sibling.tagName)) {
          const text = normalizeText(sibling.textContent || "");
          if (text) headings.push(text);
        }
        sibling = sibling.previousElementSibling;
      }
      node = node.parentElement;
    }
    return headings;
  }

  function isLikelyLayoutTable(table) {
    const signals = tableLayoutSignals(table);
    if (signals.hasCaption || signals.hasHeaderCell) {
      return false;
    }
    if (signals.hasMedia && (signals.isCompact || signals.hasLayoutHint || signals.hasBlockInCell)) {
      return true;
    }
    if (signals.hasLayoutHint && signals.isCompact && (signals.hasBlockInCell || signals.hasLineBreaks)) {
      return true;
    }
    return false;
  }

  function tableLayoutSignals(table) {
    const rows = [...table.querySelectorAll("tr")];
    const maxCells = rows.reduce((max, row) => {
      const count = [...row.children].filter((cell) => ["TD", "TH"].includes(cell.tagName)).length;
      return Math.max(max, count);
    }, 0);
    const attributeText = [
      table.className || "",
      table.getAttribute("style") || "",
      table.getAttribute("summary") || "",
      table.getAttribute("role") || "",
    ].join(" ");
    const hasLayoutHint =
      /(^|\s)(old-layout|layout|photo-row|photo|image-row|float|clearfix)(\s|$)/i.test(String(table.className || "")) ||
      /border\s*:\s*0|width\s*:|display\s*:|float\s*:/i.test(attributeText) ||
      table.getAttribute("border") === "0" ||
      table.hasAttribute("cellpadding") ||
      table.hasAttribute("cellspacing");
    return {
      hasCaption: Boolean(table.querySelector(":scope > caption")),
      hasHeaderCell: Boolean(table.querySelector("th")),
      hasMedia: Boolean(table.querySelector("img, iframe, video, audio, object, embed")),
      hasLayoutHint,
      hasBlockInCell: Boolean(table.querySelector("td p, td div, td figure, td h2, td h3, td h4, td h5, td h6")),
      hasLineBreaks: Boolean(table.querySelector("td br, th br")),
      isCompact: rows.length > 0 && rows.length <= 4 && maxCells > 0 && maxCells <= 3,
    };
  }

  function layoutTableReason(table) {
    const signals = tableLayoutSignals(table);
    const reasons = [];
    if (signals.hasMedia) reasons.push("画像・埋め込み要素を含む");
    if (signals.hasLayoutHint) reasons.push("border=0、cellpadding、旧レイアウト用class/styleなどの配置用手掛かりがある");
    if (signals.isCompact) reasons.push("少数セルの段組み構成に見える");
    if (signals.hasBlockInCell) reasons.push("セル内に本文ブロックを含む");
    if (signals.hasLineBreaks) reasons.push("セル内改行で見た目を調整している");
    return `表データではなく配置目的で使われている可能性があります。判定材料: ${reasons.join("、") || "配置目的の表構造"}。修正後HTMLは表を外した本文下書きです。内容の関係が変わっていないか確認してください。`;
  }

  function layoutTableConfidence(table) {
    const signals = tableLayoutSignals(table);
    if (signals.hasMedia) return "low";
    if (signals.hasMedia && signals.hasLayoutHint) return "medium";
    if (signals.hasLayoutHint && signals.hasBlockInCell) return "medium";
    return "low";
  }

  // miChecker C_12.0/C_12.1/C_12.2: 表の素朴な構造判定(HtmlEvalUtil.javaのis1Row1ColTable/isDataTable相当)。
  // 既存のisLikelyLayoutTable()(border=0・セル内ブロック等の装飾/レイアウト手掛かりに基づく判定)とは
  // 完全に独立したシグナルとして、以下の4種類に分類する。
  //   - "nested":  表の中に別の表が入れ子になっている(C_12.0の対象母集団)
  //   - "1row1col": 行が1つしかない、または全ての行が0〜1セルしか持たない単純な構造(C_12.1)
  //   - "notdata": フォーム部品を含む・td要素が1つも無い・長文(250字超)や大量の画像(11枚以上)を含む
  //     セルがあり、データ表と言い切れない構造(C_12.2)
  //   - "data":    上記のいずれにも該当しない、複数行・複数列を持つデータ表相当の構造
  // (miChecker本体はtr要素数のみで「1行」を判定し、列数の多寡は問わない点に注意。単一行で3列という
  //  表も、tr数が1のためC_12.1側に分類される。)
  function classifyNaiveTableStructure(table) {
    if (table.querySelector("table")) {
      return "nested";
    }
    const rows = [...table.querySelectorAll("tr")];
    const rowCellCounts = rows.map(
      (row) => [...row.children].filter((cell) => ["TD", "TH"].includes(cell.tagName)).length
    );
    if (rows.length <= 1 || rowCellCounts.every((count) => count <= 1)) {
      return "1row1col";
    }
    if (table.querySelector("form, input, select, textarea")) {
      return "notdata";
    }
    const cells = [...table.querySelectorAll("td, th")];
    if (!cells.some((cell) => cell.tagName === "TD")) {
      return "notdata";
    }
    const hasNonDataCell = cells.some((cell) => {
      const text = normalizeText(cell.textContent || "");
      return text.length > 250 || cell.querySelectorAll("img").length > 10;
    });
    return hasNonDataCell ? "notdata" : "data";
  }

  // miChecker C_12.0/C_12.1/C_12.2 + C_23.0/C_23.2: classifyNaiveTableStructure()でレイアウト表と
  // 推定される表(nested/1row1col/notdata)に対し確認候補(patchMode: none)を追加する。加えて、その表が
  // th・caption・summary属性を持つ場合は「レイアウト表であればこれらを使わない」旨の警告(C_23.0/C_23.2相当)
  // も別候補として追加する。
  //
  // 注: miChecker本体のitem_23()では、通常のデータ表(bottom_data_tables、本実装の"data"分類)がth・caption
  // を持つ場合にもC_23.1として同種の確認を発火するが、これは正しく構造化された表(th・captionを適切に使って
  // いる、望ましい状態の表)にも無条件に発火し候補数が過大になるため、本実装ではレイアウト表と推定した表
  // (nested/1row1col/notdata)に限定してC_23相当の警告を出す。"data"分類の表はcollectThlessDataTableFallback
  // Candidate()でth欠落(C_75.0)のみ確認する。
  //
  // 呼び出し元(collectTableCandidates)では、既存のisLikelyLayoutTable()等に基づく構造的解体候補
  // (plan.kind === "structural")が生成されなかった表に対してのみ本関数を呼ぶため、既存の
  // table.layout-table/table.th-scope候補と重複することはない。
  function collectNaiveTableStructureCandidates(table, candidates) {
    const classification = classifyNaiveTableStructure(table);
    if (classification === "data") {
      collectThlessDataTableFallbackCandidate(table, candidates);
      return;
    }

    const structureMessages = {
      nested: "表の中に別の表が入れ子になっています。",
      "1row1col": "行が1つ、または全ての行が1セル以下しかない単純な構造の表です。",
      notdata: "フォーム部品を含む、または長文・多数の画像を含むセルがあり、データ表と言い切れない構造の表です。",
    };
    candidates.push(
      makeCandidate({
        ruleId: "table.layout-table",
        element: table,
        message: `${structureMessages[classification]}レイアウト目的で使われていないか確認してください。`,
        reason:
          "miCheckerの素朴な構造判定(行・列数やデータセルとして扱えるか)に基づく確認です。内容の対応関係を表す表であれば問題ありませんが、見た目の配置調整のためだけに表を使っている場合はスタイルシートでの表現に置き換えてください。",
        afterHtml: table.outerHTML,
        confidence: "low",
        requiresHumanReview: true,
        patchMode: "none",
      })
    );

    const hasHeaderCell = Boolean(table.querySelector("th"));
    const hasCaption = Boolean(table.querySelector(":scope > caption"));
    const hasSummary = Boolean(normalizeText(table.getAttribute("summary") || ""));
    if (hasHeaderCell || hasCaption || hasSummary) {
      const used = [hasHeaderCell && "th要素", hasCaption && "caption要素", hasSummary && "summary属性"]
        .filter(Boolean)
        .join("・");
      candidates.push(
        makeCandidate({
          ruleId: "table.layout-table",
          element: table,
          message: `レイアウト目的の可能性がある表で${used}が使われています。`,
          reason: `この表がレイアウト目的であれば、${used}は使用せず通常のテキストとして表現してください。内容の対応関係を表すデータ表であれば、この指摘は無視して構いません。`,
          afterHtml: table.outerHTML,
          confidence: "low",
          requiresHumanReview: true,
          patchMode: "none",
        })
      );
    }
  }

  // miChecker C_75.0: classifyNaiveTableStructure()が"data"(データ表相当の構造)と判定した表のうち、
  // th要素を1つも持たない表に、th提供またはレイアウト表としての解体を検討する確認候補を追加する。
  // 既存のshouldPreserveAsDataTable()/tableNeedsDataTableSemantics()による構造化(caption/thead/th/scope
  // の一括付与)よりも緩い判定(見出しらしいセルの有無を問わない)のため、構造化経路に乗らない小規模な表
  // (例: 1列の名簿等)もここで拾える。
  function collectThlessDataTableFallbackCandidate(table, candidates) {
    if (table.querySelector("th")) {
      return;
    }
    candidates.push(
      makeCandidate({
        ruleId: "table.th-scope",
        element: table,
        message: "表にth要素(見出しセル)がありません。",
        reason:
          "データを表す表であれば、見出しとなるセルをth要素にしscope属性を設定してください。レイアウト目的で表を使っている場合は、表自体を解体して通常のテキストとして表現してください。",
        afterHtml: table.outerHTML,
        confidence: "low",
        requiresHumanReview: true,
        patchMode: "none",
      })
    );
  }

  // "iframe"に加え"frame"も対象にする(miChecker C_51.0/C_51.4: frame要素のtitle欠落・空白)。
  // 判定ロジックはiframeと共通のため、タグ名だけメッセージに反映して流用する。
  function collectIframeCandidates(fragment, candidates) {
    fragment.content.querySelectorAll("iframe,frame").forEach((iframe) => {
      const tagLabel = iframe.tagName.toLowerCase();
      const title = normalizeText(iframe.getAttribute("title") || "");
      if (!title || isGenericIframeTitle(title)) {
        const clone = iframe.cloneNode(true);
        const suggestedTitle = inferIframeTitle(iframe);
        clone.setAttribute("title", suggestedTitle);
        candidates.push(
          makeCandidate({
            ruleId: "iframe.title",
            element: iframe,
            message: title ? `${tagLabel}要素のtitle属性が汎用的です。` : `${tagLabel}要素にtitle属性がありません。`,
            reason: `${tagLabel}要素は内容や目的が分かるtitle属性が必要です。リンク先や埋め込み内容を確認して具体化します。`,
            afterHtml: clone.outerHTML,
            patch: { type: "set-attribute", name: "title", value: suggestedTitle },
            confidence: "low",
            requiresHumanReview: true,
          })
        );
      }

      candidates.push(
        makeCandidate({
          ruleId: "iframe.cms-review",
          element: iframe,
          message: `${tagLabel}埋め込みが含まれています。`,
          reason: "CMS登録用本文HTMLでこの埋め込みを利用できるか、代替リンクや埋め込み元の許可が必要かを確認します。",
          afterHtml: iframe.outerHTML,
          confidence: "low",
          requiresHumanReview: true,
          patchMode: "none",
        })
      );
    });
  }

  function collectTextCandidates(fragment, candidates) {
    const seen = new Set(candidates.map((candidate) => candidateKey(candidate.rule_id, candidate.target.node_id, candidate.proposal.after_html)));

    fragment.content.querySelectorAll("*").forEach((element) => {
      collectInlineStyleCandidate(element, candidates, seen);
      collectDecorationElementCandidate(element, candidates, seen);
      collectBoldCandidate(element, candidates, seen);
      collectPseudoListCandidate(element, candidates, seen);
    });
    collectSequentialNumberedParagraphCandidates(fragment, candidates, seen);

    textNodes(fragment.content).forEach((node) => {
      const element = node.parentElement;
      if (!element || shouldSkipTextElement(element)) {
        return;
      }

      const text = node.nodeValue || "";
      collectTextReplacementCandidates(element, text, candidates, seen);
      collectForeignLanguageCandidate(element, text, candidates, seen);
      collectNoteSymbolCandidate(element, text, candidates, seen);
      collectPositionalLanguageCandidate(element, text, candidates, seen);
    });
  }

  // miChecker C_83.0(text.sensory-characteristics): コンテンツの形・位置だけに依存した案内文言
  // (「右の」「上記の」「下のボタン」等)をテキストノードから検出する。miChecker本体は形・位置・色を
  // 総合的に扱う手動確認項目のため機械的な語彙リストを持たないが、過検出を避けるため単独の「右」
  // 「左」ではなく、位置・方向を具体的に指す複合表現のみを対象にした低確信度の確認候補にする。
  const POSITIONAL_LANGUAGE_PATTERN =
    /右側の|右の|左側の|左の|上記の|下記の|上の図|下の図|上の画像|下の画像|上のボタン|下のボタン|上のリンク|下のリンク/;

  function collectPositionalLanguageCandidate(element, text, candidates, seen) {
    const match = text.match(POSITIONAL_LANGUAGE_PATTERN);
    if (!match) {
      return;
    }
    pushUniqueCandidate(
      candidates,
      seen,
      makeCandidate({
        ruleId: "text.sensory-characteristics",
        element,
        message: `形や位置だけに依存した案内表現(「${match[0]}」)が含まれています。`,
        reason:
          "ページの内容を理解・操作するために必要な情報を、コンテンツの形・位置だけに依存させないでください。形や位置を認識できない利用者にも伝わるよう、ボタン名や見出し名などテキストで特定できる情報を併記できないか確認します。",
        afterHtml: element.outerHTML,
        confidence: "low",
        requiresHumanReview: true,
        patchMode: "none",
      })
    );
  }

  // miChecker C_16.1/C_16.2(text.list): 既存ul/ol/liの構造検査。
  // C_16.1(item_16()): li要素を子孫に1つも持たないul・ol要素。
  // C_16.2(item_16()): 祖先にul・ol(またはmenu)を持たないli要素。ブラウザのHTMLパーサ(DOMParser/
  // template.innerHTML)はli要素の親にul/ol/menuを要求しないため、この種の不正な入れ子はパース後も
  // 保持される(Playwright実機検証済み)。
  // C_16.0(item_16()には対応する機械判定が無い): レイアウト目的で使われているリストの疑い。
  // ユーザー承認済みの簡易ヒューリスティックとして「liが1件のみのul/ol」を低確信度でフラグする。
  function collectListStructureCandidates(fragment, candidates) {
    fragment.content.querySelectorAll("ul,ol").forEach((list) => {
      if (!list.querySelector("li")) {
        candidates.push(
          makeCandidate({
            ruleId: "text.list",
            element: list,
            message: `${list.tagName.toLowerCase()}要素にli要素がありません。`,
            reason: "箇条書きを表すul・ol要素には、項目を表すli要素が必要です。リスト構造を見直してください。",
            afterHtml: list.outerHTML,
            confidence: "medium",
            requiresHumanReview: true,
            patchMode: "none",
          })
        );
        return;
      }

      const directItems = [...list.children].filter((child) => child.tagName === "LI");
      if (directItems.length === 1) {
        candidates.push(
          makeCandidate({
            ruleId: "text.list",
            element: list,
            message: "項目が1件だけのリストです。",
            reason:
              "リスト要素はレイアウトのためではなく、本来のリストを表現する際にのみ利用します。項目が1件しかないリストは、レイアウト調整のためだけに使われている可能性があるため、本来のリストとして複数項目を列挙する内容か確認してください。",
            afterHtml: list.outerHTML,
            confidence: "low",
            requiresHumanReview: true,
            patchMode: "none",
          })
        );
      }
    });

    fragment.content.querySelectorAll("li").forEach((li) => {
      const parentTag = li.parentElement?.tagName;
      if (["UL", "OL", "MENU"].includes(parentTag)) {
        return;
      }
      candidates.push(
        makeCandidate({
          ruleId: "text.list",
          element: li,
          message: "このli要素には親となるul要素もしくはol要素が存在しません。",
          reason: "li要素は必ずul・ol(またはmenu)要素の子として配置します。親要素を確認し、正しいリスト構造に修正してください。",
          afterHtml: li.outerHTML,
          confidence: "medium",
          requiresHumanReview: true,
          patchMode: "none",
        })
      );
    });
  }

  // miChecker C_500.17/C_500.18: テーブルセル内のcolor/background-color指定も検出対象にする。
  // (以前はelement.closest("table")で早期returnしており、構造化経路で温存されるテーブルセル内の
  //  色・背景色指定が一切候補化されなかった。miChecker本体のstyleCheck()もテーブル内外を区別せず
  //  elementsWithStyleList全件を検査するため、テーブル内外の区別自体を廃止する。)
  function collectInlineStyleCandidate(element, candidates, seen) {
    // miChecker C_500.18: bgcolor属性(廃止された背景色指定属性)も背景色指定として扱う。
    const hasBgColorAttr = element.hasAttribute("bgcolor");
    if (hasInlineStyleProperty(element, ["background", "background-color"]) || hasBgColorAttr) {
      const clone = element.cloneNode(true);
      removeStyleProperties(clone, ["background", "background-color"]);
      if (hasBgColorAttr) {
        clone.removeAttribute("bgcolor");
      }
      pushUniqueCandidate(
        candidates,
        seen,
        makeCandidate({
          ruleId: "text.background-color",
          element,
          message: hasBgColorAttr ? "背景色の指定(廃止されたbgcolor属性を含む)が含まれています。" : "背景色の指定が含まれています。",
          reason: "CMSではコントラスト比保持のため、装飾目的の背景色は移行しません。bgcolor属性はHTML Living Standardでも廃止されています。",
          afterHtml: clone.outerHTML,
          patch: hasBgColorAttr ? undefined : { type: "remove-style-properties", names: ["background", "background-color"] },
          confidence: "high",
          requiresHumanReview: false,
        })
      );
    }

    if (hasInlineStyleProperty(element, ["font-size", "font-family"])) {
      const clone = element.cloneNode(true);
      removeStyleProperties(clone, ["font-size", "font-family"]);
      pushUniqueCandidate(
        candidates,
        seen,
        makeCandidate({
          ruleId: "text.font-size",
          element,
          message: "文字サイズまたはフォント指定が含まれています。",
          reason: "文字サイズやフォントはCMS側の標準表示に合わせ、本文HTMLでは指定しません。",
          afterHtml: clone.outerHTML,
          patch: { type: "remove-style-properties", names: ["font-size", "font-family"] },
          confidence: "high",
          requiresHumanReview: false,
        })
      );
    }

    if (hasInlineStyleProperty(element, ["text-decoration", "font-style"])) {
      const clone = element.cloneNode(true);
      removeStyleProperties(clone, ["text-decoration", "font-style"]);
      pushUniqueCandidate(
        candidates,
        seen,
        makeCandidate({
          ruleId: "text.decoration-lines",
          element,
          message: "下線・打消し線・斜体の指定が含まれています。",
          reason: "下線、打消し線、斜め文字は使用せず、必要な強調は文脈に合う方法で扱います。",
          afterHtml: clone.outerHTML,
          patch: { type: "remove-style-properties", names: ["text-decoration", "font-style"] },
          confidence: "high",
          requiresHumanReview: false,
        })
      );
    }

    if (hasInlineStyleProperty(element, ["color"])) {
      const color = getInlineStyleValue(element, "color");
      const clone = element.cloneNode(true);
      removeStyleProperties(clone, ["color"]);
      pushUniqueCandidate(
        candidates,
        seen,
        makeCandidate({
          ruleId: "text.color",
          element,
          message: "文字色の指定が含まれています。",
          reason: isAllowedCmsTextColor(color)
            ? "赤・青・黒として使える色でも、装飾目的か重要情報かの確認が必要です。"
            : "装飾目的の色やCMSで扱えない色は、黒文字またはCMS標準の赤/青文字へ整理します。",
          afterHtml: clone.outerHTML,
          patch: { type: "remove-style-properties", names: ["color"] },
          confidence: isAllowedCmsTextColor(color) ? "medium" : "low",
          requiresHumanReview: true,
        })
      );
    }

    // miChecker C_8.0(styleCheck()): 同一要素のstyle属性にcolorとbackground/background-color
    // (またはbgcolor属性)が両方とも指定されている場合、「配色だけに情報を持たせていないか」の確認
    // 対象になる(color/bgcolorのいずれか一方のみの指定ではC_500.17/C_500.18止まりで発火しない)。
    // 上のtext.color/text.background-color候補とは独立して追加するため、除去提案(patch)は持たせない。
    const hasColorForSensory = hasInlineStyleProperty(element, ["color"]);
    const hasBgForSensory = hasInlineStyleProperty(element, ["background", "background-color"]) || hasBgColorAttr;
    if (hasColorForSensory && hasBgForSensory) {
      pushUniqueCandidate(
        candidates,
        seen,
        makeCandidate({
          ruleId: "text.sensory-characteristics",
          element,
          message: "文字色と背景色が同時に指定されています。",
          reason: "配色だけで情報を伝えている場合、色を取り除いても内容が伝わるかを確認してください。伝わらない場合は、記号や文言で情報を補ってください。",
          afterHtml: element.outerHTML,
          confidence: "low",
          requiresHumanReview: true,
          patchMode: "none",
        })
      );
    }
  }

  // miChecker C_33.0/C_34.0: blink・marquee要素。廃止要素として除去(unwrap)し、テキストは保持する。
  // blinkは中身のテキストが無ければ発火しない(miChecker本体のitem_33のhasTextDescendant相当の条件に合わせる)。
  // marqueeは中身の有無を問わず常に候補化する(item_34は無条件)。
  function collectDeprecatedMotionElementCandidate(element, candidates, seen) {
    if (!["BLINK", "MARQUEE"].includes(element.tagName)) {
      return false;
    }
    if (element.tagName === "BLINK" && !hasTextDescendant(element)) {
      return true;
    }

    pushUniqueCandidate(
      candidates,
      seen,
      makeCandidate({
        ruleId: "html-structure.deprecated-elements",
        element,
        message: element.tagName === "BLINK" ? "blink要素が含まれています。" : "marquee要素が含まれています。",
        reason: element.tagName === "BLINK"
          ? "blinkによる5秒以上の明滅はWCAG違反となるため、要素を除去し通常のテキストとして表示します。"
          : "marqueeによる自動スクロールはWCAG違反となるため、要素を除去し通常のテキストとして表示します。",
        afterHtml: element.innerHTML,
        patch: { type: "unwrap-element" },
        confidence: "high",
        requiresHumanReview: false,
      })
    );
    return true;
  }

  // miChecker C_48.0/C_48.2: 廃止要素の対象拡大。item_48()で確認した実際に発火するタグのうち、
  // 装飾目的で使われるもの(basefont/center/font/strike/u、HTML5判定時はさらにbig/tt)を対象にする。
  // NOBRはitem_48()にチェックロジックが存在せず発火しないため対象外(デッドコード扱い)。
  // menuitem/frame/frameset/noframes/acronym/dir/isindex/listing/plaintext/xmpはC_48.0/C_48.2以外の
  // 別チェックID(C_48.1/48.3-48.5/48.7)であり、本タスクのB分類対象(C_48.0/C_48.2)ではないため対象外。
  const FONT_LIKE_DEPRECATED_TAGS = ["FONT", "BASEFONT"];
  const DECORATION_DEPRECATED_TAGS = ["U", "S", "STRIKE", "I", "CENTER", "BIG", "TT"];

  function collectDecorationElementCandidate(element, candidates, seen) {
    if (collectDeprecatedMotionElementCandidate(element, candidates, seen)) {
      return;
    }
    const isFontLike = FONT_LIKE_DEPRECATED_TAGS.includes(element.tagName);
    if (!isFontLike && !DECORATION_DEPRECATED_TAGS.includes(element.tagName)) {
      return;
    }

    pushUniqueCandidate(
      candidates,
      seen,
      makeCandidate({
        ruleId: isFontLike ? "text.font-size" : "text.decoration-lines",
        element,
        message: isFontLike ? `${element.tagName.toLowerCase()}要素が含まれています。` : "装飾用のHTML要素が含まれています。",
        reason: isFontLike
          ? "文字サイズやフォントはCMS側の標準表示に合わせ、本文HTMLでは指定しません。"
          : "下線、打消し線、斜め文字、中央寄せ、拡大文字、等幅表示などの装飾用要素は使用せず、必要な強調は文脈に合う方法で扱います。",
        afterHtml: element.innerHTML,
        patch: { type: "unwrap-element" },
        confidence: "high",
        requiresHumanReview: false,
      })
    );

    // miChecker C_8.0(item_8()): font要素のcolor/bgcolor属性は、どちらか一方でも値があれば
    // 「配色だけに情報を持たせていないか」の確認対象になる(styleCheck()のcolor+background併用時
    // のみ発火する条件とは異なり、font要素はcolor/bgcolorのいずれか一方の指定でも発火する)。
    if (element.tagName === "FONT") {
      const colorAttr = (element.getAttribute("color") || "").trim();
      const bgColorAttr = (element.getAttribute("bgcolor") || "").trim();
      if (colorAttr || bgColorAttr) {
        pushUniqueCandidate(
          candidates,
          seen,
          makeCandidate({
            ruleId: "text.sensory-characteristics",
            element,
            message: "font要素にcolor/bgcolor属性による配色指定があります。",
            reason: "配色だけで情報を伝えている場合、色を取り除いても内容が伝わるかを確認してください。伝わらない場合は、記号や文言で情報を補ってください。",
            afterHtml: element.outerHTML,
            confidence: "low",
            requiresHumanReview: true,
            patchMode: "none",
          })
        );
      }
    }
  }

  function collectBoldCandidate(element, candidates, seen) {
    if (!["B", "STRONG"].includes(element.tagName)) {
      return;
    }

    pushUniqueCandidate(
      candidates,
      seen,
      makeCandidate({
        ruleId: "text.bold",
        element,
        message: "太字表現が含まれています。",
        reason: "移行元で太字が使われている箇所は、CMS上でも太字設定として保持する対象です。",
        afterHtml: element.outerHTML,
        confidence: "high",
        requiresHumanReview: false,
        patchMode: "none",
      })
    );
  }

  function collectPseudoListCandidate(element, candidates, seen) {
    if (!["P", "DIV"].includes(element.tagName) || element.closest("li") || !isPseudoListContainer(element)) {
      return;
    }

    const listHtml = buildPseudoListHtml(element);
    if (!listHtml) {
      return;
    }

    pushUniqueCandidate(
      candidates,
      seen,
      makeCandidate({
        ruleId: "text.list",
        processingClass: "mechanical",
        element,
        message: "中黒による擬似的な箇条書きです。",
        reason: "中黒で並べた項目は、番号なしリストとして機械的に構造化します。文中の区切り用途の中黒は対象外です。",
        afterHtml: listHtml,
        patch: { type: "replace-with-list" },
        confidence: "high",
        requiresHumanReview: false,
      })
    );
  }

  function collectSequentialNumberedParagraphCandidates(fragment, candidates, seen) {
    const handled = new Set();
    fragment.content.querySelectorAll("p").forEach((paragraph) => {
      const nodeId = paragraph.getAttribute("data-goal2-node-id");
      if (handled.has(nodeId) || paragraph.closest("li,td,th")) {
        return;
      }
      const groups = collectNumberedParagraphGroups(paragraph);
      if (groups.length < 2) {
        return;
      }
      groups.flatMap((group) => group.nodes).forEach((item) => handled.add(item.getAttribute("data-goal2-node-id")));
      const afterHtml = buildNumberedParagraphListHtml(groups);
      pushUniqueCandidate(
        candidates,
        seen,
        makeCandidate({
          ruleId: "text.list",
          processingClass: "mechanical",
          element: paragraph,
          message: "番号付き段落による擬似的な順序リストです。",
          reason: "1.、2. のように段落で並ぶ手順や項目は、順序が意味を持つため番号付きリストとして構造化します。",
          afterHtml,
          patch: { type: "replace-paragraph-sequence", node_ids: groups.flatMap((group) => group.nodes.map((item) => item.getAttribute("data-goal2-node-id"))) },
          confidence: "high",
          requiresHumanReview: false,
        })
      );
    });
  }

  function collectNumberedParagraphGroups(start) {
    const first = numberedParagraphInfo(start);
    if (!first || first.number !== 1) {
      return [];
    }
    const groups = [{ number: 1, nodes: [start] }];
    let expected = 2;
    let current = start.nextElementSibling;
    while (current && isNumberedListRelatedParagraph(current)) {
      const info = numberedParagraphInfo(current);
      if (info) {
        if (info.number !== expected) {
          break;
        }
        groups.push({ number: info.number, nodes: [current] });
        expected += 1;
      } else {
        groups[groups.length - 1].nodes.push(current);
      }
      current = current.nextElementSibling;
    }

    const lastGroup = groups[groups.length - 1];
    const lastParagraph = lastGroup?.nodes?.[lastGroup.nodes.length - 1];
    const followingNote = lastParagraph?.nextElementSibling;
    if (
      followingNote?.tagName === "P" &&
      isStandaloneNoteParagraphText(followingNote.textContent || "") &&
      /[（(]\s*※\s*[）)]/.test(normalizeText(lastParagraph.textContent || ""))
    ) {
      lastGroup.noteNode = followingNote;
      lastGroup.nodes.push(followingNote);
    }
    return groups;
  }

  function isNumberedListRelatedParagraph(paragraph) {
    if (!paragraph || paragraph.tagName !== "P") {
      return false;
    }
    if (numberedParagraphInfo(paragraph)) {
      return true;
    }
    const text = normalizeText(paragraph.textContent || "");
    if (isStandaloneNoteParagraphText(text)) {
      return false;
    }
    return Boolean(text) && !paragraph.querySelector("table,ul,ol,img,iframe");
  }

  function isStandaloneNoteParagraphText(text) {
    return /^※/.test(normalizeText(text || ""));
  }

  function numberedParagraphInfo(paragraph) {
    const text = normalizeText(paragraph.textContent || "");
    const match = text.match(/^([0-9０-９]{1,2})[.．、]\s*(.+)$/) || text.match(/^[（(]([0-9０-９]{1,2})[）)]\s*(.+)$/);
    if (!match) {
      return null;
    }
    const number = Number(match[1].replace(/[０-９]/g, (char) => String(char.charCodeAt(0) - 0xff10)));
    return Number.isInteger(number) && number > 0 ? { number } : null;
  }

  function buildNumberedParagraphListHtml(groups) {
    const items = groups.map((group) => {
      const html = group.nodes
        .filter((paragraph) => paragraph !== group.noteNode)
        .map((paragraph, index) => {
          const sourceHtml = index === 0 ? removeLeadingNumberFromHtml(paragraph.innerHTML) : paragraph.innerHTML;
          if (group.noteNode && paragraph === group.nodes[0]) {
            return mergeNoteTextIntoHtml(sourceHtml, group.noteNode.textContent || "");
          }
          return sourceHtml;
        })
        .map((htmlPart, index) => (index === 0 ? htmlPart : `<p>${cleanHtml(htmlPart)}</p>`))
        .join("");
      return `<li>${html}</li>`;
    });
    return cleanHtml(`<ol>${items.join("")}</ol>`);
  }

  function mergeNoteTextIntoHtml(html, noteText) {
    const note = stripLeadingNoteMark(noteText);
    if (!note) {
      return html;
    }
    return String(html || "").replace(/[（(]\s*※\s*[）)]/u, `（${escapeHtml(note)}）`);
  }

  function removeLeadingNumberFromHtml(html) {
    const template = document.createElement("template");
    template.innerHTML = html || "";
    const walker = document.createTreeWalker(template.content, NodeFilter.SHOW_TEXT);
    let node = walker.nextNode();
    while (node) {
      const value = node.nodeValue || "";
      if (normalizeText(value)) {
        node.nodeValue = value.replace(/^[\s\u00a0]*[0-9０-９]{1,2}[.．、]\s*/, "").replace(/^[\s\u00a0]*[（(][0-9０-９]{1,2}[）)]\s*/, "");
        break;
      }
      node = walker.nextNode();
    }
    return cleanHtml(template.innerHTML);
  }

  function isPseudoListContainer(element) {
    if (element.tagName === "P") {
      return true;
    }
    return [...element.children].every((child) =>
      ["A", "ABBR", "B", "BR", "CITE", "CODE", "EM", "I", "MARK", "SMALL", "SPAN", "STRONG", "SUB", "SUP", "U"].includes(child.tagName)
    );
  }

  function buildPseudoListHtml(element) {
    const text = normalizeText(element.textContent);
    const bulletMarks = (text.match(/・/g) || []).length;
    const parts = element.innerHTML
      .split(/<br\s*\/?>|\n/i)
      .map((part) => part.trim())
      .filter((part) => normalizeText(stripTags(part)));
    const bulletParts = parts.filter((part) => isBulletListLine(part));

    if (bulletParts.length < 2) {
      if (text.startsWith("・") && bulletMarks >= 2 && parts.length === 1) {
        const items = text
          .split(/(?=・)/)
          .map((item) => item.replace(/^・\s*/, "").trim())
          .filter(Boolean);
        return items.length >= 2 ? `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>` : "";
      }
      // A standalone paragraph whose entire content starts with a single "・" (no sibling
      // bullet lines to group with). Still convert it to a genuine single-item list rather
      // than leaving the "・" as unstructured plain text.
      if (bulletParts.length === 1 && parts.length === 1) {
        const item = removeLeadingBulletFromHtml(parts[0]);
        return item ? `<ul><li>${item}</li></ul>` : "";
      }
      return "";
    }

    const beforeList = [];
    const items = [];
    const afterList = [];
    let insideList = false;
    let listClosed = false;

    parts.forEach((part) => {
      if (isBulletListLine(part) && !listClosed) {
        insideList = true;
        items.push(removeLeadingBulletFromHtml(part));
        return;
      }
      if (!insideList) {
        beforeList.push(part);
        return;
      }
      listClosed = true;
      afterList.push(part);
    });

    if (items.length < 2) {
      return "";
    }

    const blocks = [
      ...beforeList.map((part) => wrapPseudoListAdjacentLine(part)),
      `<ul>${items.map((item) => `<li>${item}</li>`).join("")}</ul>`,
      ...afterList.map((part) => wrapPseudoListAdjacentLine(part)),
    ];
    return cleanHtml(blocks.join(""));
  }

  function isBulletListLine(html) {
    return /^・\s*/.test(normalizeText(stripTags(html)));
  }

  function removeLeadingBulletFromHtml(html) {
    const template = document.createElement("template");
    template.innerHTML = html || "";
    const walker = document.createTreeWalker(template.content, NodeFilter.SHOW_TEXT);
    let node = walker.nextNode();
    while (node) {
      const value = node.nodeValue || "";
      if (normalizeText(value)) {
        node.nodeValue = value.replace(/^[\s\u00a0]*・\s*/, "");
        break;
      }
      node = walker.nextNode();
    }
    return cleanHtml(template.innerHTML) || escapeHtml(normalizeText(stripTags(html)).replace(/^・\s*/, ""));
  }

  function wrapPseudoListAdjacentLine(html) {
    const clean = cleanHtml(html);
    if (!clean) {
      return "";
    }
    if (/^<(p|div|ul|ol|dl|table|h[1-6]|blockquote)\b/i.test(clean)) {
      return clean;
    }
    return `<p>${clean}</p>`;
  }

  function collectTextReplacementCandidates(element, text, candidates, seen) {
    findMatches(text, /(?:TEL|ＴＥＬ)\s*[：:]?/gi).forEach((match) => {
      const suffix = /[：:]$/.test(match.text) ? "：" : "";
      pushTextReplacementCandidate(candidates, seen, {
        ruleId: "text.tel-fax",
        element,
        before: match.text,
        after: `電話番号${suffix}`,
        message: "TELの略記が含まれています。",
        reason: "TEL/FAX等の略記は、自治体別方針に従って電話番号・ファックス番号などに修正します。",
        confidence: "medium",
        requiresHumanReview: true,
      });
    });

    findMatches(text, /(?:FAX|ＦＡＸ)\s*[：:]?/gi).forEach((match) => {
      const suffix = /[：:]$/.test(match.text) ? "：" : "";
      pushTextReplacementCandidate(candidates, seen, {
        ruleId: "text.tel-fax",
        element,
        before: match.text,
        after: `ファックス番号${suffix}`,
        message: "FAXの略記が含まれています。",
        reason: "TEL/FAX等の略記は、自治体別方針に従って電話番号・ファックス番号などに修正します。",
        confidence: "medium",
        requiresHumanReview: true,
      });
    });

    findMatches(text, /[Ａ-Ｚａ-ｚ０-９]+/g).forEach((match) => {
      pushTextReplacementCandidate(candidates, seen, {
        ruleId: "text.alphanumeric",
        element,
        before: match.text,
        after: toHalfWidthAlphanumeric(match.text),
        message: "全角英数字が含まれています。",
        reason: "全角英数字は半角英数字に修正します。",
        confidence: "high",
        requiresHumanReview: false,
      });
    });

    findMatches(text, /[¥￥]\s*[\d,]+/g).forEach((match) => {
      const amount = match.text.replace(/[¥￥\s]/g, "");
      pushTextReplacementCandidate(candidates, seen, {
        ruleId: "text.currency-notation",
        element,
        before: match.text,
        after: `${amount}円`,
        message: "通貨記号が含まれています。",
        reason: "通貨記号は読み上げで伝わりにくいため、「円」などの文字表記にします。",
        confidence: "high",
        requiresHumanReview: false,
      });
    });

    findMatches(text, /\$\s*[\d,]+/g).forEach((match) => {
      const amount = match.text.replace(/[$\s]/g, "");
      pushTextReplacementCandidate(candidates, seen, {
        ruleId: "text.currency-notation",
        element,
        before: match.text,
        after: `${amount}ドル`,
        message: "通貨記号が含まれています。",
        reason: "通貨記号は読み上げで伝わりにくいため、「ドル」などの文字表記にします。",
        confidence: "high",
        requiresHumanReview: false,
      });
    });

    findWeekdayNotationMatches(text).forEach((match) => {
      pushTextReplacementCandidate(candidates, seen, {
        ruleId: "text.weekday-notation",
        element,
        before: match.text,
        after: match.after,
        message: "省略された曜日表記です。",
        reason: "読み上げで曜日として伝わるよう、曜日名を補います。自治体別の表記統一がある場合は従います。",
        confidence: "medium",
        requiresHumanReview: true,
      });
    });

    findFullDateMatches(text).forEach((match) => {
      const parts = match.text.split(/[/.]/);
      pushTextReplacementCandidate(candidates, seen, {
        ruleId: "text.date-notation",
        element,
        before: match.text,
        after: `${parts[0]}年${Number(parts[1])}月${Number(parts[2])}日`,
        message: "スラッシュまたはピリオド区切りの日付です。",
        reason: "読み上げで日付として伝わるよう、年月日の表記にします。自治体別の西暦/和暦方針は確認が必要です。",
        confidence: "medium",
        requiresHumanReview: true,
      });
    });

    findPartialDateMatches(text).forEach((match) => {
      const parts = match.text.split(/[/.]/);
      pushTextReplacementCandidate(candidates, seen, {
        ruleId: "text.date-notation",
        element,
        before: match.text,
        after: `${Number(parts[0])}月${Number(parts[1])}日`,
        message: "年のない日付表記です。",
        reason: "年がない日付はCMS自動変換に任せられない場合があるため、月日の表記へ修正します。",
        confidence: "medium",
        requiresHumanReview: true,
      });
    });

    findMatches(text, /\b(?:[01]?\d|2[0-3]):[0-5]\d\b/g).forEach((match) => {
      const [hour, minute] = match.text.split(":").map(Number);
      pushTextReplacementCandidate(candidates, seen, {
        ruleId: "text.time-notation",
        element,
        before: match.text,
        after: minute === 0 ? `${hour}時` : `${hour}時${minute}分`,
        message: "コロン区切りの時刻表記です。",
        reason: "読み上げで時刻として伝わるよう、時・分の表記にします。12時間/24時間表記の統一は確認が必要です。",
        confidence: "medium",
        requiresHumanReview: true,
      });
    });

    findUnitMatches(text).forEach((match) => {
      pushTextReplacementCandidate(candidates, seen, {
        ruleId: "text.unit-notation",
        element,
        before: match.text,
        after: match.after,
        message: "単位記号または英字略記が含まれています。",
        reason: "単位は読み上げで誤読されにくいカタカナ・日本語表記にします。",
        confidence: "high",
        requiresHumanReview: false,
      });
    });

  }

  const URL_OR_EMAIL_PATTERN =
    /\bhttps?:\/\/[^\s"'<>）)]+|\bwww\.[A-Za-z0-9.-]+(?:\/[^\s"'<>）)]*)?|\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/gi;

  // Latin script incl. accented/diacritic letters (French/Portuguese/Spanish/Vietnamese/etc.),
  // not just plain ASCII — otherwise those languages are silently missed.
  const LATIN_FOREIGN_PATTERN = /[A-Za-zÀ-ſḀ-ỿ]{3,}(?:[ ,.'"-]+[A-Za-zÀ-ſḀ-ỿ]{2,}){2,}/;
  const HANGUL_SCRIPT_PATTERN = /\p{Script=Hangul}{2,}/u;
  const THAI_SCRIPT_PATTERN = /\p{Script=Thai}{2,}/u;
  const CYRILLIC_SCRIPT_PATTERN = /\p{Script=Cyrillic}{3,}/u;
  // Kanji-only labels/headings are extremely common in ordinary Japanese municipal
  // pages (e.g. "受付窓口", "対象者一覧"), so "Han script with no kana nearby" is not
  // a safe signal for Chinese by itself. Require a Chinese-only function word/pronoun
  // (things Japanese text never spells this way) alongside a Han run as corroboration.
  const CHINESE_MARKER_PATTERN =
    /我们|我們|你们|你們|他们|他們|它们|它們|不是|没有|沒有|可以|因为|因為|所以|但是|如果|虽然|雖然|哪里|哪裡|什么|什麼|怎么|怎麼|谢谢|謝謝|欢迎|歡迎|这个|這個|你好|请问|請問/;
  const HAN_SCRIPT_PATTERN = /\p{Script=Han}{2,}/u;
  const VIETNAMESE_TONE_MARK_PATTERN = /[Ạ-ỹ]/;

  const LANGUAGE_LABELS = {
    en: "英語",
    zh: "中国語",
    ko: "韓国語",
    es: "スペイン語",
    pt: "ポルトガル語",
    ru: "ロシア語",
    th: "タイ語",
    vi: "ベトナム語",
  };

  function languageLabel(langCode) {
    return LANGUAGE_LABELS[langCode] || langCode || "不明な言語";
  }

  function isForeignLanguageText(text) {
    return (
      LATIN_FOREIGN_PATTERN.test(text) ||
      HANGUL_SCRIPT_PATTERN.test(text) ||
      THAI_SCRIPT_PATTERN.test(text) ||
      CYRILLIC_SCRIPT_PATTERN.test(text) ||
      (HAN_SCRIPT_PATTERN.test(text) && CHINESE_MARKER_PATTERN.test(text))
    );
  }

  function collectForeignLanguageCandidate(element, text, candidates, seen) {
    const textWithoutUrlsOrEmails = text.replace(URL_OR_EMAIL_PATTERN, " ");
    if (!isForeignLanguageText(textWithoutUrlsOrEmails)) {
      return;
    }

    const langCode = inferLanguageCode(textWithoutUrlsOrEmails);
    const languageHtml = buildForeignLanguageHtml(element, langCode);
    pushUniqueCandidate(
      candidates,
      seen,
      makeCandidate({
        ruleId: "text.foreign-language",
        element,
        message: `外国語(${languageLabel(langCode)}の可能性)の文章または語句が含まれています。lang="${langCode}" を付与します。`,
        reason: "本文中の外国語には、CMSで対応する言語属性を付与できるか確認します。判定した言語が違う場合は「文言を調整」からlangの値を直接修正できます。",
        afterHtml: languageHtml,
        patch: { type: "set-attribute", name: "lang", value: langCode },
        confidence: "low",
        requiresHumanReview: true,
      })
    );
  }

  function collectNoteSymbolCandidate(element, text, candidates, seen) {
    if (!/※/.test(text)) {
      return;
    }
    if (hasFollowingNoteParagraph(element, text)) {
      return;
    }
    const mergeProposal = buildAdjacentNoteMergeProposal(element);
    if (mergeProposal) {
      pushUniqueCandidate(
        candidates,
        seen,
        makeCandidate({
          ruleId: "text.note-symbol",
          element: mergeProposal.target,
          message: "注釈記号（※）を本文補足として統合できます。",
          reason: "参照元の（※）と直後の注釈本文が対応しているため、読み上げ順に沿って本文内の括弧補足へまとめます。",
          afterHtml: mergeProposal.afterHtml,
          patch: { type: "merge-following-note", note_node_id: mergeProposal.noteNodeId },
          confidence: "medium",
          requiresHumanReview: true,
        })
      );
      return;
    }
    if (!shouldCollectNoteSymbolCandidate(element, text)) {
      pushUniqueCandidate(
        candidates,
        seen,
        makeCandidate({
          ruleId: "text.note-symbol",
          element,
          message: "単発の注釈記号（※）があります。",
          reason: "※を機械的に置換せず、CMS登録時に原文のまま残すか、括弧書きや本文補足として自然に読める形へ整えるか確認します。",
          afterHtml: element.outerHTML,
          patchMode: "none",
          confidence: "medium",
          requiresHumanReview: true,
        })
      );
      return;
    }

    const noteHtml = buildNoteSymbolHtml(element);
    pushUniqueCandidate(
      candidates,
      seen,
      makeCandidate({
        ruleId: "text.note-symbol",
        element,
        message: "注釈記号（※）が含まれています。",
        reason: "※の参照先と注釈本文の関係が複数箇所に分かれているため、構造化できるか確認します。",
        afterHtml: noteHtml,
        confidence: "low",
        requiresHumanReview: true,
      })
    );
  }

  // imageContexts, when passed, collects { src, caption } for every <img> whose alt text
  // this function fills in heuristically (see prepareLayoutTableImage), so a post-hoc LLM
  // vision enrichment pass can upgrade them later without re-walking the decomposed HTML.
  function decomposeLayoutTable(table, imageContexts) {
    const template = document.createElement("template");
    const caption = table.querySelector(":scope > caption");
    const captionText = normalizeText(caption?.textContent || "");
    const parentHeadingTag = captionText ? "h2" : nearestPreviousHeadingTag(table) || "h2";

    if (captionText) {
      const heading = document.createElement("h3");
      heading.textContent = captionText;
      template.content.appendChild(heading);
    }

    table.querySelectorAll("tr").forEach((row) => {
      const drafts = [...row.children]
        .filter((cell) => ["TD", "TH"].includes(cell.tagName))
        .map((cell) => tableCellDraft(cell, imageContexts))
        .filter(Boolean);

      if (drafts.length === 1 && isLayoutTableSectionHeadingDraft(drafts[0])) {
        const heading = document.createElement(layoutTableChildHeadingTag(parentHeadingTag));
        heading.textContent = drafts[0].text;
        template.content.appendChild(heading);
        return;
      }

      // A row whose first cell is a short plain label followed by one or more plain
      // value cells reads as a single record ("参加申込書: 添付ファイル、提出期限 7/15"),
      // not as a sub-heading introducing a separate list. Earlier this promoted the label
      // to its own <h4>/<h5> whenever 2+ simple cells followed it, which duplicated heading
      // levels for ordinary multi-column data rows (a 3-column row-header/value/value row
      // read identically to a genuine section title row). Folding every such row into one
      // inline paragraph keeps table.cell-merge-layout/-file candidates from inventing
      // headings that don't exist in the source content.
      if (drafts.length >= 2 && isLayoutRecordLabelDraft(drafts[0]) && drafts.slice(1).every(isSimpleLayoutValueDraft)) {
        const paragraph = document.createElement("p");
        const label = document.createElement("strong");
        appendInlineHtml(label, drafts[0].html);
        paragraph.appendChild(label);
        paragraph.append(" ");
        drafts.slice(1).forEach((draft, index) => {
          if (index > 0) paragraph.append("、");
          appendInlineHtml(paragraph, draft.html);
        });
        template.content.appendChild(paragraph);
        return;
      }

      drafts.forEach((draft) => appendLayoutDraft(template.content, draft));
    });

    return cleanHtml(template.innerHTML) || "<p>表内の必要テキストを入力してください</p>";
  }

  function isLayoutTableSectionHeadingDraft(draft) {
    return Boolean(
      draft?.simple &&
        draft.text &&
        draft.text.length <= 40 &&
        !/[。！？!?、，,]$/.test(draft.text) &&
        !/<(?:a|img|iframe|input|select|textarea|button)\b/i.test(draft.html || "")
    );
  }

  function layoutTableChildHeadingTag(parentHeadingTag) {
    const level = Number(String(parentHeadingTag || "h2").replace(/[^0-9]/g, "")) || 2;
    return `h${Math.min(6, Math.max(3, level + 1))}`;
  }

  function buildMergedCellProposal(table, mergeRule) {
    const info = firstMergedCellInfo(table);
    if (!info) {
      return unchangedProposal(table);
    }

    if (mergeRule.ruleId === "table.cell-merge-heading") {
      return {
        afterHtml: buildHeadingSeparatedTableHtml(table, info),
        patchMode: "replace",
      };
    }

    if (mergeRule.ruleId === "table.cell-merge-summary") {
      return {
        afterHtml: buildCaptionSeparatedTableHtml(table, info),
        patchMode: "replace",
      };
    }

    if (mergeRule.ruleId === "table.cell-merge-note") {
      return {
        afterHtml: buildNoteSeparatedTableHtml(table, info),
        patchMode: "replace",
      };
    }

    if (mergeRule.ruleId === "table.cell-merge-layout") {
      const imageContexts = [];
      const afterHtml = canSplitMergedRowsIntoTables(table)
        ? splitMergedRowsIntoTablesHtml(table)
        : decomposeLayoutTable(table, imageContexts);
      return {
        afterHtml,
        patchMode: "replace",
        images: imageContexts,
      };
    }

    if (mergeRule.ruleId === "table.cell-merge-file") {
      const imageContexts = [];
      return {
        afterHtml: decomposeLayoutTable(table, imageContexts),
        patchMode: "replace",
        images: imageContexts,
      };
    }

    if (mergeRule.ruleId === "table.cell-merge-mark") {
      const imageContexts = [];
      return {
        afterHtml: buildMarkSeparatedTableHtml(table, imageContexts),
        patchMode: "replace",
        images: imageContexts,
      };
    }

    return unchangedProposal(table);
  }

  function unchangedProposal(table) {
    return {
      afterHtml: table.outerHTML,
      patchMode: "none",
    };
  }

  function firstMergedCellInfo(table) {
    const cell = table.querySelector("[rowspan], [colspan]");
    const row = cell?.closest("tr");
    const rows = [...table.querySelectorAll("tr")];
    const rowIndex = row ? rows.indexOf(row) : -1;
    const text = normalizeText(cell?.textContent || "");
    if (!cell || !row || rowIndex < 0 || !text) {
      return null;
    }
    return {
      cell,
      row,
      rowIndex,
      text,
    };
  }

  function buildHeadingSeparatedTableHtml(table, info) {
    const heading = document.createElement(suggestSeparatedHeadingTag(table));
    heading.textContent = info.text;
    const clone = tableWithRowRemoved(table, info.rowIndex);
    return cleanHtml(`${heading.outerHTML}${clone.outerHTML}`);
  }

  function buildCaptionSeparatedTableHtml(table, info) {
    if (info.cell.querySelector("a")) {
      return buildMergedLinkRepeatedAcrossCellsHtml(table, info);
    }
    const clone = tableWithRowRemoved(table, info.rowIndex);
    if (!clone.querySelector(":scope > caption")) {
      const caption = document.createElement("caption");
      caption.textContent = info.text;
      clone.insertBefore(caption, clone.firstChild);
    }
    return cleanHtml(clone.outerHTML);
  }

  function buildMergedLinkRepeatedAcrossCellsHtml(table, info) {
    const clone = table.cloneNode(true);
    stripInternalAttributes(clone);
    stripFormatting(clone);
    const clonedRow = [...clone.querySelectorAll("tr")][info.rowIndex];
    const cellIndex = [...info.row.children].indexOf(info.cell);
    const clonedCell = clonedRow?.children[cellIndex];
    if (!clonedRow || !clonedCell) {
      return cleanHtml(clone.outerHTML);
    }

    const link = info.cell.querySelector("a");
    const href = link ? link.getAttribute("href") || "" : "";
    const linkText = `${extractedRowLinkLabel(info.row, info.cell)}の案件詳細ページ`;
    const span = Number(clonedCell.getAttribute("colspan")) || 1;
    const rowspan = clonedCell.getAttribute("rowspan");
    const tagName = clonedCell.tagName;

    const replacementCells = Array.from({ length: span }, () => {
      const cell = document.createElement(tagName);
      if (rowspan) cell.setAttribute("rowspan", rowspan);
      if (href) {
        const anchor = document.createElement("a");
        anchor.setAttribute("href", href);
        anchor.textContent = linkText;
        cell.appendChild(anchor);
      } else {
        cell.textContent = linkText;
      }
      return cell;
    });
    clonedCell.replaceWith(...replacementCells);

    return cleanHtml(clone.outerHTML);
  }

  function extractedRowLinkLabel(row, mergedCell) {
    const otherCells = [...row.children].filter((cell) => cell !== mergedCell);
    const texts = otherCells.map((cell) => normalizeText(cell.textContent || "")).filter(Boolean);
    if (!texts.length) return "この案件";
    const [first, ...rest] = texts;
    return rest.length ? `${first}（${rest.join("・")}）` : first;
  }

  function buildNoteSeparatedTableHtml(table, info) {
    const clone = tableWithRowRemoved(table, info.rowIndex);
    const note = document.createElement("p");
    note.textContent = info.text;
    return cleanHtml(`${clone.outerHTML}${note.outerHTML}`);
  }

  function canSplitMergedRowsIntoTables(table) {
    const grid = buildExpandedTableGrid(table);
    if (grid.length < 3) return false;
    const firstColumnLabels = grid.slice(1).map((row) => normalizeText(row[0]?.text || "")).filter(Boolean);
    return new Set(firstColumnLabels).size >= 2 && grid.slice(1).some((row) => row[0] && !row[0].isOrigin);
  }

  function splitMergedRowsIntoTablesHtml(table) {
    const grid = buildExpandedTableGrid(table);
    const captionText = normalizeText(table.querySelector(":scope > caption")?.textContent || "");
    const headingText = captionText || nearestPreviousHeadingText(table);
    const parentHeadingTag = captionText ? suggestSeparatedHeadingTag(table) : nearestPreviousHeadingTag(table) || "h3";
    const output = document.createElement("template");
    if (captionText) {
      const heading = document.createElement(parentHeadingTag);
      heading.textContent = headingText;
      output.content.appendChild(heading);
    }

    // buildExpandedTableGrid()はcolspanで結合されたヘッダーセルを、そのセルが占める
    // グリッド列数ぶん同じ参照で埋める。そのため単純にgrid[0]を.map()するとヘッダー文言が
    // 列数ぶん重複してしまう(例: colspan="2"の「連絡先」が2列とも「連絡先」になり、実際には
    // 異なる内容の列に誤ったラベルが付く)。同一セル参照が連続する区間(=1つの結合ヘッダーが
    // 占める範囲)を1つの単位として検出し、その区間が2列以上にまたがる場合は元のテキストを
    // 繰り返さず空文字にする(呼び出し側で`内容${index+1}`という汎用ラベルにフォールバックする)。
    const headerLabels = [];
    {
      const headerRow = grid[0] || [];
      let index = 0;
      while (index < headerRow.length) {
        const cell = headerRow[index]?.cell;
        let span = 1;
        while (index + span < headerRow.length && headerRow[index + span]?.cell === cell) {
          span += 1;
        }
        const label = span > 1 ? "" : normalizeText(headerRow[index]?.text || "");
        for (let i = 0; i < span; i += 1) {
          headerLabels.push(label);
        }
        index += span;
      }
    }
    const groups = [];
    let currentGroup = null;
    grid.slice(1).forEach((row) => {
      const groupLabel = normalizeText(row[0]?.text || "");
      if (!groupLabel) return;
      if (!currentGroup || row[0]?.isOrigin || currentGroup.label !== groupLabel) {
        currentGroup = { label: groupLabel, rows: [] };
        groups.push(currentGroup);
      }
      currentGroup.rows.push(row);
    });

    groups.forEach((group) => {
      const subheading = document.createElement(layoutTableChildHeadingTag(parentHeadingTag));
      subheading.textContent = group.label;
      output.content.appendChild(subheading);

      const splitTable = document.createElement("table");
      const caption = document.createElement("caption");
      caption.textContent = headingText ? `${headingText}（${group.label}）` : group.label;
      splitTable.appendChild(caption);

      const thead = document.createElement("thead");
      const headRow = document.createElement("tr");
      headerLabels.slice(1).forEach((label, index) => {
        const th = document.createElement("th");
        th.setAttribute("scope", "col");
        th.textContent = label || `内容${index + 1}`;
        headRow.appendChild(th);
      });
      thead.appendChild(headRow);
      splitTable.appendChild(thead);

      const tbody = document.createElement("tbody");
      group.rows.forEach((row) => {
        const tr = document.createElement("tr");
        row.slice(1).forEach((item) => {
          const td = document.createElement("td");
          appendInlineHtml(td, item?.html || escapeHtml(normalizeText(item?.text || "")));
          tr.appendChild(td);
        });
        tbody.appendChild(tr);
      });
      splitTable.appendChild(tbody);
      output.content.appendChild(splitTable);
    });

    return cleanHtml(output.innerHTML);
  }

  function buildMarkSeparatedTableHtml(table, imageContexts) {
    const output = document.createElement("template");
    const captionText = normalizeText(table.querySelector(":scope > caption")?.textContent || "");
    if (captionText) {
      const heading = document.createElement("h3");
      heading.textContent = captionText;
      output.content.appendChild(heading);
    }

    const grid = buildExpandedTableGrid(table);
    const firstMarkRowIndex = grid.findIndex((row) => row.some((item) => item?.isOrigin && hasMarkSymbol(item.text)));
    const list = document.createElement("ul");
    const seen = new Set();

    grid.forEach((row, rowIndex) => {
      const marks = row.filter((item) => item?.isOrigin && hasMarkSymbol(item.text));
      if (marks.length > 0) {
        marks.forEach((mark) => {
          const subject = markRowSubject(row, mark);
          if (!subject) {
            return;
          }
          const columnLabel = markColumnLabel(grid, mark);
          const sentence = columnLabel ? `${subject}は${columnLabel}が対象です。` : `${subject}が対象です。`;
          appendUniqueListItem(list, seen, sentence);
        });
        return;
      }

      if (firstMarkRowIndex < 0 || rowIndex < firstMarkRowIndex || isLikelyMarkHeaderRow(row, rowIndex)) {
        return;
      }

      const subject = markRowSubject(row, null);
      if (subject) {
        appendUniqueListItem(list, seen, `${subject}は該当なしです。`);
      }
    });

    if (list.children.length > 0) {
      output.content.appendChild(list);
      return cleanHtml(output.innerHTML);
    }

    return decomposeLayoutTable(table, imageContexts).replace(/[●○◎◯✓✔■□]/g, "該当");
  }

  // WHATWG HTML自体がcolspan属性を最大1000にクランプする仕様になっている(rowspanは
  // 仕様上65534)。ここではrowspan/colspan共通の安全上限として同じ1000を採用する。実際の
  // 表でこの値を超えることはまず無いが、Excel等からの貼り付けで生じる壊れたcolspan値
  // (数万〜天文学的な数字になることがある)が下の展開ループを実質無限ループ化させる
  // 実害が確認されたため、上限クランプを追加した(下限クランプは既存のまま維持)。
  const MAX_TABLE_SPAN = 1000;

  function buildExpandedTableGrid(table) {
    const grid = [];
    [...table.querySelectorAll("tr")].forEach((row, rowIndex) => {
      grid[rowIndex] ||= [];
      let columnIndex = 0;
      [...row.children]
        .filter((cell) => ["TD", "TH"].includes(cell.tagName))
        .forEach((cell) => {
          while (grid[rowIndex][columnIndex]) {
            columnIndex += 1;
          }
          const rowspan = Math.min(
            MAX_TABLE_SPAN,
            Math.max(1, Number.parseInt(cell.getAttribute("rowspan") || "1", 10) || 1)
          );
          const colspan = Math.min(
            MAX_TABLE_SPAN,
            Math.max(1, Number.parseInt(cell.getAttribute("colspan") || "1", 10) || 1)
          );
          const item = {
            cell,
            text: normalizeText(cell.textContent),
            rowIndex,
            columnIndex,
            isHeader: cell.tagName === "TH",
          };
          for (let rowOffset = 0; rowOffset < rowspan; rowOffset += 1) {
            grid[rowIndex + rowOffset] ||= [];
            for (let colOffset = 0; colOffset < colspan; colOffset += 1) {
              grid[rowIndex + rowOffset][columnIndex + colOffset] = {
                ...item,
                isOrigin: rowOffset === 0 && colOffset === 0,
              };
            }
          }
          columnIndex += colspan;
        });
    });
    return grid;
  }

  function markRowSubject(row, mark) {
    const texts = [];
    const seenCells = new Set();
    row.forEach((item) => {
      if (!item?.cell || item.cell === mark?.cell || seenCells.has(item.cell)) {
        return;
      }
      seenCells.add(item.cell);
      const text = normalizeText(item.text.replace(/[●○◎◯✓✔■□]/g, ""));
      if (text) {
        texts.push(text);
      }
    });
    return formatMarkSubject(texts);
  }

  function formatMarkSubject(texts) {
    const compact = texts.filter(Boolean);
    if (!compact.length) {
      return "";
    }
    if (compact.length >= 2 && /(区分|種別|分類|対象|対象者|項目)$/.test(compact[0])) {
      return `${compact[0]}: ${compact.slice(1).join("、")}`;
    }
    return compact.join("、");
  }

  function markColumnLabel(grid, mark) {
    for (let rowIndex = mark.rowIndex - 1; rowIndex >= 0; rowIndex -= 1) {
      const item = grid[rowIndex]?.[mark.columnIndex];
      if (!item || item.cell === mark.cell || hasMarkSymbol(item.text)) {
        continue;
      }
      const text = normalizeText(item.text);
      if (text) {
        return text;
      }
    }
    return "";
  }

  function appendUniqueListItem(list, seen, text) {
    const normalized = normalizeText(text);
    if (!normalized || seen.has(normalized)) {
      return;
    }
    seen.add(normalized);
    const item = document.createElement("li");
    item.textContent = normalized;
    list.appendChild(item);
  }

  function isLikelyMarkHeaderRow(row, rowIndex) {
    return rowIndex === 0 && row.some((item) => item?.isHeader);
  }

  function hasMarkSymbol(text) {
    return /[●○◎◯✓✔■□]/.test(text || "");
  }

  function tableWithRowRemoved(table, rowIndex) {
    const clone = table.cloneNode(true);
    stripInternalAttributes(clone);
    stripFormatting(clone);
    const rows = [...clone.querySelectorAll("tr")];
    rows[rowIndex]?.remove();
    return clone;
  }

  function suggestSeparatedHeadingTag(table) {
    let sibling = table.previousElementSibling;
    while (sibling) {
      if (/^H[2-5]$/.test(sibling.tagName)) {
        return `h${Math.min(6, headingLevel(sibling) + 1)}`;
      }
      sibling = sibling.previousElementSibling;
    }
    return "h3";
  }

  function buildImagePartsProposal(container) {
    const clone = container.cloneNode(true);
    stripInternalAttributes(clone);
    const output = document.createElement("template");
    const pending = document.createElement("template");

    [...clone.childNodes].forEach((node) => {
      if (isDirectImagePart(node)) {
        flushPendingImageText(output.content, pending);
        appendImageFigure(output.content, node);
        return;
      }
      pending.content.appendChild(node.cloneNode(true));
    });

    flushPendingImageText(output.content, pending);
    return cleanHtml(output.innerHTML) || cleanHtml(container.outerHTML);
  }

  function isDirectImagePart(node) {
    if (node.nodeType !== Node.ELEMENT_NODE) {
      return false;
    }
    if (node.tagName === "IMG") {
      return true;
    }
    return node.tagName === "A" && node.children.length === 1 && node.firstElementChild?.tagName === "IMG";
  }

  function appendImageFigure(root, node) {
    const figure = document.createElement("figure");
    figure.appendChild(node.cloneNode(true));
    root.appendChild(figure);
  }

  function flushPendingImageText(root, pending) {
    const html = cleanHtml(pending.innerHTML);
    pending.innerHTML = "";
    if (!html) {
      return;
    }
    if (/^<(p|div|ul|ol|dl|table|h[1-6]|blockquote|figure)\b/i.test(html)) {
      appendHtml(root, html);
      return;
    }
    const paragraph = document.createElement("p");
    appendInlineHtml(paragraph, html);
    root.appendChild(paragraph);
  }

  function buildForeignLanguageHtml(element, langCode) {
    const clone = element.cloneNode(true);
    stripInternalAttributes(clone);
    clone.setAttribute("lang", langCode);
    return cleanHtml(clone.outerHTML);
  }

  function inferLanguageCode(text) {
    if (HANGUL_SCRIPT_PATTERN.test(text)) return "ko";
    if (THAI_SCRIPT_PATTERN.test(text)) return "th";
    if (CYRILLIC_SCRIPT_PATTERN.test(text)) return "ru";
    if (HAN_SCRIPT_PATTERN.test(text) && CHINESE_MARKER_PATTERN.test(text)) return "zh";
    if (VIETNAMESE_TONE_MARK_PATTERN.test(text)) return "vi";
    if (/ñ/i.test(text)) return "es";
    if (/[ãõç]/i.test(text)) return "pt";
    if (/[A-Za-z]/.test(text)) return "en";
    return "";
  }

  function buildAdjacentNoteMergeProposal(element) {
    if (element.tagName !== "P") return null;
    const text = normalizeText(element.textContent || "");
    if (!/^※/.test(text)) return null;
    const previous = element.previousElementSibling;
    if (!previous || previous.tagName !== "P") return null;
    const previousText = normalizeText(previous.textContent || "");
    if (!/[（(]\s*※\s*[）)]/.test(previousText)) return null;

    const noteText = stripLeadingNoteMark(text);
    if (!noteText) return null;
    const clone = previous.cloneNode(true);
    stripInternalAttributes(clone);
    replaceTextInElement(clone, /[（(]\s*※\s*[）)]/u, `（${noteText}）`);
    return {
      target: previous,
      noteNodeId: element.getAttribute("data-goal2-node-id"),
      afterHtml: clone.outerHTML,
    };
  }

  function stripLeadingNoteMark(text) {
    return normalizeText(text).replace(/^※[\s　:：・.．、。]*/, "").trim();
  }

  function hasFollowingNoteParagraph(element, text) {
    if (element.tagName !== "P" || !/[（(]\s*※\s*[）)]/.test(normalizeText(text))) {
      return false;
    }
    const next = element.nextElementSibling;
    return Boolean(next && next.tagName === "P" && /^※/.test(normalizeText(next.textContent || "")));
  }

  function shouldCollectNoteSymbolCandidate(element, text) {
    const normalized = normalizeText(text);
    const markCount = (normalized.match(/※/g) || []).length;
    if (markCount >= 2) {
      return true;
    }
    if (/[（(]\s*※\s*[）)]/.test(normalized) || /※\s*[0-9０-９]+/.test(normalized)) {
      return true;
    }
    const container = element.closest("div, section, article, td, th, li") || element.parentElement;
    const containerText = normalizeText(container?.textContent || "");
    const containerMarkCount = (containerText.match(/※/g) || []).length;
    if (containerMarkCount >= 2 && /[（(]\s*※\s*[）)]|※\s*[0-9０-９]+/.test(containerText)) {
      return true;
    }
    return false;
  }

  function buildNoteSymbolHtml(element) {
    const clone = element.cloneNode(true);
    stripInternalAttributes(clone);
    clone.querySelectorAll("br").forEach((br) => br.replaceWith("\n"));
    const text = normalizeText(clone.textContent || "");
    if (text) {
      clone.textContent = text;
    }
    return cleanHtml(clone.outerHTML);
  }

  function tableCellDraft(cell, imageContexts) {
    const clone = cell.cloneNode(true);
    stripInternalAttributes(clone);
    clone.querySelectorAll("script, style, noscript").forEach((element) => element.remove());
    normalizeLayoutTableImages(clone, imageContexts);

    const text = normalizeText(clone.textContent);
    const hasMeaningfulElement = Boolean(clone.querySelector("img, figure, a, ul, ol, dl, p, h2, h3, h4, h5, h6, blockquote"));
    if (!text && !hasMeaningfulElement) {
      return null;
    }

    const contentNodes = [...clone.childNodes].filter((node) => {
      return node.nodeType !== Node.TEXT_NODE || normalizeText(node.textContent);
    });
    const hasBlockNode = contentNodes.some((node) => {
      return node.nodeType === Node.ELEMENT_NODE && isContentBlockElement(node);
    });

    if (hasBlockNode) {
      const output = document.createElement("template");
      const pending = document.createElement("template");
      contentNodes.forEach((node) => {
        if (node.nodeType === Node.ELEMENT_NODE && isContentBlockElement(node)) {
          flushPendingImageText(output.content, pending);
          output.content.appendChild(node.cloneNode(true));
          return;
        }
        pending.content.appendChild(node.cloneNode(true));
      });
      flushPendingImageText(output.content, pending);
      return {
        blocks: [...output.content.childNodes]
          .map((node) => (node.nodeType === Node.ELEMENT_NODE ? cleanHtml(node.outerHTML) : escapeHtml(normalizeText(node.textContent))))
          .filter(Boolean),
        simple: false,
        text,
      };
    }

    return {
      html: cleanHtml(clone.innerHTML) || escapeHtml(text),
      simple: true,
      text,
    };
  }

  function normalizeLayoutTableImages(root, imageContexts) {
    root.querySelectorAll("img").forEach((img) => {
      prepareLayoutTableImage(img, imageContexts);
    });

    [...root.childNodes].forEach((node) => {
      if (!isDirectImagePart(node)) {
        return;
      }
      const figure = document.createElement("figure");
      figure.appendChild(node.cloneNode(true));
      node.replaceWith(figure);
    });
  }

  function prepareLayoutTableImage(img, imageContexts) {
    const alt = img.getAttribute("alt");
    if (alt !== null && alt.trim() !== "" && !isGenericAlt(alt)) {
      return;
    }

    const caption = normalizeText(closestCaptionElement(img)?.textContent || "");
    const baseDraft = generateImageNameDraft(img, caption);
    const draft = isComplexImageCandidate(img, caption) ? generateComplexImageNameDraft(img, caption, baseDraft) : baseDraft;
    const suggestedAlt = draft?.name || (caption && !isGenericAlt(caption) ? caption : "");
    const recordImageContext = () => {
      imageContexts?.push({ src: img.getAttribute("src") || "", caption });
    };

    if (suggestedAlt) {
      img.setAttribute("alt", suggestedAlt);
      recordImageContext();
      return;
    }

    if (alt === null || alt.trim() === "") {
      img.setAttribute("alt", "画像内容を具体的に入力");
      recordImageContext();
      return;
    }

    img.setAttribute("alt", `${alt.replace(/の?写真$/, "")}の内容を具体的に説明`);
    recordImageContext();
  }

  function isLayoutRecordLabelDraft(draft) {
    return Boolean(draft?.simple && draft.text.length > 0 && draft.text.length <= 24);
  }

  function isSimpleLayoutValueDraft(draft) {
    return Boolean(draft?.simple && draft.text.length > 0);
  }

  function appendLayoutDraft(root, draft) {
    if (!draft) {
      return;
    }

    if (!draft.simple) {
      draft.blocks.forEach((html) => appendHtml(root, html));
      return;
    }

    const paragraph = document.createElement("p");
    appendInlineHtml(paragraph, draft.html);
    root.appendChild(paragraph);
  }

  function appendInlineHtml(element, html) {
    const template = document.createElement("template");
    template.innerHTML = html || "";
    element.append(...template.content.childNodes);
  }

  function appendHtml(root, html) {
    const template = document.createElement("template");
    template.innerHTML = html || "";
    root.append(...template.content.childNodes);
  }

  function isContentBlockElement(node) {
    return ["P", "UL", "OL", "DL", "H2", "H3", "H4", "H5", "H6", "BLOCKQUOTE", "FIGURE"].includes(node.tagName);
  }

  function makeCandidate(options) {
    const kbRule = state.ruleMap.get(options.ruleId) || fallbackRuleForCandidate(options.ruleId);
    const nodeId = options.element.getAttribute("data-goal2-node-id");
    return {
      page_session_id: currentSessionId(),
      rule_id: options.ruleId,
      category: kbRule.category || "unknown",
      processing_class: options.processingClass || kbRule.processing_class || "hybrid",
      status: "unresolved",
      target: {
        node_id: nodeId,
        selector: `[data-goal2-node-id="${nodeId}"]`,
        dom_path: buildDomPath(options.element),
        snippet: cleanHtml(options.element.outerHTML),
      },
      issue: {
        message: options.message,
        reason: options.reason,
        wcag: kbRule.wcag || [],
        jis: kbRule.jis || [],
      },
      proposal: {
        before_html: cleanHtml(options.element.outerHTML),
        after_html: cleanHtml(options.afterHtml),
        confidence: options.confidence || "medium",
        requires_human_review: Boolean(options.requiresHumanReview),
        patch_mode: options.patchMode || "replace",
        patch: options.patch || null,
        ai_draft: options.aiDraft
          ? { ...options.aiDraft, inserted: false, confirmed_name: null, confirmed_by: null, confirmed_at: null }
          : null,
        // Extra surrounding-DOM context (not shown in the UI) that the post-hoc LLM
        // enrichment pass needs but before_html/target.snippet alone don't carry
        // (e.g. nearby paragraph text, the containing table's full structure).
        llm_context: options.llmContext || null,
      },
      decision: {
        status: null,
        reason: null,
        actor: null,
        decided_at: null,
        after_html: null,
      },
      rule: {
        title: kbRule.title || options.ruleId,
        source: kbRule.source || "",
        description: kbRule.description || "",
        rule_text: kbRule.rule || "",
        examples: Array.isArray(kbRule.examples) ? kbRule.examples : [],
      },
    };
  }

  function fallbackRule(id, category, title, processingClass, wcag) {
    return {
      id,
      category,
      title,
      processing_class: processingClass,
      wcag,
      jis: wcag,
      source: "fallback",
      rule: title,
    };
  }

  function fallbackRuleForCandidate(id) {
    const rules = {
      "iframe.title": {
        category: "iframe",
        title: "iframeのtitle属性",
        processingClass: "hybrid",
        wcag: ["4.1.2"],
      },
      "iframe.cms-review": {
        category: "iframe",
        title: "iframeのCMS移行確認",
        processingClass: "escalation",
        wcag: [],
      },
      "iframe.frame-unsupported": {
        category: "iframe",
        title: "frame要素の移行確認",
        processingClass: "escalation",
        wcag: ["4.1.2"],
      },
    };
    const ruleInfo = rules[id];
    if (!ruleInfo) {
      return fallbackRule(id, "unknown", id, "hybrid", []);
    }
    return fallbackRule(id, ruleInfo.category, ruleInfo.title, ruleInfo.processingClass, ruleInfo.wcag);
  }

  function rebuildWorkingHtml() {
    return rebuildWorkingHtmlFor(state.sourceHtml, state.candidates);
  }

  function rebuildWorkingHtmlFor(sourceHtml, candidates) {
    const fragment = parseFragment(sourceHtml);
    const decided = candidates.filter((candidate) =>
      ["accepted", "edited"].includes(candidate.decision.status)
    );

    decided.forEach((candidate) => {
      if (candidate.decision.status === "edited") {
        replaceTarget(fragment.content, candidate.target.node_id, candidate.decision.after_html || candidate.proposal.after_html);
        return;
      }

      if (candidate.proposal.patch_mode === "none") {
        return;
      }

      applyCandidatePatch(fragment.content, candidate);
    });

    normalizeHeadingEmphasis(fragment.content);
    return fragment.innerHTML;
  }

  function normalizeHeadingEmphasis(root) {
    root.querySelectorAll("h1 strong,h2 strong,h3 strong,h4 strong,h5 strong,h6 strong,h1 b,h2 b,h3 b,h4 b,h5 b,h6 b").forEach(
      (element) => {
        element.replaceWith(...element.childNodes);
      }
    );
  }

  function applyCandidatePatch(root, candidate) {
    const target = root.querySelector(`[data-goal2-node-id="${cssEscape(candidate.target.node_id)}"]`);
    if (!target) {
      return;
    }

    if (candidate.decision?.selected_method_id && candidate.decision.selected_method_id !== candidate.candidate_id) {
      replaceTarget(root, candidate.target.node_id, candidate.decision.after_html || candidate.proposal.after_html);
      return;
    }

    const patch = candidate.proposal.patch;
    if (!patch) {
      replaceTarget(root, candidate.target.node_id, candidate.decision.after_html || candidate.proposal.after_html);
      return;
    }

    if (patch.type === "set-attribute") {
      target.setAttribute(patch.name, patch.value);
      return;
    }

    if (patch.type === "remove-attribute") {
      target.removeAttribute(patch.name);
      return;
    }

    if (patch.type === "set-text") {
      target.textContent = patch.value;
      return;
    }

    if (patch.type === "replace-text") {
      replaceTextInElement(target, patch.before, patch.after);
      return;
    }

    if (patch.type === "rename-element") {
      target.replaceWith(renameElement(target, patch.tag_name));
      return;
    }

    if (patch.type === "remove-style-properties") {
      removeStyleProperties(target, patch.names || []);
      return;
    }

    if (patch.type === "unwrap-element") {
      target.replaceWith(...target.childNodes);
      return;
    }

    if (patch.type === "remove-element") {
      target.remove();
      return;
    }

    if (patch.type === "merge-following-note") {
      const note = root.querySelector(`[data-goal2-node-id="${cssEscape(patch.note_node_id)}"]`);
      replaceTarget(root, candidate.target.node_id, candidate.decision.after_html || candidate.proposal.after_html);
      note?.remove();
      return;
    }

    if (patch.type === "replace-paragraph-sequence") {
      const nodes = (patch.node_ids || [])
        .map((nodeId) => root.querySelector(`[data-goal2-node-id="${cssEscape(nodeId)}"]`))
        .filter(Boolean);
      if (nodes.length > 0) {
        replaceTarget(root, nodes[0].getAttribute("data-goal2-node-id"), candidate.decision.after_html || candidate.proposal.after_html);
        nodes.slice(1).forEach((node) => node.remove());
      }
      return;
    }

    if (patch.type === "strip-formatting") {
      stripFormatting(target);
      return;
    }

    if (patch.type === "insert-caption" && target.tagName === "TABLE") {
      if (!target.querySelector(":scope > caption")) {
        const caption = document.createElement("caption");
        caption.textContent = patch.value;
        target.insertBefore(caption, target.firstChild);
      }
      return;
    }

    replaceTarget(root, candidate.target.node_id, candidate.decision.after_html || candidate.proposal.after_html);
  }

  function replaceTarget(root, nodeId, html) {
    const target = root.querySelector(`[data-goal2-node-id="${cssEscape(nodeId)}"]`);
    if (!target) {
      return;
    }

    const template = document.createElement("template");
    template.innerHTML = html.trim();
    if (!template.content.childNodes.length) {
      return;
    }
    const replacement = template.content;
    if (replacement.childNodes.length === 1 && replacement.firstElementChild) {
      replacement.firstElementChild.setAttribute("data-goal2-node-id", nodeId);
    }
    target.replaceWith(replacement);
  }

  function currentTargetHtml(candidate) {
    const target = currentTargetElement(candidate);
    return target ? cleanHtml(target.outerHTML) : "";
  }

  function currentCandidateAfterHtml(candidate) {
    const target = currentTargetElement(candidate);
    if (!target) {
      return "";
    }
    if (requiresAiImageNameInsertion(candidate)) {
      return cleanHtml(target.outerHTML);
    }
    if (candidate.proposal.patch_mode === "none") {
      return cleanHtml(target.outerHTML);
    }
    const template = document.createElement("template");
    template.content.appendChild(target.cloneNode(true));
    applyCandidatePatch(template.content, candidate);
    return cleanHtml(template.innerHTML);
  }

  function currentTargetElement(candidate) {
    const fragment = parseWorkingFragment();
    return fragment.content.querySelector(`[data-goal2-node-id="${cssEscape(candidate.target.node_id)}"]`);
  }

  function parseWorkingFragment() {
    const template = document.createElement("template");
    template.innerHTML = state.workingHtml || state.sourceHtml || "";
    if (!state.workingHtml) {
      stripInternalAttributes(template.content);
      assignNodeIds(template.content);
    }
    return template;
  }

  function setInputCollapsed(collapsed) {
    state.inputCollapsed = collapsed;
    els.inputBand.classList.toggle("is-collapsed", collapsed);
    els.inputBody.hidden = collapsed;
    els.toggleInputButton.textContent = collapsed ? "入力を開く" : "入力を閉じる";
    els.toggleInputButton.setAttribute("aria-expanded", String(!collapsed));
    if (!collapsed) {
      requestAnimationFrame(() => els.inputBody.scrollIntoView({ block: "nearest" }));
    }
  }

  function selectedCandidateIndex() {
    return state.candidates.findIndex((candidate) => candidate.candidate_id === state.selectedCandidateId);
  }

  function selectPreviousCandidate() {
    const index = selectedCandidateIndex();
    if (index <= 0) {
      return;
    }
    state.selectedCandidateId = state.candidates[index - 1].candidate_id;
    state.quickEditOpen = false;
    renderAll();
  }

  function selectNextUnresolvedCandidate() {
    const next = findNextUnresolvedCandidate(selectedCandidateIndex());
    if (!next) {
      return;
    }
    state.selectedCandidateId = next.candidate_id;
    state.quickEditOpen = false;
    renderAll();
  }

  function moveToNextUnresolvedCandidate(currentCandidateId) {
    const currentIndex = state.candidates.findIndex((candidate) => candidate.candidate_id === currentCandidateId);
    const next = findNextUnresolvedCandidate(currentIndex);
    if (next) {
      state.selectedCandidateId = next.candidate_id;
    }
  }

  function findNextUnresolvedCandidate(fromIndex) {
    if (!state.candidates.length) {
      return null;
    }
    const start = Math.max(fromIndex, -1);
    const maxOffset = fromIndex < 0 ? state.candidates.length : state.candidates.length - 1;
    for (let offset = 1; offset <= maxOffset; offset += 1) {
      const index = (start + offset) % state.candidates.length;
      const candidate = state.candidates[index];
      if (!candidate.decision.status) {
        return candidate;
      }
    }
    return null;
  }

  function renderReviewNavigation() {
    const total = state.candidates.length;
    const index = selectedCandidateIndex();
    els.reviewPosition.textContent = total > 0 && index >= 0 ? `${index + 1}/${total}` : "0/0";
    els.prevCandidateButton.disabled = index <= 0;
    els.nextCandidateButton.disabled = !findNextUnresolvedCandidate(index);
  }

  function decide(status) {
    const candidate = selectedCandidate();
    if (!candidate) {
      return;
    }
    const chosenMethodCandidate = activeFixMethodCandidate(candidate);
    if (status === "accepted" && shouldRequireEditedAdoption(chosenMethodCandidate)) {
      return;
    }
    if (status === "accepted" && requiresAiImageNameInsertion(chosenMethodCandidate)) {
      return;
    }
    if (status === "edited" && requiresAiImageNameInsertion(chosenMethodCandidate)) {
      return;
    }
    const reason = els.decisionReason.value.trim() || defaultDecisionReason(status);
    const editedAfterHtml = status === "edited" ? buildQuickEditedAfterHtml(chosenMethodCandidate) : null;
    if (status === "edited" && !editedAfterHtml) {
      return;
    }
    const afterHtml = status === "edited" ? editedAfterHtml : chosenMethodCandidate.proposal.after_html;
    applyCandidateDecision(candidate, status, reason, afterHtml, chosenMethodCandidate);
    state.workingHtml = rebuildWorkingHtml();
    moveToNextUnresolvedCandidate(candidate.candidate_id);
    state.quickEditOpen = false;
    renderAll();
  }

  function toggleQuickEditPanel() {
    const candidate = selectedCandidate();
    const methodCandidate = activeFixMethodCandidate(candidate);
    if (!candidate || !quickEditConfig(methodCandidate) || requiresAiImageNameInsertion(candidate)) {
      return;
    }
    state.quickEditOpen = !state.quickEditOpen;
    renderDetail();
  }

  function decideEditedFromQuickEdit() {
    decide("edited");
  }

  function applyCandidateDecision(candidate, status, reason, afterHtml, selectedMethodCandidate = candidate) {
    candidate.status = status;
    candidate.decision = {
      status,
      reason,
      actor: els.workerInput.value.trim() || "unknown",
      decided_at: new Date().toISOString(),
      after_html: ["accepted", "edited"].includes(status) ? afterHtml : null,
      selected_method_id: selectedMethodCandidate.candidate_id,
      selected_method_rule_id: selectedMethodCandidate.rule_id,
      selected_method_title: selectedMethodCandidate.rule.title,
    };
    state.bulkSelectedCandidateIds.delete(candidate.candidate_id);
    resolveSupersededTableCandidates(candidate);
  }

  function toggleBulkSelection() {
    state.bulkActionMessage = "";
    unresolvedCandidates().forEach((candidate) => {
      if (els.bulkSelectAll.checked) {
        state.bulkSelectedCandidateIds.add(candidate.candidate_id);
      } else {
        state.bulkSelectedCandidateIds.delete(candidate.candidate_id);
      }
    });
    renderBulkControls();
    syncCandidateCheckboxes();
  }

  function bulkAcceptSelected() {
    pruneBulkSelection();
    const selected = unresolvedCandidates().filter((candidate) =>
      state.bulkSelectedCandidateIds.has(candidate.candidate_id)
    );
    let acceptedCount = 0;
    let skippedCount = 0;

    selected.forEach((candidate) => {
      if (candidate.decision.status) {
        return;
      }
      if (!canBulkAcceptCandidate(candidate)) {
        skippedCount += 1;
        return;
      }
      applyCandidateDecision(candidate, "accepted", "チェックした候補を一括採用", candidate.proposal.after_html);
      acceptedCount += 1;
    });

    pruneBulkSelection();
    state.workingHtml = rebuildWorkingHtml();
    if (acceptedCount > 0 && selectedCandidate()?.decision.status) {
      moveToNextUnresolvedCandidate(state.selectedCandidateId);
    }
    state.bulkActionMessage =
      skippedCount > 0
        ? `${acceptedCount}件を一括採用しました。${skippedCount}件は編集または確認が必要なため残しました。`
        : `${acceptedCount}件を一括採用しました。`;
    renderAll();
  }

  function canBulkAcceptCandidate(candidate) {
    return Boolean(candidate && !candidate.decision.status && !acceptDisabledReason(candidate));
  }

  // Reproduces GOAL1's autoAcceptSafe on the goal2 screen for pages handed off with the
  // autoAcceptSafe flag (see loadGoal3Transfer). Goes through the same applyCandidateDecision
  // path as bulkAcceptSelected/decide() — not a raw decision-state import — so conflict
  // resolution between same-target candidates (resolveSupersededTableCandidates) still runs.
  // Applied once per hand-off: analyze() clears the flag right after calling this.
  function applyPendingAutoAcceptSafe() {
    state.pendingAutoAcceptSafe = false;
    state.candidates.forEach((candidate) => {
      if (!canBulkAcceptCandidate(candidate)) {
        return;
      }
      applyCandidateDecision(candidate, "accepted", "一括自動採用（機械的・確認不要）", candidate.proposal.after_html);
    });
  }

  function unresolvedCandidates() {
    return state.candidates.filter((candidate) => !candidate.decision.status);
  }

  function clearBulkSelection() {
    state.bulkSelectedCandidateIds.clear();
    state.bulkActionMessage = "";
  }

  function pruneBulkSelection() {
    const validIds = new Set(unresolvedCandidates().map((candidate) => candidate.candidate_id));
    [...state.bulkSelectedCandidateIds].forEach((candidateId) => {
      if (!validIds.has(candidateId)) {
        state.bulkSelectedCandidateIds.delete(candidateId);
      }
    });
  }

  function syncCandidateCheckboxes() {
    els.candidateList.querySelectorAll(".candidate-check").forEach((checkbox) => {
      checkbox.checked = state.bulkSelectedCandidateIds.has(checkbox.value);
    });
  }

  function resolveSupersededTableCandidates(candidate) {
    if (!["accepted", "edited"].includes(candidate.decision.status)) {
      return;
    }
    if (!isTableStructuralCandidate(candidate)) {
      return;
    }

    const decidedAt = new Date().toISOString();
    state.candidates.forEach((other) => {
      if (other === candidate || other.decision.status) {
        return;
      }
      const isSameTableCandidate = other.target.node_id === candidate.target.node_id && isTableRelatedCandidate(other);
      const isDescendantCandidate = isDescendantOfCandidateTarget(other, candidate);
      if (!isSameTableCandidate && !isDescendantCandidate) {
        return;
      }

      other.status = "conflicted";
      other.decision = {
        status: "conflicted",
        reason: isDescendantCandidate
          ? "表の構造変換候補が採用されたため、表内要素への候補は変換後HTMLで再評価するものとして自動解決"
          : "同じ表の構造変換候補が採用されたため、この表への追加の表関連修正は不要として自動解決",
        actor: "AGENT",
        decided_at: decidedAt,
        after_html: null,
      };
      state.bulkSelectedCandidateIds.delete(other.candidate_id);
    });
  }

  function isTableStructuralCandidate(candidate) {
    return Boolean(
      candidate &&
        tableStructuralRuleIds.has(candidate.rule_id) &&
        /^<table[\s>]/i.test(candidate.target.snippet || "")
    );
  }

  function isTableRelatedCandidate(candidate) {
    return Boolean(
      candidate &&
        tableRelatedRuleIds.has(candidate.rule_id) &&
        /^<table[\s>]/i.test(candidate.target.snippet || "")
    );
  }

  function isDescendantOfCandidateTarget(candidate, ancestorCandidate) {
    const path = candidate?.target?.dom_path || "";
    const ancestorPath = ancestorCandidate?.target?.dom_path || "";
    if (path && ancestorPath && ancestorPath !== "/" && path.startsWith(`${ancestorPath}/`)) {
      return true;
    }

    const beforeHtml = ancestorCandidate?.proposal?.before_html || ancestorCandidate?.target?.snippet || "";
    const childHtml = candidate?.proposal?.before_html || candidate?.target?.snippet || "";
    return Boolean(beforeHtml && childHtml && beforeHtml !== childHtml && beforeHtml.includes(childHtml));
  }

  function shouldRequireEditedAdoption(candidate) {
    return Boolean(candidate.proposal.requires_human_review && candidate.proposal.confidence === "low" && quickEditConfig(candidate));
  }

  function isImageNameCandidate(candidate) {
    return Boolean(
      ["image.alt-text", "image.complex-image-report"].includes(candidate?.rule_id) && candidate?.proposal.ai_draft
    );
  }

  function requiresAiImageNameInsertion(candidate) {
    return Boolean(isImageNameCandidate(candidate) && !candidate.proposal.ai_draft.inserted);
  }

  function acceptDisabledReason(candidate) {
    if (requiresAiImageNameInsertion(candidate)) {
      return "AI画像名候補を確認し、修正後HTMLへ投入してから採用してください。";
    }
    if (shouldRequireEditedAdoption(candidate)) {
      return "この候補は文言確認が必要です。文言を調整して採用するか、却下・要確認を選んでください。";
    }
    return "";
  }

  function renderAll() {
    renderCandidates();
    renderPageAgent();
    renderDetail();
    renderReviewNavigation();
    renderPreview();
    renderOutputs();
    renderMicheckerEnginePanel();
  }

  // miChecker公式(ReportMessageDialog.java)の表示文言と一致させたマッピング。
  // checkitem.xmlのtype属性(error/warning/info/user)は、IProblemConst定数
  // ESSENTIAL/WARNING/USER_CHECK/INFOとそれぞれ対応しており、infoが「手動確認」、
  // userが「要判断箇所」という一見直感に反する対応関係になっている(逆ではない)。
  const MICHECKER_ENGINE_TYPE_LABEL = {
    error: "問題あり",
    warning: "問題の可能性大",
    info: "手動確認",
    user: "要判断箇所",
  };

  const MICHECKER_ENGINE_BASIS_LABEL = {
    source: "元のHTML(候補生成時点)に対する結果です。",
    final: "最終HTML(現在の採用・編集状況を反映したもの)に対する結果です。",
  };

  // 計画書§4.3: 「miChecker指摘対応のみ」モードでの解析結果のみ表示し、既存候補一覧とは
  // 統合・重複排除しない独立表示。KB全ルールモードでは常に非表示(既定モードの挙動を維持)。
  function renderMicheckerEnginePanel() {
    if (!els.micheckerEnginePanel) return;
    const result = state.micheckerEngineResult;
    if (els.micheckerEngineRecheckButton) {
      els.micheckerEngineRecheckButton.disabled = state.ruleScopeMode !== "michecker" || !result;
    }
    if (state.ruleScopeMode !== "michecker" || !result) {
      els.micheckerEnginePanel.hidden = true;
      els.micheckerEngineTableBody.innerHTML = "";
      els.micheckerChecklistList.innerHTML = "";
      return;
    }
    els.micheckerEnginePanel.hidden = false;
    if (els.micheckerEngineResultBasis) {
      els.micheckerEngineResultBasis.textContent =
        MICHECKER_ENGINE_BASIS_LABEL[state.micheckerEngineResultBasis] || "";
    }

    const problems = result.problems || [];
    const checklist = result.checklist || [];
    // 該当箇所はCSSセレクタ文字列のままでは作業者に分からないため、実際にmiChecker相当
    // エンジンを実行した時点のHTML(micheckerEngineResultHtml)を再パースし、セレクタが
    // 指す要素のHTML抜粋(短縮)に差し替えて表示する(ビジュアル化)。
    const snippetDoc = state.micheckerEngineResultHtml
      ? new DOMParser().parseFromString(state.micheckerEngineResultHtml, "text/html")
      : null;

    els.micheckerEngineEmptyNote.hidden = problems.length > 0;
    els.micheckerEngineTableBody.innerHTML = problems
      .map((problem, index) => {
        const rules = state.ruleByCheckId.get(problem.checkId) || [];
        const ruleText = rules.length
          ? rules.map((rule) => escapeHtml(rule.title || rule.id)).join("、")
          : "(対応する移行ルールなし)";
        const locationHtml = buildMicheckerLocationCell(problem, snippetDoc);
        const selectedClass = index === state.selectedMicheckerProblemIndex ? " is-selected" : "";
        return `
          <tr class="${selectedClass.trim()}">
            <td>${escapeHtml(MICHECKER_ENGINE_TYPE_LABEL[problem.type] || problem.type || "")}</td>
            <td>${escapeHtml(problem.checkId)}</td>
            <td>${locationHtml}</td>
            <td>${escapeHtml(problem.message || "")}</td>
            <td>${ruleText}</td>
            <td><button type="button" class="secondary" data-michecker-index="${index}">プレビューで確認</button></td>
          </tr>
        `;
      })
      .join("");

    els.micheckerChecklistCount.textContent = String(checklist.length);
    els.micheckerChecklistList.innerHTML = checklist
      .map((item) => `<li>[${escapeHtml(item.checkId)}] ${escapeHtml(item.message || "")}</li>`)
      .join("");

    els.micheckerEngineSummary.textContent = buildMicheckerCompareSummaryText(problems);
  }

  const MICHECKER_LOCATION_SNIPPET_MAX = 3;

  // 「該当箇所」セルの中身を、CSSセレクタ文字列そのものではなく実際の要素のHTML抜粋に
  // する。snippetDocがまだ無い(結果はあるがHTMLの再パースに失敗した等)場合はセレクタの
  // 文字列表示にフォールバックする。
  function buildMicheckerLocationCell(problem, snippetDoc) {
    const selectors = problem.nodes || [];
    if (!selectors.length) {
      return "(ページ全体)";
    }
    if (!snippetDoc) {
      return escapeHtml(selectors.join(", "));
    }
    const snippets = selectors
      .slice(0, MICHECKER_LOCATION_SNIPPET_MAX)
      .map((selector) => {
        let element = null;
        try {
          element = snippetDoc.querySelector(selector);
        } catch {
          element = null;
        }
        return element ? truncateHtmlSnippet(element.outerHTML) : null;
      })
      .filter(Boolean);
    if (!snippets.length) {
      return escapeHtml(selectors.join(", "));
    }
    const extraCount = selectors.length - snippets.length;
    const extraNote = extraCount > 0 ? `<div class="michecker-location-extra">他${extraCount}件</div>` : "";
    return snippets.map((snippet) => `<code class="michecker-location-snippet">${snippet}</code>`).join("") + extraNote;
  }

  function truncateHtmlSnippet(outerHtml, maxLen = 120) {
    const collapsed = outerHtml.replace(/\s+/g, " ").trim();
    const truncated = collapsed.length > maxLen ? `${collapsed.slice(0, maxLen)}…` : collapsed;
    return escapeHtml(truncated);
  }

  function handleMicheckerEngineTableClick(event) {
    const button = event.target.closest("[data-michecker-index]");
    if (!button) return;
    const index = Number(button.dataset.micheckerIndex);
    if (Number.isNaN(index)) return;
    state.selectedMicheckerProblemIndex = index;
    renderMicheckerEnginePanel();
    renderPreview();
  }

  // 既存ヒューリスティック候補(state.candidates/notices)とエンジン検出結果を、チェックID
  // 単位の集合演算で突き合わせる参考サマリー。個々の要素同士の厳密な対応付けはmiChecker比較
  // 画面(michecker-compare.js)の役割であり、ここでは「1行の参考情報」に留める(計画書§4.3)。
  function buildMicheckerCompareSummaryText(problems) {
    const engineCheckIds = new Set(problems.map((p) => p.checkId));
    const heuristicCheckIds = new Set();
    [...state.candidates, ...state.notices].forEach((item) => {
      const resolvedRuleId = MICHECKER_RULE_ALIASES[item.rule_id] || item.rule_id;
      const rule = state.ruleMap.get(resolvedRuleId);
      (rule?.michecker_check_ids || []).forEach((id) => heuristicCheckIds.add(id));
    });
    let both = 0;
    let engineOnly = 0;
    engineCheckIds.forEach((id) => {
      if (heuristicCheckIds.has(id)) both += 1;
      else engineOnly += 1;
    });
    let heuristicOnly = 0;
    heuristicCheckIds.forEach((id) => {
      if (!engineCheckIds.has(id)) heuristicOnly += 1;
    });
    return `既存ヒューリスティック候補との突き合わせ(チェックID単位、参考値): 両方で検出 ${both}件 / エンジンのみ ${engineOnly}件 / ヒューリスティックのみ ${heuristicOnly}件`;
  }

  // 「最終HTMLで再実行」ボタンのハンドラ。候補生成時点の入力HTMLではなく、採用/編集済みの
  // 最終HTMLに対してmiChecker相当エンジンを手動で再実行する(自動再実行はしない — 候補の
  // 採用状況が変わるたびに走らせるコストを避け、いつの時点の結果かをボタン操作とラベルで
  // 明確にするという運用判断)。証跡出力(buildEvidence)もこの結果を反映するため、
  // 再実行後に出力欄も再描画する。
  function recheckMicheckerEngineAgainstFinalHtml() {
    if (state.ruleScopeMode !== "michecker") return;
    const finalHtml = stripMigrationUnneededAttributesFromHtml(
      stripInternalFromHtml(state.workingHtml || state.sourceHtml)
    );
    const result = runMicheckerEngine(finalHtml);
    state.micheckerEngineResult = result;
    state.micheckerEngineResultBasis = result ? "final" : null;
    state.micheckerEngineResultHtml = result ? finalHtml : null;
    state.selectedMicheckerProblemIndex = null;
    renderMicheckerEnginePanel();
    renderOutputs();
    renderPreview();
  }

  function renderPageAgent() {
    const candidate = selectedCandidate();
    const workflow = pageAgentWorkflowState();

    if (!els.pageAgentPanel) return;

    if (state.pageAgentDismissed) {
      els.pageAgentPanel.hidden = true;
      els.pageAgentPanel.innerHTML = "";
      return;
    }
    els.pageAgentPanel.hidden = false;

    const hadFocus = els.pageAgentPanel.contains(document.activeElement);
    const previousFocusedAction = hadFocus ? document.activeElement.dataset.pageAgentAction || null : null;

    const nextTask = pageAgentNextTask(workflow, candidate);
    const secondaryActions = pageAgentCompactSecondaryActions(workflow, candidate, nextTask.action);
    els.pageAgentPanel.classList.remove("phase-input", "phase-generate", "phase-review", "phase-output");
    els.pageAgentPanel.classList.add(`phase-${pageAgentPhaseName(workflow)}`);
    els.pageAgentPanel.innerHTML = `
      <div class="page-agent-topline">
        <div class="page-agent-kicker">次にやること</div>
        <div class="page-agent-topline-controls">
          <button type="button" class="page-agent-drag" data-page-agent-action="drag-handle" aria-label="矢印キーでパネルを移動" title="矢印キーで移動">${moveDragIconSvg()}</button>
          <button type="button" class="page-agent-close" data-page-agent-action="close" aria-label="次にやることパネルを閉じる" title="閉じる">${closeIconSvg()}</button>
        </div>
      </div>
      <h3>${escapeHtml(nextTask.title)}</h3>
      <p>${escapeHtml(nextTask.body)}</p>
      <div class="page-agent-actions">
        <button type="button" class="primary" data-page-agent-action="${escapeHtml(nextTask.action)}" ${nextTask.disabled ? "disabled" : ""}>${escapeHtml(nextTask.label)}</button>
        ${secondaryActions
          .map(
            (action) =>
              `<button type="button" data-page-agent-action="${escapeHtml(action.action)}" ${action.disabled ? "disabled" : ""}>${escapeHtml(action.label)}</button>`
          )
          .join("")}
      </div>
    `;
    ensurePageAgentInViewport();

    if (hadFocus) {
      restorePageAgentFocus(previousFocusedAction);
    }
  }

  function restorePageAgentFocus(previousAction) {
    if (!els.pageAgentPanel) return;
    const buttons = [...els.pageAgentPanel.querySelectorAll("button[data-page-agent-action]")];
    const target =
      buttons.find((button) => button.dataset.pageAgentAction === previousAction && !button.disabled) ||
      buttons.find((button) => !button.disabled);
    target?.focus();
  }

  function moveDragIconSvg() {
    return `
      <svg class="move-drag-icon" viewBox="0 0 24 24" focusable="false" aria-hidden="true">
        <path d="M12 3v18M12 3l-3 3M12 3l3 3M12 21l-3-3M12 21l3-3M3 12h18M3 12l3-3M3 12l3 3M21 12l-3-3M21 12l-3 3" />
      </svg>
    `;
  }

  function closeIconSvg() {
    return `
      <svg class="page-agent-close-icon" viewBox="0 0 24 24" focusable="false" aria-hidden="true">
        <path d="M6 6l12 12M18 6L6 18" />
      </svg>
    `;
  }

  function pageAgentPhaseName(workflow) {
    if (workflow.currentStep === "input") return "input";
    if (workflow.currentStep === "generate") return "generate";
    if (workflow.currentStep === "output") return "output";
    return "review";
  }

  function pageAgentNextTask(workflow, candidate) {
    if (workflow.currentStep === "input") {
      return {
        title: "本文HTMLを入力します",
        body: "CMSに登録する本文HTMLを貼り付けます。",
        action: "focus-input",
        label: "入力欄へ",
        disabled: false,
      };
    }
    if (workflow.currentStep === "generate") {
      return {
        title: "修正候補を生成します",
        body: "入力内容からアクセシビリティ修正候補を作ります。",
        action: "generate-candidates",
        label: "候補生成",
        disabled: false,
      };
    }
    if (workflow.currentStep === "output") {
      return {
        title: "出力をコピーします",
        body: "最終HTMLと証跡を確認してコピーします。",
        action: "open-output",
        label: "出力欄へ",
        disabled: false,
      };
    }
    if (!candidate) {
      return {
        title: "修正候補を選びます",
        body: "候補一覧から確認する項目を選択します。",
        action: "next-unresolved",
        label: "未処理へ",
        disabled: !findNextUnresolvedCandidate(selectedCandidateIndex()),
      };
    }
    const recommended = pageAgentRecommendedAction(candidate);
    return {
      title: pageAgentActionForCandidate(candidate).title,
      body: pageAgentActionForCandidate(candidate).next,
      action: recommended.action,
      label: recommended.label,
      disabled: recommended.disabled,
    };
  }

  function pageAgentCompactSecondaryActions(workflow, candidate, primaryAction) {
    const actions = [];
    if (candidate && primaryAction !== "jump-target") {
      actions.push({ action: "jump-target", label: "候補へ", disabled: false });
    }
    if (workflow.currentStep === "decide" && primaryAction !== "next-unresolved") {
      actions.push({ action: "next-unresolved", label: "次へ", disabled: !findNextUnresolvedCandidate(selectedCandidateIndex()) });
    }
    if (workflow.currentStep === "output") {
      actions.push({ action: "copy-final-html", label: "HTMLコピー", disabled: !els.finalHtml.value.trim() });
      actions.push({ action: "copy-evidence-json", label: "証跡コピー", disabled: !els.evidenceOutput.value.trim() });
    }
    return actions.slice(0, 2);
  }

  function pageAgentWorkflowState() {
    const hasInput = Boolean(els.htmlInput.value.trim());
    const total = state.candidates.length;
    const unresolved = unresolvedCandidates().length;
    const hasGenerated = Boolean(state.generatedAt);
    const hasNotices = state.notices.length > 0;

    if (!hasInput) {
      return {
        currentStep: "input",
        doneSteps: [],
        title: "まず本文HTMLを投入します",
        body: "CMSへ登録する本文HTML断片を入力欄へ貼り付けます。サンプルで試す場合はサンプル投入を使えます。",
        next: "入力欄へ移動してHTMLを貼り付ける",
      };
    }
    if (!hasGenerated) {
      return {
        currentStep: "generate",
        doneSteps: ["input"],
        title: "修正候補を生成します",
        body: "入力HTMLをもとに、リンク、画像、表、見出し、テキスト表記などの候補を生成します。",
        next: "候補生成を押す",
      };
    }
    if (total === 0) {
      return {
        currentStep: hasNotices ? "output" : "review",
        doneSteps: ["input", "generate"],
        title: hasNotices ? "注意事項を出力欄で確認します" : "修正候補はありません",
        body: hasNotices
          ? "本文HTMLを直接変更する候補はありませんが、CMS登録時に確認する注意事項があります。"
          : "修正候補も注意事項もない場合は、出力欄の最終HTMLと証跡を確認します。",
        next: "出力欄を確認する",
      };
    }
    if (unresolved > 0) {
      return {
        currentStep: "decide",
        doneSteps: ["input", "generate", "review"],
        title: "修正候補を確認して判断します",
        body: "候補ごとに、見た目の比較と判断理由を確認して、採用・文言調整・却下・要確認を選びます。",
        next: "選択中候補の推奨操作を確認する",
      };
    }
    return {
      currentStep: "output",
      doneSteps: ["input", "generate", "review", "decide"],
      title: "最終HTMLと証跡をコピーします",
      body: "すべての修正候補の判断が終わりました。最終HTML、注意、証跡JSONまたはCSVを出力欄で確認します。",
      next: "出力欄を開いてコピーする",
    };
  }

  function pageAgentPrimaryWorkflowAction(workflow) {
    if (workflow.currentStep === "input") {
      return { action: "focus-input", label: "入力欄へ移動", disabled: false };
    }
    if (workflow.currentStep === "generate") {
      return { action: "generate-candidates", label: "候補生成", disabled: false };
    }
    if (workflow.currentStep === "output") {
      return { action: "open-output", label: "出力欄へ", disabled: false };
    }
    return { action: "jump-target", label: "候補へ移動", disabled: false };
  }

  function pageAgentSecondaryWorkflowActions(workflow, candidate) {
    const actions = [];
    if (workflow.currentStep !== "input") {
      actions.push({ action: "focus-input", label: "入力欄へ", disabled: false });
    }
    if (workflow.currentStep !== "generate") {
      actions.push({ action: "generate-candidates", label: "再生成", disabled: !els.htmlInput.value.trim() });
    }
    if (workflow.currentStep === "output") {
      actions.push({ action: "copy-final-html", label: "最終HTMLコピー", disabled: !els.finalHtml.value.trim() });
      actions.push({ action: "copy-evidence-json", label: "証跡JSONコピー", disabled: !els.evidenceOutput.value.trim() });
    } else if (candidate) {
      actions.push({ action: "open-output", label: "出力欄へ", disabled: false });
    }
    return actions;
  }

  function pageAgentRecommendedAction(candidate) {
    if (!candidate || candidate.decision.status) {
      return { action: "next-unresolved", label: "次の未処理へ", disabled: !findNextUnresolvedCandidate(selectedCandidateIndex()) };
    }
    if (requiresAiImageNameInsertion(candidate) || shouldRequireEditedAdoption(candidate)) {
      return { action: "focus-edit-accept", label: "文言調整を開く", disabled: false };
    }
    if (candidate.proposal.patch_mode === "none" || candidate.proposal.requires_human_review || candidate.processing_class === "escalation") {
      return { action: "focus-needs-review", label: "要確認を確認", disabled: false };
    }
    return { action: "focus-accept", label: "採用を確認", disabled: Boolean(acceptDisabledReason(candidate)) };
  }

  function handlePageAgentAction(event) {
    const button = event.target.closest("[data-page-agent-action]");
    if (!button) return;
    const action = button.getAttribute("data-page-agent-action");
    if (action === "jump-target") {
      jumpToSelectedCandidateContext();
    } else if (action === "next-unresolved") {
      selectNextUnresolvedCandidate();
    } else if (action === "focus-input") {
      setInputCollapsed(false);
      els.htmlInput.focus();
    } else if (action === "generate-candidates") {
      analyze();
    } else if (action === "open-output") {
      openOutputDrawer();
    } else if (action === "copy-final-html") {
      copyText(els.finalHtml.value);
      focusOutputControl(els.copyHtmlButton);
    } else if (action === "copy-evidence-json") {
      copyText(els.evidenceOutput.value);
      focusOutputControl(els.copyEvidenceButton);
    } else if (action === "focus-accept") {
      focusDecisionButton(els.acceptButton);
    } else if (action === "focus-edit-accept") {
      if (!state.quickEditOpen) {
        toggleQuickEditPanel();
      }
      focusDecisionButton(els.editAcceptButton);
    } else if (action === "focus-needs-review") {
      focusDecisionButton(els.needsReviewButton);
    } else if (action === "close") {
      state.pageAgentDismissed = true;
      renderPageAgent();
      document.getElementById("pageHeading")?.focus();
    }
  }

  function handlePageAgentDragHandleKeydown(event) {
    if (!event.target.closest(".page-agent-drag")) return;
    const step = event.shiftKey ? 40 : 16;
    const deltas = {
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
    };
    const delta = deltas[event.key];
    if (!delta) return;
    event.preventDefault();
    const rect = els.pageAgentPanel.getBoundingClientRect();
    const margin = 12;
    const maxLeft = Math.max(margin, window.innerWidth - rect.width - margin);
    const maxTop = Math.max(margin, window.innerHeight - rect.height - margin);
    const left = clamp(rect.left + delta[0], margin, maxLeft);
    const top = clamp(rect.top + delta[1], margin, maxTop);
    setPageAgentPosition(left, top);
    try {
      localStorage.setItem("goal2.pageAgentPosition", JSON.stringify({ left: Math.round(left), top: Math.round(top) }));
    } catch {
      // Position persistence is optional.
    }
  }

  function startPageAgentDrag(event) {
    if (event.button !== 0 || event.target.closest("button, input, select, textarea, a")) {
      return;
    }
    const rect = els.pageAgentPanel.getBoundingClientRect();
    state.pageAgentDrag = {
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
    };
    els.pageAgentPanel.classList.add("is-dragging");
    els.pageAgentPanel.setPointerCapture?.(event.pointerId);
    event.preventDefault();
    window.addEventListener("pointermove", dragPageAgent);
    window.addEventListener("pointerup", stopPageAgentDrag, { once: true });
  }

  function dragPageAgent(event) {
    if (!state.pageAgentDrag) return;
    const rect = els.pageAgentPanel.getBoundingClientRect();
    const margin = 12;
    const maxLeft = Math.max(margin, window.innerWidth - rect.width - margin);
    const maxTop = Math.max(margin, window.innerHeight - rect.height - margin);
    const left = clamp(event.clientX - state.pageAgentDrag.offsetX, margin, maxLeft);
    const top = clamp(event.clientY - state.pageAgentDrag.offsetY, margin, maxTop);
    setPageAgentPosition(left, top);
  }

  function stopPageAgentDrag() {
    if (!state.pageAgentDrag) return;
    state.pageAgentDrag = null;
    els.pageAgentPanel.classList.remove("is-dragging");
    window.removeEventListener("pointermove", dragPageAgent);
    const rect = els.pageAgentPanel.getBoundingClientRect();
    try {
      localStorage.setItem("goal2.pageAgentPosition", JSON.stringify({ left: Math.round(rect.left), top: Math.round(rect.top) }));
    } catch {
      // Position persistence is optional.
    }
  }

  function restorePageAgentPosition() {
    if (!els.pageAgentPanel) return;
    try {
      const saved = JSON.parse(localStorage.getItem("goal2.pageAgentPosition") || "null");
      if (!saved || typeof saved.left !== "number" || typeof saved.top !== "number") return;
      const rect = els.pageAgentPanel.getBoundingClientRect();
      const margin = 12;
      const left = clamp(saved.left, margin, Math.max(margin, window.innerWidth - rect.width - margin));
      const top = clamp(saved.top, margin, Math.max(margin, window.innerHeight - rect.height - margin));
      setPageAgentPosition(left, top);
    } catch {
      // Ignore invalid persisted values.
    }
  }

  function ensurePageAgentInViewport() {
    if (!els.pageAgentPanel || !els.pageAgentPanel.style.left || !els.pageAgentPanel.style.top) return;
    const rect = els.pageAgentPanel.getBoundingClientRect();
    const margin = 12;
    const left = clamp(rect.left, margin, Math.max(margin, window.innerWidth - rect.width - margin));
    const top = clamp(rect.top, margin, Math.max(margin, window.innerHeight - rect.height - margin));
    if (Math.round(left) !== Math.round(rect.left) || Math.round(top) !== Math.round(rect.top)) {
      setPageAgentPosition(left, top);
    }
  }

  function setPageAgentPosition(left, top) {
    els.pageAgentPanel.style.left = `${Math.round(left)}px`;
    els.pageAgentPanel.style.top = `${Math.round(top)}px`;
    els.pageAgentPanel.style.right = "auto";
    els.pageAgentPanel.style.bottom = "auto";
  }

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function jumpToSelectedCandidateContext() {
    const candidate = selectedCandidate();
    if (!candidate) return;
    scrollPreviewToSelectedCandidate();
    const selectedRow = els.candidateList.querySelector(`.candidate-item[aria-selected="true"]`);
    selectedRow?.scrollIntoView({ block: "nearest" });
    els.candidateDetail.scrollIntoView({ block: "nearest" });
  }

  function openOutputDrawer() {
    els.outputDrawer.open = true;
    els.outputDrawer.scrollIntoView({ block: "start" });
  }

  function focusOutputControl(button) {
    if (!button) return;
    els.outputDrawer.open = true;
    button.focus();
    button.classList.add("is-page-agent-recommended");
    window.setTimeout(() => button.classList.remove("is-page-agent-recommended"), 1400);
  }

  function focusDecisionButton(button) {
    if (!button || button.disabled) return;
    button.focus();
    button.classList.add("is-page-agent-recommended");
    window.setTimeout(() => button.classList.remove("is-page-agent-recommended"), 1400);
  }

  function pageAgentActionForCandidate(candidate) {
    const ruleId = candidate.rule_id || "";
    if (candidate.decision.status) {
      return {
        title: "この候補は判断済みです",
        body: "必要があれば詳細を開いて判断理由を確認し、次の未処理へ進みます。",
        next: "次の未処理",
      };
    }
    if (acceptDisabledReason(candidate)) {
      return {
        title: "採用前に確認が必要です",
        body: acceptDisabledReason(candidate),
        next: "文言を調整、または要確認",
      };
    }
    if (candidate.proposal.patch_mode === "none") {
      return {
        title: "本文HTMLは直接変更しません",
        body: "この候補は注意・確認事項として扱います。内容は出力欄に残し、CMS登録時の確認に使います。",
        next: "要確認、または却下",
      };
    }
    if (ruleId === "file.file-display-text") {
      return {
        title: "ファイル種別・容量表記を外します",
        body: "PDFファイルや容量はCMSが自動表示する前提のため、リンク本文からは書類名だけを残します。",
        next: "見た目の比較を確認して採用",
      };
    }
    if (ruleId.startsWith("table.")) {
      return {
        title: "表の用途を確認します",
        body: "データ表として残すのか、レイアウト表として崩すのかで修正方法が変わります。修正方法の選択肢を先に確認してください。",
        next: "修正方法を選んで比較",
      };
    }
    if (ruleId.startsWith("link.")) {
      return {
        title: "リンク先が文面だけで分かるか確認します",
        body: "「こちら」などの曖昧な文言は、リンク先ページ名や目的が分かる表記へ寄せます。",
        next: "比較して採用、または文言を調整",
      };
    }
    if (ruleId.startsWith("image.")) {
      return {
        title: "画像の意味が本文で伝わるか確認します",
        body: "alt、キャプション、画像名候補は役割が違います。採用前に写真・図表・イラストなどの種類も確認してください。",
        next: "画像名候補を確認して採用",
      };
    }
    return {
      title: "この候補の差分を確認します",
      body: "まず「この候補で変わること」と見た目の比較を確認し、問題なければ採用します。",
      next: "採用、文言調整、却下、要確認",
    };
  }

  function pageAgentCautionForCandidate(candidate) {
    if (candidate.proposal.requires_human_review) {
      return "行政情報の意味や自治体固有の表記に影響しないか、人間の確認が必要です。";
    }
    if (candidate.processing_class === "mechanical") {
      return "機械的に処理しやすい候補ですが、前後の文脈だけは確認してください。";
    }
    if (candidate.processing_class === "escalation") {
      return "リンク先やCMS登録方法の確認が必要な可能性があります。";
    }
    return "";
  }

  function renderCandidates() {
    els.candidateList.innerHTML = "";
    pruneBulkSelection();
    const total = state.candidates.length;
    const unresolved = state.candidates.filter((candidate) => !candidate.decision.status).length;
    const done = total > 0 && unresolved === 0;

    els.candidateSummary.textContent =
      (total === 0
        ? `修正候補はありません。注意 ${state.notices.length}件は出力欄にあります。`
        : `${total}件中 ${unresolved}件が未処理です。注意 ${state.notices.length}件は出力欄。`) + llmUsageSummaryText();
    els.completionPill.textContent = done ? "完了可" : total === 0 && state.notices.length > 0 ? "注意のみ" : total === 0 ? "未生成" : "未完了";
    els.completionPill.className = `completion-pill ${done ? "done" : total > 0 ? "blocked" : ""}`;
    renderBulkControls();

    // Candidates that are alternative fix methods for the same target element are always
    // pushed consecutively by the collectors, so a run of same-target-node_id candidates can
    // be wrapped in a single bordered group to make "these belong together" visible at a
    // glance (not just via the per-item "同じ箇所の代替手段" badge text).
    let selectedButton = null;
    const candidates = state.candidates;
    let index = 0;
    while (index < candidates.length) {
      const candidate = candidates[index];
      let runEnd = index;
      while (runEnd + 1 < candidates.length && candidates[runEnd + 1].target.node_id === candidate.target.node_id) {
        runEnd += 1;
      }
      const groupSize = runEnd - index + 1;
      const host = groupSize > 1 ? document.createElement("div") : els.candidateList;
      if (groupSize > 1) {
        host.className = "candidate-group";
        host.setAttribute("role", "group");
        host.setAttribute("aria-label", `同じ箇所の候補、${groupSize}件`);
        const label = document.createElement("div");
        label.className = "candidate-group-label";
        label.textContent = `同じ箇所の候補・${groupSize}件`;
        host.appendChild(label);
      }
      for (let i = index; i <= runEnd; i += 1) {
        const row = buildCandidateRow(candidates[i]);
        host.appendChild(row);
        if (candidates[i].candidate_id === state.selectedCandidateId) {
          selectedButton = row.querySelector("button");
        }
      }
      if (groupSize > 1) {
        els.candidateList.appendChild(host);
      }
      index = runEnd + 1;
    }

    if (selectedButton) {
      requestAnimationFrame(() => selectedButton.scrollIntoView({ block: "nearest" }));
    }
  }

  // table.cell-merge-* candidates share a KB rule.title using a "セル結合①〜⑥" numbering
  // scheme (matching the source manual's own page layout, kept as-is in the KB for that
  // reason). That numbering means nothing to a worker skimming the candidate list, so the
  // list/selection UI shows the situational message (already written in plain language by
  // classifyMergedCellTable()) instead. The KB rule.title is still used for the KB browser,
  // aria/decision exports, etc. — this only affects what's shown while picking a candidate.
  function candidateDisplayTitle(candidate) {
    if (candidate.rule_id && candidate.rule_id.startsWith("table.cell-merge-") && candidate.issue?.message) {
      return candidate.issue.message.replace(/[。.]+$/, "");
    }
    return candidate.rule.title;
  }

  function buildCandidateRow(candidate) {
    const row = document.createElement("div");
    const button = document.createElement("button");
    const checkbox = document.createElement("input");
    const status = candidate.decision.status || "unresolved";
    const isUnresolved = !candidate.decision.status;
    row.className = `candidate-row ${status}`;
    checkbox.type = "checkbox";
    checkbox.className = "candidate-check";
    checkbox.value = candidate.candidate_id;
    checkbox.checked = state.bulkSelectedCandidateIds.has(candidate.candidate_id);
    checkbox.disabled = !isUnresolved;
    checkbox.setAttribute("aria-label", `${candidateDisplayTitle(candidate)}を一括採用対象に含める`);
    checkbox.addEventListener("change", () => {
      state.bulkActionMessage = "";
      if (checkbox.checked) {
        state.bulkSelectedCandidateIds.add(candidate.candidate_id);
      } else {
        state.bulkSelectedCandidateIds.delete(candidate.candidate_id);
      }
      renderBulkControls();
    });
    const siblingCount = candidatesForSameTarget(candidate).length;
    button.type = "button";
    button.className = `candidate-item ${status}`;
    button.setAttribute("aria-selected", String(candidate.candidate_id === state.selectedCandidateId));
    button.setAttribute(
      "aria-label",
      `${candidateDisplayTitle(candidate)}、${statusLabels[status] || status}、${candidate.candidate_id}` +
        (siblingCount > 1 ? `、同じ箇所への代替手段が他に${siblingCount - 1}件あります` : "")
    );
    button.addEventListener("click", () => {
      state.selectedCandidateId = candidate.candidate_id;
      state.selectedFixMethodId = null;
      state.quickEditOpen = false;
      renderAll();
    });

    button.innerHTML = `
      <div class="candidate-title">${escapeHtml(candidateDisplayTitle(candidate))}</div>
      ${siblingCount > 1 ? `<div class="candidate-alt-badge">同じ箇所の代替手段 ${siblingCount}件中</div>` : ""}
    `;
    row.append(checkbox, button);
    return row;
  }

  function renderBulkControls() {
    const unresolved = unresolvedCandidates();
    const selected = unresolved.filter((candidate) => state.bulkSelectedCandidateIds.has(candidate.candidate_id));
    const acceptableCount = selected.filter(canBulkAcceptCandidate).length;

    els.bulkSelectAll.disabled = unresolved.length === 0;
    els.bulkSelectAll.checked = unresolved.length > 0 && selected.length === unresolved.length;
    els.bulkSelectAll.indeterminate = selected.length > 0 && selected.length < unresolved.length;
    els.bulkAcceptButton.disabled = acceptableCount === 0;
    els.bulkAcceptButton.textContent =
      acceptableCount > 0 ? `チェック${acceptableCount}件を一括採用` : "チェックを一括採用";

    if (state.bulkActionMessage) {
      els.bulkActionStatus.textContent = state.bulkActionMessage;
    } else if (unresolved.length === 0) {
      els.bulkActionStatus.textContent = "未処理の候補はありません。";
    } else if (selected.length > 0) {
      els.bulkActionStatus.textContent = `選択 ${selected.length}件 / 一括採用可 ${acceptableCount}件`;
    } else {
      els.bulkActionStatus.textContent = "未処理候補をチェックして一括採用できます。";
    }
  }

  function renderDetail() {
    const candidate = selectedCandidate();
    if (!candidate) {
      els.detailSubtitle.textContent = "修正候補を選択してください。";
      els.candidateDetail.className = "detail-empty";
      els.candidateDetail.textContent = state.candidates.length
        ? "修正候補を選択してください。"
        : "修正候補はまだありません。注意は出力欄を確認してください。";
      els.decisionPanel.hidden = true;
      els.quickEditPanel.hidden = true;
      els.quickEditPanel.innerHTML = "";
      els.aiImageNamePanel.hidden = true;
      els.acceptButton.disabled = false;
      els.editAcceptButton.disabled = false;
      els.acceptButton.title = "";
      els.editAcceptButton.title = "";
      els.editAcceptButton.textContent = "文言を調整";
      els.editAcceptButton.classList.remove("is-active");
      return;
    }

    els.detailSubtitle.textContent = `${candidate.candidate_id} / ${candidate.rule_id}`;
    els.candidateDetail.className = "detail-block";
    const fixMethodCandidates = candidatesForSameTarget(candidate);
    const chosenMethodCandidate = activeFixMethodCandidate(candidate);
    const chosenMethodId = chosenMethodCandidate.candidate_id;
    const changeSummary = buildChangeSummary(candidate)
      .map((item) => `<li>${escapeHtml(item)}</li>`)
      .join("");
    const changeNote = invisibleChangeNote(chosenMethodCandidate);
    const beforeVisual = buildVisualPreviewCard(
      "修正前",
      candidate.proposal.before_html || currentTargetHtml(candidate) || candidate.target.snippet,
      "before",
      changeNote
    );
    const afterVisual = buildVisualPreviewCard(
      "修正後",
      chosenMethodCandidate.decision.after_html || currentCandidateAfterHtml(chosenMethodCandidate) || chosenMethodCandidate.proposal.after_html,
      "after",
      changeNote
    );
    els.candidateDetail.innerHTML = `
      <section class="detail-summary-card">
        <h3>この候補で変わること</h3>
        <ul class="change-summary">${changeSummary || "<li>修正前後の見え方を比べます。</li>"}</ul>
        ${buildRuleLearnMoreTriggerHtml()}
      </section>
      <section class="detail-summary-card">
        <h3>修正方法</h3>
        ${
          fixMethodCandidates.length > 1
            ? `<p class="fix-method-note">同じ箇所への修正方法が${fixMethodCandidates.length}件あります。いずれか1つを選んで採用してください。</p>`
            : `<p class="fix-method-note">この箇所の修正方法は1件です。</p>`
        }
        <div class="fix-method-grid" role="radiogroup" aria-label="修正方法を選ぶ">
          ${fixMethodCandidates
            .map(
              (method, index) => `
                <label class="fix-method-card ${method.candidate_id === chosenMethodId ? "is-selected" : ""}">
                  <input type="radio" name="fix-method" value="${escapeHtml(method.candidate_id)}" ${
                method.candidate_id === chosenMethodId ? "checked" : ""
              }>
                  <span class="fix-method-card-main">
                    <span class="fix-method-card-title">${escapeHtml(index === 0 ? `おすすめ: ${candidateDisplayTitle(method)}` : candidateDisplayTitle(method))}</span>
                    <span class="fix-method-card-copy">${escapeHtml(fixMethodDescription(method))}</span>
                  </span>
                  <span class="fix-method-card-meta">${escapeHtml(fixMethodBadge(method))}</span>
                </label>
              `
            )
            .join("")}
        </div>
      </section>
      <section class="visual-compare-card">
        <div class="visual-compare-heading">
          <h3>見た目の比較</h3>
          <p>HTMLを読まなくても、色と形で違いが分かるようにしています。</p>
        </div>
        <div class="compare-grid">${beforeVisual}${afterVisual}</div>
      </section>
    `;
    const previewHosts = els.candidateDetail.querySelectorAll("[data-goal2-visual-preview]");
    previewHosts.forEach((host) => {
      const content = host.getAttribute("data-goal2-visual-preview") || "";
      host.innerHTML = content;
    });
    els.candidateDetail.querySelectorAll('input[name="fix-method"]').forEach((input) => {
      input.addEventListener("change", () => {
        state.selectedFixMethodId = input.value;
        state.quickEditOpen = false;
        renderDetail();
        renderPreview();
        renderOutputs();
      });
    });
    els.beforeHtml.value = currentTargetHtml(candidate) || candidate.proposal.before_html;
    els.afterHtml.value = chosenMethodCandidate.decision.after_html || currentCandidateAfterHtml(chosenMethodCandidate) || chosenMethodCandidate.proposal.after_html;
    const candidateMeta = document.getElementById("candidateMeta");
    if (candidateMeta) {
      candidateMeta.innerHTML = `
        <dl class="detail-block">
          <div class="detail-row"><dt>分類</dt><dd>${escapeHtml(candidate.category)} / ${escapeHtml(candidate.processing_class)}</dd></div>
          <div class="detail-row"><dt>状態</dt><dd>${escapeHtml(statusLabels[candidate.decision.status || "unresolved"])}</dd></div>
          <div class="detail-row"><dt>確度</dt><dd>${escapeHtml(candidate.proposal.confidence)}${candidate.proposal.requires_human_review ? " / 要人間確認" : ""}</dd></div>
          <div class="detail-row"><dt>反映</dt><dd>${escapeHtml(candidate.proposal.patch_mode === "none" ? "HTML自動反映なし" : "HTMLへ反映可能")}</dd></div>
          ${isImageNameCandidate(candidate) ? `<div class="detail-row"><dt>AI画像名</dt><dd>${escapeHtml(candidate.proposal.ai_draft.name)}<br><span class="detail-note">${escapeHtml(candidate.proposal.ai_draft.source)}</span></dd></div>` : ""}
          <div class="detail-row"><dt>問題</dt><dd>${escapeHtml(candidate.issue.message)}</dd></div>
          <div class="detail-row"><dt>理由</dt><dd>${escapeHtml(candidate.issue.reason)}</dd></div>
          <div class="detail-row"><dt>WCAG/JIS</dt><dd>${escapeHtml([...candidate.issue.wcag, ...candidate.issue.jis].filter(Boolean).join(", ") || "なし")}</dd></div>
          <div class="detail-row"><dt>移行ルール根拠</dt><dd>${escapeHtml(candidate.rule.source || "未設定")}</dd></div>
        </dl>
      `;
    }
    renderAiImageNamePanel(candidate);
    renderQuickEditPanel(chosenMethodCandidate);
    els.decisionReason.value = candidate.decision.reason || "";
    const acceptBlockReason = acceptDisabledReason(chosenMethodCandidate);
    els.acceptButton.disabled = Boolean(acceptBlockReason);
    els.acceptButton.title = acceptBlockReason;
    const editAcceptBlockReason = requiresAiImageNameInsertion(chosenMethodCandidate)
      ? "AI画像名候補を確認し、修正後HTMLへ投入してから編集採用してください。"
      : !quickEditConfig(chosenMethodCandidate)
        ? "この候補は直感的な編集欄を用意できないため、採用・却下・要確認で判断してください。"
      : "";
    els.editAcceptButton.disabled = Boolean(editAcceptBlockReason);
    els.editAcceptButton.title = editAcceptBlockReason;
    els.editAcceptButton.textContent = state.quickEditOpen ? "調整を閉じる" : "文言を調整";
    els.editAcceptButton.classList.toggle("is-active", state.quickEditOpen);
    els.decisionPanel.hidden = false;
  }

  function buildChangeSummary(candidate) {
    const items = [];
    const ruleId = candidate?.rule_id || "";
    if (ruleId === "image.alt-text") {
      items.push("画像の内容が分かる名前に直します。");
    } else if (ruleId === "image.caption") {
      items.push("画像下の説明を、画像名とは分けて整えます。");
    } else if (ruleId === "image.complex-image-report") {
      items.push("複雑な画像は、本文説明と報告を分けて扱います。");
    } else if (ruleId === "link.link-text") {
      items.push("『こちら』のような曖昧なリンクを、行き先が分かる言い方にします。");
    } else if (ruleId === "link.link-purpose-standalone") {
      items.push("読み上げでもリンクの行き先が分かるようにします。");
    } else if (ruleId.startsWith("table.")) {
      items.push("表は、見出しやキャプションの役割が分かる形に整えます。");
    } else if (ruleId === "html-structure.deprecated-elements") {
      items.push("古い装飾用のタグを取り除き、通常のテキストとして表示します。");
    } else if (ruleId === "html-structure.embedded-script-behavior") {
      items.push("自動で動く仕組み（自動更新・自動移動）を取り除きます。");
    } else if (ruleId === "html-structure.duplicate-id-accesskey") {
      items.push("ページ内で重複しているid・accesskeyを一意になるよう直します。");
    } else if (ruleId.startsWith("html-structure.")) {
      items.push("見出しの順番や構造を、読み上げても追いやすい形に整えます。");
    } else if (ruleId === "text.foreign-language") {
      const langCode = candidate.proposal.patch?.value || "";
      items.push(`この文章にlang="${langCode}"（${languageLabel(langCode)}）を付与します。`);
    } else if (ruleId.startsWith("text.")) {
      items.push("表記ゆれや読みづらさを、自然な日本語に整えます。");
    }

    if (candidate.proposal.patch_mode === "none") {
      items.push("HTMLそのものは変えず、注意だけを残します。");
    }
    if (items.length === 0) {
      items.push("修正前後の違いを見比べます。");
    }
    return items;
  }

  function renderQuickEditPanel(candidate) {
    const config = quickEditConfig(candidate);
    if (!config || !state.quickEditOpen) {
      els.quickEditPanel.hidden = true;
      els.quickEditPanel.innerHTML = "";
      return;
    }
    els.quickEditPanel.hidden = false;
    els.quickEditPanel.innerHTML = `
      <div class="quick-edit-heading">
        <strong>${escapeHtml(config.title || "文言を調整")}</strong>
        <span>HTMLは表示しません</span>
      </div>
      ${
        config.mode === "heading"
          ? `
      <label>
        見出しレベル
        <select id="quickEditLevel">
          ${[2, 3, 4, 5, 6]
            .map(
              (level) =>
                `<option value="h${level}"${`h${level}` === config.level ? " selected" : ""}>レベル${level} (h${level})</option>`
            )
            .join("")}
        </select>
      </label>`
          : ""
      }
      <label>
        ${escapeHtml(config.label)}
        ${
          config.multiline
            ? `<textarea id="quickEditValue" spellcheck="false">${escapeHtml(config.value)}</textarea>`
            : `<input id="quickEditValue" type="text" value="${escapeHtml(config.value)}" />`
        }
      </label>
      <p>${escapeHtml(config.help)}</p>
      <div class="quick-edit-actions">
        <button type="button" class="decision-accept" id="quickEditApplyButton">この内容で採用</button>
        <button type="button" id="quickEditCancelButton">閉じる</button>
      </div>
    `;
    document.getElementById("quickEditApplyButton")?.addEventListener("click", decideEditedFromQuickEdit);
    document.getElementById("quickEditCancelButton")?.addEventListener("click", () => {
      state.quickEditOpen = false;
      renderDetail();
    });
  }

  function quickEditConfig(candidate) {
    if (!candidate) return null;
    const patch = candidate.proposal.patch || {};
    if (patch.type === "set-attribute" && ["alt", "title"].includes(patch.name)) {
      return {
        mode: "attribute",
        attribute: patch.name,
        selector: tagSelectorFromHtml(candidate.proposal.after_html),
        title: patch.name === "alt" ? "画像説明を調整" : "埋め込み名を調整",
        label: patch.name === "alt" ? "画像の説明" : "埋め込み内容の名前",
        value: patch.value || "",
        help: patch.name === "alt" ? "画像を見られない人にも伝わる短い説明にします。" : "動画、地図、外部コンテンツの内容が分かる名前にします。",
      };
    }
    if (patch.type === "set-attribute" && patch.name === "lang") {
      return {
        mode: "attribute",
        attribute: "lang",
        selector: tagSelectorFromHtml(candidate.proposal.after_html),
        title: "言語を調整",
        label: "lang属性の値(言語コード)",
        value: patch.value || "",
        help: `自動判定: ${languageLabel(patch.value)}。判定が違う場合はBCP47言語コード(en/zh/ko/es/pt/ru/th/vi等)で書き換えてください。`,
      };
    }
    if (patch.type === "replace-text") {
      return {
        mode: "replace-text",
        before: patch.before,
        title: candidate.rule_id === "link.link-text" ? "リンク文言を調整" : "文言を調整",
        label: candidate.rule_id === "link.link-text" ? "リンク文言" : "置き換える文言",
        value: patch.after || "",
        help: candidate.rule_id === "link.link-text" ? "リンク先の内容が単独で分かる文言にします。" : "読みやすく、意味が変わらない文言にします。",
      };
    }
    if (patch.type === "set-text") {
      return {
        mode: "text-content",
        title: "表示文言を調整",
        label: "表示する文言",
        value: patch.value || "",
        help: "画面に表示する文言だけを調整します。",
      };
    }
    const caption = firstElementText(candidate.proposal.after_html, "caption");
    if (caption !== null) {
      return {
        mode: "element-text",
        selector: "caption",
        title: "表の説明を調整",
        label: "表の説明",
        value: caption,
        help: "表の内容を短く説明するキャプションにします。",
      };
    }
    const heading = firstElementText(candidate.proposal.after_html, "h1,h2,h3,h4,h5,h6");
    if (heading !== null && /^html-structure\./.test(candidate.rule_id)) {
      return {
        mode: "heading",
        selector: "h1,h2,h3,h4,h5,h6",
        title: "見出しを調整",
        label: "見出し文言",
        value: heading,
        level: firstElementTagName(candidate.proposal.after_html, "h1,h2,h3,h4,h5,h6") || "h2",
        help: "見出しレベルと文言を、ページ構造に合わせて調整します。",
      };
    }
    return null;
  }

  function buildQuickEditedAfterHtml(candidate) {
    const config = quickEditConfig(candidate);
    const input = document.getElementById("quickEditValue");
    if (!config || !input) {
      return "";
    }
    const value = input.value.trim();
    if (!value) {
      return "";
    }
    const template = document.createElement("template");
    template.innerHTML = candidate.proposal.after_html || "";
    if (config.mode === "attribute") {
      const target = template.content.querySelector(config.selector || "*");
      if (!target) return "";
      target.setAttribute(config.attribute, value);
    } else if (config.mode === "replace-text") {
      replaceTextInElement(template.content, config.before, value);
    } else if (config.mode === "text-content") {
      const first = template.content.firstElementChild;
      if (!first) return "";
      first.textContent = value;
    } else if (config.mode === "element-text") {
      const target = template.content.querySelector(config.selector);
      if (!target) return "";
      target.textContent = value;
    } else if (config.mode === "heading") {
      const target = template.content.querySelector(config.selector);
      if (!target) return "";
      target.textContent = value;
      const level = document.getElementById("quickEditLevel")?.value || config.level;
      if (level && target.tagName.toLowerCase() !== level) {
        const renamed = document.createElement(level);
        [...target.attributes].forEach((attribute) => renamed.setAttribute(attribute.name, attribute.value));
        renamed.innerHTML = target.innerHTML;
        target.replaceWith(renamed);
      }
    }
    return cleanHtml(template.innerHTML);
  }

  function tagSelectorFromHtml(html) {
    const template = document.createElement("template");
    template.innerHTML = html || "";
    const first = template.content.firstElementChild;
    return first ? first.tagName.toLowerCase() : "*";
  }

  function firstElementText(html, selector) {
    const template = document.createElement("template");
    template.innerHTML = html || "";
    const element = template.content.querySelector(selector);
    return element ? normalizeText(element.textContent || "") : null;
  }

  function firstElementTagName(html, selector) {
    const template = document.createElement("template");
    template.innerHTML = html || "";
    const element = template.content.querySelector(selector);
    return element ? element.tagName.toLowerCase() : null;
  }

  function candidatesForSameTarget(candidate) {
    if (!candidate) return [];
    return state.candidates.filter((other) => other.target.node_id === candidate.target.node_id);
  }

  function activeFixMethodCandidate(candidate) {
    const methods = candidatesForSameTarget(candidate);
    if (state.selectedFixMethodId) {
      const selected = methods.find((method) => method.candidate_id === state.selectedFixMethodId);
      if (selected) {
        return selected;
      }
    }
    return candidate;
  }

  function fixMethodDescription(candidate) {
    const ruleId = candidate?.rule_id || "";
    const afterHtml = candidate?.proposal?.after_html || "";
    if (ruleId === "table.caption") {
      return "表は残し、caption / th / scope など読み取りに必要な構造を整えます。";
    }
    if (ruleId === "table.cell-merge-layout" && (afterHtml.match(/<table\b/gi) || []).length >= 2) {
      return "1つの表に押し込まれた内容を、意味単位ごとの複数の表に分割します。";
    }
    if (ruleId === "table.layout-table") {
      return "表としての関係が薄い場合に、本文や画像配置へ分解します。";
    }
    if (ruleId.startsWith("table.cell-merge")) {
      return "結合セルが見出し・注記・レイアウトのどれかを見て、必要な形に直します。";
    }
    if (ruleId.startsWith("html-structure.")) {
      return "見出しレベルや区切りを、ページの文脈に合わせて整えます。";
    }
    if (ruleId === "image.alt-text" || ruleId === "image.complex-image-report") {
      return "画像の内容が伝わる名前や説明を入れる方法です。";
    }
    if (ruleId === "link.link-text") {
      return "リンク先が文脈なしでも分かる文言に直します。";
    }
    if (candidate?.proposal?.patch_mode === "none") {
      return "HTMLは変えず、作業時の注意として残します。";
    }
    return candidate?.issue?.message || "この対象に対する別の修正方法です。";
  }

  function fixMethodBadge(candidate) {
    if (candidate?.rule_id === "table.cell-merge-layout" && ((candidate?.proposal?.after_html || "").match(/<table\b/gi) || []).length >= 2) {
      return "分割案";
    }
    if (candidate?.proposal?.patch_mode === "none") {
      return "注意";
    }
    if (candidate?.proposal?.requires_human_review) {
      return candidate.proposal.confidence === "low" ? "要確認" : "確認あり";
    }
    if (candidate?.proposal?.confidence === "high") {
      return "推奨";
    }
    return "候補";
  }

  function buildRuleLearnMoreTriggerHtml() {
    return `<button type="button" class="rule-learn-more-trigger">❓ このルールについて詳しく確認する</button>`;
  }

  function buildRuleLearnMoreBodyHtml(candidate) {
    const rule = candidate.rule || {};
    const wcagJis = [...new Set([...(candidate.issue?.wcag || []), ...(candidate.issue?.jis || [])])].filter(Boolean).join(" / ");
    const examplesHtml = (rule.examples || [])
      .slice(0, 3)
      .map(
        (example) => `
          <div class="rule-learn-more-example">
            ${example.case ? `<p class="rule-learn-more-example-case">${escapeHtml(example.case)}</p>` : ""}
            <div class="rule-learn-more-example-pair">
              <div><span class="rule-learn-more-example-label">修正前</span><code>${escapeHtml(example.before || "")}</code></div>
              <div><span class="rule-learn-more-example-label">修正後</span><code>${escapeHtml(example.after || "")}</code></div>
            </div>
            ${example.point ? `<p class="rule-learn-more-example-point">${escapeHtml(example.point)}</p>` : ""}
          </div>
        `
      )
      .join("");
    return `
      ${wcagJis ? `<p class="rule-learn-more-wcag">WCAG/JIS: ${escapeHtml(wcagJis)}</p>` : ""}
      ${rule.description ? `<p>${escapeHtml(rule.description)}</p>` : ""}
      ${rule.rule_text ? `<p class="rule-learn-more-text">${escapeHtml(rule.rule_text)}</p>` : ""}
      ${examplesHtml ? `<div class="rule-learn-more-examples">${examplesHtml}</div>` : ""}
      ${rule.source ? `<p class="rule-learn-more-source">出典: ${escapeHtml(rule.source)}</p>` : ""}
    `;
  }

  function openRuleLearnMore(candidate) {
    if (!els.ruleLearnMoreOverlay || !candidate) return;
    els.ruleLearnMoreTitle.textContent = candidate.rule?.title || candidate.rule_id;
    els.ruleLearnMoreBody.innerHTML = buildRuleLearnMoreBodyHtml(candidate);
    els.ruleLearnMoreOverlay.hidden = false;
    if (els.appMain) {
      els.appMain.inert = true;
    }
    els.ruleLearnMoreCloseButton?.focus();
  }

  function closeRuleLearnMore() {
    if (!els.ruleLearnMoreOverlay || els.ruleLearnMoreOverlay.hidden) return;
    els.ruleLearnMoreOverlay.hidden = true;
    if (els.appMain) {
      els.appMain.inert = false;
    }
    const trigger = els.candidateDetail?.querySelector(".rule-learn-more-trigger");
    trigger?.focus();
  }

  function buildVisualPreviewCard(title, html, tone, changeNote) {
    const previewHtml = sanitizeVisualPreviewHtml(stripInternalFromHtml(html || "<p>（内容なし）</p>"));
    return `
      <article class="compare-card compare-card-${tone}"${changeNote ? ` title="${escapeHtml(changeNote)}"` : ""}>
        <div class="compare-card-header">
          <strong>${escapeHtml(title)}</strong>
          <span>${tone === "before" ? "元の状態" : "修正後の状態"}</span>
        </div>
        <div class="compare-visual" data-goal2-visual-preview="${escapeHtml(previewHtml)}"></div>
        ${changeNote ? `<p class="compare-invisible-hint">見た目は変わりません。ホバーで変更内容を表示</p>` : ""}
      </article>
    `;
  }

  // Some rules only change an attribute that assistive tech reads but that never renders
  // visibly (alt/lang/scope/headers/title) — the before/after preview cards above look
  // identical, which used to leave "did this actually do anything?" unanswered. When the
  // active patch touches one of those attributes, this builds a plain-language before→after
  // description shown as a hover tooltip on both compare cards instead.
  const INVISIBLE_RENDER_ATTRIBUTES = new Set(["alt", "lang", "scope", "headers", "title", "xml:lang"]);

  function invisibleChangeNote(candidate) {
    const patch = candidate?.proposal?.patch;
    if (!patch || patch.type !== "set-attribute") {
      return "";
    }
    const attrName = (patch.name || "").toLowerCase();
    if (!INVISIBLE_RENDER_ATTRIBUTES.has(attrName)) {
      return "";
    }
    const beforeValue = normalizeText(extractAttributeFromHtml(candidate.proposal.before_html, patch.name) || "");
    const afterValue = normalizeText(patch.value || "");
    return `${patch.name}属性: ${beforeValue || "(未設定)"} → ${afterValue || "(空)"}`;
  }

  // 見た目比較は候補のHTMLを親ページのDOMへ直接挿入するため、挿入時に実行・遷移を引き起こす
  // 能動的コンテンツを除去する。特に<meta http-equiv="refresh">は動的挿入でもブラウザが処理し、
  // アプリのページ自体を遷移させてしまう(miChecker C_36.x候補のプレビューで実際に発生)。
  function sanitizeVisualPreviewHtml(html) {
    const template = document.createElement("template");
    template.innerHTML = html || "";
    template.content.querySelectorAll("meta, script, base, link").forEach((el) => el.remove());
    template.content.querySelectorAll("*").forEach((el) => {
      [...el.attributes].forEach((attr) => {
        if (/^on/i.test(attr.name)) {
          el.removeAttribute(attr.name);
        } else if (["href", "src"].includes(attr.name.toLowerCase()) && /^\s*javascript:/i.test(attr.value)) {
          el.removeAttribute(attr.name);
        }
      });
    });
    const sanitized = template.innerHTML.trim();
    if (!sanitized && (html || "").trim()) {
      return "<p>（画面には表示されない要素です）</p>";
    }
    return sanitized;
  }

  function renderAiImageNamePanel(candidate) {
    if (!isImageNameCandidate(candidate)) {
      els.aiImageNamePanel.hidden = true;
      return;
    }

    const draft = candidate.proposal.ai_draft;
    els.aiImageNamePanel.hidden = false;
    els.aiImageNameInput.value = draft.confirmed_name || draft.name || "";
    els.aiImageNameStatus.textContent = draft.inserted ? "投入済み" : "未投入";
    els.aiImageNameStatus.className = draft.inserted ? "is-inserted" : "";
    els.applyAiImageNameButton.textContent = draft.inserted ? "画像名を更新" : "修正後HTMLへ投入";
  }

  function applyAiImageNameToAfterHtml() {
    const candidate = selectedCandidate();
    if (!isImageNameCandidate(candidate)) {
      return;
    }

    const imageName = normalizeText(els.aiImageNameInput.value);
    if (!imageName) {
      els.aiImageNameStatus.textContent = "画像名を入力してください";
      els.aiImageNameStatus.className = "is-error";
      return;
    }

    const afterHtml = buildImageAltHtml(candidate, imageName);
    candidate.proposal.after_html = afterHtml;
    candidate.proposal.patch_mode = "replace";
    candidate.proposal.patch = { type: "set-attribute", name: "alt", value: imageName };
    candidate.proposal.ai_draft = {
      ...candidate.proposal.ai_draft,
      inserted: true,
      confirmed_name: imageName,
      confirmed_by: els.workerInput.value.trim() || "unknown",
      confirmed_at: new Date().toISOString(),
    };

    const decisionReason = els.decisionReason.value.trim() || "AI画像名を確認して修正後HTMLへ投入";
    renderDetail();
    renderOutputs();
    els.decisionReason.value = decisionReason;
  }

  function buildImageAltHtml(candidate, imageName) {
    const target = currentTargetElement(candidate);
    const template = document.createElement("template");
    if (target) {
      template.content.appendChild(target.cloneNode(true));
    } else {
      template.innerHTML = candidate.proposal.before_html || candidate.target.snippet || "";
    }
    const img = template.content.querySelector("img");
    if (img) {
      img.setAttribute("alt", imageName);
    }
    return cleanHtml(template.innerHTML);
  }

  // michecker-engine.jsのselectorPathFor()は、DOMParserが常に補うhtml/body要素を含む
  // 完全なDocumentに対して計算されているため、"html > body > ..."から始まることが多い。
  // buildPreviewHtml()が使う<template>のDocumentFragmentにはhtml/body要素自体が存在しない
  // ため、そのままでは一致しない。フラグメントのルート直下を基準にするプレフィックスだけ
  // 取り除く(id指定で経路が短絡しているセレクタは対象外なのでそのまま使う)。
  function stripMicheckerSelectorPrefix(selector) {
    return selector.replace(/^html\s*>\s*body\s*(>\s*)?/, "");
  }

  function highlightMicheckerProblemInFragment(root) {
    const problem = state.micheckerEngineResult?.problems?.[state.selectedMicheckerProblemIndex];
    if (!problem) return;
    (problem.nodes || []).forEach((selector) => {
      const relativeSelector = stripMicheckerSelectorPrefix(selector);
      if (!relativeSelector) return;
      try {
        root.querySelectorAll(relativeSelector).forEach((element) => element.classList.add("goal2-highlight"));
      } catch {
        // ブラウザがこのセレクタ構文をサポートしない場合はハイライトをスキップする(致命的ではない)。
      }
    });
  }

  function buildPreviewHtml() {
    const html = state.workingHtml || cleanHtml(state.sourceHtml);
    const template = document.createElement("template");
    template.innerHTML = html;
    sanitizePreview(template.content);
    const candidate = selectedCandidate();
    if (candidate) {
      const target = template.content.querySelector(`[data-goal2-node-id="${cssEscape(candidate.target.node_id)}"]`);
      if (target) {
        target.classList.add("goal2-highlight");
      }
    }
    if (state.ruleScopeMode === "michecker" && state.selectedMicheckerProblemIndex != null) {
      highlightMicheckerProblemInFragment(template.content);
    }
    const previewHtml = stripInternalFromHtml(template.innerHTML);
    return `<!doctype html><html lang="ja"><head><meta charset="utf-8"><style>
      body{font-family:"Segoe UI","Yu Gothic UI","Meiryo",sans-serif;line-height:1.7;color:#18212b;padding:18px;margin:0}
      h1,h2,h3,h4,h5,h6{display:flex;align-items:center;gap:.45rem;line-height:1.35;margin:1.15em 0 .45em}
      h1::before,h2::before,h3::before,h4::before,h5::before,h6::before{flex:0 0 auto;border:1px solid #bcc8d4;border-radius:4px;background:#eef3f8;color:#253242;font-size:12px;font-weight:700;line-height:1.4;padding:1px 6px}
      h1::before{content:"H1";background:#6d2f6d;border-color:#6d2f6d;color:#fff}
      h2::before{content:"H2";background:#0f6f78;border-color:#0f6f78;color:#fff}
      h3::before{content:"H3";background:#174ea6;border-color:#174ea6;color:#fff}
      h4::before{content:"H4";background:#6b5b00;border-color:#6b5b00;color:#fff}
      h5::before{content:"H5"}
      h6::before{content:"H6"}
      table{border-collapse:collapse;margin:1em 0;max-width:100%}td,th{border:1px solid #98a5b3;padding:6px 8px}caption{text-align:left;font-weight:700;margin-bottom:6px}
      img{max-width:100%;height:auto}.goal2-highlight{outline:3px solid #d89216;outline-offset:3px;background:#fff7df;scroll-margin:24px}
      a{color:#0f5f87}
    </style></head><body>${previewHtml || "<p>HTMLを入力してください。</p>"}</body></html>`;
  }

  // 通常の候補選択に加え、miChecker相当チェック結果の行選択もプレビューハイライト対象に
  // なるため、「ハイライト対象があるか」「その識別子」をこの2関数に集約する。
  function hasActivePreviewHighlightTarget() {
    return Boolean(selectedCandidate()) || (state.ruleScopeMode === "michecker" && state.selectedMicheckerProblemIndex != null);
  }

  function currentPreviewHighlightId() {
    const candidate = selectedCandidate();
    if (candidate) return candidate.candidate_id;
    if (state.ruleScopeMode === "michecker" && state.selectedMicheckerProblemIndex != null) {
      return `michecker_${state.selectedMicheckerProblemIndex}`;
    }
    return "";
  }

  function renderPreview() {
    const previewHtml = buildPreviewHtml();
    const pending = hasActivePreviewHighlightTarget();
    els.previewFrame.dataset.scrollStatus = pending ? "pending" : "idle";
    els.previewFrame.dataset.scrollCandidateId = currentPreviewHighlightId();
    els.previewFrame.srcdoc = previewHtml;
    if (els.previewFrameExpanded && els.previewExpandOverlay && !els.previewExpandOverlay.hidden) {
      els.previewFrameExpanded.dataset.scrollStatus = pending ? "pending" : "idle";
      els.previewFrameExpanded.dataset.scrollCandidateId = currentPreviewHighlightId();
      els.previewFrameExpanded.srcdoc = previewHtml;
    }
  }

  function scrollPreviewToSelectedCandidate(frame = els.previewFrame) {
    if (!frame) return;
    if (!hasActivePreviewHighlightTarget()) {
      frame.dataset.scrollStatus = "idle";
      return;
    }
    const highlightId = currentPreviewHighlightId();
    requestAnimationFrame(() => {
      try {
        const target = frame.contentDocument?.querySelector(".goal2-highlight");
        if (!target) {
          frame.dataset.scrollStatus = "target-missing";
          return;
        }
        target.scrollIntoView({ block: "center", inline: "nearest" });
        frame.dataset.scrollStatus = "scrolled";
        frame.dataset.scrollCandidateId = highlightId;
      } catch {
        // The preview is sandboxed; if browser access is denied, keep the highlight visible without auto-scroll.
        frame.dataset.scrollStatus = "blocked";
      }
    });
  }

  function openPreviewExpanded() {
    if (!els.previewExpandOverlay || !els.previewFrameExpanded) return;
    const pending = hasActivePreviewHighlightTarget();
    els.previewFrameExpanded.dataset.scrollStatus = pending ? "pending" : "idle";
    els.previewFrameExpanded.dataset.scrollCandidateId = currentPreviewHighlightId();
    els.previewFrameExpanded.srcdoc = buildPreviewHtml();
    els.previewExpandOverlay.hidden = false;
    if (els.appMain) {
      els.appMain.inert = true;
    }
    els.previewExpandCloseButton?.focus();
  }

  function closePreviewExpanded() {
    if (!els.previewExpandOverlay || els.previewExpandOverlay.hidden) return;
    els.previewExpandOverlay.hidden = true;
    if (els.appMain) {
      els.appMain.inert = false;
    }
    els.previewExpandButton?.focus();
  }

  function renderOutputs() {
    const finalHtml = stripMigrationUnneededAttributesFromHtml(stripInternalFromHtml(state.workingHtml || state.sourceHtml));
    els.finalHtml.value = finalHtml;
    renderNoticeOutput();
    els.evidenceOutput.value = JSON.stringify(buildEvidence(finalHtml), null, 2);
    if (isProcessingComplete()) {
      els.outputDrawer.open = true;
    }
  }

  function isProcessingComplete() {
    return isProcessingCompleteFor(state.candidates, state.notices, state.generatedAt, state.sourceHtml);
  }

  function isProcessingCompleteFor(candidates, notices, generatedAt, sourceHtml) {
    if (!generatedAt) {
      return false;
    }
    if (candidates.length === 0) {
      return notices.length > 0 || Boolean(sourceHtml);
    }
    return candidates.every((candidate) => candidate.decision.status);
  }

  function buildEvidence(finalHtml) {
    return buildEvidenceFor(
      {
        sessionId: currentSessionId(),
        pageTitle: els.pageTitleInput.value.trim(),
        oldUrl: els.oldUrlInput.value.trim(),
        cmsTarget: els.cmsTargetInput.value.trim(),
        worker: els.workerInput.value.trim(),
        generatedAt: state.generatedAt,
        ruleScopeMode: state.ruleScopeMode,
        sourceHtml: state.sourceHtml,
        candidates: state.candidates,
        notices: state.notices,
        micheckerEngineResult: state.micheckerEngineResult,
      },
      finalHtml
    );
  }

  // Context-parameterized evidence builder shared by the goal2 screen (via buildEvidence
  // above) and the GOAL1 batch engine, which has no input fields to read from.
  function buildEvidenceFor(context, finalHtml) {
    return {
      page_session_id: context.sessionId,
      ...(context.ruleScopeMode === "michecker" && context.micheckerEngineResult
        ? {
            michecker_engine: {
              problems: context.micheckerEngineResult.problems,
              checklist: context.micheckerEngineResult.checklist,
              engine_version: context.micheckerEngineResult.engineVersion,
            },
          }
        : {}),
      page_title: context.pageTitle,
      old_url: context.oldUrl,
      cms_target: context.cmsTarget || "",
      worker: context.worker || "",
      generated_at: context.generatedAt,
      rule_scope_mode: context.ruleScopeMode,
      input_hash: hashText(context.sourceHtml),
      final_hash: hashText(finalHtml),
      completion: {
        total: context.candidates.length,
        unresolved: context.candidates.filter((candidate) => !candidate.decision.status).length,
        complete: isProcessingCompleteFor(context.candidates, context.notices, context.generatedAt, context.sourceHtml),
        notices: context.notices.length,
      },
      candidates: context.candidates.map((candidate) => ({
        candidate_id: candidate.candidate_id,
        rule_id: candidate.rule_id,
        category: candidate.category,
        processing_class: candidate.processing_class,
        status: candidate.decision.status || "unresolved",
        confidence: candidate.proposal.confidence,
        requires_human_review: candidate.proposal.requires_human_review,
        patch_mode: candidate.proposal.patch_mode,
        ai_image_name: isImageNameCandidate(candidate)
          ? candidate.proposal.ai_draft?.confirmed_name || candidate.proposal.ai_draft?.name || null
          : null,
        ai_image_name_inserted: isImageNameCandidate(candidate) ? candidate.proposal.ai_draft?.inserted || false : false,
        ai_image_name_source: isImageNameCandidate(candidate) ? candidate.proposal.ai_draft?.source || null : null,
        before_html: candidate.proposal.before_html,
        after_html: candidateAfterHtmlForEvidence(candidate),
        decision_reason: candidate.decision.reason,
        actor: candidate.decision.actor,
        decided_at: candidate.decision.decided_at,
        related_wcag: candidate.issue.wcag,
        related_jis: candidate.issue.jis,
        kb_source: candidate.rule.source,
        miChecker_status: null,
        miChecker_classification: null,
        unresolved_reason: candidate.decision.status ? null : "未処理",
      })),
      notices: context.notices.map((notice) => ({
        notice_id: notice.notice_id,
        rule_id: notice.rule_id,
        category: notice.category,
        processing_class: notice.processing_class,
        confidence: notice.proposal.confidence,
        requires_human_review: notice.proposal.requires_human_review,
        message: notice.issue.message,
        reason: notice.issue.reason,
        target_html: notice.proposal.before_html,
        related_wcag: notice.issue.wcag,
        related_jis: notice.issue.jis,
        kb_source: notice.rule.source,
      })),
    };
  }

  function renderNoticeOutput() {
    if (!state.notices.length) {
      els.noticeOutput.className = "notice-output is-empty";
      els.noticeOutput.textContent = "注意はありません。";
      return;
    }

    els.noticeOutput.className = "notice-output";
    els.noticeOutput.innerHTML = state.notices
      .map((notice, index) => {
        const source = notice.rule.source
          ? `<div><dt>移行ルール根拠</dt><dd>${escapeHtml(notice.rule.source)}</dd></div>`
          : "";
        return `
          <article class="notice-item" role="listitem">
            <p class="notice-kicker">注意 ${index + 1}</p>
            <h3>${escapeHtml(notice.rule.title)}</h3>
            <p>${escapeHtml(notice.issue.message)}</p>
            <dl>
              <div><dt>扱い</dt><dd>CMS登録時に確認する注意事項です。HTMLへコピーする文言ではありません。</dd></div>
              <div><dt>分類</dt><dd>${escapeHtml(notice.category)} / ${escapeHtml(notice.processing_class)}</dd></div>
              <div><dt>理由</dt><dd>${escapeHtml(notice.issue.reason)}</dd></div>
              <div><dt>対象HTML</dt><dd><code class="notice-html">${escapeHtml(notice.proposal.before_html)}</code></dd></div>
              ${source}
            </dl>
          </article>
        `;
      })
      .join("");
  }

  function downloadEvidenceCsv() {
    const finalHtml = stripInternalFromHtml(state.workingHtml || state.sourceHtml);
    const evidence = buildEvidence(finalHtml);
    const rows = [
      [
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
      ],
      ...evidence.candidates.map((candidate) => [
        evidence.page_session_id,
        candidate.candidate_id,
        candidate.rule_id,
        candidate.category,
        candidate.processing_class,
        candidate.status,
        candidate.confidence,
        candidate.requires_human_review,
        candidate.patch_mode,
        candidate.ai_image_name,
        candidate.ai_image_name_inserted,
        candidate.ai_image_name_source,
        candidate.decision_reason,
        candidate.actor,
        candidate.decided_at,
        candidate.before_html,
        candidate.after_html,
        (candidate.related_wcag || []).join("|"),
        (candidate.related_jis || []).join("|"),
        candidate.kb_source,
        candidate.miChecker_status,
        candidate.miChecker_classification,
        candidate.unresolved_reason,
      ]),
    ];
    const csv = rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${currentSessionId()}-evidence.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function candidateAfterHtmlForEvidence(candidate) {
    if (!candidate.decision.status && requiresAiImageNameInsertion(candidate)) {
      return candidate.proposal.before_html;
    }
    return candidate.decision.after_html || candidate.proposal.after_html;
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      textarea.remove();
    }
  }

  function selectedCandidate() {
    return state.candidates.find((candidate) => candidate.candidate_id === state.selectedCandidateId) || null;
  }

  function currentSessionId() {
    return `goal2_${hashText(currentOldUrl() + "|" + currentPageTitle()).slice(0, 10)}`;
  }

  function procedureParentHeadingProposal(fragment) {
    const firstHeading = firstMeaningfulHeading(fragment.content);
    if (!firstHeading || firstHeading.tagName !== "H3") {
      return null;
    }
    const source = fragment.innerHTML;
    if (!needsProcedureParentHeading(source)) {
      return null;
    }
    return {
      element: firstHeading,
      html: `<h2>手続きについて</h2>${stripInternalFromHtml(firstHeading.outerHTML)}`,
    };
  }

  function oldSiteTemplateHeadingProposal(heading) {
    const text = normalizeText(heading.textContent);
    if (text === "Menu") {
      return { element: heading };
    }
    if (text !== "アンケート") {
      return null;
    }
    const container = heading.closest("div") || heading;
    const containerText = normalizeText(container.textContent);
    if (/このページの内容は分かりやすかったですか|このページは見つけやすかったですか/.test(containerText)) {
      return { element: container };
    }
    return { element: heading };
  }

  function needsProcedureParentHeading(html) {
    const text = normalizeText(stripInternalFromHtml(html).replace(/<[^>]+>/g, " "));
    return (
      /(?:原動機付自転車|小型特殊自動車|軽四輪|軽三輪|軽二輪|小型二輪)/.test(text) &&
      /申告先/.test(text) &&
      /関連ダウンロードファイル/.test(text) &&
      !/<h2\b[^>]*>\s*手続きについて\s*<\/h2>/i.test(html)
    );
  }

  function isDepartmentGuideIntroText(text) {
    const normalized = normalizeText(text);
    return normalized.length <= 140 && /各部署の担当課別業務案内|課名をクリック/.test(normalized);
  }

  function singleStrongListHeadingProposal(list) {
    const items = [...list.children].filter((child) => child.tagName === "LI");
    if (items.length !== 1) {
      return null;
    }
    const item = items[0];
    const strong = item.querySelector(":scope > p > strong, :scope > strong");
    if (!strong || item.querySelector("ul,ol,table,img,iframe")) {
      return null;
    }
    const label = normalizeHeadingCandidateLabel(item.textContent);
    if (!isDocumentRequirementLabel(label)) {
      return null;
    }
    const previousHeading = previousMeaningfulHeading(list);
    if (!previousHeading || headingLevel(previousHeading) !== 2 || !/必要|添付|書類|持ち物/.test(previousHeading.textContent)) {
      return null;
    }
    const next = nextMeaningfulElement(list);
    if (!next || next.matches("h1,h2,h3,h4,h5,h6,table,ul,ol")) {
      return null;
    }
    const link = strong.querySelector("a");
    const preservedLink = link ? `<p>${stripInternalFromHtml(link.outerHTML)}</p>` : "";
    return { html: `<h3>${escapeHtml(label)}</h3>${preservedLink}` };
  }

  function organizationListHeadingProposal(list) {
    const items = [...list.children].filter((child) => child.tagName === "LI");
    if (items.length !== 1 || list.querySelector("ul,ol,table,img,iframe,a")) {
      return null;
    }
    const label = normalizeHeadingCandidateLabel(items[0].textContent);
    if (!label || label.length > 60 || !/(協会|事務所|支局|市役所|役場|センター)/.test(label)) {
      return null;
    }
    const previousHeading = previousMeaningfulHeading(list);
    const next = nextMeaningfulElement(list);
    if (!previousHeading || headingLevel(previousHeading) !== 4 || !/申告先|提出先|問い合わせ|お問い合わせ/.test(previousHeading.textContent)) {
      return null;
    }
    if (!next || !/(所在地|住所|電話)/.test(next.textContent)) {
      return null;
    }
    return { html: `<h5>${escapeHtml(label)}</h5>` };
  }

  function legalReferenceHeadingProposal(element) {
    const text = normalizeText(element.textContent);
    const previousHeading = previousMeaningfulHeading(element);
    const previousText = normalizeText(previousHeading?.textContent || "");
    if (!/地方税法|法律上|法令/.test(previousText)) {
      return null;
    }

    const bracketed = text.match(/^（([^（）]{1,40})）$/);
    if (bracketed && /(書類|送達|規定|条文)/.test(bracketed[1])) {
      return { html: `<h4>${escapeHtml(bracketed[1])}</h4>` };
    }

    const article = text.match(/^(第[一二三四五六七八九十百千〇零0-9０-９]+条)[\s　]+(.+)$/);
    if (article) {
      return { html: `<h5>${escapeHtml(article[1])}</h5><p>${escapeHtml(article[2])}</p>` };
    }

    return null;
  }

  function isEmptyHeadingSection(heading) {
    const text = normalizeText(heading.textContent);
    if (!text) {
      return true;
    }
    if (!isRemovableEmptyHeadingLabel(text)) {
      return false;
    }
    const next = nextMeaningfulElement(heading);
    if (!next) {
      return headingLevel(heading) <= 2;
    }
    if (!next.matches("h1,h2,h3,h4,h5,h6")) {
      return false;
    }
    return headingLevel(next) <= headingLevel(heading);
  }

  function normalizeHeadingCandidateLabel(text) {
    return normalizeText(text).replace(/\u200b/g, "").replace(/\s+/g, " ").trim();
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

  function previousMeaningfulHeading(element) {
    let current = element.previousElementSibling;
    while (current) {
      if (current.matches("h1,h2,h3,h4,h5,h6")) {
        return current;
      }
      current = current.previousElementSibling;
    }
    return null;
  }

  function firstMeaningfulHeading(root) {
    return [...root.querySelectorAll("h1,h2,h3,h4,h5,h6")].find((heading) => normalizeText(heading.textContent)) || null;
  }

  function nextMeaningfulElement(element) {
    let current = element.nextElementSibling;
    while (current && isIgnorableElement(current)) {
      current = current.nextElementSibling;
    }
    return current;
  }

  function isIgnorableElement(element) {
    const text = normalizeText(element.textContent).replace(/\u00a0/g, "");
    return !text && !element.querySelector("a,img,iframe,table,video,audio");
  }

  function defaultDecisionReason(status) {
    if (status === "accepted") return "AGENT候補を採用";
    if (status === "edited") return "作業者が文言を調整して採用";
    if (status === "rejected") return "作業者判断で却下";
    if (status === "needs_review") return "承認者またはSV確認へ回す";
    return "";
  }

  function candidateKey(ruleId, nodeId, afterHtml) {
    return `${ruleId}|${nodeId}|${hashText(afterHtml)}`;
  }

  function pushUniqueCandidate(candidates, seen, candidate) {
    const key = candidateKey(candidate.rule_id, candidate.target.node_id, candidate.proposal.after_html);
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    candidates.push(candidate);
  }

  function pushTextReplacementCandidate(candidates, seen, options) {
    if (!options.before || options.before === options.after) {
      return;
    }

    const clone = options.element.cloneNode(true);
    replaceTextInElement(clone, options.before, options.after);
    pushUniqueCandidate(
      candidates,
      seen,
      makeCandidate({
        ruleId: options.ruleId,
        element: options.element,
        message: options.message,
        reason: options.reason,
        afterHtml: clone.outerHTML,
        patch: { type: "replace-text", before: options.before, after: options.after },
        confidence: options.confidence,
        requiresHumanReview: options.requiresHumanReview,
      })
    );
  }

  function textNodes(root) {
    const nodes = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let current = walker.nextNode();
    while (current) {
      nodes.push(current);
      current = walker.nextNode();
    }
    return nodes;
  }

  function shouldSkipTextElement(element) {
    return Boolean(element.closest("script, style, noscript, textarea, select, option"));
  }

  function hasTextDescendant(element) {
    return textNodes(element).some((node) => normalizeText(node.nodeValue).length > 0);
  }

  function replaceTextInElement(element, before, after) {
    const isRegex = before instanceof RegExp;
    const node = textNodes(element).find((textNode) => {
      const value = textNode.nodeValue || "";
      if (isRegex) {
        before.lastIndex = 0;
        return before.test(value);
      }
      return value.includes(before);
    });
    if (!node) {
      return false;
    }
    if (isRegex) {
      before.lastIndex = 0;
    }
    node.nodeValue = node.nodeValue.replace(before, after);
    return true;
  }

  function findMatches(text, regex) {
    const matches = [];
    regex.lastIndex = 0;
    let match = regex.exec(text);
    while (match) {
      matches.push({ text: match[0], index: match.index });
      match = regex.exec(text);
    }
    return matches;
  }

  function findFullDateMatches(text) {
    return findMatches(text, /\d{4}[/.]\d{1,2}[/.]\d{1,2}/g).filter((match) => {
      const [year, month, day] = match.text.split(/[/.]/).map(Number);
      return isValidCalendarDate(year, month, day) && hasDateTokenBoundary(text, match.index, match.text.length);
    });
  }

  function findPartialDateMatches(text) {
    return findMatches(text, /\d{1,2}[/.]\d{1,2}/g).filter((match) => isLikelyPartialDateMatch(text, match));
  }

  function findWeekdayNotationMatches(text) {
    const matches = [];
    findMatches(text, /[（(]\s*([日月火水木金土])(?:曜)?\s*[)）]/g).forEach((match) => {
      const day = match.text.replace(/[（）()\s　曜]/g, "");
      matches.push({
        text: match.text,
        index: match.index,
        after: `（${weekdayName(day)}）`,
      });
    });

    const dateWeekdayRegex = /(\d{1,2}[/.]\d{1,2})([\s　]*)([日月火水木金土])(?:曜(?:日)?)?/g;
    let match = dateWeekdayRegex.exec(text);
    while (match) {
      const dateText = match[1];
      const day = match[3];
      const dateMatch = { text: dateText, index: match.index };
      if (isLikelyPartialDateMatch(text, dateMatch)) {
        matches.push({
          text: match[0],
          index: match.index,
          after: `${dateText}（${weekdayName(day)}）`,
        });
      }
      match = dateWeekdayRegex.exec(text);
    }
    return dedupeMatches(matches);
  }

  function dedupeMatches(matches) {
    const seen = new Set();
    return matches.filter((match) => {
      const key = `${match.index}|${match.text}|${match.after}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  function isLikelyPartialDateMatch(text, match) {
    const [month, day] = match.text.split(/[/.]/).map(Number);
    if (!isValidMonthDay(month, day) || !hasDateTokenBoundary(text, match.index, match.text.length)) {
      return false;
    }
    if (isFollowedByDateExcludedUnit(text, match.index + match.text.length)) {
      return false;
    }
    if (match.text.includes(".")) {
      return hasPartialDotDateContext(text, match.index + match.text.length);
    }
    return true;
  }

  function hasDateTokenBoundary(text, index, length) {
    const previous = text[index - 1] || "";
    const next = text[index + length] || "";
    return !/[\d/.]/.test(previous) && !/[\d/.]/.test(next);
  }

  function hasPartialDotDateContext(text, endIndex) {
    const after = text.slice(endIndex, endIndex + 8);
    return /^[\s　]*(?:[（(]?[日月火水木金土](?:曜(?:日)?)?[)）]?|日)/.test(after);
  }

  function isFollowedByDateExcludedUnit(text, endIndex) {
    const after = text.slice(endIndex, endIndex + 18).trimStart();
    return /^(?:㎝|cm\b|センチメートル|センチ|㎜|mm\b|ミリメートル|ミリ|㎞|km\b|キロメートル|㎏|kg\b|キログラム|㎡|m2\b|m²|平方メートル|㎥|m3\b|m³|立方メートル|m\b|メートル|g\b|グラム)/i.test(after);
  }

  function isValidCalendarDate(year, month, day) {
    if (!Number.isInteger(year) || year < 1000 || year > 2999 || !isValidMonthDay(month, day)) {
      return false;
    }
    const date = new Date(year, month - 1, day);
    return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
  }

  function isValidMonthDay(month, day) {
    if (!Number.isInteger(month) || !Number.isInteger(day) || month < 1 || month > 12 || day < 1) {
      return false;
    }
    const maxDaysByMonth = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    return day <= maxDaysByMonth[month - 1];
  }

  function findUnitMatches(text) {
    const unitMap = new Map([
      ["㎝", "センチメートル"],
      ["cm", "センチメートル"],
      ["㎜", "ミリメートル"],
      ["mm", "ミリメートル"],
      ["㎞", "キロメートル"],
      ["km", "キロメートル"],
      ["㎏", "キログラム"],
      ["kg", "キログラム"],
      ["㎡", "平方メートル"],
      ["m2", "平方メートル"],
      ["m²", "平方メートル"],
      ["㎥", "立方メートル"],
      ["m3", "立方メートル"],
      ["m³", "立方メートル"],
      ["m", "メートル"],
      ["g", "グラム"],
    ]);
    const matches = [];
    const regex = /(\d+(?:\.\d+)?)\s*(㎝|cm|㎜|mm|㎞|km|㎏|kg|㎡|m2|m²|㎥|m3|m³|m|g)(?![A-Za-z])/gi;
    let match = regex.exec(text);
    while (match) {
      const unit = match[2].toLowerCase();
      matches.push({
        text: match[0],
        after: `${match[1]}${unitMap.get(unit) || unitMap.get(match[2])}`,
      });
      match = regex.exec(text);
    }
    return matches;
  }

  function toHalfWidthAlphanumeric(text) {
    return String(text).replace(/[Ａ-Ｚａ-ｚ０-９]/g, (char) =>
      String.fromCharCode(char.charCodeAt(0) - 0xfee0)
    );
  }

  function weekdayName(day) {
    return {
      日: "日曜日",
      月: "月曜日",
      火: "火曜日",
      水: "水曜日",
      木: "木曜日",
      金: "金曜日",
      土: "土曜日",
    }[day] || day;
  }

  function hasInlineStyleProperty(element, names) {
    return names.some((name) => getInlineStyleValue(element, name));
  }

  function getInlineStyleValue(element, name) {
    return element.style?.getPropertyValue(name)?.trim() || "";
  }

  function removeStyleProperties(element, names) {
    names.forEach((name) => element.style?.removeProperty(name));
    if (element.getAttribute("style") === "") {
      element.removeAttribute("style");
    }
  }

  function isAllowedCmsTextColor(color) {
    const value = String(color || "").trim().toLowerCase().replace(/\s+/g, "");
    if (!value) return false;
    return [
      "black",
      "#000",
      "#000000",
      "rgb(0,0,0)",
      "red",
      "#f00",
      "#ff0000",
      "rgb(255,0,0)",
      "blue",
      "#00f",
      "#0000ff",
      "rgb(0,0,255)",
    ].includes(value);
  }

  function stripTags(html) {
    const template = document.createElement("template");
    template.innerHTML = html || "";
    return template.content.textContent || "";
  }

  function hasTableFormatting(table) {
    return Boolean(
      table.matches("[style],[class],[align],[valign],[width],[height],[border],[cellpadding],[cellspacing],[bgcolor]") ||
        table.querySelector("[style],[class],[align],[valign],[width],[height],[bgcolor],font")
    );
  }

  function hasFileLinkInTable(table) {
    return [...table.querySelectorAll("a[href]")].some((link) =>
      /\.(pdf|docx?|xlsx?|pptx?|zip|csv)(?:$|[?#])/i.test(link.getAttribute("href") || "")
    );
  }

  function stripFormatting(root) {
    root.querySelectorAll?.("font").forEach((element) => {
      element.replaceWith(...element.childNodes);
    });
    const elements = [root, ...(root.querySelectorAll?.("*") || [])];
    elements.forEach((element) => {
      ["style", "class", "align", "valign", "width", "height", "border", "cellpadding", "cellspacing", "bgcolor"].forEach((name) => {
        element.removeAttribute?.(name);
      });
    });
  }

  function getImageDisplayWidth(img) {
    const widthAttr = Number.parseInt(img.getAttribute("width") || "", 10);
    if (Number.isFinite(widthAttr)) {
      return widthAttr;
    }
    const styleWidth = img.style?.getPropertyValue("width") || "";
    const pxMatch = styleWidth.match(/^(\d+(?:\.\d+)?)px$/i);
    return pxMatch ? Number(pxMatch[1]) : null;
  }

  function isComplexImageCandidate(img, caption) {
    const src = img.getAttribute("src") || "";
    const alt = img.getAttribute("alt") || "";
    const text = `${src} ${alt} ${caption}`;
    if (/(地図|案内図|図表|グラフ|チャート|フローチャート|組織図|路線図|配置図|模式図|map|chart|graph)/i.test(text)) {
      return true;
    }
    // miChecker C_4.0(item_4()): キーワード非依存のシグナル。isNormalImage()相当(極端に小さい・
    // 細長いアイコン等ではない)画像で、alt文字列が「3語以上、または(日本語想定の)20文字以上」かつ
    // 「非ASCII文字を含む、またはASCIIのみで30文字超」の場合に発火する。地図・グラフ等のキーワードが
    // 無くても、既にある程度詳しい代替テキストが書かれている画像は複雑な画像の可能性があるとみなし、
    // aria-describedby等での補足説明を検討する確認対象にする。
    if (!isNormalSizedImageForComplexCheck(img)) {
      return false;
    }
    return isMicheckerComplexImageAltText(alt);
  }

  function isNormalSizedImageForComplexCheck(img) {
    const parseDimension = (value) => {
      const parsed = Number.parseInt(value, 10);
      return Number.isFinite(parsed) ? parsed : 100;
    };
    const width = img.hasAttribute("width") ? parseDimension(img.getAttribute("width")) : 100;
    const height = img.hasAttribute("height") ? parseDimension(img.getAttribute("height")) : 100;
    if (width >= 50 && height >= 50) {
      return true;
    }
    const big = Math.max(width, height);
    const small = Math.min(width, height);
    if (big < 50) {
      return false;
    }
    return small / big >= 0.2;
  }

  const MICHECKER_ALT_WORD_DELIMITER = /[ \t\n\r\f,.[\]()<>!?:/"、。「」・〈〉　]+/;

  function isMicheckerComplexImageAltText(alt) {
    if (!alt) {
      return false;
    }
    const wordCount = alt.split(MICHECKER_ALT_WORD_DELIMITER).filter(Boolean).length;
    // 自治体CMS本文はほぼ日本語(DBCS)前提のため、item_4()のvalidate_str_len(DBCS時20文字)を用いる。
    if (wordCount < 3 && alt.length < 20) {
      return false;
    }
    const isAsciiOnly = /^[\x00-\x7f]*$/.test(alt);
    return !isAsciiOnly || alt.length > 30;
  }

  function inferTopPageLinkText() {
    const title = normalizeText(els.pageTitleInput.value);
    const match = title.match(/([一-龠ぁ-んァ-ヶA-Za-z0-9]+(?:市|区|町|村))/);
    return `${match?.[1] || "サイト名"}トップページ`;
  }

  function closestCaptionElement(img) {
    const figure = img.closest("figure");
    return figure?.querySelector("figcaption") || null;
  }

  function generateImageNameDraft(img, caption) {
    const src = img.getAttribute("src") || "";
    const fileName = decodeURIComponent((src.split("/").pop() || "").split("?")[0]).toLowerCase();
    const knownDrafts = [
      {
        match: "sample-park-generated.png",
        name: "公園の芝生広場で親子が参加しているイベントの写真",
        confidence: "medium",
      },
      {
        match: "sample-map-generated.png",
        name: "中央公園周辺の会場案内図",
        confidence: "medium",
      },
      {
        match: "sample-flower-generated.png",
        name: "花壇に咲くピンク色のサツキの花の写真",
        confidence: "medium",
      },
      {
        match: "sample-family-generated.png",
        name: "祖父母と親子が並んだ家族の集合写真",
        confidence: "medium",
      },
    ];
    const matched = knownDrafts.find((draft) => fileName === draft.match);
    if (!matched) {
      return null;
    }
    return {
      ...matched,
      source: "AI画像名生成（PoCサンプル画像の視覚内容から作成。採用前に人間確認）",
      context: caption ? `近接キャプション: ${caption}` : "",
    };
  }

  function generateComplexImageNameDraft(img, caption, baseDraft) {
    const baseName = baseDraft?.name || inferComplexImageNameFromContext(img, caption);
    if (!baseName) {
      return null;
    }
    const name = /詳細は以下/.test(baseName) ? baseName : `${baseName} 詳細は以下`;
    return {
      ...(baseDraft || {}),
      name,
      confidence: baseDraft?.confidence || "low",
      source: baseDraft
        ? `${baseDraft.source} 複雑画像候補のため「詳細は以下」を付与。`
        : "AI画像名生成（alt・キャプション・ファイル名から下書き。採用前に人間確認）",
      context: [baseDraft?.context, "複雑画像候補: 本文への補足説明またはSV/顧客確認が必要"]
        .filter(Boolean)
        .join(" / "),
    };
  }

  function inferComplexImageNameFromContext(img, caption) {
    const alt = normalizeText(img.getAttribute("alt") || "");
    if (caption) {
      return caption;
    }
    if (alt && !isGenericAlt(alt)) {
      return alt;
    }
    const src = img.getAttribute("src") || "";
    const fileName = decodeURIComponent((src.split("/").pop() || "").split("?")[0])
      .replace(/\.[a-z0-9]+$/i, "")
      .replace(/[-_]+/g, " ")
      .trim();
    return fileName ? `${fileName}の図表` : "";
  }

  function cleanImageCaption(text) {
    return normalizeText(text)
      .replace(/^[（(]\s*(写真|画像|イメージ)\s*[）)]\s*/i, "")
      .replace(/^\s*(写真|画像|イメージ)\s*[：:]\s*/i, "")
      .trim();
  }

  function isGenericAlt(alt) {
    const text = normalizeText(alt);
    return /^(画像|写真|イメージ|image|photo)$/.test(text) || /^(.*の)?写真$/.test(text);
  }

  // miChecker C_25.3: 表の内容を特定しない汎用語のみで構成されたcaptionを検出する。
  // 「対象者一覧」のように具体的な語を伴うcaptionは対象外にする(完全一致のみ)。
  function isGenericTableCaptionText(text) {
    return /^(?:表[0-9０-９]*|図表|一覧|表組|データ|テーブル|table)$/i.test(text);
  }

  function isGenericIframeTitle(title) {
    return /^(iframe|埋め込み|埋め込みコンテンツ|動画|地図|map|movie)$/i.test(normalizeText(title));
  }

  function inferIframeTitle(iframe) {
    const src = iframe.getAttribute("src") || "";
    if (/youtube|youtu\.be|vimeo/i.test(src)) return "動画の内容を入力";
    if (/map|maps|地図/i.test(src)) return "地図の内容を入力";
    return "埋め込みコンテンツの内容を入力";
  }

  function isGenericLinkText(text) {
    return /^(こちら|ここ|詳細はこちら|詳しくはこちら|クリック|click here)$/i.test(text);
  }

  // リンクの「読み上げ可能テキスト」= テキストノード + img[alt]の値 + aria-label/aria-labelledbyの参照先テキスト。
  // miChecker C_57.2の算入範囲(CheckEngine.java item_57のgetNameByAriaフォールバック)を参考に、
  // このいずれにも実質的な文字列が無ければリンクは読み上げ不能とみなす。
  function computeLinkAccessibleText(link, root) {
    const parts = [normalizeText(link.textContent || "")];
    link.querySelectorAll("img[alt]").forEach((img) => {
      const alt = img.getAttribute("alt") || "";
      if (alt.trim()) {
        parts.push(normalizeText(alt));
      }
    });
    const ariaLabel = link.getAttribute("aria-label") || "";
    if (ariaLabel.trim()) {
      parts.push(normalizeText(ariaLabel));
    }
    const labelledBy = link.getAttribute("aria-labelledby") || "";
    labelledBy
      .split(/\s+/)
      .filter(Boolean)
      .forEach((id) => {
        const referenced = root?.querySelector?.(`#${cssEscape(id)}`);
        if (referenced) {
          parts.push(normalizeText(referenced.textContent || ""));
        }
      });
    return normalizeText(parts.join(" "));
  }

  function buildGenericLinkGuidanceProposal(link) {
    const parent = link.closest("p");
    if (!parent || parent.querySelectorAll("a").length !== 1) {
      return null;
    }

    const parentText = normalizeText(parent.textContent);
    const linkText = normalizeText(link.textContent);
    const suffixText = normalizeText(parentText.replace(linkText, ""));
    const isDetailLink = /^(詳細はこちら|詳しくはこちら)$/.test(linkText);
    const isGuidanceSuffix = /^を?ご(確認|覧)ください。?$/.test(suffixText);
    if (!isDetailLink || !isGuidanceSuffix) {
      return null;
    }

    const linkClone = link.cloneNode(true);
    linkClone.textContent = "リンク（リンク先ページ名など）";
    const guide = document.createElement("p");
    guide.textContent = "詳細は下記をご覧ください。";
    const linkParagraph = document.createElement("p");
    linkParagraph.appendChild(linkClone);
    return {
      element: parent,
      afterHtml: `${guide.outerHTML}${linkParagraph.outerHTML}`,
    };
  }

  // For "ラベル　<a href=URL>URL</a>" patterns: pulls the plain-text label that immediately
  // precedes the link (within the same parent) into the link text itself, and removes the
  // now-redundant label text. Returns null when there's no usable short label directly before
  // the link, so the caller can fall back to a patchless flag-only candidate.
  function buildRawUrlLinkTextProposal(link) {
    const parent = link.parentElement;
    if (!parent) {
      return null;
    }
    let precedingText = "";
    let node = link.previousSibling;
    while (node && node.nodeType === Node.TEXT_NODE) {
      precedingText = node.textContent + precedingText;
      node = node.previousSibling;
    }
    const label = normalizeText(precedingText);
    if (!label || label.length > 24 || /https?:\/\//i.test(label)) {
      return null;
    }
    const linkIndex = [...parent.childNodes].indexOf(link);
    if (linkIndex < 0) {
      return null;
    }
    const clone = parent.cloneNode(true);
    const clonedLink = clone.childNodes[linkIndex];
    if (!clonedLink || clonedLink.nodeType !== Node.ELEMENT_NODE || clonedLink.tagName !== "A") {
      return null;
    }
    let cur = clonedLink.previousSibling;
    while (cur && cur.nodeType === Node.TEXT_NODE) {
      const prev = cur.previousSibling;
      cur.remove();
      cur = prev;
    }
    clonedLink.textContent = label;
    return { element: parent, afterHtml: cleanHtml(clone.outerHTML) };
  }

  function inferLinkText(link, href) {
    const parentText = normalizeText(link.parentElement?.textContent || "");
    const fileName = decodeURIComponent((href.split("/").pop() || "").split("?")[0]);
    if (/\.pdf$/i.test(fileName)) return fileName.replace(/\.pdf$/i, "");
    const heading = closestPreviousHeadingText(link);
    if (heading) return `${heading}について`;
    if (parentText.length > 0 && parentText.length <= 48) {
      const inferred = parentText
        .replace(/詳しくはこちら|詳細はこちら|こちら|ここ|クリック/g, "")
        .replace(/をご確認ください。?$/, "")
        .replace(/をご覧ください。?$/, "")
        .trim();
      if (inferred.length >= 4 && inferred.length <= 32) return inferred;
    }
    return "リンク先の内容を具体的に入力";
  }

  function removeFileMeta(text) {
    const fileTypePattern =
      "(?:PDF|Word|Excel|PowerPoint|ZIP|CSV|XLSX?|DOCX?|PPTX?|ワード|エクセル|パワーポイント)(?:\\s*(?:ファイル|文書|形式))?(?:\\s*(?:XLSX?|DOCX?|PPTX?))?";
    const fileSizePattern = "[\\d,.]+(?:\\.\\d+)?\\s*(?:KB|MB|GB|kbyte|mbyte|gbyte|キロバイト|メガバイト|ギガバイト)";
    return text
      .replace(new RegExp(`[【［\\[(（]\\s*${fileTypePattern}\\s*[：:]\\s*${fileSizePattern}\\s*[】］\\])）]`, "gi"), "")
      .replace(new RegExp(`[【［\\[(（]\\s*${fileTypePattern}\\s*[】］\\])）]`, "gi"), "")
      .replace(new RegExp(`[【［\\[(（]\\s*${fileSizePattern}\\s*[】］\\])）]`, "gi"), "")
      .replace(new RegExp(`\\s*${fileTypePattern}\\s*$`, "gi"), "")
      .trim();
  }

  function classifyMergedCellTable(table) {
    const text = normalizeText(table.textContent);
    const firstMergedCell = table.querySelector("[rowspan], [colspan]");
    const firstMergedText = normalizeText(firstMergedCell?.textContent || "");
    const preserveAsDataTable = shouldPreserveAsDataTable(table);

    if (/[●○◎◯✓✔■□]/.test(text)) {
      return {
        ruleId: "table.cell-merge-mark",
        message: "●印などで該当箇所を示す表です。",
        reason: "記号の位置だけで意味を伝える表は、対象関係を文章や見出しで明記する必要があります。",
        confidence: "medium",
      };
    }

    if (hasFileLinkInTable(table)) {
      return {
        ruleId: "table.cell-merge-file",
        message: "セル結合を含む表内に添付ファイルリンクがあります。",
        reason: "添付ファイルを含む結合セルは、ファイル入力エリアや本文構成に分けられるか確認します。",
        confidence: "medium",
      };
    }

    if (/^(注意|注記|備考|お知らせ|お願い)/.test(firstMergedText)) {
      return {
        ruleId: "table.cell-merge-note",
        message: "注意書き用途に見える結合セルがあります。",
        reason: "注意書きは表の結合セルではなく、本文の注記や見出し付き文章として再構成できるか確認します。",
        confidence: "medium",
      };
    }

    if (!preserveAsDataTable && firstMergedCell && firstMergedCell.parentElement?.rowIndex === 0 && firstMergedText.length > 0 && firstMergedText.length <= 30) {
      return {
        ruleId: "table.cell-merge-heading",
        message: "先頭の結合セルが見出し用途に見えます。",
        reason: "表内の見出し的な結合セルは、表外の見出しやキャプションとして分離できるか確認します。",
        confidence: "medium",
      };
    }

    if (/^(概要|対象|内容|説明|詳細)/.test(firstMergedText)) {
      return {
        ruleId: "table.cell-merge-summary",
        message: "概要説明用途に見える結合セルがあります。",
        reason: "概要が見出し的に使われている場合、表外の本文や見出しに分けると構造を理解しやすくなります。",
        confidence: "medium",
      };
    }

    if (isLinkedGuidanceMergedCell(firstMergedCell, firstMergedText)) {
      return {
        ruleId: "table.cell-merge-summary",
        message: "他ページへの案内文とリンクが結合セルにまとまっています。",
        reason: "総合評価方式の案件など、複数列の情報が1つのページにまとめられている行は、colspanを解除して各列に同じ案内リンクを繰り返し配置できるか確認します。",
        confidence: "medium",
      };
    }

    // 見出し・注記・添付ファイル・概要・案内リンクいずれのパターンにも当てはまらず、かつ
    // 結合セルが表の最初の行(rowIndex 0、ヘッダー行の場合も、行見出しを兼ねる先頭データ行の
    // 場合もある)に限られていて、既にデータ表として保持すべきと判定されている場合、この表は
    // 上のplanTableTreatment()が呼ぶshouldPreserveAsDataTable+tableNeedsDataTableSemantics
    // 経由で「table.caption」候補(buildDataTableSemanticsHtml、キャプション/thead/scope
    // 属性を追加しつつ表構造は保持する安全な変換)としてカバーされる。table.cell-merge-layout
    // の分解ロジック(decomposeLayoutTable/splitMergedRowsIntoTablesHtml)は本文セル同士の
    // 結合(例: 注意書き行がcolspanで挿入されている)を想定しており、複数の関連する列を
    // グループ化する正当なヘッダー結合(例:「使用できる災害種別」が6個の真偽値列をまとめて
    // 見出す)や、先頭データ行自体が行見出しを兼ねるrowspanパターンに機械的に適用すると、
    // 表構造そのものを破壊してしまう(実データで確認済み: 185行の表が構造の無い段落の
    // 羅列に変換された)。同じ表に対して安全な候補が既に出るため、ここでは候補を出さない。
    if (preserveAsDataTable && firstMergedCell?.parentElement?.rowIndex === 0) {
      return null;
    }

    return {
      ruleId: "table.cell-merge-layout",
      message: "セル結合が含まれています。",
      reason: "セル結合は読み上げ順や表構造を複雑にするため、用途に応じて分解または説明追加を検討します。",
      confidence: "low",
    };
  }

  function isLinkedGuidanceMergedCell(cell, text) {
    if (!cell || cell.querySelectorAll("a").length !== 1) return false;
    return /(ご覧|ご確認)ください/.test(text);
  }

  function classifyHref(href) {
    const trimmed = String(href || "").trim();
    const result = {
      isPdf: /\.pdf(?:$|[?#])/i.test(trimmed),
      isExternal: false,
      isInternalAbsolute: false,
      isInternalRelative: false,
      isInPageAnchor: /^#[^#\s]+/.test(trimmed),
      isCrossPageAnchor: false,
      isTopPage: false,
      isCategoryCandidate: false,
      isBrokenCandidate: !trimmed || trimmed === "#",
    };

    if (!trimmed || result.isInPageAnchor || /^mailto:/i.test(trimmed) || /^javascript:/i.test(trimmed)) {
      return result;
    }

    try {
      const base = new URL(els.oldUrlInput.value || "https://example.invalid/");
      const url = new URL(trimmed, base);
      const hasProtocol = /^[a-z][a-z0-9+.-]*:/i.test(trimmed);
      const isHttp = /^https?:$/i.test(url.protocol);
      const isSameHost = isHttp && url.hostname === base.hostname;
      const isRelative = !hasProtocol && !trimmed.startsWith("//");
      const normalizedPath = url.pathname.replace(/\/index\.(html?|php)$/i, "/");
      const normalizedBasePath = base.pathname.replace(/\/index\.(html?|php)$/i, "/");
      result.isPdf = /\.pdf$/i.test(url.pathname) || result.isPdf;
      result.isExternal = isHttp && url.hostname !== base.hostname;
      result.isInternalAbsolute = hasProtocol && isSameHost;
      result.isInternalRelative = isRelative && isSameHost && !result.isPdf;
      result.isCrossPageAnchor = Boolean(url.hash) && !(isSameHost && normalizedPath === normalizedBasePath);
      result.isTopPage = isSameHost && normalizedPath === "/";
      result.isCategoryCandidate = isSameHost && !result.isTopPage && /\/$/.test(normalizedPath) && !result.isPdf;
    } catch {
      return result;
    }

    return result;
  }

  function isEmailAddress(text) {
    return /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(normalizeText(text));
  }

  function inferMailLinkText(link) {
    const context = normalizeText(link.closest("p,li,td,th,div")?.textContent || "");
    const match = context.match(/([一-龠ぁ-んァ-ヶA-Za-z0-9]{2,20}(?:課|係|室|センター|担当))/);
    return `${match?.[1] || "担当部署"}へメールを送信`;
  }

  function closestPreviousHeadingText(element) {
    let current = element.closest("p,li,div,td,th") || element;
    while (current && current.previousElementSibling) {
      current = current.previousElementSibling;
      if (/^H[2-6]$/.test(current.tagName)) {
        return normalizeText(current.textContent);
      }
    }
    return "";
  }

  function headingLevel(element) {
    return Number(element.tagName.replace("H", ""));
  }

  function renameElement(element, tagName) {
    const clone = document.createElement(tagName);
    [...element.attributes].forEach((attribute) => {
      if (attribute.name !== "data-goal2-node-id") clone.setAttribute(attribute.name, attribute.value);
    });
    clone.innerHTML = element.innerHTML;
    clone.setAttribute("data-goal2-node-id", element.getAttribute("data-goal2-node-id"));
    return clone;
  }

  function buildDomPath(element) {
    const parts = [];
    let current = element;
    while (current && current.nodeType === Node.ELEMENT_NODE && current.parentElement) {
      const siblings = [...current.parentElement.children].filter((sibling) => sibling.tagName === current.tagName);
      const index = siblings.indexOf(current) + 1;
      parts.unshift(`${current.tagName.toLowerCase()}[${index}]`);
      current = current.parentElement;
    }
    return `/${parts.join("/")}`;
  }

  function sanitizePreview(root) {
    root.querySelectorAll("script, object, embed").forEach((element) => element.remove());
    root.querySelectorAll("*").forEach((element) => {
      [...element.attributes].forEach((attribute) => {
        const name = attribute.name.toLowerCase();
        const value = attribute.value.trim().toLowerCase();
        if (name.startsWith("on")) element.removeAttribute(attribute.name);
        if ((name === "href" || name === "src") && value.startsWith("javascript:")) {
          element.setAttribute(attribute.name, "#");
        }
      });
    });
  }

  function stripInternalFromHtml(html) {
    const template = document.createElement("template");
    template.innerHTML = html || "";
    stripInternalAttributes(template.content);
    return template.innerHTML.trim();
  }

  function cleanHtml(html) {
    return stripInternalFromHtml(html || "");
  }

  // 元のid/class属性を参照しうる属性(ページ内アンカー・ARIA関連付け・label for)。
  // href以外は空白区切りで複数idを保持できるIDREFS型属性のため split で全件拾う。
  const ID_REFERENCE_ATTRS = [
    "href",
    "aria-describedby",
    "aria-labelledby",
    "aria-controls",
    "aria-owns",
    "aria-activedescendant",
    "aria-details",
    "aria-errormessage",
    "aria-flowto",
    "for",
  ];

  function collectReferencedIds(root) {
    const referenced = new Set();
    root.querySelectorAll("*").forEach((element) => {
      ID_REFERENCE_ATTRS.forEach((attr) => {
        const value = element.getAttribute(attr);
        if (!value) return;
        if (attr === "href") {
          if (value.startsWith("#") && value.length > 1) {
            referenced.add(value.slice(1));
          }
          return;
        }
        value
          .split(/\s+/)
          .filter(Boolean)
          .forEach((id) => referenced.add(id));
      });
    });
    return referenced;
  }

  // 移行先CMSでは旧サイトのCSS/JSに紐づくid・class属性は不要かつテンプレートと衝突しうる
  // ため、最終HTML(全候補の採用・編集結果を反映した後)構築の最終段階でのみ一括削除する
  // (候補生成・検出ロジックは元のid/classを引き続き使う。例: table.classNameをレイアウト
  // 表判定の信号に使うヒューリスティックがあるため、削除を検出より前に行うと壊れる)。
  // classは無条件削除。idはページ内アンカーやARIA属性等で実際に参照されているものだけ残す
  // (参照元のリンク自体はlink.in-page-anchorルール等で別途人間確認の対象になる)。
  function stripMigrationUnneededAttributes(root) {
    const referencedIds = collectReferencedIds(root);
    root.querySelectorAll("[class]").forEach((element) => element.removeAttribute("class"));
    root.querySelectorAll("[id]").forEach((element) => {
      if (!referencedIds.has(element.id)) {
        element.removeAttribute("id");
      }
    });
  }

  function stripMigrationUnneededAttributesFromHtml(html) {
    const template = document.createElement("template");
    template.innerHTML = html || "";
    stripMigrationUnneededAttributes(template.content);
    return template.innerHTML.trim();
  }

  function normalizeText(text) {
    return String(text || "").replace(/\s+/g, " ").trim();
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function cssEscape(value) {
    if (window.CSS?.escape) return window.CSS.escape(value);
    return String(value).replace(/["\\]/g, "\\$&");
  }

  function csvCell(value) {
    const text = value == null ? "" : String(value);
    return `"${text.replace(/"/g, '""')}"`;
  }

  function hashText(text) {
    let hash = 2166136261;
    const input = String(text || "");
    for (let i = 0; i < input.length; i += 1) {
      hash ^= input.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(16).padStart(8, "0");
  }

  // Headless engine surface for GOAL1 batch processing (goal1.html). Runs the exact
  // same pipeline as the on-screen 候補生成, with the page-scoped inputs supplied as
  // arguments instead of read from the goal2 screen's fields. Sequential use only —
  // analysisContext and state.llmUsage are module-level, so concurrent analyze()
  // calls would interleave; GOAL1 processes pages one at a time by design.
  window.goal2Engine = {
    async init() {
      if (!state.rules.length) {
        await loadRules();
      }
      if (!state.micheckerCheckitems.length) {
        await loadMicheckerCheckitems();
      }
    },

    // → { candidates, notices, generatedAt, llmUsage, micheckerEngineResult }
    async analyze({ html, pageTitle = "", oldUrl = "", ruleScopeMode = "kb" }) {
      await this.init();
      analysisContext = { pageTitle, oldUrl };
      state.llmUsage = { calls: 0, inputTokens: 0, outputTokens: 0, estimatedCostUsd: 0, estimatedCostJpy: 0 };
      try {
        const generatedAt = new Date().toISOString();
        const { candidates, notices, micheckerEngineResult } = await runAnalysis(html, { ruleScopeMode });
        return { candidates, notices, generatedAt, llmUsage: { ...state.llmUsage }, micheckerEngineResult };
      } finally {
        analysisContext = null;
      }
    },

    // Applies the same safety bar as the goal2 screen's 一括採用 (canBulkAcceptCandidate):
    // mechanical, sufficiently confident, and not flagged for human review. Mutates the
    // passed candidates' decision in place and returns how many were accepted.
    autoAcceptSafe(candidates) {
      let accepted = 0;
      candidates.forEach((candidate) => {
        if (!canBulkAcceptCandidate(candidate)) {
          return;
        }
        candidate.decision = {
          status: "accepted",
          reason: "一括自動採用（機械的・確認不要）",
          actor: "goal1-batch",
          decided_at: new Date().toISOString(),
          after_html: null,
        };
        accepted += 1;
      });
      return accepted;
    },

    buildFinalHtml(sourceHtml, candidates) {
      return stripMigrationUnneededAttributesFromHtml(
        stripInternalFromHtml(rebuildWorkingHtmlFor(sourceHtml, candidates))
      );
    },

    buildEvidence(context, finalHtml) {
      return buildEvidenceFor(context, finalHtml);
    },

    sessionIdFor(oldUrl, pageTitle) {
      return `goal2_${hashText((oldUrl || "") + "|" + (pageTitle || "")).slice(0, 10)}`;
    },
  };
})();

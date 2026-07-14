# MICHECKER_PORT_INVENTORY.md

miChecker公式判定エンジン(CheckEngine.java)移植の対象チェック項目インベントリ。
`goal2-app/MICHECKER_ENGINE_PORT_INSTRUCTIONS.md` §5 PR-M0の成果物。
`a11y-migration-kb/tools/gen_michecker_inventory.py`で自動生成(手動編集しないこと。vendorソース更新時は再生成する)。

## 集計

- 対象合計: **116件**(公式268件 − スコープ外152件)
- type別: error 24 / info 30 / user 44 / warning 18
- 移植可否分類別: TextChecker依存 2 / pure-DOM 79 / テキストCSS解析 9 / 手動確認(always) 24 / 本体未発火 2

## 一覧

| チェックID | type | 内容(要約) | CheckEngine.java担当 | 分類 | 対応KBルール | 実装PR |
|---|---|---|---|---|---|---|
| C_3.0 | error | longdesc属性に加えて、「説明へのリンク (D link)」を提供しているか確認してください | item_3 (L679) | pure-DOM | `html-structure.deprecated-elements` | M1 |
| C_3.1 | user | longdesc属性の値が、存在するリソースの有効なURIであること、ならびに、URIで指定されたコンテンツには、関連… | item_3 (L683) | pure-DOM | `html-structure.deprecated-elements` | M3 |
| C_4.0 | user | 画像の機能や情報がalt属性で十分に伝達できない場合、画像の詳細な説明を提供するために aria-describedb… | item_4 (L706) | pure-DOM | `image.complex-image-report` | M3 |
| C_6.0 | error | もしこれらのテキストがASCIIアートであるなら、アクセシブルな画像と置き換えるようにしてください | item_6 (L742) | pure-DOM | `text.ascii-art` | M1 |
| C_6.1 | warning | もしこのテキストがASCIIアート、顔文字、もしくはリート語であるなら、その直前か直後に代替テキストがあることを確認し… | item_6 (L743) | pure-DOM | `text.ascii-art` | M2 |
| C_7.0 | user | このクライアントサイド・イメージマップにはページ内の他の箇所に出現しないリンクが含まれています。{0} | item_7 (L784) | pure-DOM | ― | M3 |
| C_8.0 | user | もし、配色に何らかの情報を持たせている場合、テキストや他の視覚的な表現からもその情報を取得できるよう配慮してください。… | item_8 (L805) | テキストCSS解析 | `text.sensory-characteristics` | M3 |
| C_12.0 | user | 可能な限り、レイアウトの調整にはテーブルを使用せず、スタイルシートを利用してください。{0} | item_12 (L875) | pure-DOM | `table.layout-table` | M3 |
| C_12.1 | user | もし、このテーブルがレイアウトテーブルであるなら、スタイルシートを用いて表現するようにしてください (このテーブルには… | item_12 (L880) | pure-DOM | `table.layout-table` | M3 |
| C_12.2 | user | もし、このテーブルがレイアウトテーブルであるなら、スタイルシートを用いて表現するようにしてください (このテーブルはレ… | item_12 (L885) | pure-DOM | `table.layout-table` | M3 |
| C_13.0 | warning | サイズや位置の指定には、ピクセル数などの絶対値ではなく、相対値(em, ％など)を用いるようにしてください | item_13 (L908) | pure-DOM | `text.font-size` | M2 |
| C_14.0 | error | 見出し(h1,h2…)の入れ子関係を適切なものにしてください。{0} | item_14 (L937) | pure-DOM | `html-structure.heading-order` | M1 |
| C_15.0 | user | 各見出し(h1,h2…)はページ中の対応するセクションを表す内容になっており、テキストを太字にするためだけの目的に利用… | item_15 (L953) | pure-DOM | `html-structure.heading-content-quality` | M3 |
| C_16.0 | info | リスト要素は、レイアウトのためではなく、本来のリストを表現する際にのみ利用するようにしてください | ― | 本体未発火 | `text.list` | 対象外 |
| C_16.1 | user | li要素を持たないul要素・ol要素です | item_16 (L970) | pure-DOM | `text.list` | M3 |
| C_16.2 | user | このli要素には親となるul要素もしくはol要素が存在しません | item_16 (L1029) | pure-DOM | `text.list` | M3 |
| C_17.0 | info | blockquoteは、インデントのために利用するのではなく、引用を行う際にのみ用いてください | item_17 (L1046) | pure-DOM | `text.quotation` | M3 |
| C_17.1 | user | blockquote要素をインデントのためではなく、引用を行う際にのみ用いていることを確認して下さい。 | item_17 (L1060) | pure-DOM | `text.quotation` | M3 |
| C_18.0 | user | 長い文章の引用には、blockquoteを用いてください | item_18 (L1072) | pure-DOM | `text.quotation` | M3 |
| C_18.1 | user | 短い文章の引用にはqを用いてください | item_18 (L1091) | pure-DOM | `text.quotation` | M3 |
| C_18.2 | error | 引用箇所には引用元のURIをcite属性として提供するようにしてください | item_18 (L1077) | pure-DOM | `text.quotation` | M1 |
| C_19.0 | info | もし、文書中で利用する言語が変化する箇所が存在する場合は、全て明記するようにしてください | always (L3942) | 手動確認(always) | `text.foreign-language` | M3 |
| C_20.0 | info | 文書中の略語および頭字語は、abbrを用いて本来の形式を表記してください(HTML5では acronymは廃止されまし… | always (L3946) | 手動確認(always) | `text.abbreviation` | M3 |
| C_23.0 | user | もし、このテーブルがレイアウトテーブルである場合、thを太字などの表現のために用いることは避けてください | item_23 (L1171) | pure-DOM | `table.layout-table` | M3 |
| C_23.1 | user | もしこのテーブルがレイアウトテーブルである場合には、th要素、caption要素およびsummary属性は使用しないで… | item_23 (L1221) | pure-DOM | `table.layout-table` | M3 |
| C_23.2 | warning | もしこのテーブルがレイアウトテーブルである場合には、th要素、caption要素およびsummary属性は使用しないで… | item_23 (L1244) | pure-DOM | `table.layout-table` | M2 |
| C_25.1 | user | もし、このテーブルがデータテーブルであるなら、caption要素もしくはaria-label, aria-labell… | item_23 (L1222) | pure-DOM | `table.caption` | M3 |
| C_25.2 | user | もし、このテーブルがデータテーブルであり、かつ必要があれば、summary属性を用いてテーブルの概要や利用方法を提供す… | item_23 (L1223) | pure-DOM | `html-structure.deprecated-elements` | M3 |
| C_25.3 | user | このテーブルがデータテーブルであること、ならびに、caption要素でこのテーブルを特定できることを確認して下さい | item_23 (L1196) | pure-DOM | `table.caption` | M3 |
| C_25.4 | user | このテーブルがデータテーブルであること、ならびに、summary属性がこのテーブルの構成や利用方法を説明していることを… | item_23 (L1214) | pure-DOM | `html-structure.deprecated-elements` | M3 |
| C_26.0 | user | もし、テーブルの行・列に対するヘッダ文字列が長い場合は、略語の利用を検討してください | item_26 (L1259) | pure-DOM | ― | M3 |
| C_30.0 | user | オブジェクトやアプレットを利用する際は、イベントハンドラが入力装置に依存しないことを確認してください。{0} | mediaCheck (L1334) | pure-DOM | `html-structure.embedded-script-behavior` | M3 |
| C_30.1 | user | ユーザーがコンテンツ内に閉じ込められないこと確認してください。{0} | mediaCheck (L1335) | pure-DOM | `html-structure.embedded-script-behavior` | M3 |
| C_32.0 | user | このページが画面を高速に明滅させていないかどうか確認してください | item_32 (L1448) | pure-DOM | ― | M3 |
| C_33.0 | error | blinkを用いて5秒以上文章を明滅させることは避けてください。 | item_33 (L1464) | テキストCSS解析 | `html-structure.deprecated-elements` | M1 |
| C_33.1 | error | "text-decoration:blink"を用いて5秒以上文章を明滅させることは避けてください 。({0}) | item_33 (L1472) | テキストCSS解析 | `html-structure.deprecated-elements` | M1 |
| C_33.2 | warning | "text-decoration:blink"を用いて5秒以上文章を明滅させることは避けてください 。{0} | item_33 (L1481) | テキストCSS解析 | `html-structure.deprecated-elements` | M2 |
| C_34.0 | error | marqueeを用いて文章をスクロールさせることは避けてください | item_34 (L1508) | pure-DOM | `html-structure.deprecated-elements` | M1 |
| C_35.0 | user | もしこのGIF画像がアニメーションGIFであるなら、高速な動きや明滅を含まないことを確認してください。 | item_35 (L1528) | pure-DOM | ― | M3 |
| C_36.0 | error | 周期的にページのリロードを行う事は避けてください (<meta http-equiv="Refresh">の利用は避け… | item_36 (L1546) | pure-DOM | `html-structure.embedded-script-behavior` | M1 |
| C_36.1 | error | 自動的にページをリダイレクトすることは避けてください　(<meta http-equiv="Refresh">の利用は… | item_36 (L1551) | pure-DOM | `html-structure.embedded-script-behavior` | M1 |
| C_38.0 | warning | イベントハンドラがマウスのみに依存しない事を確認してください | item_38 (L1576) | pure-DOM | `html-structure.embedded-script-behavior` | M2 |
| C_46.0 | warning | 連続するリンクは、空白・改行以外の文字で区切るようにしてください | item_46 (L1980) | pure-DOM | `link.link-text` | M2 |
| C_48.0 | warning | 可能な限り、古い表現を用いないようにしてください (古い要素： {0} が存在しています) | item_48 (L1987) | pure-DOM | `html-structure.deprecated-elements` | M2 |
| C_48.1 | warning | 可能な限り、古い表現を用いないようにしてください (古い要素： {0} が存在しています) 替わりにobjectを利用… | item_48 (L1989) | pure-DOM | `html-structure.deprecated-elements` | M2 |
| C_48.2 | warning | 可能な限り、古い表現を用いないようにしてください (古い要素： {0} が存在しています) 文字の修飾にはスタイルシー… | item_48 (L1991) | pure-DOM | `html-structure.deprecated-elements` | M2 |
| C_48.3 | warning | 可能な限り、古い表現を用いないようにしてください (古い要素： {0} が存在しています) ul・olやスタイルシート… | item_48 (L1998) | pure-DOM | `html-structure.deprecated-elements` | M2 |
| C_48.4 | warning | 可能な限り、古い表現を用いないようにしてください (古い要素： {0} が存在しています) formとinputを用い… | item_48 (L2000) | pure-DOM | `html-structure.deprecated-elements` | M2 |
| C_48.5 | warning | 可能な限り、古い表現を用いないようにしてください (古い要素： {0} が存在しています) preを利用してください | item_48 (L2002) | pure-DOM | `html-structure.deprecated-elements` | M2 |
| C_48.6 | user | テキストを強調する際は {0} 要素ではなく strong もしくは em を用いてください | item_48 (L2008) | pure-DOM | `html-structure.deprecated-elements` | M3 |
| C_48.7 | warning | 可能な限り、古い表現を用いないようにしてください (古い要素： {0} が存在しています) abbrを利用してください | item_48 (L2022) | pure-DOM | `html-structure.deprecated-elements` | M2 |
| C_48.8 | warning | 可能な限り、古い表現を用いないようにしてください (古い属性： {0} が存在しています) | item_3 (L660) | pure-DOM | `html-structure.deprecated-elements` | M2 |
| C_51.0 | error | frame要素にtitle属性がありません。frame要素には、フレームの内容を説明するための空でないtitle属性を… | item_51 (L2045) | pure-DOM | `html-structure.iframe-frame-title` | M1 |
| C_51.1 | error | iframe要素にtitle属性がありません。iframe要素には、フレームの内容を説明するための空でないtitle属… | item_51 (L2056) | pure-DOM | `html-structure.iframe-frame-title` | M1 |
| C_51.2 | user | title属性 "{0}" がこのframe要素を特定できる適切なものであることを確認して下さい | item_51 (L2049) | pure-DOM | `html-structure.iframe-frame-title` | M3 |
| C_51.3 | user | title属性 "{0}" がこのiframe要素を特定できる適切なものであることを確認して下さい | item_51 (L2064) | pure-DOM | `html-structure.iframe-frame-title` | M3 |
| C_51.4 | error | frame要素のtitle属性が空白文字のみから構成されています。frame要素には、フレームの内容を説明するための空… | item_51 (L2047) | pure-DOM | `html-structure.iframe-frame-title` | M1 |
| C_51.5 | error | iframe要素のtitle属性が空白文字のみから構成されています。iframe要素には、フレームの内容を説明するため… | item_51 (L2060) | pure-DOM | `html-structure.iframe-frame-title` | M1 |
| C_52.0 | info | もしframeの内容をtitleで表現しきれない場合は、追加の説明を提供してください | item_52 (L2081) | pure-DOM | `html-structure.iframe-frame-title` | M3 |
| C_52.1 | info | もしiframeの内容をtitleで表現しきれない場合は、追加の説明を提供してください | item_52 (L2096) | pure-DOM | `html-structure.iframe-frame-title` | M3 |
| C_55.0 | info | もし可能であれば、関連する情報はグループ化してください | always (L3952) | 手動確認(always) | ― | M3 |
| C_56.1 | info | リンク内の文字列とその文脈を合わせて、リンクの目的が適切に説明されているか確認して下さい | always (L3956) | 手動確認(always) | ― | M3 |
| C_57.0 | info | 必要があれば、リンクにその内容を表すtitleを付加して下さい。{0} | item_57 (L2301) | pure-DOM | ― | M3 |
| C_57.1 | user | リンク内のテキストやtitleは短すぎるかもしれません。{0} | item_57 (L2291) | pure-DOM | ― | M3 |
| C_57.2 | error | このリンク内には読み上げ可能なテキストが存在しないため、アクセシブルではありません。{0} | item_57 (L2275) | pure-DOM | `link.link-purpose-standalone` | M1 |
| C_57.3 | error | リンクのtitle属性の値として、空の文字列や空白文字のみからなる文字列を使用してはいけません | item_57 (L2217) | pure-DOM | ― | M1 |
| C_57.4 | user | リンクテキストとtitle属性の値 ("{0}") を合わせて、リンクの目的を適切に示していることを確認して下さい | item_57 (L2303) | pure-DOM | `link.link-purpose-standalone` | M3 |
| C_57.5 | user | このリンク内には読み上げ可能なテキストが存在しませんが、直前または直後に同じURLへのリンクがあります。1つのリンクに… | item_57 (L2268) | pure-DOM | `link.link-purpose-standalone` | M3 |
| C_57.6 | user | このリンク内には要素やテキストが存在しない様です。リンク内に適切なコンテンツを提供するか、リンクを削除することを検討し… | item_57 (L2311) | pure-DOM | `link.link-purpose-standalone` | M3 |
| C_58.0 | user | 異なる複数のURLへのリンクに、同一のテキストを用いることはなるべく避けてください。{0} | item_58 (L2454) | pure-DOM | `link.link-purpose-standalone` | M3 |
| C_67.0 | info | 見出し、パラグラフやリストの先頭に、その内容を表す適切な情報を配置してください | always (L3978) | 手動確認(always) | `html-structure.heading-content-quality` | M3 |
| C_69.0 | user | もし、これらのテキストがASCIIアートであるなら、ASCIIアートをスキップする仕組みを提供してください | item_69 (L2574) | pure-DOM | `text.ascii-art` | M3 |
| C_71.0 | info | もし、ページ内容の理解を容易にするのであれば、アイコンや画像などを利用してください。ただし、必ずアクセシブルな代替テキ… | always (L3984) | 手動確認(always) | `image.alt-text` | M3 |
| C_75.0 | user | もし、このテーブルがデータテーブルなら、テーブルヘッダ(th)を提供してください。もし、このテーブルがレイアウトテーブ… | item_75 (L2663) | pure-DOM | `table.th-scope` | M3 |
| C_76.0 | user | テーブルの行・列に対する見出し(th要素)が複数存在する場合、構造に関する表現(scope属性等)を用いて階層構造を明… | item_76 (L2693) | pure-DOM | `table.th-scope` | M3 |
| C_76.1 | user | いくつかのテーブルのセルがcolspan属性またはrowspan属性を用いて結合されています。 id属性とheader… | item_76 (L2702) | pure-DOM | `table.cell-merge-file`, `table.cell-merge-heading`, `table.cell-merge-layout`, `table.cell-merge-mark`, `table.cell-merge-note`, `table.cell-merge-summary` | M3 |
| C_80.0 | warning | 代替テキストが150文字を超えています。画像の詳細な説明を提供するために aria-describedby などの使用… | item_80 (L3124) | pure-DOM | `image.complex-image-report` | M2 |
| C_81.0 | info | リンクやボタンが、操作可能なものと判るような表現を用い、操作しやすい配置であることを確認してください | always (L3964) | 手動確認(always) | ― | M3 |
| C_83.0 | info | ページの内容を理解・操作するために必要な情報が、コンテンツの形や位置だけに依存していないか確認してください | always (L3990) | 手動確認(always) | `text.sensory-characteristics` | M3 |
| C_85.0 | error | 自動的に音を再生することは避けてください。 自動的に再生する際は、音を再生していることを明示しているか確認してください | mediaCheck (L1423) | pure-DOM | ― | M1 |
| C_86.0 | info | 動画や音声などのコンテンツに、音量調整などの制御が出来る仕組みが提供されているか確認してください | item_86 (L3204) | pure-DOM | ― | M3 |
| C_89.0 | error | このページには読み上げ可能なテキスト情報がありません。何らかのテキスト情報を提供するようにしてください | item_89 (L3293) | pure-DOM | ― | M1 |
| C_89.1 | user | このページにはいくつかの画像が存在しますが、読み上げ可能なテキスト情報がほとんどありません。より多くの代替テキスト情報… | item_89 (L3296) | pure-DOM | `image.alt-text` | M3 |
| C_89.2 | warning | このページには読み上げ可能なテキスト情報がほとんどありません。より多くのテキスト情報を提供するようにしてください | item_89 (L3298) | pure-DOM | ― | M2 |
| C_300.1 | warning | "{0}" はarea要素のalt属性として不適切である可能性があります。適切な代替テキストを指定してください | item_300 (L3380) | TextChecker依存 | `image.alt-text` | M2 |
| C_300.5 | user | canvas要素に必要に応じて適切な代替テキストが指定されているか確認してください。 | item_300 (L3407) | TextChecker依存 | ― | M3 |
| C_331.0 | error | th要素にscope属性がありません。scope属性を適切に用いて、データテーブルの見出しセルとデータセルを関連付けて… | item_331 (L3552) | pure-DOM | `table.th-scope` | M1 |
| C_331.1 | error | th要素のscope属性値が不正です。scope属性を適切に用いて、データテーブルの見出しセルとデータセルを関連付けて… | item_331 (L3557) | pure-DOM | `table.th-scope` | M1 |
| C_331.2 | warning | th要素が1行目、1列目のみにある単純な表の左上のtd要素にテキストが存在しています。このセルのテキストを削除するか、… | item_331 (L3540) | pure-DOM | `table.th-scope` | M2 |
| C_332.0 | error | id属性及びheaders属性を適切に用いて、データテーブルのデータセルを見出しセルと関連付けて下さい。 {0} | ― | 本体未発火 | `table.th-scope` | 対象外 |
| C_332.1 | error | データセルのheaders属性値に含まれるidに対応する見出しセルがありません。 {0} | item_332 (L3569) | pure-DOM | `table.th-scope` | M1 |
| C_332.2 | error | データセルのheaders属性値に含まれるidがセルでない要素({0})を参照しています。id属性及びheaders属… | item_332 (L3571) | pure-DOM | `table.th-scope` | M1 |
| C_388.0 | user | 目的や内容が分かるラベルを提供していることを確認して下さい | formCheck (L3652) | pure-DOM | `html-structure.heading-content-quality` | M3 |
| C_422.0 | error | accesskey属性の値に重複があります。({0}) | item_422 (L3701) | pure-DOM | `html-structure.duplicate-id-accesskey` | M1 |
| C_423.0 | error | id属性の値に重複があります。({0}) | item_423 (L3719) | pure-DOM | `html-structure.duplicate-id-accesskey` | M1 |
| C_500.2 | info | 使用しているウェブコンテンツ技術で意図した視覚的な表現が可能である場合は、画像化された文字ではなくテキストを用いて情報… | always (L4011) | 手動確認(always) | `image.avoid-text-as-image` | M3 |
| C_500.4 | info | 見出し及びラベルが、主題又は目的を説明していることを確認して下さい。 | always (L4018) | 手動確認(always) | `html-structure.heading-content-quality` | M3 |
| C_500.6 | info | 固有名詞、技術用語、どの言語なのか不明な語句、及びすぐ前後にあるテキストの言語の一部になっている単語又は語句を除いて、… | always (L4021) | 手動確認(always) | `text.foreign-language` | M3 |
| C_500.11 | info | テキスト及び画像化された文字の視覚的な表現には、十分なコントラスト比をもたせていることをロービジョンモードを使用して確… | always (L4009) | 手動確認(always) | `text.color` | M3 |
| C_500.12 | info | キャプション及び画像化された文字を除き、コンテンツ又は機能を損なうことなく、テキストを支援技術なしで 200％ までサ… | always (L4010) | 手動確認(always) | `text.font-size` | M3 |
| C_500.13 | info | テキストとその背景とのコントラストが十分であることを確認して下さい。 | always (L4027) | 手動確認(always) | `text.background-color` | M3 |
| C_500.14 | info | テキスト化された画像の前景色と背景色とのコントラストが十分であることを確認して下さい。 | always (L4028) | 手動確認(always) | `image.avoid-text-as-image` | M3 |
| C_500.15 | info | フォントサイズを相対的な大きさで指定していることを確認して下さい。 | always (L4029) | 手動確認(always) | `text.font-size` | M3 |
| C_500.16 | info | スタイルシートを用いて背景画像が使われている場合には、テキストとその画像の背景色とのコントラストが十分であることを確認… | always (L4030) | 手動確認(always) | `text.background-color` | M3 |
| C_500.17 | user | 文字色のみが指定されている可能性があります。十分なコントラスト比となる背景色を指定するようにして下さい。また、もし配色… | styleCheck (L4109) | テキストCSS解析 | `text.color` | M3 |
| C_500.18 | user | 背景色のみが指定されている可能性があります。十分なコントラスト比となる文字色を指定するようにして下さい。 また、もし配… | styleCheck (L4113) | テキストCSS解析 | `text.background-color` | M3 |
| C_500.19 | user | フォントサイズは相対的な大きさで指定することを検討してください。{0} | styleCheck (L4121) | テキストCSS解析 | `text.font-size` | M3 |
| C_500.20 | user | フォントサイズは相対的な大きさで指定することを検討してください。{0} | styleCheck (L4179) | テキストCSS解析 | `text.font-size` | M3 |
| C_500.21 | user | テキストのサイズがビューポート単位で指定されています。テキストがデフォルトの200%以上にサイズ変更できることを確認し… | styleCheck (L4125) | テキストCSS解析 | `text.font-size` | M3 |
| C_600.0 | info | 利用者に提示されるすべての非テキストコンテンツに対して、状況に応じて、同等の目的を果たす代替テキストを提供していること… | always (L4034) | 手動確認(always) | `image.alt-text` | M3 |
| C_600.8 | info | コンテンツに制限時間が設定されている場合には、利用者が解除・調整・延長することを可能にしてください。（次の例外を除く：… | always (L4046) | 手動確認(always) | `html-structure.embedded-script-behavior` | M3 |
| C_600.9 | info | 動きのある、点滅している、スクロールする、又は自動更新する情報に対しては、必要に応じてそれを利用者がそれを一時停止、停… | always (L4047) | 手動確認(always) | `html-structure.deprecated-elements`, `html-structure.embedded-script-behavior` | M3 |
| C_600.10 | info | ウェブページ上に閃光が存在する場合は、どの1秒間においても3回以下である、又は一般閃光閾値及び赤色閃光閾値を下回ってい… | always (L4048) | 手動確認(always) | `html-structure.deprecated-elements` | M3 |
| C_600.14 | info | リンクの目的が、リンクのテキスト、もしくはプログラムが解釈可能なリンクの文脈をリンクのテキストとあわせたものから解釈で… | always (L4052) | 手動確認(always) | `link.link-text` | M3 |
| C_600.17 | info | 開始タグ及び終了タグが仕様に準じて用いられており、IDの重複や、同一属性が複数回指定されたタグが存在しないことを確認し… | always (L4058) | 手動確認(always) | `html-structure.duplicate-id-accesskey` | M3 |
| C_600.19 | info | 情報を伝える画像の中で色を用いている場合、パターンやテキストを用いて色以外の方法でも情報を入手可能にしてください。 | always (L4060) | 手動確認(always) | `text.sensory-characteristics` | M3 |

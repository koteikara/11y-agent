# Chrome でページの HTML を保存する手順

作成日: 2026-09-18

## 目的

`memory/cms-migration-import-failure-patterns.md` の各項目を再現するための HTML を、ページが消える前に手元へ残す。
対象は2種類ある。

- 取込前の元ページ（自治体サイト）。
- 取込後のページ（`migrate.smart-lgov.jp` など。ログインが要る）。

この手順は Windows の Google Chrome を前提にする。
図は Linux の Chromium で撮ったため、メニューの並びは同じだが細部が異なる（アドレスバーに「保護されていない通信」と出ているのは撮影環境の都合で、実際は鍵マークになる。DevTools の表記が英語なのも同じ理由）。

## 方法の使い分け

4つの方法を書いているが、今回使うのは A と B だけである。

- **方法A**（Ctrl+S で「ウェブページ、HTML のみ」）が原則。今回の3ページはすべて方法Aで保存する。
- **方法B**（「ウェブページ、完全」）は、1-4 の和気町の2ページで方法Aに加えて保存する。背景画像を CSS で指定しているため。
- **方法C**（ページのソースを表示）は、保存する前の任意の確認。メモに書いてある形（1-1 なら `<li>` の中の `.pdf` リンク）がそのページにまだ残っているかを見る。無ければ、その旨をメモに残したうえで、保存はしておく。
- **方法D**（DevTools）は今回は使わない。JavaScript で本文を組み立てているページや、本文の一部だけを渡したいときの手段。

## 1. 準備

- 元ページが VPN 経由でしか開けない場合は、先に VPN につなぐ。
- 取込後のページは、先に CMS にログインしておく。
- 保存先のフォルダを1つ決める（例: `ダウンロード\torikomi-samples`）。
- ファイル名は `<項目番号>-<自治体>-<before|after>.html` にする。例: `1-1-koryo-before.html`、`1-4-wake-after.html`。同じページを「完全」でも保存するときは `-complete` を足す。

## 2. 方法A（原則）: Ctrl+S で「ウェブページ、HTML のみ」

1. 保存したいページを開く（図1）。
2. `Ctrl+S` を押す。メニューから開くなら、右上の「⋮」→「保存と共有」→「名前を付けてページを保存」（図2）。ページ上で右クリック →「名前を付けて保存」でも同じ（図3）。
3. 「名前を付けて保存」のダイアログで、「ファイルの種類」を「ウェブページ、HTML のみ」にし、ファイル名を付けて「保存」を押す（図4）。

「HTML のみ」で保存されるのは、Chrome がサーバーから受け取った HTML そのものである。JavaScript が動いたあとの状態ではない。CMS 取込ツールが読むのもこの形なので、原則はこちらを使う。
保存したファイルを Chrome で開くと画像や CSS が外れて見えるが、それで正しい。

![図1 保存したいページを開いたところ](images/chrome-save/01-page.png)

図1 保存したいページを開いたところ。右上の「⋮」がメニュー。

![図2 メニューから「名前を付けてページを保存」](images/chrome-save/02-menu-save.png)

図2 「⋮」→「保存と共有」→「名前を付けてページを保存」。ショートカットは Ctrl+S。

![図3 右クリックメニュー](images/chrome-save/03-context-menu.png)

図3 ページ上の右クリックメニュー。「名前を付けて保存」「ページのソースを表示」「検証」をこの手順で使う。

![図4 名前を付けて保存のダイアログ（画面イメージ）](images/chrome-save/04-save-dialog.png)

図4 「ファイルの種類」で「ウェブページ、HTML のみ」を選ぶ。この図は Windows のダイアログを模式化したもので、実際の画面と細部は異なる。

## 3. 方法B: 「ウェブページ、完全」で保存する

次の項目は、HTML だけでは足りない。

- 1-4 CSS の背景画像（画像の指定が CSS 側にある）。
- 1-6 JavaScript で本文を組み立てているページ。

このときは方法Aに加えて、同じダイアログで「ファイルの種類」を「ウェブページ、完全」にしてもう一度保存する。
「完全」は表示中の状態（JavaScript が動いたあとの DOM）を書き出し、CSS と画像を `<ファイル名>_files` というフォルダに保存する。背景画像を指定している CSS もこのフォルダに入る。
渡すときは `.html` と `_files` フォルダをまとめて zip にする。

## 4. 方法C: 保存する前に「ページのソースを表示」で中身を確かめる

`Ctrl+U`（または右クリック →「ページのソースを表示」）で、Chrome が受け取った HTML をそのまま見られる（図5）。
保存する前に、探している形が入っているかを `Ctrl+F` で確かめる。

| 項目 | 探す文字列 |
| --- | --- |
| 1-1 リスト内のファイルリンク | `<li>` の中の `.pdf` |
| 1-2 アイコン付きファイルリンク | `<a` の前後の `<img` |
| 1-3 `data:` 形式の画像 | `data:image` |
| 1-5 非対応形式 | `.odt`、`.webp` |
| 1-7 不要な属性 | `file_size`、`data-foreign-domain` |
| 2-② SVG | `.svg` |

探している形が無ければ、ページが変わっている。その旨をメモに残したうえで、保存はしておく。

左上の「行を折り返す」にチェックを入れると、長い行が読みやすい。

![図5 ページのソースを表示](images/chrome-save/05-view-source.png)

図5 「ページのソースを表示」。アドレスバーの先頭が `view-source:` になる。この画面で Ctrl+S を押すと、ソースをそのまま保存できる。

## 5. 方法D: 本文の一部だけを取り出す（DevTools）

今回の3ページでは使わない。ページ全体ではなく、本文のブロックだけが要るときの手段で、次の場面で使う。

- JavaScript で本文を組み立てているページ（1-6）で、表示後の状態を取りたいとき。
- 取込後のページからテンプレート部分を除いて、本文だけを渡したいとき（内部情報を減らせる）。
- 大きなページの一部だけをチャットに貼って共有したいとき。

1. 取り出したい本文の上で右クリック →「検証」（図3）。
2. DevTools が開き、「要素」（Elements）パネルでその要素が選ばれる（図6）。本文のブロック全体を取りたいときは、ツリーの上の行をクリックして親の要素へ移る。
3. 選んだ行を右クリック →「コピー」（Copy）→「outerHTML をコピー」（Copy outerHTML）（図7）。
4. メモ帳などに貼り付け、`.html` の拡張子で保存する。

方法Dで取れるのは表示中の DOM である。JavaScript で書き換わったあとの形なので、方法Aの HTML と一致しないことがある。どちらを渡したかをファイル名かメモに残す。

![図6 検証で DevTools を開いたところ](images/chrome-save/06-devtools-inspect.png)

図6 DevTools の「要素」パネル。選ばれている行が、右クリックした場所の要素。

![図7 要素を右クリックしてコピー](images/chrome-save/07-devtools-copy.png)

図7 ツリーの行を右クリックすると出るメニュー。「コピー」→「outerHTML をコピー」でその要素の HTML がクリップボードに入る。

## 6. 取込後のページ（CMS 側）の注意

- ログインしたあとに同じ手順で保存する。`www03.migrate4.smart-lgov.jp` の `torikomi_test` はログイン画面へ飛ぶので、先にログインする。
- 取込後のページには CMS のテンプレート（ヘッダー、ナビゲーション、フッター）が含まれる。本文だけが要るときは方法Dで `free-layout-area` の中を取る。
- 顧客コードや内部の URL など、外に出せない情報が入っていないかを確かめてから共有する。
- 取込後の URL が 404 のもの（広陵町、神栖市、那珂川町の元ページ）は、CMS 側の取込履歴から取込時の HTML を取り出す。取り出し方は CMS の担当に確認する。

## 7. 今回保存してほしいもの

メモに載っている URL 13 件の一覧。「状態」は 2026-09-18 に検証環境（クラウド）から確認した結果で、ブラウザ（VPN、CMS ログイン）では開ける可能性がある。

| 項目 | ページ | URL | 状態 | 方法 | ファイル名の例 |
| --- | --- | --- | --- | --- | --- |
| 1-1 | 広陵町 元ページ | https://www.town.koryo.nara.jp/contents_detail.php?co=kak&frmId=5993 | WAF のエラーページ。**要保存** | A | `1-1-koryo-before.html` |
| 1-1 | 広陵町 取込後 | https://www01.migrate.smart-lgov.jp/torikomi/77/koryo/6822.html | 404。CMS の取込履歴 | 履歴から | `1-1-koryo-after.html` |
| 1-2 | 那珂川町 元ページ | https://www.town.tochigi-nakagawa.lg.jp/life/kosodate_kyouiku/2025-0324-1009-105.html | 404。CMS の取込履歴があれば | 履歴から | `1-2-nakagawa-before.html` |
| 1-2 | 那珂川町 取込後 | https://www01.migrate.smart-lgov.jp/torikomi/78/nakagawa/9319.html | 取得済み | 不要 | `1-2-nakagawa-after.html` |
| 1-3 | 那珂川町 元ページ | https://www.town.tochigi-nakagawa.lg.jp/life/fukushi_kaigo/2020-0219-1001-25.html | 404。CMS の取込履歴があれば | 履歴から | `1-3-nakagawa-before.html` |
| 1-3 | 那珂川町 取込後 | https://www01.migrate.smart-lgov.jp/torikomi/78/nakagawa/9313.html | 取得済み | 不要 | `1-3-nakagawa-after.html` |
| 1-4 | 和気町 元ページ | https://www.town.wake.lg.jp/children/englishQuiz/ | 404 の見込み。開けたら **要保存** | A と B | `1-4-wake-before.html`、`1-4-wake-before-complete.zip` |
| 1-4 | 和気町 取込後 | http://www03.migrate4.smart-lgov.jp/torikomi_test/77/wake/239.html | CMS のログイン画面。**要保存** | A と B | `1-4-wake-after.html`、`1-4-wake-after-complete.zip` |
| 1-5 | 上板町 元ページ | https://www.townkamiita.jp/docs/2013103000011/ | 取得済み（ODT の例） | 不要 | `1-5-kamiita-before.html` |
| 1-5 | 飯島町 元ページ | https://iju.go-iijima.nagano.jp/information/4847/ | 404。同じサイトで webp を使う別のページがあれば | A | `1-5-iijima-before.html` |
| 1-7 | 神栖市 元ページ | https://kamisu-pr.jp/2021/11/10/r3senningarou/ | 取得済みだが、いまは `file_size` などの属性が無い | 不要 | `1-7-kamisu-before.html` |
| 1-7 | 神栖市 取込後 | http://www01.migrate.smart-lgov.jp/torikomi/77/kamisushi_kamisumika_pre/5833.html | 404。CMS の取込履歴 | 履歴から | `1-7-kamisu-after.html` |
| 2-② | 遠野市 元ページ | https://www.city.tono.iwate.jp/index.cfm/45,43562,242,472,html | 取得済み（SVG の例） | 不要 | `2-2-tono-before.html` |

「要保存」の 3 件（広陵町 元ページ、和気町 元ページ、和気町 取込後）が、ブラウザで保存してほしいもの。「履歴から」の 5 件は、CMS 側に取込時の HTML が残っていれば取り出す。

## 8. 渡し方

- 保存したファイルは、チャットに添付するか、共有フォルダに置いてパスを知らせる。
- 元ページ（公開されている自治体サイト）の HTML は、内容を確認したうえでリポジトリの `goal2-app/test/fixtures/` 配下に置ける。取込後のページは内部情報を含むので、リポジトリに入れる前に判断する。

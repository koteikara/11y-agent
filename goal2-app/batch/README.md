# 一括処理(リニューアルの段1の骨組み)

リニューアルの一括処理のうち、取得、型のまとめ、本処理を動かすコマンドである。
設計は `docs/renewal/ARCHITECTURE.md` の「一括処理」「確認の深さの決め方」「案件のフォルダの形」にある。
書き出し、確かめ、取り直し、比べ合わせ、取り込みの事前の確かめ、精度の指標(`metrics.json`)、校正台は、まだ無い(「作る順番」の段2以降)。

## 動かし方

`goal2-app/` で動かす。
Playwright(`npm install --no-save playwright@1.56.1` と `npx playwright install chromium`)が要る。

```bash
node batch/cli.js crawl   <案件のフォルダ> --start <始まりの URL> [--restart]
node batch/cli.js patterns <案件のフォルダ> [--under <URL>]
node batch/cli.js sheet   <案件のフォルダ>
node batch/cli.js fetch   <案件のフォルダ> [--reinspect]
node batch/cli.js group   <案件のフォルダ>
node batch/cli.js approve <案件のフォルダ> <型の番号> --by <名前> [--selector <CSS>]
node batch/cli.js process <案件のフォルダ>
node batch/cli.js status  <案件のフォルダ>
```

- `crawl`: 旧サイトをリンクと `sitemap.xml` でたどり、ページの一覧 `crawl/list.csv`(URL、タイトル、ディレクトリ、階層、状態、転送先、重複先、更新日、見つけ方、見つけた元)、ファイルの一覧 `crawl/files.csv`、外のサイトへのリンクの一覧 `crawl/external.csv` を書く。Website Explorer と WebCopy の代わり。スクリプトの中のリンクを拾い、スクリプトでメニューを描くページは Chromium で開く(`crawl.render`)。Cookie を引き継ぎ(`crawl.cookies`)、名乗りを変えられる(`fetch.userAgent`)。外す URL の項目は `crawl.ignoreParams` で決め、値が変わっても中身が同じになる項目は巡回の中で見つけて外す。`robots.txt` で止められた URL は取りに行かない。印刷用ページは既定で取りに行かず、一覧に「印刷用として外した」と書く(`crawl.excludePrintPages`)。止めても続きから再開し、ネットワークの切断や時間切れで取れなかったページは再開のときに取り直す。項目が2つ以上の同じ形の URL(ブログやカレンダーの組み合わせ)は `crawl.maxPerQueryPattern` 件で打ち切り、打ち切った形を `crawl/capped.csv` に書く。外のサイトへのリンクは `crawl/external.csv` にサーバーごとにまとめる。やり直すときは `--restart`。取ったページは `crawl/pages/` に置き、`fetch` が使い回す。
- `patterns`: 巡回の結果から、複数のページで作られているページ群(サブサイトの候補)を見つけ、順位を付けて `crawl/patterns.xlsx` に出す。ページごとの所属は `crawl/patterns-pages.json`。`--under` を付けると、その URL の下のページだけで見る(`patterns-<名前>.xlsx`)。決め方は `ARCHITECTURE.md` の「コンテンツパターンの抽出」。
- `sheet`: 巡回の結果から、移行管理シートの下書き `crawl/sheet-draft.xlsx` を出す(手順書の「移行管理シート作成」で埋める列の案)。旧ページタイトル、移行元 URL、h1、旧カテゴリ構成(パンくず)、グループの案(問い合わせ先の部署)、ページ種別の案と理由、重複の案、新ページタイトルの案と直した点、パターンの案。旧サイトへは取りに行かず、巡回の写しを読む。パンくずと問い合わせ先の要素、移行管理 ID の形、ページ種別の名前と決め方の値は、案件の設定の `sheet` で変えられる。
- `fetch`: `input/pages.json` のページを取り、`pages/<ID>/source.html` と台帳 `fetch.json` を書く。もう一度動かすと、取得できていないページだけを取り直す。`--reinspect` は、旧サイトへ取りに行かずに、保存した旧ページを調べ直す(構造の取り方を変えたときなど)。
- `group`: 構造の似ている度合い(要素の道の重なりが 0.8 以上)でページを型にまとめ、型ごとの本文の範囲の案を、型のページの文字の比べ合わせで選んで `project/templates.json` に書く。決め方は `ARCHITECTURE.md` の「構造の型と本文の範囲」。
- `approve`: 型の本文の範囲を承認し、案件の設定に入れる。設計では案件の設定を書くのは人と校正台だけなので、校正台ができるまでの代わりとして置く。承認した人の名前を変更の履歴に残す。10 ページ未満の型(`templates.json` の `smallTemplates`)も、`--selector` を付けて承認できる。
- `process`: 本文の抽出、候補、自動で採用にしたルールの候補の採用、残る指摘、確認の深さを `pages/<ID>/candidates.json` に書く。済んだページは飛ばす(`--force` でやり直す)。

どのコマンドも、`project/summary.json` と、「AI 修正」タブへ写す `project/status.csv` を書き直す。
画面と `logs/` の実行の記録には、件数、移行管理 ID、理由だけを出し、旧サイトの本文は出さない。

同じ案件のフォルダでは、書き込むコマンド(crawl、patterns、sheet、fetch、group、process)を2つ同時に動かせない。動いているあいだは、フォルダに `run.lock`(PC の名前とプロセスの番号)を置く。印を置いたプロセスがもう無ければ、次のコマンドが引き継ぐ。別の PC の印があるときは止まる。status と approve は印を見ずに動く(動いているあいだに数を見たり、型を承認したりできる)。

## 入力と案件の設定

`input/pages.json` は、移行管理シートの GAS が共有ドライブに書き出し、受け渡しのコマンドが案件のフォルダへ取り込む(段4。`docs/renewal/ARCHITECTURE.md` の「入力」)。
それまでは手で作る。

```json
{
  "sheet": { "name": "移行管理シート", "version": "3" },
  "pages": [
    { "id": "P0001", "oldUrl": "https://www.example.lg.jp/a/1.html", "pageTitle": "", "templateNo": "1", "round": 1 }
  ]
}
```

`project/settings.json` は、少なくとも取りに行ってよいサーバーを入れる。
書かなかった項目は、`batch/lib/project.js` の既定の値になる。

```json
{
  "fetch": { "allowedHosts": ["www.example.lg.jp"], "intervalMs": 1000, "concurrency": 2 },
  "ai": { "enabled": false }
}
```

- `fetch.privateHosts`: 社内のネットワークのアドレスにあってもよいサーバー(CMS の取込環境など)。ここに無いサーバーは、内部のアドレスなら取りに行かない。
- `rules.autoAccept`: 確認不要に入れてよいと決めたルール。初めは空にする。
- `ai.enabled`: 本文を AI(さくらか Gemini)に送るか。自治体の同意を確かめてから `true` にする。既定は `false` で、AI の要求は宿主で止める。

## 仕組み

候補のエンジン(`public/app.js`)と本文抽出(`public/goal3.js`)は、Playwright の Chromium で `public/engine.html` を開いて動かす(`lib/engine-host.js`)。
サーバーは立てず、ページの要求は route で受けて、ファイルは手元から返し、API は `lib/engine-api.js`(今のサーバーと同じ処理)で答える。
エンジンのページから外への要求は止める。

## テスト

```bash
npm run test:batch-engine
```

- `test/batch-engine/run-engine-host-tests.js`: 佐賀市の51件と手書きの3件で、今のサーバーと宿主の結果が一致すること。
- `test/batch-engine/run-batch-cli-tests.js`: 手元の旧サイトの代わり(`fake-old-site.js`)に対して、取得の守り、取得、型のまとめ、承認、本処理、本文を出さないことを確かめる。

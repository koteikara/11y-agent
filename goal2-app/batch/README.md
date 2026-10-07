# 一括処理(リニューアルの段1の骨組み)

リニューアルの一括処理のうち、取得、型のまとめ、本処理を動かすコマンドである。
設計は `docs/renewal/ARCHITECTURE.md` の「一括処理」「確認の深さの決め方」「案件のフォルダの形」にある。
書き出し、確かめ、取り直し、比べ合わせ、取り込みの事前の確かめ、精度の指標(`metrics.json`)、校正台は、まだ無い(「作る順番」の段2以降)。

## 動かし方

`goal2-app/` で動かす。
Playwright(`npm install --no-save playwright@1.56.1` と `npx playwright install chromium`)が要る。

```bash
node batch/cli.js fetch   <案件のフォルダ>
node batch/cli.js group   <案件のフォルダ>
node batch/cli.js approve <案件のフォルダ> <構造のハッシュ> --by <名前>
node batch/cli.js process <案件のフォルダ>
node batch/cli.js status  <案件のフォルダ>
```

- `fetch`: `input/pages.json` のページを取り、`pages/<ID>/source.html` と台帳 `fetch.json` を書く。もう一度動かすと、取得できていないページだけを取り直す。
- `group`: 構造のハッシュでページを型にまとめ、型ごとの本文の範囲の案を `project/templates.json` に書く。
- `approve`: 型の本文の範囲を承認し、案件の設定に入れる。設計では案件の設定を書くのは人と校正台だけなので、校正台ができるまでの代わりとして置く。承認した人の名前を変更の履歴に残す。10 ページ未満の型(`templates.json` の `smallTemplates`)も、`--selector` を付けて承認できる。
- `process`: 本文の抽出、候補、自動で採用にしたルールの候補の採用、残る指摘、確認の深さを `pages/<ID>/candidates.json` に書く。済んだページは飛ばす(`--force` でやり直す)。

どのコマンドも、`project/summary.json` と、「AI 修正」タブへ写す `project/status.csv` を書き直す。
画面と `logs/` の実行の記録には、件数、移行管理 ID、理由だけを出し、旧サイトの本文は出さない。

## 入力と案件の設定

`input/pages.json` は、移行管理シートの GAS が書き出す(段4)。
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

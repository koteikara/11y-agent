# ローカルWindows版(単一実行ファイル)のビルド手順

`goal2-app` を、コマンドラインに不慣れな担当者でも使えるように、Windows用の単一の `.exe` ファイルとして配布するための手順。Node.js標準の「単一実行ファイル化(SEA: Single Executable Applications)」機能を使う。追加のnpmパッケージをランタイム依存として増やすことはない(ビルド時にのみ `esbuild`・`postject` を`npx`経由で一時的に使う)。

> Node.jsのSEA機能は、`require("./lib/rules")`のようなローカルファイルへの`require()`を実行時に解決できない(単一の埋め込みスクリプトとしてしか扱えない)。そのため、ビルド手順の中でまず`esbuild`を使って`server.js`とその依存ファイル(`lib/`以下)を1つの自己完結したファイルにまとめてから、SEA化している。

## 前提条件

- ビルドを行うWindows PCに **Node.js 20以降** がインストールされていること。
- ビルドを行うWindows PCに **`signtool`(Windows SDK Signing Tools)** がインストールされていること。`node.exe`は署名済みバイナリのため、SEA化する前に署名を除去する必要があり、これが無いと`goal2-app.exe`は生成されても正しく動作しない(起動時にアプリではなくNode.jsの対話モードが開いてしまう)。
- インターネット接続(初回ビルド時に `npx esbuild`・`npx postject` が実行される)。

Node.js・signtoolが入っているかどうかは、次の2つの節の確認手順で分かる。すでに両方入っているPCでは、このセクションは読み飛ばして「ビルド手順」に進んでよい。

## Node.jsのインストール(未インストールの場合)

`goal2-app.exe`のビルドには、開発ツールのNode.jsが必要になる(ビルドする側のPCだけで必要。`goal2-app.exe`を配布された利用者側のPCには不要)。すでに他のソフトでNode.jsを使っている場合も、通常はそのままで問題ない。

1. ブラウザで [https://nodejs.org/](https://nodejs.org/) を開く。
2. 「LTS」と書かれた方のボタンをクリックしてインストーラー(`.msi`ファイル)をダウンロードする(「Current」ではなく「LTS」を選ぶ)。
3. ダウンロードした`.msi`ファイルをダブルクリックして実行する。表示される画面は基本的にすべて「Next」(次へ)を押して進めてよい。追加コンポーネントを選ぶ画面が出ても、標準の選択のまま進めてよい。
4. インストール完了後、Windowsの検索バーに「コマンドプロンプト」と入力して開く。
5. 開いた黒い画面に `node -v` と入力してEnterキーを押す。`v20.x.x`のようにバージョン番号が表示されればインストール成功。「'node' は、内部コマンドまたは外部コマンド...」のようなエラーが出る場合は、一度PCを再起動してから同じ手順を試す。

Node.jsは無償・公式のオープンソースソフトウェアで、インストールしてもgoal2-app以外の動作に影響することはない。

## signtoolのインストール(未インストールの場合)

`signtool`は、Microsoftが提供する「Windows SDK」というツール集の一部として配布されている。SDK全体(数GB)をインストールする必要はなく、`signtool`を含む部分だけを選んでインストールできる。

1. ブラウザで [https://developer.microsoft.com/windows/downloads/windows-sdk/](https://developer.microsoft.com/windows/downloads/windows-sdk/) を開く。
2. 「Windows SDKのインストーラーをダウンロードする」のようなリンクからインストーラー(`winsdksetup.exe`)をダウンロードする。
3. インストーラーを実行し、インストールする機能を選ぶ画面まで進める。
4. 一覧の中から **「Windows SDK Signing Tools for Desktop Apps」だけにチェック**を入れ、他はすべてチェックを外す(数十MB程度で済む)。
5. インストールを完了する。
6. コマンドプロンプトを開いて `where signtool` と入力し、Enterキーを押す。パスが1つ以上表示されればインストール成功。「情報を見つけられません」と表示される場合は、一度PCを再起動してから同じ手順を試す。

すでにVisual StudioやWindows用の開発ツールが入っているPCでは、`signtool`がすでに使える場合もある(手順6でまず確認するとよい)。

## ビルド手順

1. このリポジトリを取得し、`goal2-app` フォルダに移動する。
2. `build-windows-app.bat` をダブルクリックする(またはコマンドプロンプトで実行する)。
3. 完了すると `goal2-app` フォルダの中に `goal2-app.exe` が生成される。
4. **`goal2-app.exe` 単体ではなく、`goal2-app` フォルダごと**(`goal2-app.exe`・`public`フォルダ・`data`フォルダを含む)を、配布したい担当者のPCにコピーする。`goal2-app.exe`は画面表示に使う`public`フォルダ、ルールデータの`data`フォルダを、自分と同じフォルダの中から読み込む仕組みになっているため、`.exe`ファイルだけをコピーすると起動時にエラーになる。

> **注意**: バンドル(esbuild)→SEA化(postject)の一連の処理自体は開発環境(Linux)で同様の手順を再現し、生成したバイナリが実際に画面表示・APIレスポンスまで正しく動作することを確認済み。Windows実機での検証も進めているが、まだ完全に確認できたとは限らないため、問題があれば「トラブルシューティング」を参照する。

## 利用者側の使い方

1. `goal2-app` フォルダ(`goal2-app.exe`・`public`・`data`が同じ場所に入っているフォルダ)の中の `goal2-app.exe` をダブルクリックする。`.exe`だけを別の場所に移動すると起動できない。
2. 一瞬コマンド画面(黒い画面)が表示された後、既定のブラウザが自動で開き、画面が表示される。
3. 初回のみ、「(ローカルWindows限定) htmlchecker.exeで自動比較」の欄に、`htmlchecker.exe` の場所(フルパス)を入力して「保存」を押す。次回以降は入力不要(このPC内に保存される)。
4. 「移行元の全体HTML」「移行後の全体HTML」を貼り付けて「htmlchecker.exeで自動比較する」を押すと、自動で比較結果が表示される。

コマンドライン操作は一切不要。

## 設定の保存場所

`htmlchecker.exe` のパスなどのローカル設定は、以下のファイルに保存される。

- `%APPDATA%\goal2-app\config.json`

このファイルを削除すれば設定はリセットされる。

## 環境変数による上書き(開発・検証用)

サーバー起動時に環境変数 `MICHECKER_HTMLCHECKER_EXE` を設定すると、画面上の設定より優先される。開発・検証時のみの利用を想定している。

## Cloud Runホスト版との違い

この `.exe` はローカルWindows PC専用。Cloud Run上にデプロイされたホスト版では、`htmlchecker.exe` の自動実行機能自体が無効化される(Windows以外の環境では動作しないため)。CSVを手動でアップロードして比較する機能は、Cloud Runホスト版・ローカルWindows版のどちらでも同じように使える。

## トラブルシューティング

- `node: command not found` と表示される → Node.js がインストールされていないか、PATHが通っていない。上記「Node.jsのインストール(未インストールの場合)」を参照してインストールする(インストール後もエラーが出る場合はPCを再起動する)。
- `postject` の実行でエラーになる → インターネット接続を確認する(初回実行時にダウンロードが発生する)。
- `goal2-app.exe` を起動してもブラウザが開かない → コマンド画面に表示されるURL(`http://localhost:8080` など)を手動でブラウザに入力して開く。
- ダブルクリックしても黒い画面が一瞬表示されただけで何も起きない(エラー内容が読めない) → まずコマンドプロンプトから`goal2-app.exe`を実行し、表示されるエラーメッセージを確認する。
  1. Windowsの検索バーに「コマンドプロンプト」と入力して開く。
  2. `cd`コマンドで`goal2-app.exe`があるフォルダに移動する(例: `cd C:\Users\name\Desktop\goal2-app`)。
  3. `goal2-app.exe` と入力してEnterキーを押す。
  4. `ENOENT`等のファイルが見つからないエラーが表示される場合、`goal2-app.exe`と同じフォルダに`public`フォルダ・`data`フォルダが存在するか確認する(`.exe`だけを別フォルダに移動していないか)。
  5. `ERR_UNKNOWN_BUILTIN_MODULE`(`No such built-in module: ./lib/rules`等)というエラーが表示される場合、`server.js`をesbuildでバンドルする前の古い手順で`.exe`をビルドしている。最新の`build-windows-app.bat`を取得し直し、`goal2-app`フォルダ内の古い`goal2-app.exe`・`sea-prep.blob`・`server.bundled.js`を削除してから再ビルドする。
- `esbuild`の実行でエラーになる → `postject`と同様、インターネット接続を確認する(初回実行時にダウンロードが発生する)。
- `[4/5]`で「signtool was not found」と表示されビルドが止まる → 上記「signtoolのインストール(未インストールの場合)」を参照してインストールする。
- ビルドは`Done.`まで進んで`goal2-app.exe`も生成されるが、ダブルクリックすると`goal2-app`のアプリ画面ではなく`Welcome to Node.js v...`という黒い対話画面(REPL)が開いてしまう → SEA化(埋め込み)が正しく行われていない兆候。`build-windows-app.bat`実行時に`postject`の出力に`warning: The signature seems corrupted!`が出ていないか確認する。出ている場合、`signtool`による署名除去(`[4/5]`)が行われていない(`signtool`が正しくインストールされていない、または古いビルド手順のまま)ことが原因。`goal2-app.exe`・`sea-prep.blob`・`server.bundled.js`を削除し、`signtool`のインストールを確認した上で再ビルドする。
- 上記を確認してもなお、コマンドプロンプトから実行してもエラーメッセージが一切出ずに終了する、またはWindows Defender・アンチウイルスの通知が出る → セキュリティソフトに未知の実行ファイルとして警告・ブロックされることがある。Windows Securityの「保護の履歴」に`goal2-app.exe`関連のブロック記録がないか確認し、あれば許可(除外)リストに追加する。

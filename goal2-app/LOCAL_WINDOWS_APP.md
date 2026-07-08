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

Node.js・`signtool`が必要なのは、ここでビルドを行う人(担当者PC)だけ。ビルドした`goal2-app-windows.zip`を受け取って使うだけの人は、Node.jsも`signtool`もインストール不要。

1. このリポジトリを取得し、`goal2-app` フォルダに移動する。
2. `build-windows-app.bat` をダブルクリックする。
   - コマンドプロンプト/PowerShellから実行してもよい(進行状況やエラーを確認したい場合はこちらが便利)。PowerShellの場合は `build-windows-app.bat` だけでは実行できず、`.\build-windows-app.bat` のように先頭に `.\` を付ける必要がある(コマンドプロンプトでは`.\`は不要)。
3. `[1/6]`〜`[6/6]`まで進み、最後に`Done.`と表示されれば成功。`goal2-app` フォルダの中に **`goal2-app-windows.zip`** が生成される(`goal2-app.exe`・`public`フォルダ・`data`フォルダの3つをまとめて圧縮したもの。`goal2-app.exe`は画面表示用の`public`フォルダ・ルールデータの`data`フォルダを自分と同じ場所から読み込む仕組みになっているため、この3つは常にセットで必要)。
4. **この`goal2-app-windows.zip`をそのまま**、配布したい担当者にメールやファイル共有で送る。

> **確認済み**: 2026-07-08、Windows実機でビルド→`goal2-app.exe`の起動→画面表示(KBルール61件の読み込み含む)まで一通り成功を確認した。それでも環境によって問題が起きる場合は、下記「トラブルシューティング」を参照する。

## 利用者側の使い方

1. 受け取った`goal2-app-windows.zip`を右クリックして「すべて展開」(または任意の解凍ソフト)で展開する。
2. 展開してできたフォルダの中の `goal2-app.exe` をダブルクリックする。`.exe`だけを他の場所へ移動すると起動できないので、フォルダの中身(`goal2-app.exe`・`public`・`data`)は常にひとまとめのままにする。
3. 一瞬コマンド画面(黒い画面)が表示された後、既定のブラウザが自動で開き、画面が表示される。
4. 初回のみ、「(ローカルWindows限定) htmlchecker.exeで自動比較」の欄に、`htmlchecker.exe` の場所(フルパス)を入力して「保存」を押す。次回以降は入力不要(このPC内に保存される)。
5. 「移行元の全体HTML」「移行後の全体HTML」を貼り付けて「htmlchecker.exeで自動比較する」を押すと、自動で比較結果が表示される。

コマンドライン操作もNode.js等のインストールも一切不要。

## 設定の保存場所

`htmlchecker.exe` のパスなどのローカル設定は、以下のファイルに保存される。

- `%APPDATA%\goal2-app\config.json`

このファイルを削除すれば設定はリセットされる。

## 環境変数による上書き(開発・検証用)

サーバー起動時に環境変数 `MICHECKER_HTMLCHECKER_EXE` を設定すると、画面上の設定より優先される。開発・検証時のみの利用を想定している。

## Cloud Runホスト版との違い

この `.exe` はローカルWindows PC専用。Cloud Run上にデプロイされたホスト版では、`htmlchecker.exe` の自動実行機能自体が無効化される(Windows以外の環境では動作しないため)。CSVを手動でアップロードして比較する機能は、Cloud Runホスト版・ローカルWindows版のどちらでも同じように使える。

## トラブルシューティング

問題が起きたら、まずコマンドプロンプトまたはPowerShellから`build-windows-app.bat`を実行し、`[1/6]`〜`[6/6]`のどこで・どんなメッセージが出て止まっているかを確認する(ダブルクリックだとウィンドウが閉じてエラーが読めないことがある)。PowerShellの場合は`.\build-windows-app.bat`のように先頭に`.\`を付けること。

### ビルド中(`build-windows-app.bat`実行時)のエラー

- `node: command not found` と表示される → Node.js がインストールされていないか、PATHが通っていない。上記「Node.jsのインストール(未インストールの場合)」を参照する(インストール後もエラーが出る場合はPCを再起動する)。
- `[1/6]`の`esbuild`または`[5/6]`の`postject`の実行でエラーになる → インターネット接続を確認する(初回実行時にそれぞれダウンロードが発生する)。
- `[1/6]`は正常終了するが、`[2/6]`以降が何もエラーメッセージを出さずに実行されない(スクリプトがそこで終わってしまう) → 古いバージョンの`build-windows-app.bat`を使っている可能性がある。最新版を取得し直す。
- `[4/6]`で「signtool was not found」と表示されビルドが止まる → `signtool`が未インストールの場合は上記「signtoolのインストール(未インストールの場合)」を参照する。すでにインストール済みの場合は、インストール後に開いたままのコマンドプロンプト/PowerShellのウィンドウを一旦閉じて新しく開き直してから再実行する(インストーラーによるPATHの更新は、既に開いているウィンドウには反映されない)。`build-windows-app.bat`は`C:\Program Files (x86)\Windows Kits\10\bin\`以下も自動で探すため、PATHが通っていなくても標準的な場所にインストールされていれば通常は検出できる。
- `[5/6]`で「Error: Couldn't write executable」と表示される → `goal2-app.exe`が他のプロセスに使用中でロックされている、またはアンチウイルスが書き込みをブロックしている可能性が高い。タスクマネージャーで`goal2-app.exe`(または`node.exe`)のプロセスが残っていないか確認して終了させ(`taskkill /f /im goal2-app.exe`でも可)、もう一度`build-windows-app.bat`を実行する。それでも解決しない場合は下記「アンチウイルスによるブロック」を確認する。
- `[6/6]`でZIP作成に失敗する(`Compress-Archive`のエラー) → 直前に生成された`goal2-app-windows.zip`が他のプログラム(解凍ソフト等)で開いたままになっていないか確認して閉じる。それでも失敗する場合は、`goal2-app.exe`・`public`フォルダ・`data`フォルダを手動で選択し、右クリック→「送る」→「圧縮(zip形式)フォルダー」でも同じものが作れる。

### `goal2-app.exe`の実行時のエラー

- ダブルクリックしても黒い画面が一瞬表示されただけで何も起きない(エラー内容が読めない) → コマンドプロンプト/PowerShellから`goal2-app.exe`を直接実行し、表示されるエラーメッセージを確認する(`cd`で`goal2-app.exe`のあるフォルダに移動してから`goal2-app.exe`、PowerShellなら`.\goal2-app.exe`と入力)。
  - `ENOENT`等のファイルが見つからないエラー → `goal2-app.exe`と同じフォルダに`public`フォルダ・`data`フォルダが存在するか確認する(`.exe`だけを別フォルダに移動していないか)。
  - `ERR_UNKNOWN_BUILTIN_MODULE`(`No such built-in module: ./lib/rules`等) → `server.js`をesbuildでバンドルする前の古い手順で`.exe`をビルドしている。最新の`build-windows-app.bat`を取得し直し、`goal2-app`フォルダ内の古い`goal2-app.exe`・`sea-prep.blob`・`server.bundled.js`を削除してから再ビルドする。
- `goal2-app`のアプリ画面ではなく`Welcome to Node.js v...`という黒い対話画面(REPL)が開いてしまう → SEA化(埋め込み)が正しく行われていない。ビルド時の`postject`の出力に`warning: The signature seems corrupted!`が出ていないか確認する(出ている場合は`signtool`による署名除去が効いていない)。`goal2-app.exe`・`sea-prep.blob`・`server.bundled.js`を削除し、`signtool`のインストールを確認した上で再ビルドする。
- `goal2-app.exe` を起動してもブラウザが開かない → コマンド画面に表示されるURL(`http://localhost:8080` など)を手動でブラウザに入力して開く。

### アンチウイルスによるブロック

コマンドプロンプトから実行してもエラーメッセージが一切出ずに終了する、またはWindows Defender・アンチウイルスの通知が出る場合、セキュリティソフトに未知の実行ファイルとして警告・ブロックされている可能性がある。Windows Securityの「ウイルスと脅威の防止」→「保護の履歴」に`goal2-app.exe`関連のブロック記録がないか確認し、あれば許可(除外)リストに追加する。

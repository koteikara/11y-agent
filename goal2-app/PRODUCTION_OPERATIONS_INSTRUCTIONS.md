# 本番運用の段階 設計書（アクセス制御、送信の同意、証跡、手元で動くサーバーの守り）

Cloud Run の本番と Windows 版を、実案件で使える状態にするための設計と手順をまとめる。
扱うのは、Cloud Run を使える人の制限、自治体のページを LLM に送ることへの同意の扱い、証跡の置き場所、Windows 版の待ち受けの守り、Node.js の版の更新、さくらの AI Engine への切り替え（L3）の順序である。
前半は判断の前提と現状の事実、後半は段階ごとの作業と検証である。

作成は 2026-09-25、設計はこのリポジトリの設計・レビュー担当が行った。
関数名で該当箇所を探すこと。行番号は書かない。

## 0. 作業の前に読むもの

- `AGENTS.md`、`PROJECT_CONTEXT.md`
- `goal2-app/CLOUD_RUN_DEPLOY.md`（本番のデプロイ手順）
- `goal2-app/LLM_DATA_POLICY.md`（データ送信の方針）
- `goal2-app/LLM_PROVIDER_SWITCH_INSTRUCTIONS.md` の 4章 L3（さくらへの切り替え）
- `goal2-app/LOCAL_WINDOWS_APP.md`（Windows 版の作り方と配り方）
- `goal2-app/server.js` の `server.listen()`、`readJsonBody()`、`/api/local-settings`、`runHtmlCheckerLocalCompare()`

## 1. 前提（ユーザー確定、2026-09-25。アクセス制御は 2026-09-28 に変更）

- **Cloud Run は、全員で共通の1つのパスワードで守る。** 開くとブラウザーがパスワードを求め、知っている人だけが使える。当初は IAP（Google のログインで、許可したアカウントだけを通す）としたが、使える人を選んで登録するのが難しいため、2026-09-28 にユーザーがパスワード制に変えた。
- **送信の同意は、自治体（案件）ごとに営業が取る。記録は持たない。** アプリは同意の有無を確かめない。
- **証跡は共有ドライブに置き、承認者が見る。** 保存期間の決まりは無い。

次の1点は確かめていない。

- 同意が得られない案件があり得るか。あり得るなら、その案件で AI を使わない方法を決める（4章 P2 の2）。

## 2. 現状の事実（2026-09-25、main `836853a`）

### 2.1 Cloud Run

- デプロイの手順は `--allow-unauthenticated` を付けており、URL を知っていれば誰でも画面と API を使える。
- 誰でも `/api/llm/*` を呼べるので、Vertex AI の費用が第三者の呼び出しでもかかる。1分あたりの上限（`LLM_MAX_CALLS_PER_MINUTE`）はあるが、呼び出す人は選べない。
- 誰でも `/api/fetch-html` と `/api/link-title` で外部のページを取らせられる。内部のアドレス（プライベートアドレスなど）へは行かないようにしてある（`isBlockedHostLiteral()` ほか）。
- 誰でも `POST /api/local-settings` で、コンテナの中に設定ファイルを書ける。Windows 以外では htmlchecker.exe を実行しない（`runHtmlCheckerLocalCompare()` が Windows でなければ止める）ので、書けるだけで実行はされない。

### 2.2 Windows 版（`goal2-app.exe`）

Windows 版は、担当者の PC で `goal2-app.exe` を起動し、同じ PC のブラウザーで画面を開く。
サーバーは次のとおりに動く。

- `server.listen(port, "0.0.0.0")` で、すべてのネットワークの口で待ち受ける。同じネットワークの別の機器からも届く。
- POST の送り元を確かめない。`readJsonBody()` は `Content-Type` を見ずに本文を JSON として読み、`Origin` と `Host` も見ない。
- `POST /api/local-settings` は、受け取った `htmlCheckerExePath` をそのまま設定ファイルに書く。値の形（ファイル名や、ネットワーク上のパスかどうか）を確かめない。
- `POST /api/michecker-local-compare` は、設定ファイルのパスにあるファイルを `execFile(パス, ["-f", 一覧ファイル])` で実行する。

この組み合わせで、コード上は次の2つの経路から、担当者の PC で任意の実行ファイルを動かせる。
実際に攻撃して確かめてはいない。

- **同じネットワークの別の機器から。** 2つの POST を順に送るだけで成り立つ。Windows のファイアウォールが初回の起動で許可を求め、担当者が許可していれば届く。
- **担当者のブラウザーで開いた別のサイトから。** `Content-Type: text/plain` の POST はブラウザーの事前確認（CORS のプリフライト）を経ずに送られ、サーバーは本文を JSON として読む。応答は読めないが、設定の書き込みと実行はできる。Chrome などは、公開サイトから `localhost` への要求に許可を求める仕組み（Local Network Access）を入れつつあるが、利用者の操作しだいで通るため、守りとしては当てにしない。

パスには、ネットワーク上の共有フォルダー（`\\` で始まる UNC パス）も書ける。`fs.existsSync()` で見つかれば実行されるので、外部に置いた実行ファイルを指すこともできる。

### 2.3 証跡

- Goal 2（`/`）の証跡は、CSV をダウンロードでき（ファイル名 `goal2_<ページの識別>-evidence.csv`）、JSON はクリップボードへのコピーだけである。ページの識別（`page_session_id`）は、旧 URL と題名から作る10文字のハッシュである。
- GOAL1（`/goal1.html`）は、バッチの JSON（`<バッチID>.json`）と一覧の CSV（`<バッチID>-summary.csv`）をダウンロードできる。
- 証跡の作業者の欄（`worker`、決定の `actor`、`confirmed_by`）は、画面の「作業者」欄の文字をそのまま使う。既定値は `worker-001` で、作業者が書き替えないとそのまま残る。
- 作業者は、ダウンロードまたはコピーした証跡を手で保存している。置き場所と名前の決まりは無い。

### 2.4 Node.js の版

`Dockerfile`（`node:20-alpine`）と CI は Node 20 で動かしている。
Node 20 のサポートは 2026-04-30 に終わった。
Node 22 は 2027-04-30、Node 24 は 2028-04-30 まで保守される（Node.js の公式の予定表、2026-09-25 確認）。

## 3. 設計

### 3.1 段階と順序

段階は5つに分ける。
P0 は本番の段階と関係なく、いま配っている Windows 版の穴を塞ぐものなので、最初に行う。

| 段階 | 内容 | 変えるもの | 担当 |
|---|---|---|---|
| P0 | 手元で動くサーバーの守り | `server.js` と新しい `lib/`、テスト、Windows 版の配り直し | 実装担当、配り直しはユーザー |
| P1 | Cloud Run に共通のパスワードを掛ける | `server.js` と新しい `lib/`、テスト、`CLOUD_RUN_DEPLOY.md`、Secret Manager | 実装担当、シークレットとデプロイはユーザー |
| P2 | 同意と証跡の運用 | 運用の決まり、画面の小さな変更 | 決まりはユーザー、画面は実装担当 |
| P3 | さくらへの切り替え（L3） | 本番の設定、画面と証跡の表示 | L3 の設計どおり |
| P4 | Node.js を 24 に上げる | `Dockerfile`、CI、文書 | 実装担当 |

P3 は P1 のあとに行う。
さくらの API キーで費用がかかる呼び出しを、パスワードを知っている人だけに絞ってから載せるためである。
P4 はいつ行ってもよいが、P0 と同じ PR には入れない。
問題が出たときに、どちらの変更が原因かを分けられるようにするためである。

### 3.2 P0 手元で動くサーバーの守り

2.2 の経路を、次の4つの守りで塞ぐ。
1つが破られても残りが効くように、重ねて入れる。

1. **待ち受けの口を絞る。** 待ち受けのアドレスを環境変数 `HOST` で決める。`HOST` が無いときは、Cloud Run（環境変数 `K_SERVICE` がある）では `0.0.0.0`、それ以外では `127.0.0.1` にする。`Dockerfile` には `ENV HOST=0.0.0.0` を明記する。同じネットワークの別の機器からは届かなくなる。
2. **`Host` ヘッダーを確かめる。** `127.0.0.1` で待ち受けるときは、`Host` が `localhost:<port>`、`127.0.0.1:<port>`、`[::1]:<port>` のどれかでなければ 403 を返す。GET も含むすべての要求で確かめる。外部のドメインの名前を `127.0.0.1` に向ける攻撃（DNS リバインディング）では `Host` が外部のドメインになるので、ここで止まる。
3. **POST の送り元を確かめる。** すべての POST で、`Content-Type` のメディアタイプが `application/json` でなければ 415 を返す（`; charset=utf-8` などの付加は許す）。`Origin` ヘッダーがあるときは、そのホストが `Host` ヘッダーと一致しなければ 403 を返す。`Content-Type: application/json` の要求は、別のサイトからはブラウザーの事前確認を経ないと送れず、サーバーは事前確認に許可を返さないので、ブラウザーが送らない。画面の POST はすべて `application/json` で送っているので、画面の動きは変わらない。この確認は Cloud Run でも行う。
4. **htmlchecker.exe のパスを確かめる。** パスは、ドライブ文字から始まる絶対パスで、UNC パスでなく、ファイル名が `htmlchecker.exe`（大文字と小文字を区別しない）のときだけ受け付ける。`POST /api/local-settings` で保存するときと、`runHtmlCheckerLocalCompare()` で実行する直前の両方で確かめる。環境変数 `MICHECKER_HTMLCHECKER_EXE` は利用者が自分の PC で設定するものなので、実行の直前の確認だけを当てる。ドライブ文字から始まるパスでも、割り当てたネットワークドライブを指すことはあるので、この確認だけで外部の共有フォルダーを締め出せるわけではない。外からの要求そのものは 1〜3 で止まるので、この確認は、それが破られたときに実行できるものを絞る役目である。

   あわせて、Windows 以外では `POST /api/local-settings` に 404 を返す。GET は、いまの画面が「Windows 以外の環境で動作しています」の説明を出すのに使っているので、200 のまま `isWindows: false` と空のパスを返す。

確かめる処理は、`server.js` から切り出して `lib/` の新しいモジュール（例: `lib/local-guard.js`）に純粋な関数として置く。
CI は Linux で動くので、Windows のパスの確認は、`server.js` を通さずに関数を直接テストする。

変えないものは次のとおりである。

- 画面（`public/`）。
- Cloud Run での待ち受け（`0.0.0.0`）。
- `/api/fetch-html` と `/api/link-title` の、内部のアドレスへ行かない確認。

Windows 版は、変更のマージ後に作り直し、配った担当者に古い `goal2-app.exe` を消して置き換えてもらう。
配った相手の一覧が無ければ、作るときに配り先を記録する。

### 3.3 P1 Cloud Run に共通のパスワードを掛ける

Cloud Run の本番を、全員で共通の1つのパスワードで守る。
仕組みは HTTP の Basic 認証とする。
サーバーがパスワードを求めると、ブラウザーが標準の入力画面を出し、入力した値を以後の要求に自動で付ける。
画面（`public/`）の `fetch()` は同じオリジンなので、ブラウザーが覚えたパスワードがそのまま付き、画面の変更は要らない。
ブラウザーを閉じると、多くの場合もう一度求められる。

決まりは次のとおりである。

1. **パスワードの渡し方。** 環境変数 `APP_PASSWORD` で渡す。Cloud Run では Secret Manager のシークレットから渡し、`--set-env-vars` に平文で書かない。値の前後の空白と改行は除いて使う。PowerShell からシークレットを作ると、末尾に改行が付くためである。そのため、前後の空白はパスワードの一部にできない（パスワードは無作為に作るので困らない）。
2. **確かめる範囲。** `APP_PASSWORD` があるときは、`GET /api/health` を除くすべての要求で確かめる。除くのは、メソッドが GET でパスがちょうど `/api/health` のときだけで、`POST /api/health` や `/api/healthz` などは除かない。ユーザー名は確かめない（空でも何でもよい）。合わなければ 401 と `WWW-Authenticate: Basic realm="a11y-migration-app", charset="UTF-8"` を返す。`Authorization` ヘッダーの形が崩れているとき（`Basic` で始まらない、Base64 として読めない、コロンが無い）も、例外を出さずに 401 を返す。
3. **比べ方。** 送られたパスワードと `APP_PASSWORD` を、それぞれ SHA-256 にしてから `crypto.timingSafeEqual()` で比べる。比べるのにかかる時間から、中身を推し量られないようにするためである。
4. **設定し忘れの守り。** Cloud Run（`K_SERVICE` がある）で `APP_PASSWORD` が無いか16文字より短いときは、`GET /api/health` を除くすべての要求に 503 を返し、起動時にエラーを1行出す。設定し忘れて誰でも開ける状態にならないようにするためと、短いパスワードで総当たりされないようにするためである。
5. **手元では求めない。** Cloud Run 以外（Windows 版、開発、テスト）では、`APP_PASSWORD` が無ければパスワードを求めない。P0 の守りで、同じ PC からしか届かないためである。
6. **記録に残さない。** パスワードと `Authorization` ヘッダーを、ログにも応答にも出さない。ヘッダーを読み損ねたときの例外の内容も、ログに出さない。
7. **別のサイトから起こされた API の要求を止める。** `/api/` で始まる要求（`GET /api/health` を除く）で、`Sec-Fetch-Site` ヘッダーがあり、その値が `same-origin` と `none` のどちらでもなければ 403 を返す。ブラウザーは覚えたパスワードを、別のサイトの画像や iframe が起こした要求にも付けることがある。そのとき、外部のページを取りに行く GET（`/api/fetch-html`、`/api/link-title`）が動いてしまうためである。`Sec-Fetch-Site` は、いまの主なブラウザーがすべての要求に付けるヘッダーで、画面自身の `fetch()` は `same-origin`、アドレス欄に直接打ったときは `none` になる。`same-site` も止める。この API は、同じサイトではなく同じオリジンの画面からだけ使う設計で、同じサイトの別のオリジンから呼ばせる用途が無いためである。あとから同じサイトに別のオリジン（独自ドメインや前段のプロキシなど）が加わっても、パスワードの付いた API を起こさせないようにする。ヘッダーが無い要求（ブラウザー以外の道具やテスト）は通すが、パスワードは要る。この確認は、パスワードの有無にかかわらず、手元の Windows 版でも行う。

Cloud Run の設定（誰でも呼べる `allUsers` の権限と `--allow-unauthenticated`）は変えない。
アプリの前に Google の仕組みを置かず、アプリ自身が確かめるためである。

ブラウザーは覚えたパスワードを、別のサイトから送らされた要求にも付けることがある。
別のサイトからの POST は P0 の確認（`Content-Type` と `Origin`）で止まり、API の GET は 7 の確認で止まる。

パスワードは全員で共通なので、アプリからは誰が使ったかが分からない。
証跡の作業者の欄は、これまでどおり作業者が書く（3.5）。

パスワードを変えるのは、移行チームから人が抜けたときと、漏れたおそれがあるときである。
シークレットに新しい版を足し、その版の番号を指定した新しいリビジョンを作る。
シークレットは `latest` ではなく、版の番号で指定する。
リビジョンごとにパスワードの版が決まるので、どのリビジョンがどのパスワードで動くかがはっきりし、前のリビジョンに戻したときの結果も読める（4章 P1 の8）。

P1 より前のリビジョンには、パスワードを確かめる処理が無い。
そこへトラフィックを戻すと、誰でも開ける状態に戻る。
そのため、P1 を適用したときの最初のリビジョンの名前を控え、それより前には戻さない（4章 P1 の3、5、8）。

手順は 4章 P1 にある。

### 3.4 P2 送信の同意

同意は営業が案件ごとに取り、記録は持たない（1章）。
そのため、アプリは同意を確かめず、止めもしない。

どの提供元に送ったかは、L3 で証跡の JSON のトップに `llm`（提供元とモデル）を足すので、ページごとに残る。
これは同意の記録ではなく、送った事実の記録である。
後から「この自治体のページをどこに送ったか」を問われたときに、証跡から答えられる。

`LLM_DATA_POLICY.md` の最低条件5（同意を得る）は、送信先を Gemini に限らない書き方にし、同意は営業が案件ごとに取ると書き替えた（この設計書と同じ PR）。

同意が得られない案件があり得る場合、作業者がそれを知り、AI を使わずに作業する方法が要る。
いまの Cloud Run は LLM をサーバーの設定で一括して有効にしており、案件ごとに切れない。
案は次の2つである。

| 案 | どうなるか | 手間 |
|---|---|---|
| A. 運用だけで分ける | 営業が案件の開始時に移行チームへ「AI 不可」を伝える。作業者はその案件では、LLM の鍵を入れていない Windows 版を使う | 画面の変更なし。Windows 版は Cloud Run と同じ画面を持つ |
| B. 画面に切り替えを足す | 画面に「この案件では AI を使わない」の切り替えを置き、オンのときは `/api/llm/*` を呼ばない。証跡に切り替えの状態を残す | `public/app.js` と `public/goal1.js` の変更（小） |

同意が得られない案件が無いなら、どちらも要らない。

### 3.5 P2 証跡の置き場所と名前

証跡は共有ドライブに置き、承認者が見る（1章）。
承認者は、移行管理シートの行（旧ページの題名と URL）から証跡を探すので、題名と日時で見つかる名前にする。

**フォルダー**：`<共有ドライブ>/移行証跡/<自治体名>/<サイト区分>/`。サイト区分は、ページ一覧を分けたデザインテンプレートの単位（本体サイト、子育てサイト、観光サイトなど）である。

**ファイル名**：`<日時>_<題名>_<ページの識別>_<種類>.<拡張子>`。

- 日時は `YYYYMMDD-HHMM`（証跡の `generated_at` を日本時間で表したもの）。先頭に置くので、同じページを作り直したときに新しい順に並ぶ。
- 題名は旧ページの題名の先頭30文字。Windows と Google ドライブで使えない文字（`\ / : * ? " < > |`）と改行は `_` に替える。
- ページの識別は、証跡の `page_session_id` の値（`goal2_` と10文字のハッシュ）。題名が同じページを見分ける。
- 種類は `evidence`（証跡）、`final`（最終 HTML）など。

例：`20260925-1430_固定資産評価審査委員会_goal2_3f9a1c07b2_evidence.json`

GOAL1 のバッチは、`<日時>_<バッチID>.json` と `<日時>_<バッチID>-summary.csv` にする。

画面の変更は次の2つで、どれも小さい。

1. Goal 2 に「証跡JSONを保存」ボタンを足す。いまはコピーだけで、作業者が自分でファイルを作っている。
2. Goal 2 の証跡の CSV と、GOAL1 の書き出しのファイル名を、上の決まりに合わせる。

保存期間の決まりは無いので、当面は削除しない。
共有ドライブのメンバーは、移行チームと承認者に絞る。
証跡には、旧ページの HTML の断片と作業者の名前が入るためである。
作業者の欄は、これまでどおり作業者が書く。パスワードは全員で共通なので、アプリからは誰が使ったかが分からないためである（3.3）。

### 3.6 P3 さくらへの切り替え（L3）

手順と変更は `LLM_PROVIDER_SWITCH_INSTRUCTIONS.md` の 4章 L3 のとおりである。
この設計書では、始める条件と、L3 に足すものだけを決める。

始める条件は次の3つである。

- P1 が終わっている。
- L1 の修正（さくらに送るスキーマの `required` を全項目にする）がマージされ、再評価で任意の項目が返るようになっている。
- 人の判定（判定用のページ、2026-09-25 公開）で、文字のタスクの「さくらが良い」と「同等」の合計が 80% 以上である。

L3 に足すものは1つである。
本番（`K_SERVICE` がある）で `LLM_RECORD_DIR` が設定されていたら、書き出しをせず、起動時に警告を1行出す。
評価用の書き出しは入力の全文をディスクに書くので、本番で誤って設定したときに止めるためである。

### 3.7 P4 Node.js を 24 に上げる

上げる先は Node 24 にする。
Node 22 の保守は 2027-04-30 で終わり、1年も残らないためである。
Node 26 は 2026-10-28 に LTS になる予定で、この設計書の時点ではまだ LTS ではない。

変えるものは次のとおりである。

- `Dockerfile` の `node:20-alpine` を `node:24-alpine` にする。
- CI（`.github/workflows/ci.yml`）の `node-version` を `"24"` にする。
- `LOCAL_WINDOWS_APP.md` の「Node.js 20以降」を「Node.js 24以降（LTS）」にする。Windows 版は、作る PC の Node.js を中に含めるので、作る PC の版がそのまま利用者の版になる。
- `PROJECT_CONTEXT.md` の未解決事項の Node 20 の項目を消す。

アプリの依存は0件なので、依存の更新は要らない。
Cloud Run には、トラフィックを流さないタグ付きのリビジョンで先に確かめてから移す（`CLOUD_RUN_DEPLOY.md` の手順）。

## 4. 作業の手順

### P0 手元で動くサーバーの守り（実装担当）

**実装済み（PR #150、2026-09-28）。** 手順の1〜4を行った。5 はレビュー待ち、6 はマージ後にユーザーが行う。
確かめる処理は `lib/local-guard.js` に置き、テストは `test/local-guard/run-local-guard-tests.js`（`npm test` から続けて走る）に置いた。
Windows の実機での確認（5章の最後の3項目）は、まだ行っていない。

設計との差は次の5つである。

- `HOST` が `::1` と `localhost` のときも、`127.0.0.1` と同じく手元だけの待ち受けとして扱い、`Host` ヘッダーを確かめる。どちらも同じ PC からしか届かない口なので、確認を外す理由が無い。
- htmlchecker.exe のパスは、3.2 の条件に加えて、ドライブ文字の後ろのコロン（`C:\tools\htmlchecker.exe:stream` のような代替データストリーム）と制御文字を拒む。`\\?\C:\...` も `\\` で始まるので UNC パスとして拒む。区切りの `/`（`C:/tools/htmlchecker.exe`）は `\` と同じく受け付ける。
- `POST /api/local-settings` で空のパスを送ったときは、設定を消す操作として通す。いまの画面は、入力欄を空にして「保存」を押すと設定を消せるためである。実行の直前には、空のパスはこれまでどおり「設定されていません」で止まる。
- Windows 以外の `GET /api/local-settings` は、パスに加えて `envOverride` も `false` で返す。`true` を返すと、画面が「Windows 以外の環境で動作しています」ではなく環境変数の説明を出すためである。
- `Origin` のホストと `Host` ヘッダーは、ポートを含めた文字列の一致で比べる。`Host` にポートの既定値（`:443` など）を明記する要求は拒まれるが、ブラウザーは既定のポートを書かないので、画面の動きは変わらない。

1. 3.2 の4つの守りを入れる。
2. テストを足す（`test/run-tests.js` か、新しいテストファイル）。
   - `Host` が外部のドメインの要求に 403 を返す（`127.0.0.1` で待ち受けるとき）。
   - `Content-Type: text/plain` の POST に 415 を返す。
   - `Origin` が別のホストの POST に 403 を返す。`Origin` が同じホストか、無い POST は通る。
   - パスの確認の関数が、`C:\tools\miChecker\htmlchecker.exe` を通し、`\\server\share\htmlchecker.exe`、`C:\Windows\System32\cmd.exe`、`htmlchecker.exe`（相対パス）を拒む。
   - Linux では `POST /api/local-settings` が 404 を返し、GET は 200 で `isWindows: false` を返す。
3. 既存のテストがすべて通ることを確かめる（5章）。テストが起動するサーバーは `127.0.0.1` につなぐので、待ち受けを絞っても通るはずである。
4. `LOCAL_WINDOWS_APP.md` に、待ち受けが `127.0.0.1` だけになったこと、別の PC からは開けないことを書く。あわせて、`HOST` を `0.0.0.0` などに変えると同じネットワークの別の機器から届くようになり、1つ目の守りが外れることを書く。`HOST` は、その意味が分かる管理者だけが変える。
5. PR はドラフトで出し、設計・レビュー担当のレビューと Codex の二次レビューを受ける。
6. マージ後、ユーザーが Windows 版を作り直して配り直す。

直した版を配るまでは、ユーザーから担当者へ次を伝える。

- `goal2-app.exe` は使うときだけ起動し、使い終わったら黒い画面を閉じる。
- 起動したときに Windows のファイアウォールが許可を求めたら、許可しない。許可しなくても、同じ PC のブラウザーからは使える。すでに許可した人は、「Windows セキュリティ」の「ファイアウォールとネットワーク保護」の「ファイアウォールによるアプリケーションの許可」から `goal2-app` の許可を外す。
- 起動している間は、作業に関係の無いサイトをできるだけ開かない。

### P1 Cloud Run に共通のパスワードを掛ける

#### 実装（実装担当）

**実装済み（PR #154、2026-09-28）。** 手順の1〜4を行った。5 はレビュー待ちで、「本番への適用」はマージ後にユーザーが行う。
確かめる処理は `lib/app-auth.js` に置き、テストは `test/app-auth/run-app-auth-tests.js`（`npm test` から続けて走る。単独では `npm run test:app-auth`）に置いた。

確かめる順は、`Host`（P0）、`Sec-Fetch-Site`、パスワード、POST の `Content-Type` と `Origin`（P0）とした。理由は次のとおりである。

- `Host` を最初にするのは、DNS リバインディングで届いた要求を、ほかの確認の結果を見せずに止めるためである。
- `Sec-Fetch-Site` をパスワードより先にするのは、別のサイトから起こされた要求に `WWW-Authenticate` を返さず、別のサイトの iframe などでブラウザーがパスワードの入力画面を出さないようにするためである。パスワードが合っていても 403 にする決まりとも合う。
- パスワードを POST の確認より先にするのは、パスワードを知らない要求には、どこで止まったかを見せず一律に 401 を返すためである。

設計との差は次の4つである。

- `Authorization` の `Basic` は、大文字と小文字を区別しない（`basic` も受け付ける）。HTTP の決まり（RFC 7617）で、認証の方式の名前は大文字と小文字を区別しないためである。Base64 は、標準の文字（`A-Z`、`a-z`、`0-9`、`+`、`/`）で、`=` を含めて長さが4の倍数のときだけ読めるものとする。URL 向けの Base64（`-` と `_`）や、`=` を省いた形は、形が崩れているとして 401 にする。ブラウザーは標準の形で送る。
- `Sec-Fetch-Site` の値は、前後の空白を除き、大文字と小文字を区別せずに比べる。値が空のヘッダーは、ヘッダーが無いものとは扱わず 403 にする。
- Cloud Run 以外で `APP_PASSWORD` があるときは、16文字より短くてもそのパスワードを求める。16文字の下限は、3.3 の4のとおり Cloud Run だけに当てる。
- `CLOUD_RUN_DEPLOY.md` の `gcloud run deploy` の行には、`--update-secrets` に加えて `--project=$PROJECT_ID` も付けた。4章 P1 の「本番への適用」と同じく、プロジェクトの取り違えを防ぐためである。あわせて、「よくあるつまずき」にすべての画面が 503 になるときの確かめ方を足した。

1. 3.3 の決まりを入れる。確かめる処理は、`lib/` の新しいモジュール（例: `lib/app-auth.js`）に純粋な関数として置く。
2. `test/server-env.js` で、テストのサーバーに `APP_PASSWORD` と `K_SERVICE` を渡さないようにする。`test/local-guard/` の Cloud Run の場合のテストは、`K_SERVICE` を渡すので、`APP_PASSWORD` も渡すように直す。
3. テストを足す。
   - `APP_PASSWORD` があるとき、パスワードが無い要求と違う要求に、401 と `WWW-Authenticate` を返す。合う要求は通る。ユーザー名が空でも何でも通る。
   - `GET /api/health` は、パスワードが無くても通る。
   - `APP_PASSWORD` の前後の空白と改行を除いて比べる。
   - Cloud Run で `APP_PASSWORD` が無いときと16文字より短いときは、`GET /api/health` 以外に 503 を返す。
   - Cloud Run 以外で `APP_PASSWORD` が無いときは、これまでどおり求めない。
   - 401 と 503 の応答とログに、パスワードが出ない。
   - `Authorization` の形が崩れている要求（`Basic` で始まらない、Base64 として読めない、コロンが無い）に、例外を出さずに 401 を返す。
   - `POST /api/health` と `/api/healthz` は、パスワードを求める側に入る。
   - `Sec-Fetch-Site` が `cross-site` と `same-site` の `GET /api/fetch-html` と `GET /api/link-title` に 403 を返す。パスワードが合っていても 403 にする。`same-origin`、`none`、ヘッダー無しは通る。`GET /api/health` は `cross-site` でも通る。
   - Cloud Run 以外（`APP_PASSWORD` 無し）でも、`Sec-Fetch-Site: cross-site` の `/api/` の要求に 403 を返す。
4. `CLOUD_RUN_DEPLOY.md` の `gcloud run deploy` の行に `--update-secrets="APP_PASSWORD=app-password:<版の番号>"` を足し（`latest` は使わない）、パスワードの作り方、変え方、戻し方の節を足す（下の「本番への適用」の1、2、7、8）。`README.md` の環境変数の一覧に `APP_PASSWORD` を足す。
5. PR はドラフトで出し、設計・レビュー担当のレビューと Codex の二次レビューを受ける。

#### 本番への適用（ユーザー、実装のマージ後）

PowerShell で行う。
`$REGION`、`$SERVICE`、`$IMAGE` は `CLOUD_RUN_DEPLOY.md` と同じものを使う。
プロジェクトを取り違えないよう、最初に `$PROJECT_ID = gcloud config get-value project` を実行し、表示されたプロジェクトが本番のものであることを確かめる。

1. パスワードを作り、シークレットに入れる（初回のみ）。無作為の 24 文字を作り、画面に出さずにそのまま入れる。入れた版の番号を `$PW_VERSION` に控える（初回は `1`）。

   ```powershell
   $bytes = New-Object byte[] 18
   [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
   [Convert]::ToBase64String($bytes) | gcloud secrets create app-password --data-file=- --project=$PROJECT_ID
   $PW_VERSION = gcloud secrets versions list app-password --project=$PROJECT_ID --sort-by="~createTime" --limit=1 --format="value(name.basename())"
   $PW_VERSION
   ```

2. Cloud Run がシークレットを読めるようにする（初回のみ）。サービスアカウントが設定されていないサービスは、既定の Compute Engine のサービスアカウントで動くので、そのときはそれを組み立てる。

   ```powershell
   $SERVICE_ACCOUNT = gcloud run services describe $SERVICE --region $REGION --project=$PROJECT_ID --format="value(spec.template.spec.serviceAccountName)"
   if (-not $SERVICE_ACCOUNT) {
     $PROJECT_NUMBER = gcloud projects describe $PROJECT_ID --format="value(projectNumber)"
     $SERVICE_ACCOUNT = "$PROJECT_NUMBER-compute@developer.gserviceaccount.com"
   }
   $SERVICE_ACCOUNT
   gcloud secrets add-iam-policy-binding app-password --project=$PROJECT_ID --member="serviceAccount:$SERVICE_ACCOUNT" --role="roles/secretmanager.secretAccessor"
   ```

3. いまトラフィックを受けているリビジョンの名前を、「P1 より前の最後のリビジョン」として控える。このリビジョンとそれより前には、あとで戻さない（8）。そのうえで、実装をマージしたあとの main でイメージを作り（`CLOUD_RUN_DEPLOY.md` の手順）、パスワードの版を付けて、トラフィックを流さずにデプロイする。いまの環境変数（Gemini のモデルなど）は、そのまま引き継がれる。

   ```powershell
   gcloud run services describe $SERVICE --region $REGION --project=$PROJECT_ID --format="yaml(status.traffic)"
   gcloud run deploy $SERVICE --image "$IMAGE" --region $REGION --project=$PROJECT_ID --platform managed --port 8080 --memory 512Mi --cpu 1 --allow-unauthenticated --update-secrets="APP_PASSWORD=app-password:$PW_VERSION" --no-traffic --tag pw
   ```

4. 表示されたタグ付きの URL で確かめる。
   - 開くとパスワードの入力画面が出る。ユーザー名は空でよい。
   - 違うパスワードでは、もう一度求められる。
   - 正しいパスワードで画面が出て、1ページを処理すると AI の下書きが入る。
   - `<タグ付きの URL>/api/health` は、パスワード無しで開ける。

5. 問題が無ければ、トラフィックを移す。移したあと、いまトラフィックを受けているリビジョンの名前を、「P1 の最初のリビジョン」として控える。これより前のリビジョンには戻さない。

   ```powershell
   gcloud run services update-traffic $SERVICE --region $REGION --project=$PROJECT_ID --to-latest
   gcloud run services describe $SERVICE --region $REGION --project=$PROJECT_ID --format="yaml(status.traffic)"
   ```

6. 作業者にパスワードを渡す。パスワードは次のコマンドで表示できる。社内で決まった安全な方法で渡し、チャットや共有の文書に平文で残さない。

   ```powershell
   gcloud secrets versions access $PW_VERSION --secret=app-password --project=$PROJECT_ID
   ```

7. パスワードを変えるとき（人が抜けたとき、漏れたおそれがあるとき）は、新しい版を足し、その版を指定した新しいリビジョンを、トラフィックを流さずに作る。タグ付きの URL で、新しいパスワードで開けて古いパスワードでは開けないことを確かめてから、トラフィックを移し、新しいパスワードを配り直す。

   ```powershell
   $OLD_PW_VERSION = $PW_VERSION
   $bytes = New-Object byte[] 18
   [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
   [Convert]::ToBase64String($bytes) | gcloud secrets versions add app-password --data-file=- --project=$PROJECT_ID
   $PW_VERSION = gcloud secrets versions list app-password --project=$PROJECT_ID --sort-by="~createTime" --limit=1 --format="value(name.basename())"
   gcloud run services update $SERVICE --region $REGION --project=$PROJECT_ID --update-secrets="APP_PASSWORD=app-password:$PW_VERSION" --no-traffic --tag "pw$PW_VERSION"
   # タグ付きの URL で確かめてから
   gcloud run services update-traffic $SERVICE --region $REGION --project=$PROJECT_ID --to-latest
   ```

   漏れたおそれがあるときは、トラフィックを移したあとに古い版を無効にする。古い版で動くリビジョンは起動できなくなり、誤ってそこへ戻すこともできなくなる。

   ```powershell
   gcloud secrets versions disable $OLD_PW_VERSION --secret=app-password --project=$PROJECT_ID
   ```

8. 戻し方（問題があったとき）。何を戻したいかで、手順が分かれる。どの場合も、「P1 の最初のリビジョン」より前のリビジョンには戻さない。そこへ戻すと、パスワードを確かめる処理が無く、誰でも開ける状態になるためである。

   - **アプリもパスワードも、前のリビジョンのときに戻す。** トラフィックを前のリビジョンに移す。前のリビジョンは、作ったときの版のパスワードで動く。ただし、その版が有効なときに限る。無効にした版を参照するリビジョンは、新しいインスタンスを起動できないためである。先に、前のリビジョンが参照する版を見て、その版の状態が `ENABLED` であることを確かめる。漏れたために無効にした版は、戻すために有効に戻さない。その場合は、次の「アプリだけを前に戻す」を使う。リビジョンの名前は `gcloud run revisions list --service $SERVICE --region $REGION --project=$PROJECT_ID` で分かる。

     ```powershell
     gcloud run revisions describe <前のリビジョン> --region $REGION --project=$PROJECT_ID --format="yaml(spec.containers[0].env)"
     # 表示された APP_PASSWORD の key(版の番号)について
     gcloud secrets versions describe <版の番号> --secret=app-password --project=$PROJECT_ID --format="value(state)"
     # ENABLED なら
     gcloud run services update-traffic $SERVICE --region $REGION --project=$PROJECT_ID --to-revisions=<前のリビジョン>=100
     ```

   - **パスワードはいまのままで、アプリだけを前に戻す。** 前のリビジョンのイメージを、いまのパスワードの版で、トラフィックを流さずにデプロイし直す。タグ付きの URL で確かめてから、トラフィックを移す。

     ```powershell
     $OLD_IMAGE = gcloud run revisions describe <前のリビジョン> --region $REGION --project=$PROJECT_ID --format="value(spec.containers[0].image)"
     gcloud run deploy $SERVICE --image "$OLD_IMAGE" --region $REGION --project=$PROJECT_ID --platform managed --port 8080 --memory 512Mi --cpu 1 --allow-unauthenticated --update-secrets="APP_PASSWORD=app-password:$PW_VERSION" --no-traffic --tag back
     # タグ付きの URL で確かめてから
     gcloud run services update-traffic $SERVICE --region $REGION --project=$PROJECT_ID --to-latest
     ```

   - **P1 の実装そのものに問題があるとき（正しいパスワードでも開けない、など）。** P1 より前のリビジョンには戻さない。「P1 の最初のリビジョン」以後のどれかで動くなら、上の2つのどちらかで戻す。どれでも動かないなら、パスワードを確かめる処理を直した新しいイメージを、いまのパスワードの版で `--no-traffic --tag` を付けてデプロイし、タグ付きの URL で確かめてからトラフィックを移す。直るまでの間は、画面が使えない状態を受け入れる。

   パスワード無しで誰でも開ける状態に戻すことは、この手順には含めない。そうするしかない事情があっても、画面を止めたままにする場合と比べたうえで、ユーザー（本番の責任者）が決める。

### P2 同意と証跡の運用

1. ユーザーが、共有ドライブの `移行証跡` フォルダーを作り、メンバーを移行チームと承認者に絞る。
2. ユーザーが、同意が得られない案件があり得るかを確かめ、あり得るなら 3.4 の案 A か B を選ぶ。
3. 実装担当が、3.5 の画面の変更の1と2を行う。
4. 実装担当が、`WORKER_GUIDE.md` の証跡の節を、置き場所と名前の決まりに合わせて書き替える。
5. `LLM_DATA_POLICY.md` の最低条件5と未決定事項は、この設計書と同じ PR で1章の決定に合わせた。さくらの約款の要点などは、L3 で書き直す（`LLM_PROVIDER_SWITCH_INSTRUCTIONS.md` 4章 L3）。

### P3 さくらへの切り替え

3.6 の条件がそろってから、`LLM_PROVIDER_SWITCH_INSTRUCTIONS.md` の 4章 L3 に従う。

### P4 Node.js を 24 に上げる（実装担当）

**実装済み（PR #151、2026-09-28）。** 手順の1と2を行った。3 はマージ後にユーザーが行う。
手元の Node 24.21.0 で 5章のコマンドをすべて通した。アプリのコードは変えていない。
Linux の Node 24.21.0 で、`build-windows-app.bat` と同じ SEA の手順（esbuild でまとめ、SEA の blob を作り、postject で入れる）を試し、できた実行ファイルが起動して画面を返すことを確かめた。Windows で `build-windows-app.bat` を動かしての確認は、まだ行っていない。

設計との差は次の2つである。3.7 の一覧に無いが、版を書いている箇所なので合わせて直した。

- `package.json` の `engines.node` を `">=24"` にし、`build-windows-app.bat` の Node.js が無いときの案内を「Node.js 24 or later」にした。CI の「Dockerfile と同じ版で動かす」のコメントも `node:24-alpine` にした。
- `LOCAL_WINDOWS_APP.md` の「すでに他のソフトで Node.js を使っている場合も、通常はそのままで問題ない」を、「`node -v` で版を確かめ、24 より古ければ LTS の版を入れ直す」に替えた。`build-windows-app.bat` は Node.js の有無だけを確かめ、版は確かめないので、古い Node.js のまま作ると古い版の `goal2-app.exe` ができるためである。

1. 3.7 の変更を入れる。
2. 手元の Node 24 で 5章のコマンドを通す。CI でも通ることを確かめる。
3. マージ後、ユーザーが `CLOUD_RUN_DEPLOY.md` の手順で、タグ付きのリビジョンを作って確かめてからトラフィックを移す。

## 5. 検証

P0、P1、P4 では、次を通す。

```
cd goal2-app
node --check server.js
node test/llm/run-llm-tests.js
node test/run-tests.js
node test/local-guard/run-local-guard-tests.js
node test/app-auth/run-app-auth-tests.js
node test/goal2-output/run-output-tests.js
node test/table-nesting/run-table-tests.js
node test/michecker-parity/run-parity-tests.js
cd ..
node scripts/ci/check-tracked-files.js
node scripts/ci/check-kb-build.js
```

佐賀市の fixture がある環境では、`npm run test:saga-gold` も通す。

P0 は、Windows の実機でも次を確かめる。

- `goal2-app.exe` を起動し、同じ PC のブラウザーで画面が開く。
- htmlchecker.exe のパスを保存し、自動比較が動く。
- 同じネットワークの別の PC から `http://<その PC の IP アドレス>:8080/` を開けない。

## 6. 決めてほしいこと

- パスワードを管理する人（作り方、配り方、変える時期を受け持つ人）を1人決める（3.3、4章 P1 の6と7）。
- 同意が得られない案件があり得るか。あり得るなら、3.4 の案 A か B。
- 共有ドライブのフォルダーの形（3.5）で、サイト区分の段を入れるか。案件によってサイトが1つだけなら、段を省いてよい。

## 7. 危険と対策

| 危険 | 対策 |
|---|---|
| パスワードを付けずに新しいイメージをデプロイすると、画面が開けなくなる（503） | タグ付きの URL で先に確かめてから、トラフィックを移す（4章 P1 の3〜5）。戻し方（同じく8）で数分で戻せる |
| パスワードが漏れる、または抜けた人が知っている | 新しいパスワードに変えて配り直す（4章 P1 の7）。変えるまでの間、URL とパスワードを知る人は使える |
| 総当たりでパスワードを当てられる | 無作為の 24 文字を使う（4章 P1 の1）。16文字より短いと、サーバーが受け付けない（3.3 の4） |
| P1 より前のリビジョンに戻すと、誰でも開ける状態に戻る | 「P1 の最初のリビジョン」の名前を控え、それより前には戻さない（3.3、4章 P1 の3、5、8） |
| ブラウザーが覚えたパスワードが、別のサイトから起こされた要求に付く | POST は P0 の確認で、API の GET は `Sec-Fetch-Site` の確認で止める（3.3 の7） |
| 誰が使ったかがアプリから分からない | パスワードは共通なので、証跡の作業者の欄は作業者が書く。必要になったら、IAP など人ごとに確かめる方式に変える |
| 待ち受けを `127.0.0.1` に絞ると、別の PC から Windows 版を使っていた人が使えなくなる | Windows 版は同じ PC で使う前提で配っている（`LOCAL_WINDOWS_APP.md`）。必要な人は `HOST` を設定して起動できる |
| `Content-Type` の確認で、画面以外から API を呼ぶ道具が止まる | 画面の POST（8か所）とテストの POST は、すべて `application/json` で送っている。評価の道具（`tools/llm-provider-eval.js`）は画面を通して要求を作る |
| 証跡の名前の決まりを作業者が守らない | 画面が決まりどおりの名前で保存する（3.5 の画面の変更）。手で名前を付ける場面を減らす |
| 同意の記録が無いため、後から同意の有無を示せない | 送った事実は証跡の `llm` に残る。同意の有無は営業の契約書類に頼る。問われる場面が出たら、記録の方法を決め直す |
| 証跡の保存期間が決まっていない | 当面は削除しない。契約で定めがある案件は、それに従う |

## 8. 用語

- **Basic 認証**：HTTP の標準のパスワードの仕組み。サーバーが求めると、ブラウザーがユーザー名とパスワードの入力画面を出し、入力した値を以後の要求に自動で付ける。
- **IAP**：Identity-Aware Proxy。Google Cloud のサービスの前で Google のログインを求め、許可したアカウントだけを通す機能。当初の P1 で使う予定だったが、2026-09-28 にパスワード制に変えた。
- **タグ付きの URL**：Cloud Run で、トラフィックを流さないリビジョンに付けた名前から作られる URL。切り替え前の確認に使う。
- **待ち受けのアドレス**：サーバーが要求を受け付けるネットワークの口。`127.0.0.1` は同じ PC からの要求だけ、`0.0.0.0` はすべての口からの要求を受け付ける。
- **DNS リバインディング**：外部のドメインの名前を、あとから `127.0.0.1` などに向け直し、ブラウザーに手元のサーバーへ要求を送らせる攻撃。
- **ページの識別**：証跡の `page_session_id`。旧 URL と題名から作るハッシュで、同じページなら同じ値になる。

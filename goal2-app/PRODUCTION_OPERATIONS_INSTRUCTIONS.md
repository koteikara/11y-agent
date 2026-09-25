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

## 1. 前提（ユーザー確定、2026-09-25）

- **Cloud Run は IAP で守る。** 開くと Google のログインを求め、許可したアカウントだけが使える。作業者は会社の Google Workspace のアカウントを持っている。
- **送信の同意は、自治体（案件）ごとに営業が取る。記録は持たない。** アプリは同意の有無を確かめない。
- **証跡は共有ドライブに置き、承認者が見る。** 保存期間の決まりは無い。

次の2点は確かめていない。

- 外部の協力会社の人も Cloud Run を使うか。使うなら、その人のアカウントを個別に足す（4章 P1 の6）。
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
| P1 | Cloud Run に IAP を掛ける | GCP の設定、`CLOUD_RUN_DEPLOY.md` | ユーザー（gcloud の操作） |
| P2 | 同意と証跡の運用 | 運用の決まり、画面の小さな変更 | 決まりはユーザー、画面は実装担当 |
| P3 | さくらへの切り替え（L3） | 本番の設定、画面と証跡の表示 | L3 の設計どおり |
| P4 | Node.js を 24 に上げる | `Dockerfile`、CI、文書 | 実装担当 |

P3 は P1 のあとに行う。
さくらの API キーで費用がかかる呼び出しを、許可した人だけに絞ってから載せるためである。
P4 はいつ行ってもよいが、P0 と同じ PR には入れない。
問題が出たときに、どちらの変更が原因かを分けられるようにするためである。

### 3.2 P0 手元で動くサーバーの守り

2.2 の経路を、次の4つの守りで塞ぐ。
1つが破られても残りが効くように、重ねて入れる。

1. **待ち受けの口を絞る。** 待ち受けのアドレスを環境変数 `HOST` で決める。`HOST` が無いときは、Cloud Run（環境変数 `K_SERVICE` がある）では `0.0.0.0`、それ以外では `127.0.0.1` にする。`Dockerfile` には `ENV HOST=0.0.0.0` を明記する。同じネットワークの別の機器からは届かなくなる。
2. **`Host` ヘッダーを確かめる。** `127.0.0.1` で待ち受けるときは、`Host` が `localhost:<port>`、`127.0.0.1:<port>`、`[::1]:<port>` のどれかでなければ 403 を返す。GET も含むすべての要求で確かめる。外部のドメインの名前を `127.0.0.1` に向ける攻撃（DNS リバインディング）では `Host` が外部のドメインになるので、ここで止まる。
3. **POST の送り元を確かめる。** すべての POST で、`Content-Type` のメディアタイプが `application/json` でなければ 415 を返す（`; charset=utf-8` などの付加は許す）。`Origin` ヘッダーがあるときは、そのホストが `Host` ヘッダーと一致しなければ 403 を返す。`Content-Type: application/json` の要求は、別のサイトからはブラウザーの事前確認を経ないと送れず、サーバーは事前確認に許可を返さないので、ブラウザーが送らない。画面の POST はすべて `application/json` で送っているので、画面の動きは変わらない。この確認は Cloud Run でも行う。
4. **htmlchecker.exe のパスを確かめる。** パスは、ドライブ文字から始まる絶対パスで、UNC パスでなく、ファイル名が `htmlchecker.exe`（大文字と小文字を区別しない）のときだけ受け付ける。`POST /api/local-settings` で保存するときと、`runHtmlCheckerLocalCompare()` で実行する直前の両方で確かめる。環境変数 `MICHECKER_HTMLCHECKER_EXE` は利用者が自分の PC で設定するものなので、実行の直前の確認だけを当てる。あわせて、Windows 以外では `/api/local-settings` の GET と POST に 404 を返す。

確かめる処理は、`server.js` から切り出して `lib/` の新しいモジュール（例: `lib/local-guard.js`）に純粋な関数として置く。
CI は Linux で動くので、Windows のパスの確認は、`server.js` を通さずに関数を直接テストする。

変えないものは次のとおりである。

- 画面（`public/`）。
- Cloud Run での待ち受け（`0.0.0.0`）。
- `/api/fetch-html` と `/api/link-title` の、内部のアドレスへ行かない確認。

Windows 版は、変更のマージ後に作り直し、配った担当者に古い `goal2-app.exe` を消して置き換えてもらう。
配った相手の一覧が無ければ、作るときに配り先を記録する。

### 3.3 P1 Cloud Run に IAP を掛ける

IAP（Identity-Aware Proxy）は、Cloud Run の前で Google のログインを求め、許可したアカウントの要求だけを通す Google Cloud の機能である。
Cloud Run に直接掛けられ、`run.app` の URL を含むすべての入口に効く（Google Cloud の文書「Configure IAP for Cloud Run」）。タグ付きの URL も `run.app` のドメインにあるので同じく守られるはずだが、文書には明記が無いため、4章 P1 の8で確かめる。
アプリのコードは変えない。

画面と API は同じオリジンなので、ログイン後の `fetch()` はそのまま通る。
IAP のセッションは Google のログインに結び付いていて、作業者が Google からログアウトしない限り続く（同じく「Managing IAP sessions」）。
初めて開くときだけ、Google のログインと、身元を渡すことへの同意の画面が出る。

使える人の単位は2つある。

- **ドメイン**（`domain:<会社のドメイン>`）：会社の Workspace の全員が使える。設定が1回で済む。
- **グループ**（`group:<グループのアドレス>`）：移行チームのグループに入っている人だけが使える。人の出入りをグループで管理できる。

移行チームのグループがあれば、グループを勧める。
画面に案件の HTML を貼る人を、移行に関わる人に絞れるためである。

手順は 4章 P1 にある。

### 3.4 P2 送信の同意

同意は営業が案件ごとに取り、記録は持たない（1章）。
そのため、アプリは同意を確かめず、止めもしない。

どの提供元に送ったかは、L3 で証跡の JSON のトップに `llm`（提供元とモデル）を足すので、ページごとに残る。
これは同意の記録ではなく、送った事実の記録である。
後から「この自治体のページをどこに送ったか」を問われたときに、証跡から答えられる。

`LLM_DATA_POLICY.md` の最低条件5（同意を得る）は、「営業が案件ごとに取る」に書き替える。

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

画面の変更は次の3つで、どれも小さい。

1. Goal 2 に「証跡JSONを保存」ボタンを足す。いまはコピーだけで、作業者が自分でファイルを作っている。
2. Goal 2 の証跡の CSV と、GOAL1 の書き出しのファイル名を、上の決まりに合わせる。
3. P1 のあと、「作業者」欄の既定値を、ログインしたアカウントのメールアドレスにする。サーバーに `GET /api/whoami` を足し、IAP が付ける `X-Goog-Authenticated-User-Email` ヘッダー（値は `accounts.google.com:<メールアドレス>`）からメールアドレスを返す。この値は欄の既定値にだけ使い、権限の判断には使わない。IAP の文書は、身元を権限の判断に使うなら署名付きの `x-goog-iap-jwt-assertion` ヘッダーを検証するよう求めている。作業者は欄を書き替えられる。ヘッダーが無いとき（Windows 版、IAP の無い環境）は、いまの `worker-001` のままにする。

保存期間の決まりは無いので、当面は削除しない。
共有ドライブのメンバーは、移行チームと承認者に絞る。
証跡には、旧ページの HTML の断片と作業者の名前（3 のあとはメールアドレス）が入るためである。

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

1. 3.2 の4つの守りを入れる。
2. テストを足す（`test/run-tests.js` か、新しいテストファイル）。
   - `Host` が外部のドメインの要求に 403 を返す（`127.0.0.1` で待ち受けるとき）。
   - `Content-Type: text/plain` の POST に 415 を返す。
   - `Origin` が別のホストの POST に 403 を返す。`Origin` が同じホストか、無い POST は通る。
   - パスの確認の関数が、`C:\tools\miChecker\htmlchecker.exe` を通し、`\\server\share\htmlchecker.exe`、`C:\Windows\System32\cmd.exe`、`htmlchecker.exe`（相対パス）を拒む。
   - Linux では `/api/local-settings` が 404 を返す。
3. 既存のテストがすべて通ることを確かめる（5章）。テストが起動するサーバーは `127.0.0.1` につなぐので、待ち受けを絞っても通るはずである。
4. `LOCAL_WINDOWS_APP.md` に、待ち受けが `127.0.0.1` だけになったこと、別の PC からは開けないことを書く。
5. PR はドラフトで出し、設計・レビュー担当のレビューと Codex の二次レビューを受ける。
6. マージ後、ユーザーが Windows 版を作り直して配り直す。

直した版を配るまでは、ユーザーから担当者へ次を伝える。

- `goal2-app.exe` は使うときだけ起動し、使い終わったら黒い画面を閉じる。
- 起動したときに Windows のファイアウォールが許可を求めたら、許可しない。許可しなくても、同じ PC のブラウザーからは使える。すでに許可した人は、「Windows セキュリティ」の「ファイアウォールとネットワーク保護」の「ファイアウォールによるアプリケーションの許可」から `goal2-app` の許可を外す。
- 起動している間は、作業に関係の無いサイトをできるだけ開かない。

### P1 Cloud Run に IAP を掛ける（ユーザー）

PowerShell で行う。
`$SERVICE`、`$REGION`、`$PROJECT_ID` は `CLOUD_RUN_DEPLOY.md` と同じものを使う。

1. プロジェクトが会社の組織に属しているかを確かめる。

   ```powershell
   gcloud projects describe $PROJECT_ID --format="value(parent.type,parent.id)"
   ```

   `organization` か `folder` と表示されれば、組織の中の手順で進められる。
   何も表示されなければ、プロジェクトは組織に属していない。その場合は、IAP を初めて有効にする操作を Google Cloud コンソールで行う（Cloud Run のサービスの「セキュリティ」タブで「認証が必要」と「Identity-Aware Proxy (IAP)」を選ぶ）。コンソールから行うと、必要な OAuth の設定が自動で作られる。

2. IAP の API を有効にする。

   ```powershell
   gcloud services enable iap.googleapis.com
   ```

3. サービスに IAP を掛ける。操作する人には、プロジェクトの Cloud Run 管理者（`roles/run.admin`）と IAP ポリシー管理者（`roles/iap.admin`）の役割が要る。プロジェクトのオーナーなら持っている。

   ```powershell
   gcloud run services update $SERVICE --region $REGION --iap
   ```

4. IAP が Cloud Run を呼べるようにする。

   ```powershell
   $PROJECT_NUMBER = gcloud projects describe $PROJECT_ID --format="value(projectNumber)"
   gcloud run services add-iam-policy-binding $SERVICE --region $REGION `
     --member="serviceAccount:service-$PROJECT_NUMBER@gcp-sa-iap.iam.gserviceaccount.com" `
     --role="roles/run.invoker"
   ```

5. 使える人を登録する。グループを使う場合は `group:<グループのアドレス>`、ドメイン全体なら `domain:<会社のドメイン>` にする（3.3）。

   ```powershell
   gcloud iap web add-iam-policy-binding `
     --member="group:<グループのアドレス>" `
     --role="roles/iap.httpsResourceAccessor" `
     --region=$REGION --resource-type=cloud-run --service=$SERVICE
   ```

6. 外部の協力会社の人を足す場合は、その人のアカウントを `user:<メールアドレス>` で登録する。会社の組織の外のアカウントを登録するには、先に OAuth の同意画面（対象は「外部」）の設定が要る。コンソールの IAP の画面から「Configure consent screen」で設定する。

7. 誰でも呼べる設定を外す。IAP を誤って外したときに、画面が誰にでも開いてしまわないようにするためである。

   ```powershell
   gcloud run services remove-iam-policy-binding $SERVICE --region $REGION `
     --member="allUsers" --role="roles/run.invoker"
   ```

8. 確かめる。
   - `gcloud run services describe $SERVICE --region $REGION` の出力に `Iap Enabled: true` がある。
   - ブラウザーのシークレットウィンドウで本番の URL を開くと、Google のログインを求められる。会社のアカウントでログインすると画面が出る。
   - 登録していないアカウント（個人の Gmail など）でログインすると、画面が出ない。
   - タグ付きの URL（例: `gemini35` のタグ）も、同じくログインを求められる。
   - 画面で1ページを処理し、AI の下書きが入る。

9. 戻し方（問題があったとき）。

   ```powershell
   gcloud run services update $SERVICE --region $REGION --no-iap
   gcloud run services add-iam-policy-binding $SERVICE --region $REGION `
     --member="allUsers" --role="roles/run.invoker"
   ```

10. `CLOUD_RUN_DEPLOY.md` の `gcloud run deploy` の行から `--allow-unauthenticated` を外し、`--no-allow-unauthenticated --iap` を付ける。IAP を掛けた日と、使える人の単位（グループかドメインか）を記録する。この文書の変更は、実装担当に頼んでもよい。

### P2 同意と証跡の運用

1. ユーザーが、共有ドライブの `移行証跡` フォルダーを作り、メンバーを移行チームと承認者に絞る。
2. ユーザーが、同意が得られない案件があり得るかを確かめ、あり得るなら 3.4 の案 A か B を選ぶ。
3. 実装担当が、3.5 の画面の変更の1と2を行う。3 は P1 のあとに行う。
4. 実装担当が、`WORKER_GUIDE.md` の証跡の節を、置き場所と名前の決まりに合わせて書き替える。
5. 実装担当が、`LLM_DATA_POLICY.md` の最低条件5と未決定事項を、1章の決定に合わせて書き替える。

### P3 さくらへの切り替え

3.6 の条件がそろってから、`LLM_PROVIDER_SWITCH_INSTRUCTIONS.md` の 4章 L3 に従う。

### P4 Node.js を 24 に上げる（実装担当）

1. 3.7 の変更を入れる。
2. 手元の Node 24 で 5章のコマンドを通す。CI でも通ることを確かめる。
3. マージ後、ユーザーが `CLOUD_RUN_DEPLOY.md` の手順で、タグ付きのリビジョンを作って確かめてからトラフィックを移す。

## 5. 検証

P0 と P4 では、次を通す。

```
cd goal2-app
node --check server.js
node test/llm/run-llm-tests.js
node test/run-tests.js
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

- IAP で使える人の単位（移行チームのグループか、会社のドメイン全体か）。グループがあればグループを勧める（3.3）。
- 外部の協力会社の人も使うか（1章）。
- 同意が得られない案件があり得るか。あり得るなら、3.4 の案 A か B。
- 共有ドライブのフォルダーの形（3.5）で、サイト区分の段を入れるか。案件によってサイトが1つだけなら、段を省いてよい。

## 7. 危険と対策

| 危険 | 対策 |
|---|---|
| IAP を掛けた直後に、作業者が画面を開けなくなる | 先に操作する人のアカウントで確かめる。戻し方（4章 P1 の9）で数分で戻せる |
| 待ち受けを `127.0.0.1` に絞ると、別の PC から Windows 版を使っていた人が使えなくなる | Windows 版は同じ PC で使う前提で配っている（`LOCAL_WINDOWS_APP.md`）。必要な人は `HOST` を設定して起動できる |
| `Content-Type` の確認で、画面以外から API を呼ぶ道具が止まる | 画面の POST（8か所）とテストの POST は、すべて `application/json` で送っている。評価の道具（`tools/llm-provider-eval.js`）は画面を通して要求を作る |
| 証跡の名前の決まりを作業者が守らない | 画面が決まりどおりの名前で保存する（3.5 の画面の変更）。手で名前を付ける場面を減らす |
| 同意の記録が無いため、後から同意の有無を示せない | 送った事実は証跡の `llm` に残る。同意の有無は営業の契約書類に頼る。問われる場面が出たら、記録の方法を決め直す |
| 証跡の保存期間が決まっていない | 当面は削除しない。契約で定めがある案件は、それに従う |

## 8. 用語

- **IAP**：Identity-Aware Proxy。Google Cloud のサービスの前で Google のログインを求め、許可したアカウントだけを通す機能。
- **タグ付きの URL**：Cloud Run で、トラフィックを流さないリビジョンに付けた名前から作られる URL。切り替え前の確認に使う。
- **待ち受けのアドレス**：サーバーが要求を受け付けるネットワークの口。`127.0.0.1` は同じ PC からの要求だけ、`0.0.0.0` はすべての口からの要求を受け付ける。
- **DNS リバインディング**：外部のドメインの名前を、あとから `127.0.0.1` などに向け直し、ブラウザーに手元のサーバーへ要求を送らせる攻撃。
- **ページの識別**：証跡の `page_session_id`。旧 URL と題名から作るハッシュで、同じページなら同じ値になる。

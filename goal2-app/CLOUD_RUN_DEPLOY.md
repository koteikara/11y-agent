# Cloud Run デプロイ手順

`goal2-app` を Google Cloud Run に更新デプロイするための短い手順です。

公開URL(Goal 2):

```text
https://goal2-a11y-review-700549743482.asia-northeast1.run.app/
```

公開URL(Goal 3):

```text
https://goal2-a11y-review-700549743482.asia-northeast1.run.app/goal3.html
```

## Goal 2とGoal 3は同じサービス・同じデプロイで反映される

Goal 2(`/`)とGoal 3(`/goal3.html`)は、別々のアプリ・別々のCloud Runサービスではなく、`goal2-app` 1つのNode.jsサーバー(`server.js`)から配信されている。`Dockerfile` は `public/` フォルダ全体(`index.html`、`goal3.html`、`goal3.js`、`app.js`、`styles.css` などすべて)をコンテナへコピーするため、下記の「更新デプロイ」を1回実行すれば、Goal 2・Goal 3の両方の変更が同時に反映される。Goal 3だけを個別にビルド・デプロイする手順は存在しない。

## 前提

- 開発もデプロイも、手元の作業フォルダ `D:\Codex\11y-agent-deploy` の `main` で行う(2026-10-04 から。それまでは GitHub の `main` をデプロイ専用のフォルダへ同期していた)
- GitHub リポジトリ `koteikara/11y-agent` はバックアップとして使う。変更は `main` にコミットし、そのまま `git push origin main` する
- デプロイするのは、コミットして GitHub へ push 済みの `main` だけにする。画面右下の `build:` 表示のコミットIDを GitHub の履歴で引けるようにするためである
- デプロイ先サービス名は `goal2-a11y-review`
- リージョンは `asia-northeast1`
- コンテナポートは `8080`

## 更新デプロイ

PowerShell で、次の2つの段に分けて実行します。

### 1. 送る内容を確かめる

`gcloud builds submit` は、コミットしていない変更も含めて `goal2-app` フォルダの中身をそのまま送ります。
そのため、デプロイの前に、手元の `main` がコミット済みで、GitHub の `main` と同じであることを確かめます。

```powershell
$WORKDIR = "D:\Codex\11y-agent-deploy"
cd $WORKDIR

git fetch origin main              # エラーが出たら進まない
git branch --show-current          # main と出ること
git status --porcelain             # 何も出ないこと
git rev-parse HEAD origin/main     # 同じ値が2行出ること
```

`git fetch` が失敗すると `origin/main` が古いままになり、確認が通ってしまいます。
fetch がエラーを出したときと、3つのどれかが違うときは、デプロイに進みません。

- ブランチが `main` でない: `git switch main` で戻す
- `git status --porcelain` に何か出る: コミットするか、要らない変更なら取り消す
- 2行の値が違う: 手元が進んでいれば `git push origin main`、GitHub が進んでいれば `git pull --ff-only` で揃える

### 2. ビルドしてデプロイする

```powershell
cd "$WORKDIR\goal2-app"

$PROJECT_ID = gcloud config get-value project
$REGION = "asia-northeast1"
$SERVICE = "goal2-a11y-review"
$REPO = "goal2-app"
$TAG = Get-Date -Format "yyyyMMdd-HHmmss"
$IMAGE = "${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO}/${SERVICE}:${TAG}"

# 画面右下に表示するバージョン表示用。デプロイ元のコミット・デプロイ日時をpublic/build-info.jsonへ
# 書き出し、Dockerイメージへ静的ファイルとして含める(server.js側の変更は不要)。
@{
  commit      = (git rev-parse HEAD)
  commitShort = (git rev-parse --short HEAD)
  commitDate  = (git log -1 --format=%cI)
  deployedAt  = (Get-Date).ToString("o")
} | ConvertTo-Json | Set-Content -Path "public/build-info.json" -Encoding utf8

# 共通のパスワードの版の番号。いまのリビジョンが使っている版を指定する(latest は使わない)。
# いまの版は、次の表示の APP_PASSWORD の key で分かる。
# gcloud run services describe $SERVICE --region $REGION --project=$PROJECT_ID --format="yaml(spec.template.spec.containers[0].env)"
$PW_VERSION = "<版の番号>"

gcloud builds submit --tag "$IMAGE" .
gcloud run deploy $SERVICE --image "$IMAGE" --region $REGION --project=$PROJECT_ID --platform managed --port 8080 --memory 512Mi --cpu 1 --allow-unauthenticated --update-secrets="APP_PASSWORD=app-password:$PW_VERSION"

# 手元の node server.js で古い build: 表示が出ないよう、作ったファイルを消す
Remove-Item public/build-info.json
```

`APP_PASSWORD` が無いイメージを Cloud Run で動かすと、画面も API も 503 になります(`GET /api/health` だけは開けます)。
シークレット `app-password` をまだ作っていないときは、先に下の「共通のパスワード」の1と2を行います。

デプロイ後、公開URLを開くと画面右下に `build: <コミットの短縮ID> (デプロイ日時)` という小さな表示が出ます。これで、今開いている画面が最新のデプロイを反映しているか(＝GitHubの最新コミットと一致するか)を一目で確認できます。手元の `node server.js` では、デプロイの最後に `public/build-info.json` を消すので、この表示は出ません(表示が無い=手元、という目印にもなります)。

`public/build-info.json` はデプロイのたびに作り直す生成物なので、`.gitignore` で無視しています。

変更を本番に出す前に試したいときも、先にコミットして push します。
そのうえで `gcloud run deploy` に `--no-traffic --tag <名前>` を付け、トラフィックを流さないリビジョンを作ってタグ付きの URL で確かめてから、`gcloud run services update-traffic $SERVICE --region $REGION --project=$PROJECT_ID --to-latest` で移します。

## 反映確認

デプロイ後も URL は変わりません。次の2つの公開URLを両方とも開いて確認します(Goal 2のみ確認してGoal 3の確認を忘れないよう注意する)。

```text
https://goal2-a11y-review-700549743482.asia-northeast1.run.app/
https://goal2-a11y-review-700549743482.asia-northeast1.run.app/goal3.html
```

開くとブラウザーがパスワードを求めます。ユーザー名は空のままでよく、パスワードに共通のパスワードを入れます。

画面右下の `build:` 表示のコミットIDが、GitHubの `main` ブランチの最新コミット([コミット履歴](https://github.com/koteikara/11y-agent/commits/main))と一致しているかを確認すると、目的の変更が反映されているか一目で分かります。

反映されないときは次を確認します。

- `gcloud builds submit` が成功しているか
- `gcloud run deploy` が成功しているか
- ブラウザのキャッシュが残っていないか
- Cloud Run の最新リビジョンに 100% のトラフィックがあるか
- 画面右下の `build:` 表示のコミットIDが古いままでないか(古い場合は、手元の `main` が最新でないままデプロイした可能性がある。「1. 送る内容を確かめる」からやり直す)

## 共通のパスワード

Cloud Run の画面と API は、全員で共通の1つのパスワードで守っています(HTTP の Basic 認証)。
パスワードは Secret Manager のシークレット `app-password` に入れ、環境変数 `APP_PASSWORD` としてリビジョンに渡します。
`--set-env-vars` に平文で書かず、シークレットは `latest` ではなく版の番号で指定します。
リビジョンごとにパスワードの版が決まるので、どのリビジョンがどのパスワードで動くかがはっきりし、前のリビジョンに戻したときの結果も読めるためです。

アプリは次のとおりに動きます。設計は [PRODUCTION_OPERATIONS_INSTRUCTIONS.md](PRODUCTION_OPERATIONS_INSTRUCTIONS.md) の 3.3 にあります。

- `GET /api/health` を除くすべての要求でパスワードを確かめ、合わなければ 401 を返してブラウザーにパスワードを求めさせる。ユーザー名は確かめない。
- `APP_PASSWORD` の前後の空白と改行は除いて使う。PowerShell からシークレットを作ると、末尾に改行が付くためである。
- Cloud Run で `APP_PASSWORD` が無いか16文字より短いときは、`GET /api/health` 以外に 503 を返し、起動時にログへエラーを1行出す。

**P1 を適用したときの最初のリビジョン(「P1 の最初のリビジョン」)より前のリビジョンには、トラフィックを戻しません。**
そこにはパスワードを確かめる処理が無く、戻すと誰でも開ける状態になるためです。
適用のときに控えたリビジョンの名前は `memory/project-state.md` に記録します。

以下は PowerShell で行います。
`$REGION`、`$SERVICE`、`$IMAGE` は上の「更新デプロイ」と同じものを使います。
プロジェクトを取り違えないよう、最初に `$PROJECT_ID = gcloud config get-value project` を実行し、表示されたプロジェクトが本番のものであることを確かめます。
初めて適用するときの全体の流れ(トラフィックを流さないリビジョンで確かめてから移す手順)は、設計書の 4章 P1 の「本番への適用」にあります。

### パスワードを作る(初回のみ)

無作為の 24 文字を作り、画面に出さずにそのままシークレットに入れます。
入れた版の番号を `$PW_VERSION` に控えます(初回は `1`)。

```powershell
$bytes = New-Object byte[] 18
[Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
[Convert]::ToBase64String($bytes) | gcloud secrets create app-password --data-file=- --project=$PROJECT_ID
$PW_VERSION = gcloud secrets versions list app-password --project=$PROJECT_ID --sort-by="~createTime" --limit=1 --format="value(name.basename())"
$PW_VERSION
```

### Cloud Run がシークレットを読めるようにする(初回のみ)

サービスアカウントが設定されていないサービスは、既定の Compute Engine のサービスアカウントで動くので、そのときはそれを組み立てます。

```powershell
$SERVICE_ACCOUNT = gcloud run services describe $SERVICE --region $REGION --project=$PROJECT_ID --format="value(spec.template.spec.serviceAccountName)"
if (-not $SERVICE_ACCOUNT) {
  $PROJECT_NUMBER = gcloud projects describe $PROJECT_ID --format="value(projectNumber)"
  $SERVICE_ACCOUNT = "$PROJECT_NUMBER-compute@developer.gserviceaccount.com"
}
$SERVICE_ACCOUNT
gcloud secrets add-iam-policy-binding app-password --project=$PROJECT_ID --member="serviceAccount:$SERVICE_ACCOUNT" --role="roles/secretmanager.secretAccessor"
```

### パスワードを変える

移行チームから人が抜けたときと、漏れたおそれがあるときに変えます。
新しい版を足し、その版を指定した新しいリビジョンを、トラフィックを流さずに作ります。
タグ付きの URL で、新しいパスワードで開けて古いパスワードでは開けないことを確かめてから、トラフィックを移し、新しいパスワードを配り直します。

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

漏れたおそれがあるときは、トラフィックを移したあとに古い版を無効にします。
古い版で動くリビジョンは起動できなくなり、誤ってそこへ戻すこともできなくなります。

```powershell
gcloud secrets versions disable $OLD_PW_VERSION --secret=app-password --project=$PROJECT_ID
```

パスワードは次のコマンドで表示できます。
社内で決まった安全な方法で作業者に渡し、チャットや共有の文書に平文で残しません。

```powershell
gcloud secrets versions access $PW_VERSION --secret=app-password --project=$PROJECT_ID
```

### 戻す

何を戻したいかで、手順が分かれます。
どの場合も、「P1 の最初のリビジョン」より前のリビジョンには戻しません。

**アプリもパスワードも、前のリビジョンのときに戻す。**
トラフィックを前のリビジョンに移します。
前のリビジョンは、作ったときの版のパスワードで動きます。
ただし、その版が有効なときに限ります。無効にした版を参照するリビジョンは、新しいインスタンスを起動できないためです。
先に、前のリビジョンが参照する版を見て、その版の状態が `ENABLED` であることを確かめます。
漏れたために無効にした版は、戻すために有効に戻しません。その場合は、次の「アプリだけを前に戻す」を使います。
リビジョンの名前は `gcloud run revisions list --service $SERVICE --region $REGION --project=$PROJECT_ID` で分かります。

```powershell
gcloud run revisions describe <前のリビジョン> --region $REGION --project=$PROJECT_ID --format="yaml(spec.containers[0].env)"
# 表示された APP_PASSWORD の key(版の番号)について
gcloud secrets versions describe <版の番号> --secret=app-password --project=$PROJECT_ID --format="value(state)"
# ENABLED なら
gcloud run services update-traffic $SERVICE --region $REGION --project=$PROJECT_ID --to-revisions=<前のリビジョン>=100
```

**パスワードはいまのままで、アプリだけを前に戻す。**
前のリビジョンのイメージを、いまのパスワードの版で、トラフィックを流さずにデプロイし直します。
タグ付きの URL で確かめてから、トラフィックを移します。

```powershell
$OLD_IMAGE = gcloud run revisions describe <前のリビジョン> --region $REGION --project=$PROJECT_ID --format="value(spec.containers[0].image)"
gcloud run deploy $SERVICE --image "$OLD_IMAGE" --region $REGION --project=$PROJECT_ID --platform managed --port 8080 --memory 512Mi --cpu 1 --allow-unauthenticated --update-secrets="APP_PASSWORD=app-password:$PW_VERSION" --no-traffic --tag back
# タグ付きの URL で確かめてから
gcloud run services update-traffic $SERVICE --region $REGION --project=$PROJECT_ID --to-latest
```

**パスワードを確かめる処理そのものに問題があるとき(正しいパスワードでも開けない、など)。**
P1 より前のリビジョンには戻しません。
「P1 の最初のリビジョン」以後のどれかで動くなら、上の2つのどちらかで戻します。
どれでも動かないなら、処理を直した新しいイメージを、いまのパスワードの版で `--no-traffic --tag` を付けてデプロイし、タグ付きの URL で確かめてからトラフィックを移します。
直るまでの間は、画面が使えない状態を受け入れます。

パスワード無しで誰でも開ける状態に戻すことは、この手順に含めません。
そうするしかない事情があっても、画面を止めたままにする場合と比べたうえで、本番の責任者が決めます。

## LLM (Gemini) 連携を有効にする場合

既定では `GEMINI_API_KEY` が未設定のため、LLM連携は無効(呼び出しなし・課金なし)のままデプロイされる。有効にする場合のみ、以下のいずれかを行う。各環境変数の意味は [README.md](README.md#llm-gemini-連携) を参照。

### APIキー方式(Secret Manager経由を推奨)

```powershell
# 1回だけ: シークレットを作成してキーを登録
echo "ここに実際のAPIキー" | gcloud secrets create gemini-api-key --data-file=-

# デプロイ時にシークレットをそのまま環境変数として注入する(平文でコマンド履歴に残さない)
gcloud run deploy $SERVICE --image "$IMAGE" --region $REGION --platform managed --port 8080 --memory 512Mi --cpu 1 --allow-unauthenticated `
  --update-secrets="GEMINI_API_KEY=gemini-api-key:latest"
```

APIキーを直接 `--set-env-vars` に書くとコマンド履歴・Cloud Runのリビジョン設定に平文で残るため避ける。

### ADC/Vertex AI方式(APIキー不要)

```powershell
# 1. プロジェクトでVertex AI APIを有効化(初回のみ)
gcloud services enable aiplatform.googleapis.com

# 2. Cloud RunサービスアカウントにVertex AI呼び出し権限を付与(初回のみ)
$PROJECT_ID = gcloud config get-value project
$SERVICE_ACCOUNT = gcloud run services describe $SERVICE --region $REGION --format="value(spec.template.spec.serviceAccountName)"
gcloud projects add-iam-policy-binding $PROJECT_ID --member="serviceAccount:$SERVICE_ACCOUNT" --role="roles/aiplatform.user"

# 3. デプロイ時にADCモードを指定
gcloud run deploy $SERVICE --image "$IMAGE" --region $REGION --platform managed --port 8080 --memory 512Mi --cpu 1 --allow-unauthenticated `
  --set-env-vars="GEMINI_AUTH_MODE=adc,GEMINI_VERTEX_PROJECT=$PROJECT_ID,GEMINI_VERTEX_LOCATION=asia-northeast1"
```

`GEMINI_VERTEX_LOCATION` はVertex AI Gemini APIが提供されているリージョンを指定する(未対応リージョンだとエラーになる場合はいったん `us-central1` を試す)。

いずれの方式でも、有効化後は実際に候補生成を実行し、画面上のコスト概算表示が出ること・候補の内容がLLMで改善されていること(`(AI判定)`等の注記が付く)を確認する。

### さくらの AI Engine を使う場合

本番を切り替えるのは評価(設計書 [LLM_PROVIDER_SWITCH_INSTRUCTIONS.md](LLM_PROVIDER_SWITCH_INSTRUCTIONS.md) の L2)のあとである。
トークンはシークレットにして渡し、`--set-env-vars` に平文で書かない。

```powershell
# 1回だけ: シークレットを作成してトークンを登録
echo "ここに実際のトークン" | gcloud secrets create sakura-ai-api-key --data-file=-

gcloud run services update $SERVICE --region $REGION `
  --update-secrets="SAKURA_AI_API_KEY=sakura-ai-api-key:latest" `
  --update-env-vars="LLM_TEXT_PROVIDER=sakura,LLM_FALLBACK_PROVIDER=gemini" `
  --no-traffic --tag sakura
```

各変数の意味は [README.md](README.md#提供元の切り替えさくらの-ai-engine) を参照。
評価用の書き出し `LLM_RECORD_DIR` は、本番の Cloud Run には設定しない。

### gemini-2.5-flash の廃止(2026-10-20)に向けたつなぎの設定

Vertex AI の `gemini-2.5-flash` は 2026-10-20 に廃止される。
本番は `GEMINI_AUTH_MODE=adc`、`GEMINI_VERTEX_LOCATION=asia-northeast1` で、`GEMINI_MODEL` を設定していないので、このままだと AI の下書きがその日に止まる(画面はルールベースの案で作業を続けられる)。
次の3案から選ぶ。推奨は案 A である。
2026-09-25 に案 A を本番に適用した(リビジョン `goal2-a11y-review-00094-sev`、戻し先 `goal2-a11y-review-00093-7gf`。記録は `memory/project-state.md`)。案の比べ方は [README.md](README.md#gemini-25-flash-の廃止2026-10-20に向けたつなぎの設定) を参照。

どの案でも、トラフィックを流さない新しいリビジョンで先に確かめてから切り替える。

1. 設定を替えたリビジョンを、トラフィックを流さずタグ付きで作る。
2. 表示されたタグ付きの URL を開き、画像と見出しのあるページを数件処理する。AI の下書きが入ること、代替テキストや見出しの文言に繰り返しや崩れが無いことを見る。
3. 問題が無ければ、トラフィックを新しいリビジョンへ移す。

   ```powershell
   gcloud run services update-traffic $SERVICE --region $REGION --to-latest
   ```

#### 案 A: 東京のまま gemini-3.5-flash に替える

```powershell
gcloud run services update $SERVICE --region $REGION `
  --update-env-vars="GEMINI_MODEL=gemini-3.5-flash,GEMINI_TEMPERATURE=1,GEMINI_INPUT_PRICE_PER_1M_TOKENS=1.65,GEMINI_OUTPUT_PRICE_PER_1M_TOKENS=9.9" `
  --no-traffic --tag gemini35
```

`GEMINI_TEMPERATURE` は、2026-09-24 の変更を含む版でないと効かない(古い版では温度 0 のまま送る)。
古い版で試して繰り返しや崩れが出た場合は、新しい版をデプロイしてから同じ手順をやり直す。

#### 案 B: global の gemini-3.5-flash-lite に替える

```powershell
gcloud run services update $SERVICE --region $REGION `
  --update-env-vars="GEMINI_VERTEX_LOCATION=global,GEMINI_MODEL=gemini-3.5-flash-lite,GEMINI_TEMPERATURE=1" `
  --no-traffic --tag gemini35lite
```

`global` の宛先の修正(2026-09-24)を含む版が要る。古い版では `global-aiplatform.googleapis.com` という存在しない宛先を呼んで失敗する。
処理する場所は保証されない。

#### 案 C: APIキー方式に戻し、gemini-2.5-flash のまま使う

上の「APIキー方式」の手順でシークレットを作り、ADC の設定を外す。
課金を有効にしたプロジェクトの API キーを使う(無料枠は送った内容を学習に使う場合がある)。

```powershell
gcloud run services update $SERVICE --region $REGION `
  --remove-env-vars="GEMINI_AUTH_MODE,GEMINI_VERTEX_PROJECT,GEMINI_VERTEX_LOCATION" `
  --update-secrets="GEMINI_API_KEY=gemini-api-key:latest" `
  --no-traffic --tag geminiapikey
```

Gemini API の 2.5 系の廃止日は発表されていない。入出力は55日保存され、処理する場所は保証されない。

どの案にしたかと、確かめた結果(日付、リビジョン名、処理したページ、崩れの有無)は `memory/project-state.md` に記録する。

## よくあるつまずき

### `git` コマンドが見つからない、または認証を求められる

Git for Windows がインストールされていない場合は先にインストールします。プライベートリポジトリの場合、初回の `git fetch`/`git push` で GitHub の認証(ブラウザでのサインインまたはトークン入力)を求められることがあります。

### `git push` が拒否される

GitHub の `main` に手元に無いコミットがあると、`git push origin main` は `rejected` で止まります。
`git pull --ff-only` で取り込んでから push し直します。
`--ff-only` で取り込めないとき(手元と GitHub の両方に別のコミットがあるとき)は、`git pull --rebase` で手元のコミットを GitHub の後ろに付け直します。
`git push --force` は GitHub 側のコミットを消すので使いません。

### `IMAGE` が作れない

PowerShell では、次の形式にします。

```powershell
$IMAGE = "${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO}/${SERVICE}:${TAG}"
```

### `--tag` が `pkg.dev` 形式でない

`gcloud builds submit --tag` には、`asia-northeast1-docker.pkg.dev/...` のような `pkg.dev` 形式を使います。

### すべての画面が 503 になる

`APP_PASSWORD` が渡っていないか、16文字より短いときに起きます。
Cloud Run のログに `ERROR: APP_PASSWORD が設定されていないか` で始まる行が出ています。
`gcloud run deploy` に `--update-secrets="APP_PASSWORD=app-password:<版の番号>"` を付けたか、その版が有効(`ENABLED`)かを確かめます。

### 更新後に見た目が変わらない

- まず Cloud Run のログで新しいアクセスが来ているか確認します
- そのうえで、最新リビジョンが選ばれているか確認します
- 必要なら `Ctrl + Shift + R` で強制再読み込みします


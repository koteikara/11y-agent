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

- デプロイ元は GitHub リポジトリ `koteikara/11y-agent` の `main` ブランチ(ローカルの手元フォルダではなく、GitHub上にマージ済みの内容をデプロイする)
- デプロイ作業用フォルダは `C:\Codex\11y-agent-deploy`(手元の開発用チェックアウトとは別に用意し、常にGitHubの最新内容へ揃える)
- デプロイ先サービス名は `goal2-a11y-review`
- リージョンは `asia-northeast1`
- コンテナポートは `8080`

## 更新デプロイ

PowerShell で次を実行します。まず GitHub の `main` ブランチを作業用フォルダへ同期し、そのフォルダから Cloud Build に送ります(ローカルでの未コミットの変更は含まれません)。

```powershell
$REPO_URL = "https://github.com/koteikara/11y-agent.git"
$WORKDIR = "C:\Codex\11y-agent-deploy"

if (Test-Path $WORKDIR) {
  cd $WORKDIR
  git fetch origin main
  git checkout main
  git reset --hard origin/main
} else {
  git clone --branch main $REPO_URL $WORKDIR
  cd $WORKDIR
}

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

gcloud builds submit --tag "$IMAGE" .
gcloud run deploy $SERVICE --image "$IMAGE" --region $REGION --platform managed --port 8080 --memory 512Mi --cpu 1 --allow-unauthenticated
```

デプロイ後、公開URLを開くと画面右下に `build: <コミットの短縮ID> (デプロイ日時)` という小さな表示が出ます。これで、今開いている画面が最新のデプロイを反映しているか(＝GitHubの最新コミットと一致するか)を一目で確認できます。ローカル開発環境(`node server.js`)では `public/build-info.json` が存在しないため、この表示自体が出ません(表示が無い=ローカル、という目印にもなります)。

`main` 以外のブランチ(マージ前のPRなど)を試験的にデプロイしたい場合は、`git clone --branch main` と `git checkout main` の部分をブランチ名に置き換えます。ただし通常の更新デプロイは、PRがマージされて `main` に反映された後に実行します。

## 反映確認

デプロイ後も URL は変わりません。次の2つの公開URLを両方とも開いて確認します(Goal 2のみ確認してGoal 3の確認を忘れないよう注意する)。

```text
https://goal2-a11y-review-700549743482.asia-northeast1.run.app/
https://goal2-a11y-review-700549743482.asia-northeast1.run.app/goal3.html
```

画面右下の `build:` 表示のコミットIDが、GitHubの `main` ブランチの最新コミット([コミット履歴](https://github.com/koteikara/11y-agent/commits/main))と一致しているかを確認すると、目的の変更が反映されているか一目で分かります。

反映されないときは次を確認します。

- `gcloud builds submit` が成功しているか
- `gcloud run deploy` が成功しているか
- ブラウザのキャッシュが残っていないか
- Cloud Run の最新リビジョンに 100% のトラフィックがあるか
- 画面右下の `build:` 表示のコミットIDが古いままでないか(古い場合はデプロイ手順そのものが最新の`main`を取得できていない可能性がある)

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

## よくあるつまずき

### `git` コマンドが見つからない、または認証を求められる

Git for Windows がインストールされていない場合は先にインストールします。プライベートリポジトリの場合、初回の `git clone`/`git fetch` で GitHub の認証(ブラウザでのサインインまたはトークン入力)を求められることがあります。

### `git reset --hard origin/main` で作業内容が消えないか心配

`$WORKDIR`(`C:\Codex\11y-agent-deploy`)はデプロイ専用の作業フォルダであり、開発用チェックアウト(`C:\Codex\a11y-agent` など)とは別に用意します。このフォルダには編集中のファイルを置かないようにすれば、`git reset --hard` で消えて困る内容は発生しません。

### `IMAGE` が作れない

PowerShell では、次の形式にします。

```powershell
$IMAGE = "${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO}/${SERVICE}:${TAG}"
```

### `--tag` が `pkg.dev` 形式でない

`gcloud builds submit --tag` には、`asia-northeast1-docker.pkg.dev/...` のような `pkg.dev` 形式を使います。

### 更新後に見た目が変わらない

- まず Cloud Run のログで新しいアクセスが来ているか確認します
- そのうえで、最新リビジョンが選ばれているか確認します
- 必要なら `Ctrl + Shift + R` で強制再読み込みします


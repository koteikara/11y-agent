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

- ローカルの作業フォルダは `C:\Codex\a11y-agent\goal2-app`
- デプロイ先サービス名は `goal2-a11y-review`
- リージョンは `asia-northeast1`
- コンテナポートは `8080`

## 更新デプロイ

PowerShell で次を実行します。

```powershell
cd "C:\Codex\a11y-agent\goal2-app"
$PROJECT_ID = gcloud config get-value project
$REGION = "asia-northeast1"
$SERVICE = "goal2-a11y-review"
$REPO = "goal2-app"
$TAG = Get-Date -Format "yyyyMMdd-HHmmss"
$IMAGE = "${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO}/${SERVICE}:${TAG}"

gcloud builds submit --tag "$IMAGE" .
gcloud run deploy $SERVICE --image "$IMAGE" --region $REGION --platform managed --port 8080 --memory 512Mi --cpu 1 --allow-unauthenticated
```

## 反映確認

デプロイ後も URL は変わりません。次の2つの公開URLを両方とも開いて確認します(Goal 2のみ確認してGoal 3の確認を忘れないよう注意する)。

```text
https://goal2-a11y-review-700549743482.asia-northeast1.run.app/
https://goal2-a11y-review-700549743482.asia-northeast1.run.app/goal3.html
```

反映されないときは次を確認します。

- `gcloud builds submit` が成功しているか
- `gcloud run deploy` が成功しているか
- ブラウザのキャッシュが残っていないか
- Cloud Run の最新リビジョンに 100% のトラフィックがあるか

## よくあるつまずき

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


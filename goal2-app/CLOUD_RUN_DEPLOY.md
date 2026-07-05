# Cloud Run デプロイ手順

`goal2-app` を Google Cloud Run に更新デプロイするための短い手順です。

公開URL:

```text
https://goal2-a11y-review-700549743482.asia-northeast1.run.app/
```

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

デプロイ後も URL は変わりません。次の公開URLを開いて確認します。

```text
https://goal2-a11y-review-700549743482.asia-northeast1.run.app/
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


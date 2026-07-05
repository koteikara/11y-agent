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

gcloud builds submit --tag "$IMAGE" .
gcloud run deploy $SERVICE --image "$IMAGE" --region $REGION --platform managed --port 8080 --memory 512Mi --cpu 1 --allow-unauthenticated
```

`main` 以外のブランチ(マージ前のPRなど)を試験的にデプロイしたい場合は、`git clone --branch main` と `git checkout main` の部分をブランチ名に置き換えます。ただし通常の更新デプロイは、PRがマージされて `main` に反映された後に実行します。

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


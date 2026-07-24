// デプロイ済みの本番環境が最新のコードを反映しているか、画面から一目で確認できるようにする。
// public/build-info.json はCloud Runへのデプロイ時(CLOUD_RUN_DEPLOY.mdの手順)に生成される
// ため、ローカル開発環境ではファイルが存在せず404になる。その場合は何も表示しない
// (ローカルではgit状態を直接確認できるため、バッジが無いこと自体が「ローカル」の目印になる)。
(function () {
  fetch("/build-info.json", { cache: "no-store" })
    .then((response) => (response.ok ? response.json() : null))
    .then((info) => {
      if (!info || !info.commitShort) return;
      const badge = document.createElement("div");
      badge.className = "version-badge";
      badge.textContent = `build: ${info.commitShort}${info.deployedAt ? ` (${formatDateTime(info.deployedAt)})` : ""}`;
      badge.title = [info.commit ? `commit: ${info.commit}` : "", info.commitDate ? `commit date: ${info.commitDate}` : "", info.deployedAt ? `deployed: ${info.deployedAt}` : ""]
        .filter(Boolean)
        .join("\n");
      document.body.appendChild(badge);
    })
    .catch(() => {
      // ベストエフォート。取得できなくても画面表示には影響させない。
    });

  function formatDateTime(iso) {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return iso;
    const pad = (value) => String(value).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }
})();

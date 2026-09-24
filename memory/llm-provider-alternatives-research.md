# llm-provider-alternatives-research.md

## Purpose

Goal 2 実行画面（`goal2-app/`）の LLM 呼び出しを、いまの Google Gemini から別の提供元へ移す検討の記録である。
2026-09-24 に、Google Workspace 経由、さくらの AI Engine、そのほかの経路（Azure、AWS Bedrock、Anthropic と OpenAI の直接契約、国産 LLM、自前で動かすモデル）を調べ、ユーザーの判断を受けてさくらの AI Engine に寄せる方針を決めた。
移行の設計と実装の手順は `goal2-app/LLM_PROVIDER_SWITCH_INSTRUCTIONS.md` にある。

調査は、調査担当のエージェント3つが公式ページと 2025〜2026 年の技術記事を読んで行った。
Vertex AI の廃止日だけは、公式ページを直接取得して確かめた。
料金や提供モデルは変わりやすいので、使う前に出典で確かめ直す。

## ユーザーの判断（2026-09-24）

- **ISMAP はいまは求めない。** 送るのは公開済みの自治体ページの HTML と画像で、機密性が低いためである。
- **Google から離れることは条件ではない。** さくらに寄せる理由は、他のプロジェクトですでにさくらの AI を使っているためである。契約と支払いの手続きは済んでいる。

## アプリ側の条件

- 呼び出しは 1 往復だけで、会話の履歴は持たない。システム指示、日本語の本文、画像 1 枚までを送り、温度は 0 にしている。
- 13 のタスクがあり、すべて JSON Schema で形を決めた JSON を受け取る。文字のタスクは 11、画像のタスクは 2（代替テキストの下書き、画像化された文字の判定）である。
- 画像のタスクには、日本語の文字を読める画像対応モデルが要る。
- 見出しの見直しは、ページ全体の見出しと段落を 1 回で送るので、入力が数万トークンになることがある。

## 比較

条件に合うかどうか（2026-09-24 時点）:

| 経路 | 国内で処理 | ISMAP | 保存と学習 | 画像入力 | JSON Schema | 温度0 | 判定 |
|---|---|---|---|---|---|---|---|
| いまの Gemini API（API キー） | 保証なし | 対象外の見込み | 有料枠は学習なし、55日保存 | 可 | 可 | 可 | 移行元 |
| Vertex AI 東京、gemini-3.5-flash | 可 | 登録あり | 学習なし。不審な入力だけ最長90日、申請で除外可 | 可 | 可 | 非推奨。3系は1.0を推奨 | 受け皿、つなぎ |
| Google Workspace 経由 | 不可。日本の地域は無い | 登録あり | 学習なし | 対話画面だけ | 不可 | 指定不可 | 除外。サーバーから呼べない |
| さくらの AI Engine | 可 | 範囲外 | 約款で学習なし。保守のため一定期間保存の場合あり | プレビューのモデルだけ | 公式の記載なし。効いた報告と無視された報告がある | 可 | **採用**。文字から移す |
| AWS Bedrock 日本プロファイル、Claude Haiku 4.5 / Sonnet 4.6 | 可。東京と大阪 | 範囲内 | 既定で保存しない | 可 | 可 | 可 | 条件はすべて満たすが、今回は不採用 |
| Azure OpenAI 東日本 | 旧モデル2つだけ。2027-04-14 退役 | 登録あり | 学習なし。不審な入力は保存、除外は申請制 | 可 | 可 | 可 | 期間が短い |
| Anthropic / OpenAI と直接契約 | 不可 | 未確認 | 30日保存など | 可 | 可 | モデルによる | 除外 |
| 国産 LLM のサービス | 可 | 多くは不明 | サービスによる | ほぼ無い | 不明 | 不明 | 源内の試用の結果待ち |
| 自前で動かす（Ollama、vLLM） | 置き場所しだい | 置き場所しだい | 外に出ない | 可 | 可 | 可 | 長期の選択肢。GPU が要る |

料金（100万トークンあたり、入力／出力。1ドル162円で換算）:

| 経路 | 入力 | 出力 | 現行との比 |
|---|---|---|---|
| いまの gemini-2.5-flash | 49円 | 405円 | 1倍 |
| Vertex AI 東京、gemini-3.5-flash | 267円 | 1,604円 | 入力5.5倍、出力4倍 |
| Bedrock 日本、Claude Haiku 4.5 | 178円 | 891円 | 入力3.7倍、出力2.2倍 |
| さくら、gpt-oss-120b | 15円 | 75円 | 入力0.3倍、出力0.2倍。考える過程の分も出力に数える |
| さくら、Qwen3-VL-30B-A3B（プレビュー） | 10円 | 30円 | 0.1倍以下 |

## 経路ごとの要点

### Google（Gemini API、Vertex AI、Workspace）

- **Vertex AI の gemini-2.5-flash は 2026-10-20 に廃止される。** 公式の「Model versions and lifecycle」（2026-09-22 更新）に載っている。後継は gemini-3.5-flash-lite か gemini-3.1-flash-lite である。2.5-pro と 2.5-flash-lite も同じ日に廃止される。一覧には「延びることはあっても早まることはない」とある。第三者の報告（2026-09-16）では、使い続けているプロジェクトには延長の再通知が届いている。
- **東京リージョンで処理が完結する後継は gemini-3.5-flash だけである。** 3.1-flash-lite、3.5-flash-lite、3.6〜3.8-flash は、東京では使えない。
- **Gemini 3 系は温度を既定の 1.0 のまま使うよう推奨されている。** 1.0 より下げると、繰り返しや性能の低下が起きることがあるとされる。
- **Gemini API（API キー）の有料枠は、入出力を 55 日保存する。** 処理する国は保証されない。2.5 系の廃止日は発表されていないが、新しいプロジェクトには提供されない。
- **Workspace の契約では、サーバーから呼べる Gemini の利用枠は付かない。** Workspace 規約の範囲で使える Gemini（Gemini アプリ、Docs や Sheets の Gemini、Sheets の `=AI()`、Workspace Studio）は、人が画面で操作する前提で、温度や JSON Schema を指定できない。Apps Script から呼ぶ場合も、課金を有効にした Google Cloud のプロジェクトを通すので、Vertex AI と同じ扱いになる。Workspace のデータの置き場所に日本は無い（米国、EU、指定なし）。
- Vertex AI は、2026-04-22 に「Gemini Enterprise Agent Platform」へ名前が変わった。API の宛先は `aiplatform.googleapis.com` のままである。

### さくらの AI Engine

- **呼び口は OpenAI 互換である。** 宛先は `https://api.ai.sakura.ad.jp/v1/chat/completions`、認証は `<UUID>:<シークレット>` 形式のトークンを Bearer で送る。Anthropic 互換の `/v1/messages` もある。
- **正式提供の文字モデルは gpt-oss-120b と llm-jp-3.1-8x13b-instruct4 の 2 つである。** llm-jp は文脈が 4,096 トークンまでなので、長い入力には使えない。gpt-oss-120b は約 128K トークンまで受け付けた報告がある。
- **画像を読めるモデルは、すべてパブリックプレビューである。** `preview/Qwen3-VL-30B-A3B-Instruct`、`preview/gemma-4-31B-it`、`preview/Qwen3.6-35B-A3B`、`preview/Kimi-K2.6`、`preview/Kimi-K2.7-Code` がある。プレビューは予告なく終わることがあり、品質の保証も無い。実際に Phi-4-multimodal は 2026-07-27 に終わった。
- **JSON Schema による出力の強制は、公式の API 仕様に載っていない。** 第三者の検証は割れている。2026-05 の検証では gpt-oss-120b がスキーマを無視し、2026-08 の検証では enum や件数の制約まで守った。Qwen3-VL に画像と JSON Schema を渡して読み取りに成功した報告もある。
- **gpt-oss-120b は、考える過程で出力の上限を使い切ると、HTTP 200 のまま中身が空で返る。** 温度 0 でも、同じ入力で答えが揺れる報告がある。
- **データの扱いは約款に書かれている。** 入力を学習に使わず、モデルの提供者を含む第三者に渡さない。入出力は原則として保存しないが、保守や障害対応のために一定期間保存することがある。期間は公開されていない。処理は国内のデータセンターで完結する。
- **SLA は無い。** 支払いは原則クレジットカードである。
- ISMAP の登録範囲に AI Engine は入っていない。さくらのクラウドは、ガバメントクラウドに正式に採択されている（2026-03-27）。
- 約款第12条は、さくらの承諾なく第三者にサービスを使わせることを禁じている。自社の作業者が使うツールなら当たりにくい。自治体の職員が直接使う形にするときは、さくらに確かめる。
- 無償枠は毎月 Chat 3,000 リクエストである。有償プランの上限（1分あたりのリクエスト数など）は公開されていない。

### そのほかの経路

- **AWS Bedrock**：日本プロファイルは、東京と大阪の間だけで処理する。Claude Haiku 4.5 と Sonnet 4.6 は、画像入力と JSON Schema の両方に対応し、温度 0 も使える。既定で入出力を保存しない。Bedrock は ISMAP の言明範囲に入っている。確かめることが2つある。Haiku 4.5 の提供期間（Anthropic 側の退役は「2026-10-15以降」）と、日本プロファイルの対応モデル（公式の表どうしで食い違う）である。
- **Azure OpenAI**：東日本で処理が完結する従量課金は、gpt-4.1-mini と gpt-4o の2つだけで、どちらも 2027-04-14 に退役する。新しい GPT-5 系は、APAC のデータゾーン（日本単独ではない）か全世界での処理になる。
- **Anthropic と OpenAI の直接契約**：日本で推論する選択肢が無い。
- **国産 LLM**：デジタル庁の「源内」で、tsuzumi 2、Takane、Sarashina、cotomi、PLaMo などを 2027 年 3 月まで試用している。画像入力と JSON 出力に対応するかは、多くが不明である。PLaMo 3.0 Prime と cotomi v3 は、さくらの AI Engine のクローズドモデル（申請制）として使える。
- **自前で動かす**：Qwen3.6、Qwen3-VL、Gemma 4 などは Apache-2.0 で、画像を読める。Ollama や vLLM は JSON Schema で出力を制約できる。27〜35B 級を動かすには 24GB 級の GPU が要る見込みで、事務用の PC では遅すぎる。

## 未決事項

- 本番の Cloud Run が、Vertex AI 経由か API キー経由か。Vertex AI 経由で gemini-2.5-flash を使っていれば、2026-10-20 に止まる。
- さくらの画像モデルが、日本語の代替テキストと画像内の文字の読み取りで、Gemini と同じ質を出せるか。評価はまだ無い。
- さくらの有償プランの上限と、保守のための保存期間。
- 画像モデルの正式提供と、AI Engine の ISMAP 追加の予定。

## Source Links

Google:
- [Vertex AI（Agent Platform）Model versions and lifecycle](https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/model-versions)（2026-09-22 更新）
- [Agent Platform のデータ所在地](https://docs.cloud.google.com/gemini-enterprise-agent-platform/resources/data-residency)、[ゼロデータ保持](https://docs.cloud.google.com/gemini-enterprise-agent-platform/resources/zero-data-retention)
- [Gemini API 利用規約](https://ai.google.dev/gemini-api/terms)、[料金](https://ai.google.dev/gemini-api/docs/pricing)、[Gemini 3 の注意](https://ai.google.dev/gemini-api/docs/gemini-3)
- [Workspace Privacy Hub](https://knowledge.workspace.google.com/admin/gemini/generative-ai-in-google-workspace-privacy-hub)、[データの保存地域](https://knowledge.workspace.google.com/admin/compliance/choose-a-geographic-location-for-your-data)
- [Apps Script の Vertex AI サービス](https://developers.google.com/apps-script/advanced/vertex-ai)
- [延長の再通知についての報告（GitHub、2026-09-16）](https://github.com/dimagi/open-chat-studio/issues/4509)

さくらの AI Engine:
- [サービスページ](https://ai.sakura.ad.jp/sakura-ai/ai-engine/)、[約款](https://www.sakura.ad.jp/corporate/wp-content/themes/sakura-corporate/assets/pdf/yakkan_ai-engine.pdf)
- [利用手順](https://manual.sakura.ad.jp/cloud/ai-engine/02-howto.html)、[サービス基本情報](https://manual.sakura.ad.jp/cloud/ai-engine/01-basics.html)、[推論 API の OpenAPI](https://manual.sakura.ad.jp/api/cloud/portal/openapis/ai-engine-inference-api.yaml)
- [マルチモーダルのプレビュー開始（2025-10-21）](https://cloud.sakura.ad.jp/news/2025/10/21/ai-engine-preview-multimodal/)、[gemma-4-31B-it のプレビュー（2026-06-30）](https://cloud.sakura.ad.jp/news/2026/06/30/aiengine_gemma-4-31b-it_pubpreview/)
- [ISMAP の登録範囲](https://manual.sakura.ad.jp/cloud/ismap/index.html)
- 第三者の検証: [Zenn（2026-05-10）](https://zenn.dev/takeyuwebinc/articles/daec34094c21ce)、[Qiita（2026-08-18）](https://qiita.com/kedama-t/items/03be38cd176ab26b938d)、[Qiita（2026-08-24）](https://qiita.com/EightT/items/eb9c95ae210264c9475f)

そのほか:
- [Bedrock の日本国内推論（AWS Blog）](https://aws.amazon.com/blogs/machine-learning/introducing-amazon-bedrock-cross-region-inference-for-claude-sonnet-4-5-and-haiku-4-5-in-japan-and-australia)、[Bedrock と ISMAP（AWS Blog）](https://aws.amazon.com/jp/blogs/news/amazon-bedrock-ismap/)
- [Azure のモデルごとの提供地域](https://learn.microsoft.com/en-us/azure/foundry/foundry-models/concepts/models-sold-directly-by-azure-region-availability)、[Azure OpenAI のデータの扱い](https://learn.microsoft.com/en-us/azure/foundry/responsible-ai/openai/data-privacy)
- [Anthropic のデータ所在地](https://platform.claude.com/docs/en/manage-claude/data-residency)、[OpenAI のデータの扱い](https://developers.openai.com/api/docs/guides/your-data)
- [デジタル庁 生成AIの調達・利活用に係るガイドライン 2.0](https://www.digital.go.jp/assets/contents/node/information/field_ref_resources/decb64eb-f26e-41cb-8d37-f3dd173108b8/59054b35/20260612_resources_standard_guidelines_guideline_01.pdf)
- [令和8年度ガバメントクラウドの選定結果](https://www.digital.go.jp/assets/contents/node/basic_page/field_ref_resources/d6b5753c-c4eb-4ee6-92d0-21b3fa945a82/8bcd22f0/20260327_policies_gov_cloud_outline_01.pdf)

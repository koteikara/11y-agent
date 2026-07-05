# google/agents-cli Execution Plan for Goal2

## Purpose

Goal2 は公共団体CMS移行時のアクセシビリティ修正候補を扱うため、`google/agents-cli` はUI本体の置き換えではなく、評価、失敗分析、プロンプト/Skill改善、将来のバッチ実行基盤として利用する。

## Scope

- 対象はCMS本文HTMLのold/gold評価。
- 佐賀市fixtureの `old/` と `gold/` を最初の評価データセットにする。
- 行政情報の意味を変える修正は自動確定せず、人間確認または証跡に回す。
- Google Cloud / Gemini Enterpriseへのデプロイは次段階。まずローカルで再現可能な評価パイプラインを構築する。

## Phase 1: Local agents-cli-compatible Evaluation

1. `old` / `gold` HTMLをJSONL評価データに変換する。
2. 既存のGoal2変換ロジックで `current_html` を生成する。
3. `current_html` と `gold_html` を比較し、トレースJSONLと採点JSONを出す。
4. 失敗傾向を `heading`、`table`、`image alt`、`weak link`、`date/weekday/unit` などの指標で見る。
5. 失敗をカテゴリ別に分類し、次に直すべきルール群を出す。

Commands:

```bash
npm run agents:bootstrap
```

Outputs:

- `agents-cli/datasets/saga-a11y-eval.jsonl`
- `agents-cli/datasets/saga-a11y-eval.json`
- `agents-cli/results/saga-a11y-local-traces.jsonl`
- `agents-cli/results/saga-a11y-local-grade.json`
- `agents-cli/results/saga-a11y-local-report.md`
- `agents-cli/results/saga-a11y-local-analysis.json`
- `agents-cli/results/saga-a11y-local-analysis.md`

## Phase 2: Real agents-cli Evaluation

When `agents-cli` and credentials are available:

1. Install tools outside the app workspace.

```bash
uvx google-agents-cli setup
```

2. Scaffold or enhance an ADK agent that wraps Goal2 candidate generation.
3. Use the generated JSONL dataset as the initial eval source.
4. Run `agents-cli eval generate` to produce model/agent traces.
5. Run `agents-cli eval grade` to grade traces.
6. Use `agents-cli eval compare` and `agents-cli eval analyze` for regression and failure-mode analysis.
7. Use `agents-cli eval optimize` only after public-sector review criteria are stable.

## Phase 3: Project Integration

- Convert high-confidence failures into deterministic Goal2 rules.
- Convert repeated ambiguous failures into human-review prompts.
- Keep generated decisions explainable through evidence JSON.
- Do not feed customer non-public content to external services without approval.

## Success Criteria

- The local evaluation can be reproduced with one command.
- Each eval case contains old HTML, gold HTML, and public-sector migration instructions.
- Reports identify worst files and failing structural metrics.
- Later agents-cli traces can be compared against the local baseline.

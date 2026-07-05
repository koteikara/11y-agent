---
type: bundle-index
title: 自治体サイト アクセシビリティ移行ナレッジベース
description: SMART CMSへのデータ移行ルール・作業手順・WCAG根拠をOKF形式でまとめた知識基盤。Claude-A11yエージェントが直接参照でき、68本JSONLルール基盤の生成元となる。
resource: manual://データ移行総合マニュアル_V2.01
tags: [accessibility, migration, smart-cms, okf]
timestamp: 2025-12-15T00:00:00Z
okf_version: "0.1"
source_standards: ["WCAG 2.2", "JIS X 8341-3:2016"]
---

# 概要

このバンドルは「データ移行総合マニュアル V2.01」を OKF（Open Knowledge Format）で再構成したものです。
1ルール＝1ファイルを原則とし、各概念はMarkdownリンクで相互参照されたグラフを構成します。

# ディレクトリ

- [workflow/](/workflow/index.md) — 作業フロー（移行・公開・基本ルール）
- [rules/](/rules/index.md) — 移行ルール（中核）。ドメイン別ディレクトリ
- [cms/](/cms/index.md) — SMART CMS 機能・操作仕様
- [reference/](/reference/index.md) — スプレッドシート記入欄・質問プロトコル等
- [wcag/](/wcag/index.md) — WCAG 2.2 / JIS X 8341-3 根拠（章別）

# 規約

- **type**（必須）: `migration-rule` / `workflow-step` / `cms-feature` / `reference` / `wcag-criteria`
- **processing_class**: `mechanical`（機械置換）/ `ai`（LLM判断）/ `hybrid`（LLM+人間）/ `escalation`（人間・報告必須）
- **municipality_specific**: `true` の場合「自治体毎に専用ルール有」。自治体別マニュアルを別途参照
- **cms_auto**: CMS側で自動変換（禁則文字変換等）されるか
- **before/after 例の表記**: 本文 `# 例` 内で info string 付きフェンスを用いる

```text
## ケースN: 見出し
（before/after を以下のフェンスで）
```before
駄目な例（移行元）の文字列
```
```after
改修例（移行先）の文字列
```
ポイント: 補足（任意）
```

`tools/okf2jsonl.py` がこの規約を解析し、68本JSONLルール基盤を生成します。

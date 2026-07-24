---
type: migration-rule
title: テーブルレイアウトの解体
description: 枠線を隠した段組み用の表（テーブルレイアウト）は表を崩してパーツで再構成する
resource: manual://V2.01#p36
tags: [table, ai]
timestamp: 2025-12-15T00:00:00Z
wcag: ["1.3.1"]
jis: ["なし"]
processing_class: hybrid
municipality_specific: false
cms_auto: false
origin: manual
michecker_check_ids: ["C_12.0", "C_12.1", "C_12.2", "C_23.0", "C_23.1", "C_23.2"]
related: [/rules/image/image-text-layout.md, /wcag/ch6-table.md]
---

# 必須ルール
見た目は表でないのにテキスト入力エリアに表枠がある場合はテーブルレイアウト。表は不要なので必要テキストを切り取り、表を削除してから貼り直す。表内の画像名は不要なので削除する。表の中に表が入れ子になっている（テーブルレイアウト）場合は、必要なのは中の表だけなので、中の表だけを取り出し、外側の不要な表は削除する。

# 例
## ケース1: 左テキスト・右画像のレイアウト表
```before
表の左セルにテキスト、右セルに画像名（画像は直下の画像エリア）
```
```after
表を削除し、テキストは本文、画像は画像パーツへ再構成
```

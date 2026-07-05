---
type: migration-rule
title: 画像とテキストの横並び
description: 画像とテキストが横並びの場合は左右配置パーツを使用する
resource: manual://V2.01#p58
tags: [image]
timestamp: 2025-12-15T00:00:00Z
wcag: ["なし"]
jis: ["なし"]
processing_class: mechanical
municipality_specific: false
cms_auto: false
related: [/rules/table/layout-table.md]
---

# 必須ルール
画像とテキストが横並びの場合、「左画像・右テキスト」または「左テキスト・右画像」パーツを使用する。

# 例
## ケース1: 左画像・右テキスト
```before
表組みで左に画像、右に説明文を配置
```
```after
「左画像、右テキスト」パーツで構成
```

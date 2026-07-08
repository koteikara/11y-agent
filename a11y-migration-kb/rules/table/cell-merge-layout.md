---
type: migration-rule
title: セル結合①レイアウト用途
description: レイアウトのための結合は、表を使わず画像2枚並びパーツ等で再現する
resource: manual://V2.01#p39
tags: [table, ai]
timestamp: 2025-12-15T00:00:00Z
wcag: ["1.3.1"]
jis: ["なし"]
processing_class: hybrid
municipality_specific: true
cms_auto: false
origin: manual
michecker_check_ids: ["C_76.1"]
related: [/rules/table/layout-table.md, /wcag/ch6-table.md]
---

# 必須ルール
セル結合がレイアウト目的の場合、表を使用せず画像2枚並び（キャプションあり）等のパーツで同じレイアウトに修正する。

# 例
## ケース1: 画像配置のための結合
```before
結合セルで画像を2枚並べている
```
```after
画像2枚並びパーツで再現
```

---
type: migration-rule
title: 複数画像の並び
description: 横並びは最大3枚。4枚以上は入力エリアを繰り返す。縦並びは画像パーツを必要数設定
resource: manual://V2.01#p57
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
横並びは最大3枚（3枚並びはテンプレート0005が必要）。4枚以上は横並び入力エリアを繰り返して枚数分入力する。キャプションがあればそれぞれ設定。画像名がキャプションと同じ場合は「画像名を省略する」にチェック。

# 例
## ケース1: 4枚横並び
```before
画像を横に4枚配置
```
```after
横並び3枚＋横並び入力エリアを繰り返して残り1枚
```

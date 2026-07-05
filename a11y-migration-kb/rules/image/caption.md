---
type: migration-rule
title: 画像のキャプション
description: キャプションは画像名とは別ルールで入力し、分類語の付与は不要
resource: manual://V2.01#p64
tags: [image]
timestamp: 2025-12-15T00:00:00Z
wcag: ["1.1.1"]
jis: ["1.1.1"]
processing_class: hybrid
municipality_specific: false
cms_auto: false
related: [/rules/image/alt-text.md]
---

# 必須ルール
キャプション（画像下の説明文）にはテキストのルールのみ適用する。画像名とは別なので「(写真)」等の分類追記は不要。キャプションと画像名が同一文言の場合は画像名を省略。別文言の場合は画像名を画像ルールに従って修正する。

# 例
## ケース1: 分類語付きキャプション
```before
(写真)チューリップ
```
```after
チューリップ
```

---
type: migration-rule
title: 画像の表示幅（サブ画像 大/小）
description: コンテンツ幅に対する表示幅でサブ画像（大）／（小）を選ぶ
resource: manual://V2.01#p55
tags: [image]
timestamp: 2025-12-15T00:00:00Z
wcag: ["なし"]
jis: ["なし"]
processing_class: mechanical
municipality_specific: false
cms_auto: false
---

# 必須ルール
テンプレート0001〜0004で、コンテンツ幅に対し表示幅が概ね50〜100%以上なら「サブ画像（大）」、50%未満なら「サブ画像（小）」に設定する（参考：350px以上/未満）。

# 例
## ケース1: 大きい画像
```before
表示幅がコンテンツ幅の約80%（約400px）
```
```after
サブ画像（大）
```

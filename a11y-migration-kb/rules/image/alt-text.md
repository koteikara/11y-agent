---
type: migration-rule
title: 画像の代替テキスト（画像名）
description: 画像の内容を音声読み上げで把握できるよう、具体的な代替テキストへ修正する
resource: manual://V2.01#p61
tags: [image, ai, hybrid]
timestamp: 2025-12-15T00:00:00Z
wcag: ["1.1.1", "3.1.5"]
jis: ["1.1.1"]
processing_class: hybrid
municipality_specific: false
cms_auto: false
origin: manual
michecker_check_ids: ["C_71.0", "C_80.0", "C_89.1", "C_600.0"]
related: [/rules/image/caption.md, /rules/image/complex-image-report.md, /wcag/ch3-images.md]
---

# 必須ルール
画像に内容がある場合、その内容をテキストで説明する代替テキスト（画像名）を設定する。分類語だけでは不十分。移行段階で文字起こしは不要だが、適切な画像名へ修正する。画像内容がテキストで十分説明されていれば画像名省略も可。

# 例
## ケース1: 公園の写真
```before
公園の写真
```
```after
青空の下に芝生が広がる大阪公園の写真
```

## ケース2: サツキの写真
```before
サツキの写真
```
```after
満開になっているピンク色のサツキの花の写真
```

## ケース3: 家族の写真
```before
家族の写真
```
```after
祖父母と親子の5人が揃った集合写真
```

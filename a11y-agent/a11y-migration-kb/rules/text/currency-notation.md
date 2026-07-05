---
type: migration-rule
title: 通貨の表記
description: 機種依存の通貨記号を「円」「ドル」等の表記に修正する
resource: manual://V2.01#p27
tags: [text, mechanical]
timestamp: 2025-12-15T00:00:00Z
wcag: ["1.1.1"]
jis: ["なし"]
processing_class: mechanical
municipality_specific: false
cms_auto: false
related: [/wcag/ch2-site.md]
---

# 必須ルール
通貨を表す記号は機種依存文字がほとんどであり、「円」「ドル」等に修正する。

# 例
## ケース1: 円記号
```before
¥100
```
```after
100円
```
ポイント: 「えんまーく ひゃく」と誤読される。

## ケース2: ドル記号
```before
$100
```
```after
100ドル
```
ポイント: 「どるひゃく」と誤読される。

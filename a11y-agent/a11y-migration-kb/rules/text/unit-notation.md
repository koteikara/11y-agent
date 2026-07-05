---
type: migration-rule
title: 単位の表記
description: 機種依存の単位記号・英字略記をカタカナ表記へ修正する
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
単位記号（㎡ ㎥ ㎏ 等）および英字略記（cm km 等）は音声読み上げで誤読・読み分けされるため、カタカナ表記に修正する。一般的でない単位は質問する。

# 例
## ケース1: センチメートル
```before
5cm
```
```after
5センチメートル
```
ポイント: 「ごしーえむ」と誤読される。

## ケース2: 平方メートル記号
```before
5㎡
```
```after
5平方メートル
```

## ケース3: キログラム
```before
5kg
```
```after
5キログラム
```

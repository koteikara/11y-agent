---
type: migration-rule
title: 箇条書き（リスト）
description: 中黒による擬似箇条書きをリスト機能で正しく設定する
resource: manual://V2.01#p29
tags: [text, mechanical]
timestamp: 2025-12-15T00:00:00Z
wcag: ["1.3.1"]
jis: ["なし"]
processing_class: mechanical
municipality_specific: false
cms_auto: false
origin: manual
michecker_check_ids: ["C_16.0", "C_16.1", "C_16.2"]
related: [/rules/html-structure/heading-required.md]
---

# 必須ルール
箇条書きは「・（中黒）」を使用せず、番号付きリスト／番号無しリスト機能で設定する。入れ子はTabで階層化する。

# 例
## ケース1: 中黒の擬似リスト
```before
・AAA
・BBB
・CCC
```
```after
- AAA
- BBB
- CCC
（番号無しリスト機能で設定）
```

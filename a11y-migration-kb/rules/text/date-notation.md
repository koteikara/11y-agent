---
type: migration-rule
title: 日付の表記
description: 音声読み上げで日付として読まれない表記を、年月日の形式に修正する
resource: manual://V2.01#p26
tags: [text, mechanical]
timestamp: 2025-12-15T00:00:00Z
wcag: ["1.3.1"]
jis: ["なし"]
processing_class: hybrid
municipality_specific: true
cms_auto: true
related: [/wcag/ch2-site.md]
---

# 必須ルール
音声読み上げで日付として読まれない表記は、○○○○年○月○日（または年号○○年○月○日）に修正する。
西暦・和暦の統一が必要な場合は自治体別マニュアルに従う。

# 例
## ケース1: スラッシュ区切り（CMS自動変換あり）
```before
2000/1/1
```
```after
2000年1月1日
```
ポイント: 「2000/1/1」「2000.1.1」はCMS側で自動変換される。

## ケース2: 日付だけの省略（手作業必要）
```before
1/1
```
```after
1月1日
```
ポイント: 年が無い「1/1」は自動変換されないため手作業で修正する。

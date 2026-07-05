---
type: migration-rule
title: 曜日の表記
description: 音声読み上げで曜日として読まれない表記を、（○曜日）等に修正する
resource: manual://V2.01#p26
tags: [text, mechanical]
timestamp: 2025-12-15T00:00:00Z
wcag: ["1.3.1"]
jis: ["なし"]
processing_class: hybrid
municipality_specific: true
cms_auto: true
---

# 必須ルール
音声読み上げで曜日として読まれない表記は、（日曜日）（日曜）等に修正する。統一が必要な場合は自治体別マニュアルに従う。

# 例
## ケース1: 括弧付き省略（CMS自動変換あり）
```before
1月1日（日）
```
```after
1月1日（日曜日）
```
ポイント: 「（日）」はCMS側で「（日曜日）」に自動変換される。

## ケース2: 括弧なし（手作業必要）
```before
1月1日 日
```
```after
1月1日 日曜日
```
ポイント: 括弧なしの「日」は自動変換されないため手作業で修正する。

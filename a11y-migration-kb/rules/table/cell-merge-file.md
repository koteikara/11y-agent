---
type: migration-rule
title: セル結合⑤添付ファイル
description: 表組の中に添付ファイルがある場合は表を崩し見出しとファイルで構成する
resource: manual://V2.01#p42
tags: [table, ai]
timestamp: 2025-12-15T00:00:00Z
wcag: ["1.3.1"]
jis: ["なし"]
processing_class: hybrid
municipality_specific: true
cms_auto: false
related: [/rules/file/file-display-text.md, /wcag/ch6-table.md]
---

# 必須ルール
表組の中に添付ファイルがある場合は表を崩し、見出しとファイルで構成する。

# 例
## ケース1: 表内のファイル
```before
結合セル内にPDFファイルリンク
```
```after
見出し＋ファイル入力エリアで構成
```

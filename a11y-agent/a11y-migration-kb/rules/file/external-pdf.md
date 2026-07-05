---
type: migration-rule
title: 外部サイトのPDF
description: 外部サイトのファイルは無断転載防止のため外部リンクで設定する
resource: manual://V2.01#p54
tags: [file, escalation]
timestamp: 2025-12-15T00:00:00Z
wcag: ["なし"]
jis: ["なし"]
processing_class: escalation
municipality_specific: false
cms_auto: false
related: [/rules/link/external-link.md]
---

# 必須ルール
外部サイトのファイルをファイルリンクで移行すると無断転載になる。ファイルリンクで取り込まれていた場合は削除し、外部リンクでURLを指定し直す。PDFを開いたURLが移行元とドメインが異なれば外部サイトのPDF。判断つかなければ質問する。

# 例
## ケース1: 外部PDFがファイルリンク化
```before
他ドメインのPDFがファイルリンクとして取り込まれている
```
```after
ファイルリンクを削除し、外部リンクでURLを指定
```

---
type: migration-rule
title: 別ページへのアンカーリンク
description: 別ページ内の特定箇所へのリンクを、見るべき箇所をテキストで示す形に移行する
resource: manual://V2.01#p77
tags: [link, ai]
timestamp: 2025-12-15T00:00:00Z
wcag: ["2.4.4"]
jis: ["2.4.4"]
processing_class: ai
municipality_specific: true
cms_auto: false
---

# 必須ルール
内部リンクでは別ページの特定箇所への遷移を再現できないため、リンク先のどこを見ればよいかをテキストで補う。

# 例
## ケース1: 別ページの特定箇所
```before
申請方法は～手続きの流れ～をご覧ください。
```
```after
申請方法は次のリンクの「～手続きの流れ～」の箇所をご覧ください。
（リンク先：平成30年度「移住住宅取得助成事業」のご案内）
```

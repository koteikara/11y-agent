---
type: migration-rule
title: ページ内アンカーリンク
description: 同一ページ内の特定箇所へのリンクは原則移行せず、テキストで箇所を示す
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
ページ内アンカーリンクは原則移行しない。ただし削除のみだと訪問者がどこを見ればよいか分からなくなるため、リンク先になっていた箇所をテキストで示す。「見出し目次」使用の指示がある場合は自治体別マニュアルに従う。

# 例
## ケース1: 同一ページ内アンカー
```before
会場周辺のご案内は周辺地図をご覧ください。
```
```after
会場周辺のご案内は、本ページ内の「周辺地図」の箇所をご覧ください。
```

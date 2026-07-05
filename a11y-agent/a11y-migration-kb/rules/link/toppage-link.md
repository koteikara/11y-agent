---
type: migration-rule
title: トップページへの内部リンク
description: トップページへのリンクはページNo.1を指定し、リンクテキストを補う
resource: manual://V2.01#p84
tags: [link]
timestamp: 2025-12-15T00:00:00Z
wcag: ["2.4.4"]
jis: ["2.4.4"]
processing_class: hybrid
municipality_specific: false
cms_auto: false
related: [/rules/link/link-text.md]
---

# 必須ルール
内部リンク先がトップページの場合、内部リンク検索で「ホーム」と検索しページNo.1を指定する。リンクテキストが「ホーム」のままだと遷移先が不明なため「○○（サイト名）トップページ」に書き換える。

# 例
## ケース1: トップページリンクのテキスト
```before
ホーム
```
```after
○○市トップページ
```

---
type: migration-rule
title: 内部リンク（CMS管理内ページ）
description: 同一サイト内（CMS管理内）ページには内部リンク機能を使用する
resource: manual://V2.01#p76
tags: [link]
timestamp: 2025-12-15T00:00:00Z
wcag: ["2.4.4"]
jis: ["2.4.4"]
processing_class: hybrid
municipality_specific: false
cms_auto: false
related: [/rules/link/external-link.md, /rules/link/category-link.md]
---

# 必須ルール
同一サイト内（CMS管理内）ページには内部リンク機能を使用する。内部リンク検索はリニューアル後のページタイトルで行う。タイトルが意図的に変更されている場合があるため、移行元URLでスプレッドシートを検索して確認する。

# 例
## ケース1: 内部ページへのリンク
```before
<a href="http://sample.lg.jp/koseki.html">戸籍の届出</a>
```
```after
内部リンク機能で「戸籍の届出」ページを指定
```

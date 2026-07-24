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
同一サイト内（CMS管理内）ページには内部リンク機能を使用する。内部リンク検索はリニューアル後のページタイトルで行う。タイトルが意図的に変更されている場合があるため、移行元URLでスプレッドシートを検索して確認する。内部リンクは本文の文章中に埋め込まず、テキストとリンクを分離する（「詳細は次のリンクをご覧ください」等の文＋独立したリンク行）。外部リンクは文章中に設定してもよい。

# 例
## ケース1: 内部ページへのリンク
```before
<a href="http://sample.lg.jp/koseki.html">戸籍の届出</a>
```
```after
内部リンク機能で「戸籍の届出」ページを指定
```

## ケース2: 文章中に埋め込まれた内部リンクを分離する
```before
<p>お問い合わせは<a href="/soshiki/somu.html">こちら</a>よりお願いします。</p>
```
```after
<p>お問い合わせは次のリンクよりお願いします。</p>
<p><a href="/soshiki/somu.html">総務課へのお問い合わせ</a></p>
```
ポイント: 内部リンクは本文から分離し、リンク文言は遷移先が分かる形にする（内部リンクはページタイトルが自動表示される）。外部リンクの場合は文章中に設定してもよい。

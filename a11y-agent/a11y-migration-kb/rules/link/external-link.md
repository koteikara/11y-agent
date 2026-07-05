---
type: migration-rule
title: 外部リンク（CMS管理外ページ）
description: 別ドメイン・CMS管理外ページには外部リンク機能を使用する
resource: manual://V2.01#p76
tags: [link]
timestamp: 2025-12-15T00:00:00Z
wcag: ["2.4.4"]
jis: ["2.4.4"]
processing_class: hybrid
municipality_specific: true
cms_auto: false
related: [/rules/link/internal-link.md, /rules/link/link-broken.md]
---

# 必須ルール
別ドメイン・CMS管理外ページには外部リンク機能を使用する。CMS領域外ページの扱いは自治体別マニュアルに従う。遷移先がNot foundやリンク名と明らかに異なる場合はリンク切れ報告欄で報告する。

# 例
## ケース1: 外部サイトへのリンク
```before
<a href="http://example.com/outside.html">関連情報</a>
```
```after
外部リンク機能でURLを指定
```

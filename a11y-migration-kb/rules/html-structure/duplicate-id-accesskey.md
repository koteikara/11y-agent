---
type: migration-rule
title: id・accesskey属性の重複
description: id属性・accesskey属性の値がページ内で重複しないようにする
resource: https://accessibility.jp/resources/tools/michecker-techniques/
tags: [html, mechanical]
timestamp: 2026-07-07T00:00:00Z
wcag: ["4.1.1"]
jis: ["なし"]
processing_class: mechanical
municipality_specific: false
cms_auto: false
related: [/rules/link/in-page-anchor.md, /wcag/ch2-site.md]
---

# 必須ルール
id属性・accesskey属性の値は、同一ページ内で重複しないようにする。特に、複数の案件・記事を貼り付けたページでは、同じidを持つアンカーやフォーム部品が重複しやすいので確認する。

# 例
## ケース1: id属性の重複
```before
<h3 id="section1">案件A</h3>
…
<h3 id="section1">案件B</h3>
```
```after
<h3 id="section1">案件A</h3>
…
<h3 id="section2">案件B</h3>
```
ポイント: ページ内アンカーリンク（in-page-anchor.md）の移行先が重複idを指していないかも合わせて確認する。

---
type: migration-rule
title: 画像＋関連リンクのまとまり
description: セクション見出し配下で、画像の並びと関連リンク群をひとまとまりとして扱う。
resource: manual://V2.01#p61
tags: [image, hybrid]
timestamp: 2026-07-24T00:00:00Z
wcag: ["1.1.1", "2.4.4"]
jis: ["1.1.1", "2.4.4"]
processing_class: hybrid
municipality_specific: false
cms_auto: false
known_failure: false
origin: manual
related: [/rules/image/alt-text.md, /rules/image/caption.md, /rules/image/multiple-images.md, /rules/link/link-text.md, /rules/link/external-link.md, /wcag/ch3-images.md, /wcag/ch4-links.md]
---

# 必須ルール
セクション見出し配下に、画像のまとまりと関連リンク群がセットで並んでいる場合は、ページ名だけに引っ張られず、そのセクションをひとまとまりとして扱う。セクション名（見出し）はそのまとまり全体を表す短い名称にする。各画像の代替テキスト（画像名）は画像内容がわかる簡潔な説明にし、種類が伝わる場合は「写真」「イラスト」「地図」などを補う。リンクテキストは飛び先がわかる形にし、「こちら」のような曖昧なリンク文言は避ける。画像だけのページや個別対象の紹介ページ（heritage-image）を、このルールへ無理に寄せないよう確認する。

# 例
## ケース1: 見出し配下の画像＋関連リンク群
```before
<h2>暮らしYASUKAさがし</h2>
<img src="food.jpg" alt="画像"><img src="child.jpg" alt="画像">
<p><a href="/food/">こちら</a></p>
<p><a href="/child/">こちら</a></p>
```
```after
<h2>暮らしYASUKAさがし</h2>
<img src="food.jpg" alt="食のイベントの様子の写真"><img src="child.jpg" alt="子育て広場の写真">
<p><a href="/food/">暮らしYASUKAさがし【食編】</a></p>
<p><a href="/child/">暮らしYASUKAさがし【子育て編】</a></p>
```
ポイント: 画像群と関連リンク群を同じセクションのまとまりとして扱い、画像名は内容＋種類、リンクは飛び先がわかる文言に整える。「こちら」等の曖昧なリンク文言は避ける。

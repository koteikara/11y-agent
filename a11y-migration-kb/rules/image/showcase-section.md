---
title: 画像＋関連リンクのまとまり
description: セクション見出し配下で、画像の並びと関連リンク群をひとまとまりとして扱う。
type: migration-rule
processing_class: hybrid
municipality_specific: false
cms_auto: false
known_failure: false
related: [/rules/image/alt-text.md, /rules/image/caption.md, /rules/image/multiple-images.md, /rules/link/link-text.md, /rules/link/external-link.md, /wcag/ch3-images.md, /wcag/ch4-links.md]
---

## 目的
セクション見出し配下に、画像のまとまりと関連リンク群がセットで並んでいるページを、ページ名だけに引っ張られずにひとまとまりとして扱う。
画像だけが多いページや、個別の対象記録ページとは分けて考える。

## 論点
- セクション名は、そのまとまり全体を表す短い見出しとして扱う
- 画像の `alt` は、画像内容がわかる簡潔な説明にする
- 画像の種類が伝わる場合は、写真・イラスト・地図などを補う
- リンクテキストは、飛び先がわかる形にする
- `こちら` のような曖昧なリンク文言は避ける

## 確認ポイント
- 画像群と関連リンク群が、同じセクション見出し配下に収まっているか
- 画像だけのページを、このルールに無理に寄せていないか
- リンクだけの断片を、画像まとまりとして扱っていないか

## 例
- 暮らしYASUKAさがし【食編】
- 暮らしYASUKAさがし【子育て編】
- 暮らしYASUKAさがし【仕事編】

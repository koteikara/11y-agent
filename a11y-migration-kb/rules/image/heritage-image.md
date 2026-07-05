---
title: 文化財紹介ページの画像
description: 文化財や個別紹介ページの画像は、対象名と説明の一致を優先して扱う。
type: migration-rule
processing_class: hybrid
municipality_specific: false
cms_auto: false
known_failure: false
related: [/rules/image/alt-text.md, /rules/image/caption.md, /rules/image/complex-image-report.md, /wcag/ch3-images.md]
---

## 目的
文化財・個別紹介ページでは、画像がページ全体のまとまりではなく対象の説明補助になっていることがある。
この場合は、画像＋関連リンクの共通ルールに寄せず、対象名と説明文の整合を優先して確認する。

## 論点
- 画像の `alt` は、対象名を基本にする
- 対象名と画像内容がずれる場合は、画像内容の説明を補う
- キャプションは、対象の説明として短くまとめる
- リンクが少ない場合は、関連リンク群としてまとめない

## 確認ポイント
- 対象名と画像の関係が、説明文で自然に伝わるか
- 画像＋関連リンクの共通ルールへ誤って寄せていないか
- 画像の説明が、文化財としての対象名とぶれていないか

## 例
- 青漆塗萌黄糸威二枚胴具足
- 大日如来坐像
- 文化財紹介の画像一覧

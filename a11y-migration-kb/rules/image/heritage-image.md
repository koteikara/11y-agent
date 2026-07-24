---
type: migration-rule
title: 文化財紹介ページの画像
description: 文化財や個別紹介ページの画像は、対象名と説明の一致を優先して扱う。
resource: manual://V2.01#p61
tags: [image, hybrid]
timestamp: 2026-07-24T00:00:00Z
wcag: ["1.1.1"]
jis: ["1.1.1"]
processing_class: hybrid
municipality_specific: false
cms_auto: false
known_failure: false
origin: manual
related: [/rules/image/alt-text.md, /rules/image/caption.md, /rules/image/complex-image-report.md, /wcag/ch3-images.md]
---

# 必須ルール
文化財・個別紹介ページのように、画像がページ全体のまとまりではなく特定の対象（仏像・美術工芸品・史跡等）の説明補助になっている場合は、画像＋関連リンクの共通ルール（showcase-section）へ寄せず、対象名と説明文の整合を優先して扱う。代替テキスト（画像名）は対象名を基本にし、対象名と画像内容がずれる場合のみ画像内容の説明を補う。キャプションは対象の短い説明としてまとめ、リンクが少ない場合は関連リンク群として無理にまとめない。対象名と画像の関係が説明文で自然に伝わるか、画像の説明が文化財としての対象名とぶれていないかを確認する。

# 例
## ケース1: 具足の個別紹介画像
```before
<figure><img src="gusoku.jpg" alt="写真"><figcaption>写真</figcaption></figure>
```
```after
<figure><img src="gusoku.jpg" alt="青漆塗萌黄糸威二枚胴具足"><figcaption>青漆塗萌黄糸威二枚胴具足</figcaption></figure>
```
ポイント: 個別対象の紹介画像は、汎用的な「写真」ではなく対象名（文化財の名称）を画像名の基本にする。

## ケース2: 仏像の紹介画像
```before
<figure><img src="butsuzo.jpg" alt="仏像の写真"><figcaption>仏像の写真</figcaption></figure>
```
```after
<figure><img src="butsuzo.jpg" alt="大日如来坐像"><figcaption>大日如来坐像</figcaption></figure>
```
ポイント: 分類語（仏像・写真）ではなく、対象を特定できる名称を優先する。リンクが少ないページでは、関連リンク群としてまとめようとしない。

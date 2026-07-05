---
type: migration-rule
title: 複雑な画像の補足説明・報告
description: グラフ・楽譜・チラシ・凡例等は本文に説明を追記し、画像名に「詳細は以下」を付して報告する
resource: manual://V2.01#p63
tags: [image, escalation]
timestamp: 2025-12-15T00:00:00Z
wcag: ["1.1.1"]
jis: ["1.1.1"]
processing_class: escalation
municipality_specific: false
cms_auto: false
related: [/rules/image/alt-text.md, /wcag/ch3-images.md]
---

# 必須ルール
代替テキスト（200字未満）で説明しきれない複雑な画像（グラフ・楽譜・チラシ・凡例等）は、本文に内容説明テキストを追記するか解説ページへのリンクを提供する。画像名に「○○のグラフ 詳細は以下」を付し、自治体向けコメントを報告欄に起票する。

# 例
## ケース1: 集計グラフ
```before
人口推移の集計結果のグラフ
```
```after
人口推移のグラフ 詳細は以下
```
ポイント: 本文へ内容説明を追記し、報告欄に「グラフの内容説明を画像に続けてテキスト掲載してください」と起票する。

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
origin: manual
michecker_check_ids: ["C_4.0", "C_80.0"]
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

## ケース2: alt属性が長すぎる（150文字超）
```before
<img src="chart.png" alt="令和3年度から令和8年度までの人口推移を示す折れ線グラフで、令和3年は12万3千人、令和4年は12万1千人、令和5年は11万9千人、令和6年は11万7千人、令和7年は11万5千人、令和8年は11万3千人と年々減少傾向にあることを示している（以下略、150文字超）">
```
```after
<img src="chart.png" alt="人口推移のグラフ 詳細は以下">
（詳しい数値は本文またはaria-describedbyで参照できる別要素に記載する）
```
ポイント: 代替テキストに詳細情報を全て詰め込むと読み上げの負担が大きくなる。aria-describedby等で本文側に詳細説明を分離できないか検討する。

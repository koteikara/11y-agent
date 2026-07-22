---
type: migration-rule
title: 表組みの単純な構造
description: 結合セルはできるだけ単純な構造にする。表を維持したまま結合だけ解消する・意味単位に分割するなどして複雑さを減らす
resource: https://design-system.isct.ac.jp/ja/documents/web-accessibility-support-book/content/table
tags: [table]
timestamp: 2026-07-22T00:00:00Z
wcag: ["1.3.1"]
jis: ["なし"]
processing_class: hybrid
municipality_specific: false
cms_auto: false
origin: external-guideline
related: [/rules/table/th-scope.md, /rules/table/layout-table.md, /rules/table/cell-merge-layout.md]
---

# 必須ルール
表組みはできるだけ単純な構造にする。セルの結合や入れ子は、表が複雑になりスクリーンリーダー等の支援技術での理解を困難にすることがあるため、なるべく避ける。セルの結合自体は非推奨ではないが、結合や入れ子を使う場合は、読み上げが適切にできるかを確認する。

# 例
## ケース1: 結合セルを解除してフラットな表に整える
```before
rowspan/colspanで結合されたセルを含む表
```
```after
結合を解除し、結合していたマスに同じ内容を並べた単純な行×列グリッドの表
```

## ケース2: 意味単位ごとに複数の表へ分割する
```before
複数の意味単位が1つの表に強引にまとめられ、結合が発生している表
```
```after
意味単位ごとに分割した、結合の無い複数の単純な表
```

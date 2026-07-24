---
type: migration-rule
title: セル結合⑪目次が設定されている場合
description: 結合セルで目次が設定されている表は、目次ごとに表組を分割する
resource: manual://V2.01#p48
tags: [table, ai]
timestamp: 2026-07-24T00:00:00Z
wcag: ["1.3.1"]
jis: ["なし"]
processing_class: hybrid
municipality_specific: true
cms_auto: false
known_failure: false
origin: manual
michecker_check_ids: ["C_76.1"]
related: [/rules/table/simple-structure.md, /rules/html-structure/heading-required.md, /wcag/ch6-table.md]
---

# 必須ルール
結合されたセルで目次（見出し的な区切り）が設定され、その下に複数の内容がぶら下がっている表は、目次ごとに表組を分割する。分割した各表の見出し相当は、見出し（heading-required.md）やキャプション（caption.md）で表す。

# 例
## ケース1: 目次ごとに表を分割する
```before
<table>
  <tr><td colspan="2">1. 新契約の計算式</td></tr>
  <tr><td>保険料の支払い額</td><td>控除額</td></tr>
  <tr><td colspan="2">2. 旧契約の計算式</td></tr>
  <tr><td>保険料の支払い額</td><td>控除額</td></tr>
</table>
```
```after
「1. 新契約の計算式」「2. 旧契約の計算式」を見出しにし、それぞれの下に独立した表を置く（目次ごとに分割）。
```
ポイント: 1つの表に複数の区分をまとめず、区分（目次）ごとに表を分けると、読み上げで各表の対応関係が明確になる。

---
type: migration-rule
title: 取込/貼付け表の書式解除
description: 取り込んだ表やExcel貼付け表は、書式解除してから編集する
resource: manual://V2.01#p38
tags: [table, mechanical]
timestamp: 2025-12-15T00:00:00Z
wcag: ["なし"]
jis: ["なし"]
processing_class: mechanical
municipality_specific: false
cms_auto: false
related: [/cms/paste-text.md]
---

# 必須ルール
取り込まれた表・Excel等から貼り付けた表はフォント指定など不要タグを含む。必ず表全体を選択して書式解除を実行してから編集する。

# 例
## ケース1: 不要タグの除去
```before
<td style="font-family:..."> ... </td>
```
```after
書式解除後のシンプルな <td>
```

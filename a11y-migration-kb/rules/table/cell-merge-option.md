---
type: migration-rule
title: セル結合⑩オプション的な結合
description: 結合セルでオプション的な内容を表している場合は、セル内に括弧書きで表現する
resource: manual://V2.01#p47
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
related: [/rules/table/simple-structure.md, /wcag/ch6-table.md]
---

# 必須ルール
結合されたセルで、ある項目に対するオプション的（付随的）な内容を表している場合は、結合をやめ、対象のセル内に括弧書きで表現する。

# 例
## ケース1: オプション的な結合を括弧書きにする
```before
<td>市役所</td><td rowspan="2">駐車場あり</td>
```
```after
<td>市役所（駐車場あり）</td>
```
ポイント: 結合で「まとめて表現」する代わりに、対象セル内に括弧書きで付随情報を入れると、読み上げでも対応関係が保たれる。

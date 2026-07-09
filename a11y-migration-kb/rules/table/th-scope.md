---
type: migration-rule
title: 表の見出しセル(th)とscope属性
description: データテーブルの見出しセルにはthを使い、scope属性で見出しの方向(列/行)を明示する
resource: https://github.com/eclipse-actf/org.eclipse.actf/blob/master/org.eclipse.actf.validation.html/resources/checkitem.xml
tags: [table, mechanical]
timestamp: 2026-07-08T00:00:00Z
wcag: ["1.3.1"]
jis: ["なし"]
processing_class: hybrid
municipality_specific: false
cms_auto: false
origin: michecker
michecker_check_ids: ["C_75.0", "C_76.0", "C_331.0", "C_331.1", "C_331.2", "C_332.0", "C_332.1", "C_332.2"]
related: [/rules/table/caption.md, /rules/table/layout-table.md, /wcag/ch6-table.md]
---

# 必須ルール
データテーブル（内容の対応関係を伝える表）の見出しセルには`th`要素を使い、`scope`属性で見出しの方向を明示する。列見出しには`scope="col"`、行見出しには`scope="row"`を設定する。CMSの表パーツで見出し行・見出し列を指定すると自動で付与される場合は、その機能を使う。miCheckerではscope属性の欠如は「問題あり」（最も重い区分）として検出される。

# 例
## ケース1: scope属性の無い見出しセル
```before
<table><caption>手数料一覧</caption>
<tr><th>区分</th><th>金額</th></tr>
<tr><td>住民票</td><td>300円</td></tr></table>
```
```after
<table><caption>手数料一覧</caption>
<tr><th scope="col">区分</th><th scope="col">金額</th></tr>
<tr><td>住民票</td><td>300円</td></tr></table>
```

## ケース2: 行見出しがtdになっている
```before
<tr><td>受付時間</td><td>平日9時〜17時</td></tr>
```
```after
<tr><th scope="row">受付時間</th><td>平日9時〜17時</td></tr>
```
ポイント: 見出しが列・行の両方にある表や、セル結合がある表では単純なscope指定では不十分な場合がある。結合がある場合はセル結合ルール（cell-merge-*）に沿って表を崩す・分割することを先に検討する。

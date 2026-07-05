---
type: migration-rule
title: リンク切れの対応
description: リンク切れは報告し、文脈に応じてリンク削除またはテキスト化する
resource: manual://V2.01#p85
tags: [link, escalation]
timestamp: 2025-12-15T00:00:00Z
wcag: ["2.4.4"]
jis: ["2.4.4"]
processing_class: escalation
municipality_specific: false
cms_auto: false
related: [/reference/spreadsheet-fields.md]
---

# 必須ルール
リンク先がnotfound・見つかりません・トップへリダイレクト等で表示できない場合は「リンク切れ」として報告欄で報告する。新URLと思われるものを見つけても移行URLは変更せず、報告欄に挙げるのみとする。

# 例
## ケース1: 削除可（影響なし）
```before
リンク集で説明文の無いリンクのみが並ぶ
```
```after
リンクを削除（報告欄に報告）
```

## ケース2: 削除不可（文脈に必要）
```before
文中の一部にリンクが設定され、削除すると文意が途切れる
```
```after
テキストは残しリンクのみ解除（報告欄に報告）
```

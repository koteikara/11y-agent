---
type: migration-rule
title: 注釈記号（※）の扱い
description: ※を「注意」等に置換せず、太字やリスト＋補足で構造化する
resource: manual://V2.01#p25
tags: [text, ai]
timestamp: 2025-12-15T00:00:00Z
wcag: ["1.3.1"]
jis: ["なし"]
processing_class: ai
municipality_specific: false
cms_auto: false
related: [/rules/text/bold.md, /rules/text/list.md]
---

# 必須ルール
「※」を機械的に「注意」と置換しない。「注意」「注釈」「（注）」は原則使わず太字を使用する。
注釈として記号が連続使用されている場合はリストへ整理する。判断に迷う場合は質問する。

# 例
## ケース1: 連続する注釈記号 → リスト＋括弧書き
```before
◎市役所（※）
◎市民ホール（※）
※・・・駐車場あり。
```
```after
- 市役所（駐車場あり）
- 市民ホール（駐車場あり）
```

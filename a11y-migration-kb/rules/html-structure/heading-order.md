---
type: migration-rule
title: 見出し階層の順守
description: 見出しはレベルの高いものから順に使用し、階層をスキップしない
resource: manual://V2.01#p31
tags: [html]
timestamp: 2025-12-15T00:00:00Z
wcag: ["1.3.1", "2.4.1", "2.4.10"]
jis: ["2.4.1"]
processing_class: ai
municipality_specific: false
cms_auto: true
origin: kb
related: [/rules/html-structure/heading-required.md, /wcag/ch5-text.md, /rules/html-structure/heading-content-quality.md]
---

# 必須ルール
見出しはレベルの高いものから順に使用する。見出し2を使わずに見出し3は使えない。見出し1はページタイトルで自動設定されるためコンテンツエリアでは使用不可。順序不正はアクセシビリティチェックで承認申請・公開がブロックされる。

# 例
## ケース1: レベルスキップ
```before
見出し1（ページタイトル）
↓
見出し3
```
```after
見出し1（ページタイトル）
↓
見出し2
↓
見出し3
```
ポイント: 低→高（見出し6→見出し3）や同レベル連続はOK。

---
type: workflow-step
title: 基本ルール
description: 置換による変換、取込データと移行元の差異対応、未取込時の対応、迷った場合の質問
resource: manual://V2.01#p8
tags: [workflow, policy]
timestamp: 2025-12-15T00:00:00Z
processing_class: hybrid
municipality_specific: false
related: [/reference/question-protocol.md]
---

# 必須ルール
- 記号や単位は手作業ではなく「置換」で変換する。置換時に意図しない箇所まで変換されていないか確認する。
- 取込データと移行元ページに差異がある場合は、原則移行元の内容になるよう移行元からコピー&ペーストで移行する。
- データが全て取り込まれていない場合は、移行元からファイルをDLしCMSへ手作業でアップロードする。未取込が多すぎる場合は相談する。
- ルールに無く迷った場合は自己判断せず、スプレッドシートの質問欄でSVに質問し、回答を待ってから作業する。

# 例
## ケース1: 一括置換の誤爆チェック
```before
単位「CM」を「センチメートル」に一括置換 → 文中の「CMYK」が「センチメートルYK」に化ける
```
```after
置換対象を確認し、語中に含まれるケース（CMYK等）を除外して変換する
```
ポイント: mechanical置換でも誤爆確認は人間が行う。

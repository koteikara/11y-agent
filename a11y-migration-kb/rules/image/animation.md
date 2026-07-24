---
type: migration-rule
title: アニメーション画像
description: 5秒以上動き続けるアニメーション画像はそのまま移行せず、移行方法を確認する
resource: manual://V2.01#p70
tags: [image, escalation]
timestamp: 2026-07-24T00:00:00Z
wcag: ["2.2.2"]
jis: ["2.2.2"]
processing_class: escalation
municipality_specific: false
cms_auto: false
known_failure: false
origin: manual
related: [/rules/image/alt-text.md, /wcag/ch3-images.md]
---

# 必須ルール
5秒以上動き続けるアニメーション画像（例：矢印がぐるぐる回り続けるアニメーションGIF等）は、アクセシビリティ上望ましくないため、そのままの状態では移行しない。どう移行するかはページの内容に応じて検討が必要なため、質問欄で確認する（回答を待つ）。静止画は対象外。

# 例
## ケース1: 5秒以上のアニメーションGIF
```before
<img src="/img/loading-arrow.gif" alt="読み込み中">
```
```after
（そのまま移行せず、質問欄で移行方法を確認する。動きを止めた静止画に差し替える、アニメーションを外す等をページ内容に応じて判断）
```
ポイント: アクセシビリティチェックでは GIF 形式（.gif）の画像はすべて「アニメーションGIF」の指摘が出る（アニメーションか静止画かは拡張子からは機械判別できないため）。指摘された画像が静止画なら問題なくそのまま使用してよく、質問は不要。実際に5秒以上動くアニメーションだった場合のみ、質問欄で確認する。

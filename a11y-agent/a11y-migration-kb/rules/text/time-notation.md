---
type: migration-rule
title: 時間の表記
description: 音声読み上げで時間として読まれない表記を、○時／午後○時等に修正する
resource: manual://V2.01#p26
tags: [text, mechanical]
timestamp: 2025-12-15T00:00:00Z
wcag: ["1.3.1"]
jis: ["なし"]
processing_class: hybrid
municipality_specific: true
cms_auto: false
---

# 必須ルール
音声読み上げで時間として読まれない表記は、13時、午後1時のような表記に修正する。
24時間表記・12時間表記の統一が必要な場合は自治体別マニュアルに従う。

# 例
## ケース1: コロン区切り
```before
13:00
```
```after
13時
```

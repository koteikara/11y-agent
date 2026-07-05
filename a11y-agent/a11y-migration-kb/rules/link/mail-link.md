---
type: migration-rule
title: メールリンク
description: メールアドレス直書きのリンクを暗号化されるメールリンクに修正する
resource: manual://V2.01#p76
tags: [link, ai]
timestamp: 2025-12-15T00:00:00Z
wcag: ["2.4.4"]
jis: ["2.4.4"]
processing_class: ai
municipality_specific: true
cms_auto: false
---

# 必須ルール
メールアドレス表記のままのメールリンクは、アドレス名を「●●へメールを送信」に修正する。アドレス名に生アドレスを入れると暗号化されず迷惑メールの恐れがある。

# 例
## ケース1: 生アドレス表記
```before
sample@smartvalue.jp
```
```after
市民課へメールを送信
```

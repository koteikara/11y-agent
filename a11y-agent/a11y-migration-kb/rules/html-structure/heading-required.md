---
type: migration-rule
title: 見出しの設定
description: 文書構造上の見出しを適切な見出し要素として設定する
resource: manual://V2.01#p30
tags: [html, ai]
timestamp: 2025-12-15T00:00:00Z
wcag: ["1.3.1", "2.4.1"]
jis: ["2.4.1"]
processing_class: ai
municipality_specific: false
cms_auto: false
related: [/rules/html-structure/heading-order.md, /wcag/ch5-text.md]
---

# 必須ルール
文章は見出しと内包する文で構成される。見出しに当たる箇所が見出し要素として設定されていない場合は設定する。適切な見出しにより音声読み上げでの拾い読みが可能になる。

# 例
## ケース1: 見出し未設定の小項目
```before
担当課
市民課
届出期間
出生日から14日以内
```
```after
（見出し3）担当課
市民課
（見出し3）届出期間
出生日から14日以内
```
ポイント: 「担当課」「届出期間」等は見出し3として設定する。

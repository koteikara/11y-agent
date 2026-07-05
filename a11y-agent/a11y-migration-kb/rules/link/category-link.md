---
type: migration-rule
title: カテゴリページへの内部リンク
description: 移行対象外のカテゴリページは、移行元パンくずを参考にツリーで特定して設定する
resource: manual://V2.01#p83
tags: [link]
timestamp: 2025-12-15T00:00:00Z
wcag: ["2.4.4"]
jis: ["2.4.4"]
processing_class: escalation
municipality_specific: false
cms_auto: false
related: [/rules/link/internal-link.md]
---

# 必須ルール
カテゴリページは移行対象外で移行管理シート上で特定できない。移行元のカテゴリページのパンくずを確認し、SMARTCMSツリービューで該当カテゴリを特定する。特定できない・迷う場合は質問する。カテゴリNoが一致するページを内部リンク先に設定する。

# 例
## ケース1: パンくずからの特定
```before
内部リンク先がカテゴリ「育児サポート」（移行元パンくず：トップ＞子育て＞育児サポート）
```
```after
CMSツリーで対応カテゴリを特定し、カテゴリNo一致ページを内部リンク先に設定
```

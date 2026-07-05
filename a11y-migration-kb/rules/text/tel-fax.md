---
type: migration-rule
title: 電話・FAXの表記
description: TEL/FAX等の略記を、電話番号・ファックス等の表記に修正する
resource: manual://V2.01#p28
tags: [text, mechanical]
timestamp: 2025-12-15T00:00:00Z
wcag: ["1.1.1"]
jis: ["なし"]
processing_class: hybrid
municipality_specific: true
cms_auto: true
---

# 必須ルール
「TEL」「FAX」等の表記は、電話番号／電話／ファックス番号／ファックス／ファクス のいずれかに必要に応じて修正する（禁則文字で変換）。どれに修正するかは自治体別マニュアルに従う。

# 例
## ケース1: TEL略記
```before
TEL：000-000-0000
```
```after
電話番号：000-000-0000
```
ポイント: 「HOTEL」のように単語内に含まれ自動変換される場合は質問する。

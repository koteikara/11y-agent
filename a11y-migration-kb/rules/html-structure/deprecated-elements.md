---
type: migration-rule
title: 廃止された要素・属性の除去
description: font・marquee・blink・applet・center等の廃止された要素は使用せず、CSS相当の表現に置き換える
resource: https://accessibility.jp/resources/tools/michecker-techniques/
tags: [html, mechanical]
timestamp: 2026-07-07T00:00:00Z
wcag: ["4.1.1", "2.2.2", "2.3.1"]
jis: ["なし"]
processing_class: hybrid
municipality_specific: false
cms_auto: false
origin: manual
michecker_check_ids: ["C_48.0", "C_48.1", "C_48.2", "C_48.3", "C_48.4", "C_48.5", "C_48.6", "C_48.7", "C_48.8", "C_600.9", "C_600.10", "C_33.0", "C_33.1", "C_33.2", "C_34.0", "C_25.2", "C_25.4", "C_3.0", "C_3.1"]
related: [/rules/text/font-size.md, /rules/text/decoration-lines.md, /rules/table/caption.md, /wcag/ch2-site.md]
---

# 必須ルール
`font`・`marquee`・`blink`・`applet`・`center`・`u`・`tt`・`acronym`・`big`・`strike`等、HTML Living Standardで廃止された要素・属性は使用しない。文字装飾はCSSまたはCMSの装飾機能に、動きのある表現（marquee・blinkによる明滅・スクロール）は削除する。移行元にこれらの要素が残っている場合は、対応するCMS機能または現代的なHTMLへ置き換える。

`img`要素の`longdesc`属性、`table`要素の`summary`属性も同様に廃止済みのため、内容を確認・改善するのではなく一律で除去する。表の概要は`summary`属性ではなく`caption`要素で提供する（`table/caption.md`）。longdescで提供していた詳細情報は、本文への説明追記や解説ページへのリンクに置き換える（`image/complex-image-report.md`）。`applet`要素自体を除去する方針のため、画像ボタン用途で使われていたapplet要素のalt属性の内容確認も不要になる。

# 例
## ケース1: fontタグによる装飾
```before
<font color="#0066cc" size="4">お知らせ</font>
```
```after
お知らせ（CMSの文字色・見出し機能で表現）
```

## ケース2: marquee・blinkによる明滅・スクロール
```before
<marquee>新着情報はこちら</marquee>
```
```after
新着情報はこちら（通常のテキストとして表示、自動的な明滅・スクロールは行わない）
```
ポイント: marquee・blinkは5秒以上の明滅・スクロールを禁止するWCAG 2.2.2にも抵触するため、要素自体を除去すれば両方の指摘が解消する。

## ケース3: table要素のsummary属性
```before
<table summary="この表は開庁日と受付時間の一覧です。">...</table>
```
```after
<table><caption>開庁日・受付時間一覧</caption>...</table>
```
ポイント: summary属性の内容が的確かを確認・改善するのではなく、属性自体を除去し、必要な概要はcaption要素（`table/caption.md`）で提供する。

---
type: migration-rule
title: 廃止された要素・属性の除去
description: font・marquee・blink・applet・center等の廃止された要素は使用せず、CSS相当の表現に置き換える
resource: https://accessibility.jp/resources/tools/michecker-techniques/
tags: [html, mechanical]
timestamp: 2026-07-07T00:00:00Z
wcag: ["4.1.1", "2.2.2"]
jis: ["なし"]
processing_class: hybrid
municipality_specific: false
cms_auto: false
related: [/rules/text/font-size.md, /rules/text/decoration-lines.md, /wcag/ch2-site.md]
---

# 必須ルール
`font`・`marquee`・`blink`・`applet`・`center`・`u`・`tt`・`acronym`・`big`・`strike`等、HTML Living Standardで廃止された要素・属性は使用しない。文字装飾はCSSまたはCMSの装飾機能に、動きのある表現（marquee・blinkによる明滅・スクロール）は削除する。移行元にこれらの要素が残っている場合は、対応するCMS機能または現代的なHTMLへ置き換える。

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

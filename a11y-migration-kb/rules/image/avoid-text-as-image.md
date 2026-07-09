---
type: migration-rule
title: 文字を画像化しない
description: バナー等に埋め込まれた文字情報は、可能な限り画像ではなく本文テキストとして提供する
resource: https://github.com/eclipse-actf/org.eclipse.actf/blob/master/org.eclipse.actf.validation.html/resources/checkitem.xml
tags: [image, hybrid]
timestamp: 2026-07-07T00:00:00Z
wcag: ["1.4.5", "1.4.9"]
jis: ["なし"]
processing_class: hybrid
municipality_specific: false
cms_auto: false
origin: michecker
michecker_check_ids: ["C_500.2", "C_500.14"]
related: [/rules/image/alt-text.md]
---

# 必須ルール
CMSで意図した見た目（フォント・配色等）を再現できる場合、文字情報を画像に埋め込んで提供しない。バナー画像内の見出しや告知文をそのまま画像化するのではなく、本文テキスト＋CSSの装飾機能で表現する。ロゴ・図表内の説明的でない文字等、画像化がやむを得ない場合は、代替テキスト（`alt-text.md`）で内容を確実に伝える。

# 例
## ケース1: 告知文が画像に埋め込まれている
```before
<img src="banner_20260707.png" alt="バナー画像">
（画像内に「7月10日は休館日です」という文字が描かれている）
```
```after
<p>7月10日は休館日です</p>（画像を使わず本文テキストとCMSの装飾機能で表現）
```

## ケース2: 画像化がやむを得ない場合
```before
<img src="event_banner.png" alt="バナー画像">
```
```after
<img src="event_banner.png" alt="夏祭り開催のお知らせ（7月20日開催）">
```
ポイント: 画像化を完全に禁止するのではなく、CMSの機能で同等の見た目を再現できるかをまず検討し、やむを得ず画像化する場合は代替テキストで内容を担保する。

---
type: migration-rule
title: iframe・frame要素のtitle属性
description: iframe・frame要素には、内容を説明する空でないtitle属性を設定する
resource: https://github.com/eclipse-actf/org.eclipse.actf/blob/master/org.eclipse.actf.validation.html/resources/checkitem.xml
tags: [html, mechanical]
timestamp: 2026-07-07T00:00:00Z
wcag: ["4.1.2"]
jis: ["なし"]
processing_class: mechanical
municipality_specific: false
cms_auto: false
origin: michecker
michecker_check_ids: ["C_51.0", "C_51.1", "C_51.4", "C_51.5"]
related: []
---

# 必須ルール
本文に埋め込む`iframe`・`frame`要素には、フレームの内容が分かる空でないtitle属性を設定する。「iframe」「動画」「地図」等の汎用的な値ではなく、埋め込み内容（地図の対象地点、動画のタイトル等）が特定できる文言にする。

# 例
## ケース1: title属性が無い
```before
<iframe src="/maps/center.html" width="560" height="280"></iframe>
```
```after
<iframe src="/maps/center.html" title="本庁舎周辺の地図" width="560" height="280"></iframe>
```

## ケース2: title属性が汎用的
```before
<iframe src="https://www.youtube.com/embed/sample" title="動画" width="560" height="315"></iframe>
```
```after
<iframe src="https://www.youtube.com/embed/sample" title="市長あいさつ動画" width="560" height="315"></iframe>
```
ポイント: 埋め込み元（地図サービス・動画サイト等）の許可・利用規約上、CMS本文にiframeを含めてよいかも別途確認する。

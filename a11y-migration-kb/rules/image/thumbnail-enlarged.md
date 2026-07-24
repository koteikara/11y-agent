---
type: migration-rule
title: サムネイル画像と拡大画像の移行
description: クリックで拡大表示する画像は、サムネイルを画像パーツ・拡大画像をファイルリンクに移行し、拡大画像に情報がある場合は拡大画像も残す
resource: manual://V2.01#p67
tags: [image, hybrid]
timestamp: 2026-07-24T00:00:00Z
wcag: ["1.1.1"]
jis: ["1.1.1"]
processing_class: hybrid
municipality_specific: false
cms_auto: false
known_failure: false
origin: manual
related: [/rules/image/alt-text.md, /rules/image/complex-image-report.md, /rules/file/file-display-text.md]
---

# 必須ルール
クリックすると拡大表示（原寸表示）される画像は、原則としてサムネイル画像を画像パーツに、拡大画像をファイルリンクに移行する。ただし拡大画像に情報があり、拡大画像を無くすと移行後のページで利用者が情報を得られなくなる場合（イベントのポスター・チラシ、申込書サンプル・記入例、施設内マップ・アクセスマップ、グラフ等）は、縮小画像を画像パーツに、拡大画像をファイルリンクに移行し、移行後も拡大画像から情報を得られるようにする。単にクリックで大きく表示するだけ（拡大画像に追加情報が無い）の場合は、拡大画像側にリンクを設定せず、クリックしても何も起きない状態でよい。

# 例
## ケース1: 情報のある拡大画像（ポスター等）
```before
<a href="/img/event-poster-large.jpg"><img src="/img/event-poster-thumb.jpg" alt="イベントポスター"></a>
```
```after
<img src="/img/event-poster-thumb.jpg" alt="○○イベントのポスター 詳細は以下">
<a href="/img/event-poster-large.jpg">拡大画像（JPEG:228KB）</a>
```
ポイント: ポスター・チラシ・申込書・マップ・グラフ等は拡大画像に情報があるため、拡大画像をファイルリンクとして残す。拡大画像側の内容は complex-image-report.md（○○の△△ 詳細は以下）の考え方で扱う。

## ケース2: 情報の無い拡大画像（写真を大きく見せるだけ）
```before
<a href="/img/sky-large.jpg"><img src="/img/sky-thumb.jpg" alt="青空の写真"></a>
```
```after
<img src="/img/sky-thumb.jpg" alt="雲の浮かぶ青空と海の写真">
```
ポイント: 拡大しても新しい情報が増えない画像は、拡大画像へのリンクを外して画像パーツのみにする。

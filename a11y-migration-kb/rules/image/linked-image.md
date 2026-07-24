---
type: migration-rule
title: リンクになっている画像の代替テキスト
description: 画像がリンクの場合、代替テキストは画像の内容だけでなくリンク先（リンクの目的）が分かる文言にする
resource: manual://V2.01#p68
tags: [image, hybrid]
timestamp: 2026-07-24T00:00:00Z
wcag: ["1.1.1", "2.4.4"]
jis: ["1.1.1", "2.4.4"]
processing_class: hybrid
municipality_specific: false
cms_auto: false
origin: manual
related: [/rules/image/alt-text.md, /rules/link/link-text.md, /wcag/ch3-images.md, /wcag/ch4-links.md]
---

# 必須ルール
画像がリンク（a要素）の中にあり、その画像がリンクの読み上げ名を担っている（リンク内に他のテキストが無い）場合、代替テキスト（画像名）はそのままリンクの読み上げ名になる。画像の内容に加えて「どこへ移動するか（リンク先）」が分かる文言にする。alt が空でリンク名が空になる場合は link.link-text（読み上げ可能なテキストが無いリンク）として扱い、alt が入力済みでも被写体の説明だけでリンク先が分からない場合は、リンク先が分かる言葉を追記する。

# 例
## ケース1: バナー画像のリンク（内容＋リンク先）
```before
<a href="https://mobility.example.jp/"><img src="banner.png" alt="Mobility社会の次の可能性を。"></a>
```
```after
<a href="https://mobility.example.jp/"><img src="banner.png" alt="Mobility社会の次の可能性を。Mobility IoT（Mobility IoTのサイトへリンク）"></a>
```
ポイント: リンク画像の alt は「画像の内容＋（リンク先が分かる語）」の形にする。例）「SMARTVALUE Facebookページ いいね（SMARTVALUE Facebookページへリンク）」。

## ケース2: 内容説明だけでリンク先が分からない
```before
<a href="/kanko/"><img src="tokushu.png" alt="観光地特集のポスター"></a>
```
```after
<a href="/kanko/"><img src="tokushu.png" alt="観光地特集（◯◯市観光サイトへリンク）"></a>
```
ポイント: 被写体の説明（「観光地特集のポスター」）だけでは、その画像をクリックすると何が起きるか（どこへ飛ぶか）が読み上げ利用者に伝わらない。リンク先が分かる言葉を必ず含める。

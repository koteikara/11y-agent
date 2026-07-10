---
type: migration-rule
title: リンク単体の見出しタグを使わない
description: 見出しタグがリンク（内部・外部・ファイル）1件だけをラップしている場合は、見出しではなく通常のリンクとして扱う
resource: manual://V2.01#p30
tags: [html, mechanical]
timestamp: 2026-07-10T00:00:00Z
wcag: ["1.3.1", "2.4.6"]
jis: ["2.4.1"]
processing_class: mechanical
municipality_specific: false
cms_auto: true
origin: manual
related: [/rules/html-structure/heading-order.md, /rules/html-structure/heading-required.md, /rules/html-structure/heading-content-quality.md]
---

# 必須ルール
見出し要素（h1〜h6）の中身が、内部リンク・外部リンク・ファイル（PDF等）リンクのいずれか1件だけで構成されている場合、その見出しタグは外し、通常のリンクとして扱う。カード型の一覧表示（お知らせ一覧・関連ページ一覧等）で、見た目の強調のためにCMSテンプレートが見出しタグでリンクをラップしているケースが典型例。この種の要素は文書構造上の見出し（セクションの内容を説明するもの）ではなく、リンクの一種であるため、見出しとして移行すると見出しジャンプ（スクリーンリーダーの見出し単位ナビゲーション）で本来の見出しに混じって大量に列挙され、文書構造の把握を妨げる。

同一ページ内アンカー（`#`のみのリンク）やリンク切れ（`href`が空・`#`のみ）は対象外とする（別ルールで扱う）。見出しにリンク以外のテキストも含まれている場合（例: 「新着：〇〇のお知らせ」の一部だけがリンク）は、見出しとしての文書構造を保つ可能性があるため対象外とし、人間の確認に委ねる。

# 例
## ケース1: お知らせ一覧のカード型見出し
```before
<h3><a href="/news/20260701.html">粗大ごみ収集の申し込み方法が変わります</a></h3>
```
```after
<a href="/news/20260701.html">粗大ごみ収集の申し込み方法が変わります</a>
```

## ケース2: 関連ファイルへのリンクが見出しになっている
```before
<h4><a href="/files/youkou.pdf">○○要綱（PDF）</a></h4>
```
```after
<a href="/files/youkou.pdf">○○要綱（PDF）</a>
```

## ケース3: 見出しにリンク以外のテキストも含む場合（対象外）
```before
<h3>新着：<a href="/news/20260701.html">粗大ごみ収集の申し込み方法</a></h3>
```
```after
<h3>新着：<a href="/news/20260701.html">粗大ごみ収集の申し込み方法</a></h3>
```
ポイント: 見出しがリンク単体ではなく他のテキストも含むため対象外（変更なし）。見出し自体は残し、リンク部分の妥当性のみ別途確認する。

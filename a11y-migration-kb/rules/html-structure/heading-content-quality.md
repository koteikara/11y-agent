---
type: migration-rule
title: 見出しの内容と太字利用の区別
description: 見出しタグは対応するセクションの内容を表す文言にし、単なる太字表示の目的で使わない
resource: https://github.com/eclipse-actf/org.eclipse.actf/blob/master/org.eclipse.actf.validation.html/resources/checkitem.xml
tags: [html, mechanical]
timestamp: 2026-07-07T00:00:00Z
wcag: ["2.4.6"]
jis: ["なし"]
processing_class: ai
municipality_specific: false
cms_auto: false
origin: michecker
michecker_check_ids: ["C_15.0", "C_388.0", "C_500.4"]
related: [/rules/html-structure/heading-order.md]
---

# 必須ルール
見出し(h1〜h6)は、対応するセクションの内容を説明する文言にする。テキストを太字にするためだけの目的で見出しタグを使わない（本来は太字にしたいだけの箇所には見出しタグではなくCMSの装飾機能を使う）。逆に、見出しであるべき箇所を太字の通常テキストで代用することも避ける。

# 例
## ケース1: 太字目的だけの見出し
```before
<h3>お問い合わせは平日9時〜17時まで</h3>
```
```after
お問い合わせは平日9時〜17時まで（太字スタイルを適用、見出しタグは使わない）
```

## ケース2: 見出しであるべき箇所が太字テキストで代用されている
```before
<p><strong>よくある質問</strong></p>
```
```after
<h3>よくある質問</h3>
```
ポイント: `heading-order.md`（マニュアル版）は見出しレベルの階層順序を扱い、そのチェックは本ルール（miChecker版、見出しタグの使い方そのもの）を内包する。マニュアル版の基準（見出しが対応するセクションを正しく表している）を満たしていれば、本ルールが指摘する太字目的だけの濫用も通常あわせて解消する。

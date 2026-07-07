---
type: migration-rule
title: 形状・位置・色だけに依存した説明の回避
description: 「右のボタン」「赤い項目」等、形・位置・色だけに頼った案内文を、名前や見出しで特定できる表現に修正する
resource: https://github.com/eclipse-actf/org.eclipse.actf/blob/master/org.eclipse.actf.validation.html/resources/checkitem.xml
tags: [text, ai]
timestamp: 2026-07-07T00:00:00Z
wcag: ["1.3.3"]
jis: ["なし"]
processing_class: ai
municipality_specific: false
cms_auto: false
origin: michecker
michecker_check_ids: ["C_83.0"]
related: [/rules/text/color.md]
---

# 必須ルール
ページの内容を理解・操作するために必要な情報を、コンテンツの形・位置・色・音だけに依存させない。「右側のボタンを押してください」「上の図を参照」「赤い項目が必須です」のような案内文は、形状や位置、色を認識できない利用者（画面拡大・音声読み上げ・色覚特性等）に伝わらない。ボタン名・見出し名など、テキストで特定できる情報を併記する。

# 例
## ケース1: 位置だけに依存した案内
```before
画面右上のボタンから申込書をダウンロードしてください。
```
```after
画面右上の「申込書ダウンロード」ボタンから申込書をダウンロードしてください。
```

## ケース2: 色だけに依存した案内
```before
赤字の項目は入力必須です。
```
```after
赤字（必須マーク付き）の項目は入力必須です。
```
ポイント: 位置・色の説明を削除するのではなく、名前や記号による特定情報を追加する。位置・色の情報自体は残してよい。

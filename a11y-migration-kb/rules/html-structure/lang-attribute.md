---
type: migration-rule
title: 文書のlang属性
description: html要素のlang属性に、文書内で主に使用されている言語をBCP 47準拠の値で設定する
resource: https://accessibility.jp/resources/tools/michecker-techniques/
tags: [html, mechanical]
timestamp: 2026-07-07T00:00:00Z
wcag: ["3.1.1"]
jis: ["なし"]
processing_class: mechanical
municipality_specific: false
cms_auto: true
related: [/rules/text/foreign-language.md, /wcag/ch2-site.md]
---

# 必須ルール
`html`要素のlang属性には、文書内で主に使用されている言語をBCP 47準拠の値（日本語なら`ja`）で設定する。新CMSのテンプレートで自動設定される場合が多いが、移行元ページに設定が無い・不正な値になっている場合は、新CMS側で正しく設定されているか確認する。

# 例
## ケース1: lang属性が未設定
```before
<html>
```
```after
<html lang="ja">
```

## ケース2: BCP 47に準拠しない値
```before
<html lang="japanese">
```
```after
<html lang="ja">
```
ポイント: 本文中の外国語の語句への言語属性付与は別ルール（foreign-language.md）で扱う。

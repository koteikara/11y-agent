---
type: migration-rule
title: 必須項目のテキストによる明示
description: フォームの必須項目は、色や記号だけでなくテキストの説明でも明示する
resource: https://github.com/eclipse-actf/org.eclipse.actf/blob/master/org.eclipse.actf.validation.html/resources/checkitem.xml
tags: [form, ai]
timestamp: 2026-07-07T00:00:00Z
wcag: ["3.3.1"]
jis: ["なし"]
processing_class: ai
municipality_specific: false
cms_auto: false
origin: michecker
michecker_check_ids: ["C_383.0"]
related: [/rules/form/label-position.md]
---

# 必須ルール
入力が必須の項目は、色や記号（アスタリスク等）だけでなく、テキストの説明（「必須」等）またはaria-required属性で明示する。色や記号のみで必須を示している場合は、テキストを併記する。

# 例
## ケース1: 記号のみで必須を示している
```before
<label for="name">お名前<span style="color:red">*</span></label>
<input type="text" id="name" required>
```
```after
<label for="name">お名前<span style="color:red">*</span>（必須）</label>
<input type="text" id="name" required>
```
ポイント: `label-position.md`のlabel配置ルールとあわせて確認する。フォームコントロール自体の実装（`aria-required`の付与等）はCMSのフォーム機能側の対応になる場合が多く、本文編集で対応できない場合は開発担当者に確認する。

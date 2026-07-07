---
type: migration-rule
title: フォームの送信ボタン
description: フォームには必ず実行（送信）ボタンを設置する
resource: https://accessibility.jp/resources/tools/michecker-techniques/
tags: [form, mechanical]
timestamp: 2026-07-07T00:00:00Z
wcag: ["3.2.2"]
jis: ["なし"]
processing_class: hybrid
municipality_specific: false
cms_auto: false
related: [/rules/form/label-position.md]
---

# 必須ルール
本文に埋め込まれたフォーム（アンケート・申込・検索等）には、必ず明示的な実行（送信）ボタンを設置する。入力内容の変化だけで自動的に送信・画面遷移する作りは避ける。

# 例
## ケース1: 送信ボタンが無いフォーム
```before
<select onchange="location.href=this.value">…</select>
```
```after
<select>…</select><button type="submit">移動する</button>
```
ポイント: プルダウン選択などで即座に画面遷移する実装は、意図しない操作による遷移が起きやすいため、明示的なボタンを設置する。

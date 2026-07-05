---
type: workflow-step
title: 移行フロー
description: ページ選定から移行管理シート反映、テンプレート調整、質問対応までの一連の流れ
resource: manual://V2.01#p10
tags: [workflow]
timestamp: 2025-12-15T00:00:00Z
processing_class: escalation
municipality_specific: false
related: [/workflow/basic-rules.md, /cms/source-data-deletion.md, /reference/spreadsheet-fields.md, /reference/question-protocol.md]
---

# 移行フロー

## 1. ページを選ぶ
- 移行対象のページを決める。
- ページ一覧や担当範囲を確認する。

## 2. 移行管理シートに反映する
- 移行管理シートにページ情報を記入する。
- 判定内容や対応内容が後から追えるように残す。

## 3. テンプレートを整える
- 必要に応じてCMSテンプレートへ移行内容を合わせる。
- 取込データと移行元の差異があれば、内容を見直す。

## 4. コンテンツを移行する
- 原則として移行元の内容をコピー&ペーストで反映する。
- 未取込がある場合は、移行元からファイルをDLしてCMSへ手作業でアップロードする。
- 未取込が多すぎる場合は相談する。

## 5. 質問がある場合
- ルールに無く迷った場合は自己判断しない。
- スプレッドシートの質問欄でSVに質問し、回答を待ってから作業する。

## 6. 画像系の分岐
- 画像系の振り分けで迷うときは、[showcase-section.md](/rules/image/showcase-section.md) と [heritage-image.md](/rules/image/heritage-image.md) を見る。
- 画像＋関連リンクか、対象記録かで分ける。

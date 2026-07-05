---
type: workflow-step
title: 移行作業者の作業フロー
description: ページ選択から移行完了・移行管理シート記載までの一連の流れ
resource: manual://V2.01#p10
tags: [workflow]
timestamp: 2025-12-15T00:00:00Z
processing_class: escalation
municipality_specific: false
related: [/workflow/basic-rules.md, /cms/source-data-deletion.md, /reference/spreadsheet-fields.md, /reference/question-protocol.md]
---

# 手順
1. ページを選択する
2. 移行管理シートに移行開始を記載（移行開始日・移行担当者）
3. 必要に応じてテンプレートを変更する（[cms/templates.md](/cms/templates.md)）
4. コンテンツを移行する
   - 不明箇所は質問する（[reference/question-protocol.md](/reference/question-protocol.md)）
   - 回答待ちの間は質問箇所以外を進める
   - 回答があれば該当箇所を移行する
5. 移行を完了させる（一時保存ボタン）
6. 移行管理シートに完了を記載（(最終)移行担当者・移行完了日）
7. 報告がある場合は移行管理シートに記載する

---
type: wcag-criteria
title: テーブル
description: レイアウト目的のtable禁止・caption/th/scope・セル結合最小化
resource: wcag_guideline_ai_optimized.md#CH6
tags: [wcag, table]
timestamp: 2025-12-15T00:00:00Z
---

# 6.1 レイアウト目的のtable禁止
判断基準: 各行が明確なまとまりを表し、縦横で比較検討する場合のみdata table。ヘッダーを隠して意味が通じる場合はレイアウト目的。

# 6.2 表見出しの設定
caption必須。行・列見出しにthとscope（row/col）。

# 6.3 セル結合は最小限
rowspan/colspanは必要最低限。

参照ルール: [caption](/rules/table/caption.md), [layout-table](/rules/table/layout-table.md), セル結合①〜⑥（rules/table/cell-merge-*.md）

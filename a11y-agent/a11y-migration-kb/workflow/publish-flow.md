---
type: workflow-step
title: 公開（チェック）作業者の作業フロー
description: 移行済みコンテンツの確認から移行元データ削除・公開までの流れ
resource: manual://V2.01#p10
tags: [workflow, review]
timestamp: 2025-12-15T00:00:00Z
processing_class: escalation
municipality_specific: false
related: [/cms/source-data-deletion.md, /reference/spreadsheet-fields.md]
---

# 手順
1. ページを選択する
2. 移行管理シートに公開作業開始を記載（公開作業担当者・公開作業開始日）
3. 移行されたコンテンツをチェックする
   - マニュアルに沿って移行されているか確認
   - 質問とその回答が正しく反映されているか確認
   - 不明箇所は質問する
4. ページ最下部の「移行元データ」を削除する（[cms/source-data-deletion.md](/cms/source-data-deletion.md)）
5. 移行を完了させる（公開ボタン）
6. 移行管理シートに完了を記載（(最終)公開作業担当者・公開作業完了日）
7. 報告がある場合は移行管理シートに記載する

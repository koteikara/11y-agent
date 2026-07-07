---
type: migration-rule
title: リンクのみで目的が分かること（空リンク・重複テキスト）
description: リンクテキストが空でないこと、同一テキストで異なる遷移先を指さないことを確認する
resource: https://github.com/eclipse-actf/org.eclipse.actf/blob/master/org.eclipse.actf.validation.html/resources/checkitem.xml
tags: [link, mechanical]
timestamp: 2026-07-07T00:00:00Z
wcag: ["2.4.9"]
jis: ["なし"]
processing_class: hybrid
municipality_specific: false
cms_auto: false
origin: michecker
michecker_check_ids: ["C_57.2", "C_57.4", "C_57.5", "C_57.6", "C_58.0"]
related: [/rules/link/link-text.md]
---

# 必須ルール
`link-text.md`（リンクテキストの文脈非依存化）とあわせて、以下も確認する。

- リンク内に読み上げ可能なテキストが存在しない（画像のみでalt無し等）状態を解消する。
- 直前・直後に同じURLへのリンクが連続する場合は、1つのリンクにまとめることを検討する。
- 異なる遷移先へのリンクに、同一のテキストを使うことは避ける（例: 複数のPDFに全て「ダウンロード」だけを使う等）。
- title属性を補助的に使う場合、リンクテキストと重複するだけの内容にしない。

# 例
## ケース1: 読み上げテキストが存在しないリンク
```before
<a href="/news/2026/report.pdf"><img src="pdf-icon.png"></a>
```
```after
<a href="/news/2026/report.pdf"><img src="pdf-icon.png" alt="">お知らせ2026年度報告書（PDF）</a>
```

## ケース2: 異なる遷移先に同一テキスト
```before
<a href="/news/2025.pdf">ダウンロード</a>
<a href="/news/2026.pdf">ダウンロード</a>
```
```after
<a href="/news/2025.pdf">2025年度報告書をダウンロード</a>
<a href="/news/2026.pdf">2026年度報告書をダウンロード</a>
```
ポイント: `link-text.md`は「指示語だけのリンクを避ける」という編集面の指摘、本ルールは「空リンク・重複テキスト」というmiChecker側の機械的な検出観点。同じリンクテキスト改善作業の中で両方確認する。

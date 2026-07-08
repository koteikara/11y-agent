---
type: migration-rule
title: 文字色
description: 装飾目的の色は黒に戻し、文脈上重要な強調のみ赤／青を使用する
resource: manual://V2.01#p19
tags: [text, ai]
timestamp: 2025-12-15T00:00:00Z
wcag: ["1.4.1", "1.4.3", "1.4.6"]
jis: ["1.4.1", "1.4.3"]
processing_class: ai
municipality_specific: false
cms_auto: false
origin: manual
michecker_check_ids: ["C_500.11", "C_500.17"]
related: [/wcag/ch2-site.md]
---

# 必須ルール
CMSではコントラスト比確保のため文字色は黒・赤・青のみ使用可。装飾目的だけの色は黒に修正する。文脈上重要なポイントの色は赤（または青）を使用する。判断できない場合は質問する。AAA相当（コントラスト比7:1以上）を目指す場合は、CMSの標準配色パレットがその基準を満たしているか別途確認する。

# 例
## ケース1: 装飾目的の色
```before
<span style="color:#00aa00">お知らせ</span>（緑＝装飾のみ）
```
```after
お知らせ（黒）
```

## ケース2: 重要ポイントの強調
```before
<span style="color:#cc0000">申込締切は本日です</span>
```
```after
申込締切は本日です（スタイル「赤文字」を適用）
```

---
type: migration-rule
title: ページタイトル（title要素）
description: すべてのページに、内容を表す空でないtitle要素を設定する
resource: https://accessibility.jp/resources/tools/michecker-techniques/
tags: [html]
timestamp: 2026-07-07T00:00:00Z
wcag: ["2.4.2"]
jis: ["なし"]
processing_class: hybrid
municipality_specific: false
cms_auto: true
origin: manual
michecker_check_ids: ["C_60.0", "C_60.1", "C_600.12"]
related: [/wcag/ch2-site.md]
---

# 必須ルール
すべてのページには、内容を的確に表す空でないtitle要素を設定する。新CMSでは多くの場合、ページ名からtitleが自動生成されるが、ページ名が空・仮の値・全ページ共通の値になっていないか確認する。

# 例
## ケース1: titleが空・未設定
```before
<title></title>
```
```after
<title>入札結果（工事）令和8年度 - ○○市</title>
```

## ケース2: ページ内容を表さない仮のタイトル
```before
<title>無題ページ</title>
```
```after
<title>粗大ごみ収集の申し込み方法 - ○○市</title>
```
ポイント: CMSがtitleを自動生成する場合でも、移行時にページ名を仮の値のまま残さないよう確認する。

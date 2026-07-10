---
type: migration-rule
title: リンクテキストは文脈非依存にする
description: 「こちら」等の指示語のみのリンクを、リンク先が分かる文言へ修正する
resource: manual://V2.01#p76
tags: [link, ai]
timestamp: 2025-12-15T00:00:00Z
wcag: ["2.4.4"]
jis: ["2.4.4"]
processing_class: ai
municipality_specific: false
cms_auto: false
known_failure: v1.0-blindspot
origin: manual
michecker_check_ids: ["C_600.14", "C_46.0"]
includes: [/rules/link/link-purpose-standalone.md]
related: [/wcag/ch4-links.md, /rules/link/link-purpose-standalone.md]
---

# 必須ルール
「こちら」「ここ」「詳細」など指示語だけのリンクを禁止し、リンク単体で遷移先が理解できる文言にする。連続するリンクは、空白・改行以外の文字（読点、区切り記号等）で区切る。

# 例
## ケース1: 指示語リンク
```before
詳しくはこちらをご覧ください。
```
```after
詳しくは戸籍の届出についてのページをご覧ください。
```
ポイント: v1.0は9ページにわたり「こちら」を一切改善できなかった既知の盲点。v2.0プロンプトでは前後文脈から遷移先名詞を補う指示を強化する。本ルールの基準（リンク単体で遷移先が理解できる具体的な文言にする）を満たしていれば、miChecker版の`link-purpose-standalone.md`が指摘する空リンク・重複テキストも通常あわせて解消する。

## ケース2: 連続リンクの区切り
```before
<a href="/detail.html">詳細</a><a href="/file.pdf">PDF</a><a href="/map.html">地図</a>
```
```after
<a href="/detail.html">詳細</a>｜<a href="/file.pdf">PDF</a>｜<a href="/map.html">地図</a>
```
ポイント: 空白・改行のみの区切りでは、スクリーンリーダーで隣接リンクの境界が分かりにくい。読点・区切り記号（｜等）や、リスト構造（`ul`/`li`）での区切りを検討する。

---
type: migration-rule
title: 外国語の言語属性
description: 本文中の外国語の文章・単語に言語属性を付与する
resource: manual://V2.01#p29
tags: [text, ai]
timestamp: 2025-12-15T00:00:00Z
wcag: ["3.1.2"]
jis: ["3.1.1"]
processing_class: ai
municipality_specific: false
cms_auto: false
origin: manual
michecker_check_ids: ["C_19.0", "C_500.6"]
related: [/wcag/ch2-site.md]
---

# 必須ルール
本文中に外国語の文章・単語がある場合、該当テキストに言語属性（英語・中国語・韓国語・スペイン語・ポルトガル語のいずれか）を付与する。5言語以外は質問する。

# 例
## ケース1: 英語句への言語属性
```before
Welcome to our city
```
```after
Welcome to our city（該当テキストに lang="en" 相当の言語属性を付与）
```

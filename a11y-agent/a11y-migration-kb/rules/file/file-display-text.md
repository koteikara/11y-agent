---
type: migration-rule
title: ファイルの表示テキスト
description: 表示テキストのファイル種別・容量はCMSが自動表示するため削除する
resource: manual://V2.01#p53
tags: [file, mechanical]
timestamp: 2025-12-15T00:00:00Z
wcag: ["なし"]
jis: ["なし"]
processing_class: mechanical
municipality_specific: false
cms_auto: true
---

# 必須ルール
ファイルの表示テキストに含まれるファイル種別（PDF等）や容量はCMSが自動表示するため、不要部分を削除する。ファイルはテキスト入力エリアではなくファイル入力エリアから挿入する。

# 例
## ケース1: 種別・容量の重複
```before
出生届（PDF：1,928kbyte）
```
```after
出生届
```

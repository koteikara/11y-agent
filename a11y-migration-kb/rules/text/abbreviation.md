---
type: migration-rule
title: 略語・頭字語の表記
description: 略語・頭字語はabbr要素で本来の形式を表記する（acronymは廃止のため使用しない）
resource: https://github.com/eclipse-actf/org.eclipse.actf/blob/master/org.eclipse.actf.validation.html/resources/checkitem.xml
tags: [text, mechanical]
timestamp: 2026-07-07T00:00:00Z
wcag: ["3.1.4"]
jis: ["なし"]
processing_class: mechanical
municipality_specific: false
cms_auto: false
origin: michecker
michecker_check_ids: ["C_20.0"]
related: []
---

# 必須ルール
文書中に初出する略語・頭字語（例: NPO、UNESCO等、一般に浸透していないもの）には、`abbr`要素のtitle属性で正式名称を表記する。HTML Living Standardで`acronym`要素は廃止されているため使用しない。

# 例
## ケース1: 略語のabbr表記
```before
NPO法人〇〇会が主催します。
```
```after
<abbr title="特定非営利活動法人">NPO</abbr>法人〇〇会が主催します。
```

## ケース2: 廃止されたacronym要素の置き換え
```before
<acronym title="World Wide Web Consortium">W3C</acronym>
```
```after
<abbr title="World Wide Web Consortium">W3C</abbr>
```
ポイント: 一般に広く浸透している略語（市役所、CMS等）まで全て`abbr`化する必要はない。初見の利用者が読み解けない専門用語・団体名の略称を優先する。

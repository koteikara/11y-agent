---
type: migration-rule
title: アスキーアート・顔文字の代替表現
description: 記号を組み合わせた顔文字・アスキーアートは、読み上げても意味が伝わるよう代替テキストを添えるか、画像に置き換える
resource: https://github.com/eclipse-actf/org.eclipse.actf/blob/master/org.eclipse.actf.validation.html/resources/checkitem.xml
tags: [text, ai]
timestamp: 2026-07-10T00:00:00Z
wcag: ["1.1.1"]
jis: ["なし"]
processing_class: ai
municipality_specific: false
cms_auto: false
origin: michecker
michecker_check_ids: ["C_6.0", "C_6.1", "C_69.0"]
related: []
---

# 必須ルール
「(^o^)」「m(_ _)m」のような顔文字や、記号を組み合わせた簡易的なアスキーアートは、スクリーンリーダーで記号の羅列としてそのまま読み上げられ、意味が伝わらない。次のいずれかで対応する。

- 短い顔文字（1〜数記号程度）: 直前・直後に文字での言い換え（「（笑顔で）」「（お辞儀）」等）を添える、または装飾目的であれば削除する。
- 大きく複雑なアスキーアート（複数行にわたる図案等）: アクセシブルな画像（適切なalt属性付き）に置き換えるか、スキップ手段（読み飛ばせる構造）を用意する。

# 例
## ケース1: 顔文字への言い換え追加
```before
<p>お待ちしております(^o^)</p>
```
```after
<p>お待ちしております（笑顔で）</p>
```

## ケース2: 複数行のアスキーアート
```before
<pre>　∧＿∧
（　´∀｀）　いつでもお越しください
（　　　　）
｜　｜　｜</pre>
```
```after
<img src="/mascot-illust.png" alt="市のマスコットキャラクターが手を振っているイラスト">
<p>いつでもお越しください</p>
```
ポイント: 装飾目的の軽い顔文字まで全て除去する必要はないが、意味を持たせている場合（案内文の一部として使っている等）は、記号だけに頼らず文字で内容が伝わるようにする。

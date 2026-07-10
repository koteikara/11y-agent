---
type: migration-rule
title: 引用の構造化（blockquote・q・cite）
description: 条例・要綱・他機関発表等の引用を、blockquote・q要素とcite属性で構造化する
resource: https://github.com/eclipse-actf/org.eclipse.actf/blob/master/org.eclipse.actf.validation.html/resources/checkitem.xml
tags: [text, ai, hybrid]
timestamp: 2026-07-10T00:00:00Z
wcag: ["1.3.1"]
jis: ["なし"]
processing_class: hybrid
municipality_specific: false
cms_auto: false
origin: michecker
michecker_check_ids: ["C_17.0", "C_17.1", "C_18.0", "C_18.1", "C_18.2"]
related: [/rules/text/note-symbol.md]
---

# 必須ルール
条例・要綱の条文、他機関の発表文、有識者コメント等、引用にあたる文章は、見た目のインデントのためではなく、`blockquote`要素（長い引用）または`q`要素（短い引用）で構造化する。インデントだけを目的にした`blockquote`の流用（本文の階層表現等）は避ける。引用元が特定できる場合は、`cite`属性に引用元のURIを設定する。

# 例
## ケース1: 条例の引用（長文）
```before
<p>第3条　この条例において「空家等」とは、建築物又はこれに附属する工作物であって、居住その他の使用がなされていないことが常態であるものをいう。</p>
```
```after
<blockquote cite="https://example-city.jp/reiki/jourei/000123.html">
  <p>第3条　この条例において「空家等」とは、建築物又はこれに附属する工作物であって、居住その他の使用がなされていないことが常態であるものをいう。</p>
</blockquote>
<p>（○○市空家等対策条例 第3条より引用）</p>
```

## ケース2: 短い引用（q要素）
```before
市長は「安全で安心なまちづくりを進めます」と述べた。
```
```after
市長は<q>安全で安心なまちづくりを進めます</q>と述べた。
```

## ケース3: インデント目的のblockquote流用（避けるべき例）
```before
<blockquote>お知らせ<br>・受付時間は平日9時〜17時です<br>・電話でのお問い合わせも可能です</blockquote>
```
```after
<p>お知らせ</p>
<ul>
  <li>受付時間は平日9時〜17時です</li>
  <li>電話でのお問い合わせも可能です</li>
</ul>
```
ポイント: `blockquote`・`q`は「引用である」という意味を持つ要素であり、見た目のインデントのためだけに使うと、スクリーンリーダー利用者に「これは引用です」という誤った情報を伝えてしまう。単なる字下げ・箇条書きにはCMSの装飾機能やリスト要素を使う。引用元が明確な場合（条例・要綱・他機関の発表等）は`cite`属性の設定を検討するが、引用元URIが無い・不明な場合は無理に設定しない。

---
type: wcag-criteria
title: ウェブサイト全体
description: HTML準拠・言語指定・コントラスト・色依存禁止・単位記号等
resource: wcag_guideline_ai_optimized.md#CH2
tags: [wcag]
timestamp: 2025-12-15T00:00:00Z
jis: ["4.1.1", "3.1.1", "2.4", "1.4.3", "1.4.1", "1.1.1", "1.4.4", "3.1"]
---

# 2.1 HTML仕様準拠 [JIS:4.1.1]
HTML Living Standard準拠・DOCTYPE宣言必須。禁止: frameset/frame/marquee/blink。

# 2.4 文字エンコーディング
UTF-8。機種依存文字の置換（①②→(1)(2)、㍉→ミリ、㈱→株式会社 等）。

# 2.5 コントラスト比 [JIS:1.4.3]
文字と背景のコントラスト比 4.5:1 以上。画像内テキストも同基準。赤と緑の組合せを避ける。

# 2.6 色依存禁止 [JIS:1.4.1]
情報伝達に色のみを使わない。テキスト・記号・パターンを補足。

# 2.8 文字サイズ [JIS:1.4.4]
相対単位（em/rem/%）。絶対単位（px/pt）禁止。

# 2.10 記号による単位表記
通貨・単位を半角英数略記のみで表さない（「100cm」は誤読リスク）。

参照ルール: [date-notation](/rules/text/date-notation.md), [unit-notation](/rules/text/unit-notation.md), [currency-notation](/rules/text/currency-notation.md), [color](/rules/text/color.md), [font-size](/rules/text/font-size.md), [foreign-language](/rules/text/foreign-language.md)

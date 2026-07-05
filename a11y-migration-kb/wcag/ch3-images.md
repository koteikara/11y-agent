---
type: wcag-criteria
title: 画像
description: 代替テキスト必須・複雑画像の補足・width/height指定
resource: wcag_guideline_ai_optimized.md#CH3
tags: [wcag, image]
timestamp: 2025-12-15T00:00:00Z
jis: ["1.1.1"]
---

# 3.1 代替テキスト必須 [JIS:1.1.1]
全imgにalt必須。200文字未満・末尾に画像種別（写真・グラフ等）。役割別: 情報提供=内容を簡潔に / 装飾=alt="" / リンク=遷移先 / 隣に同テキスト=alt=""（二重読み上げ防止）。

# 3.2 複雑な画像の補足 [JIS:1.1.1]
200字に収まらない複雑画像（地図・グラフ）は近くに補足テキストまたは解説リンク。

# 3.3 サイズ属性
imgにwidth/height指定（レイアウト崩れ防止）。

参照ルール: [alt-text](/rules/image/alt-text.md), [complex-image-report](/rules/image/complex-image-report.md), [caption](/rules/image/caption.md)

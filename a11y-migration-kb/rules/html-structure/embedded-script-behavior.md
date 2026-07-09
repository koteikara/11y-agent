---
type: migration-rule
title: 埋め込みスクリプトによる自動的な動作
description: 本文に埋め込まれたスクリプトやmeta要素による自動音声再生・自動リロード・マウス依存操作は、利用者が制御できる形に見直すか除去する
resource: https://accessibility.jp/resources/tools/michecker-techniques/
tags: [html, escalation]
timestamp: 2026-07-07T00:00:00Z
wcag: ["1.4.2", "2.1.1", "2.1.2", "2.1.3", "2.2.1", "2.2.2", "2.2.4", "3.2.5"]
jis: ["なし"]
processing_class: escalation
municipality_specific: false
cms_auto: false
origin: manual
michecker_check_ids: ["C_30.0", "C_30.1", "C_38.0", "C_600.8", "C_600.9", "C_36.0", "C_36.1"]
related: [/wcag/ch7-script.md]
---

# 必須ルール
以下のような、利用者の制御を妨げる自動的な動作が本文コンテンツ内に含まれている場合は、そのまま移行せず開発担当者に確認する。多くの場合はページテンプレート側の問題だが、貼り付けられた埋め込みコード（動画・地図・外部ウィジェット等）に含まれていることもあるため、本文編集時にも注意する。

- 音声・動画の自動再生（ミュートなしで自動的に音を再生しない）
- `<meta http-equiv="Refresh">`による周期的な自動リロード・自動リダイレクト
- マウス操作のみに依存するイベントハンドラ（キーボードでも同じ操作ができるようにする）
- キーボード操作でコンテンツから抜けられなくなる作り（キーボードトラップ）
- 制限時間の設定や、動き・点滅・自動更新を利用者が停止・調整できない作り

# 例
## ケース1: 自動リロードのmetaタグ
```before
<meta http-equiv="Refresh" content="30">
```
```after
（自動リロードのmetaタグを削除し、必要であれば更新ボタンを設置する）
```

## ケース2: 埋め込み動画の自動再生
```before
<video src="event.mp4" autoplay>
```
```after
<video src="event.mp4" controls>（自動再生を止め、再生操作を利用者に委ねる）
```
ポイント: この種の指摘はページ全体・テンプレート起因であることが多く、コンテンツ編集だけでは解決できない場合は開発担当者へエスカレーションする。

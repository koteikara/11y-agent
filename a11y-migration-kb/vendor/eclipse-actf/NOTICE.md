# vendor/eclipse-actf

このディレクトリには、[eclipse-actf/org.eclipse.actf](https://github.com/eclipse-actf/org.eclipse.actf)
(miChecker / HTML Checkerの評価エンジン本体)から取得した以下2ファイルをそのまま含めている。

- `checkitem.xml`
  - 出典パス: `org.eclipse.actf.validation.html/resources/checkitem.xml`
  - miChecker/HTML Checkerの全チェック項目定義(WCAG 2.0達成基準・達成方法・重大度)
- `description_ja.properties`
  - 出典パス: `org.eclipse.actf.validation.html/resources/description_ja.properties`
  - 各チェック項目に対応する日本語メッセージテンプレート

## 取得情報
- 取得元コミット: `703e34f0af7b7c4882a7adbd4fa6305f114cd548`(2026-06-29時点のmasterブランチ)
- 取得日: 2026-07-07
- ライセンス: Eclipse Public License 1.0 (EPL-1.0)、Copyright (c) 2005, 2025 IBM Corporation and others.
  各ファイル冒頭のコピーライト・ライセンス表記はそのまま保持している。

## 用途
`a11y-migration-kb/tools/actf2json.py`で解析し、`build/michecker-checkitems.json`を生成する。
`goal2-app`のmiChecker比較結果画面(`michecker-compare.js`)で、CSVの指摘内容を公式チェック項目・
`a11y-migration-kb`のルールへ逆引きするための一次データとして利用する。

## 更新方法
miChecker/HTML Checkerの新しいバージョンがリリースされた場合、上記出典から最新の2ファイルを
取得し直し、このディレクトリに上書きした上で`python3 tools/actf2json.py --bundle . --out build/michecker-checkitems.json`
を再実行する。

## 判定ロジックの移植(goal2-app/public/michecker-engine.js)

上記2ファイル(メタデータのみ)とは別に、`goal2-app/public/michecker-engine.js`は、同じ
`eclipse-actf/org.eclipse.actf`リポジトリに含まれる**判定ロジックのJavaソース**(評価エンジン
本体)をJavaScriptへ移植した二次的著作物である。移植元・スコープ・移植方針は
`goal2-app/MICHECKER_ENGINE_PORT_INSTRUCTIONS.md`(計画書)と
`goal2-app/MICHECKER_PORT_INVENTORY.md`(対象116件のインベントリ)を参照。

- 移植元ファイル:
  - `org.eclipse.actf.validation.html/src/org/eclipse/actf/validation/html/internal/CheckEngine.java`
  - `org.eclipse.actf.visualization.engines.blind/src/org/eclipse/actf/visualization/engines/blind/TextChecker.java`
  - `org.eclipse.actf.visualization.engines.blind/config/altText.properties`
- 参照コミット: `703e34f0af7b7c4882a7adbd4fa6305f114cd548`(上記2ファイルと同一時点)
- ライセンス: EPL-1.0、Copyright (c) 2004, 2025 IBM Corporation and Others。
  `michecker-engine.js`冒頭に同ライセンス表記を保持している。
- 移植コードは`michecker-engine.js`1ファイルに閉じ込め、他のファイル(`app.js`等)へは
  混在させない(ライセンス隔離。詳細は移植計画書§4.2)。

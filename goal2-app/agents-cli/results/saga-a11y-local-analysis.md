# agents-cli Failure Analysis

- Source grade: `C:\Codex\a11y-agent\goal2-app\agents-cli\results\saga-a11y-local-grade.json`
- Cases: 51
- Failing cases: 20
- Failure instances: 62
- Average score: 91.3374

## Recommended Actions

1. 表構造: 44件。データ表、レイアウト表、セル結合、caption/scope付与のどれがgoldと違うかを切り分ける。
   - Top metrics: th=10, scopeCol=8, scopeRow=8, thead=6
2. リンク文言: 9件。弱いリンク文言が残るページを確認し、リンク先ページ名推定または人間確認候補へ回す。
   - Top metrics: weakLink=9
3. 見出し構造: 7件。h2/h3/h4の段階補正ルールを確認し、本文先頭見出しとページ内見出しのgold差分を分類する。
   - Top metrics: h3=3, h2=3, h4=1
4. 画像・埋め込み: 2件。画像alt、複雑画像、iframeのCMS注意/修正候補の分類を確認する。
   - Top metrics: img=1, iframe=1

## Categories

### 見出し構造

- Failure instances: 7
- Statuses: improved=4, regressed=2, unchanged=1
- Metrics: h2=3, h3=3, h4=1
- Action: h2/h3/h4の段階補正ルールを確認し、本文先頭見出しとページ内見出しのgold差分を分類する。

| Case | Metric | Status | Current | Gold | Score |
|---|---|---|---:|---:|---:|
| saga-city/sg04007.html | h3 | regressed | 11 | 0 | 55.8765 |
| saga-city/sg02395.html | h3 | regressed | 17 | 8 | 59.0689 |
| saga-city/sg06323.html | h3 | unchanged | 6 | 22 | 75.8165 |
| saga-city/sg04007.html | h2 | improved | 2 | 8 | 55.8765 |
| saga-city/sg06323.html | h2 | improved | 10 | 9 | 75.8165 |
| saga-city/sg06323.html | h4 | improved | 6 | 8 | 75.8165 |
| saga-city/sg03997.html | h2 | improved | 4 | 5 | 77.0243 |

### 表構造

- Failure instances: 44
- Statuses: improved=34, unchanged=6, regressed=4
- Metrics: th=10, scopeCol=8, scopeRow=8, caption=6, table=6, thead=6
- Action: データ表、レイアウト表、セル結合、caption/scope付与のどれがgoldと違うかを切り分ける。

| Case | Metric | Status | Current | Gold | Score |
|---|---|---|---:|---:|---:|
| saga-city/sg04007.html | thead | regressed | 3 | 1 | 55.8765 |
| saga-city/sg04007.html | caption | regressed | 3 | 1 | 55.8765 |
| saga-city/sg04007.html | th | regressed | 24 | 8 | 55.8765 |
| saga-city/sg04007.html | scopeRow | regressed | 20 | 6 | 55.8765 |
| saga-city/sg04007.html | table | unchanged | 3 | 1 | 55.8765 |
| saga-city/sg04007.html | scopeCol | unchanged | 4 | 2 | 55.8765 |
| saga-city/sg02395.html | table | unchanged | 16 | 7 | 59.0689 |
| saga-city/sg02562.html | table | unchanged | 11 | 13 | 79.7571 |
| saga-city/sg02546.html | table | unchanged | 7 | 8 | 79.8101 |
| saga-city/sg04782.html | table | unchanged | 42 | 0 | 96.4702 |

### 画像・埋め込み

- Failure instances: 2
- Statuses: unchanged=2
- Metrics: iframe=1, img=1
- Action: 画像alt、複雑画像、iframeのCMS注意/修正候補の分類を確認する。

| Case | Metric | Status | Current | Gold | Score |
|---|---|---|---:|---:|---:|
| saga-city/sg00761.html | img | unchanged | 87 | 0 | 75.7483 |
| saga-city/sg06323.html | iframe | unchanged | 0 | 13 | 75.8165 |

### リンク文言

- Failure instances: 9
- Statuses: unchanged=9
- Metrics: weakLink=9
- Action: 弱いリンク文言が残るページを確認し、リンク先ページ名推定または人間確認候補へ回す。

| Case | Metric | Status | Current | Gold | Score |
|---|---|---|---:|---:|---:|
| saga-city/sg04007.html | weakLink | unchanged | 1 | 0 | 55.8765 |
| saga-city/sg01171.html | weakLink | unchanged | 1 | 0 | 84.7977 |
| saga-city/sg02558.html | weakLink | unchanged | 1 | 0 | 88.3829 |
| saga-city/sg03727.html | weakLink | unchanged | 1 | 0 | 89.3369 |
| saga-city/sg02571.html | weakLink | unchanged | 1 | 0 | 89.5073 |
| saga-city/sg02565.html | weakLink | unchanged | 1 | 0 | 90.3231 |
| saga-city/sg02539.html | weakLink | unchanged | 1 | 0 | 90.506 |
| saga-city/sg02555.html | weakLink | unchanged | 1 | 0 | 91.5003 |
| saga-city/sg02536.html | weakLink | unchanged | 1 | 0 | 94.2848 |

## Priority Cases

- saga-city/sg04007.html: score=55.8765, differs=9, categories=heading_structure, table_semantics, link_text
  - 表構造のgold差分を優先確認し、表解体/データ表維持/caption/scopeのどれを修正するか決める。
- saga-city/sg02395.html: score=59.0689, differs=7, categories=heading_structure, table_semantics
  - 表構造のgold差分を優先確認し、表解体/データ表維持/caption/scopeのどれを修正するか決める。
- saga-city/sg00761.html: score=75.7483, differs=6, categories=table_semantics, image_media
  - 表構造のgold差分を優先確認し、表解体/データ表維持/caption/scopeのどれを修正するか決める。
- saga-city/sg02562.html: score=79.7571, differs=6, categories=table_semantics
  - 表構造のgold差分を優先確認し、表解体/データ表維持/caption/scopeのどれを修正するか決める。
- saga-city/sg02546.html: score=79.8101, differs=6, categories=table_semantics
  - 表構造のgold差分を優先確認し、表解体/データ表維持/caption/scopeのどれを修正するか決める。
- saga-city/sg06323.html: score=75.8165, differs=5, categories=heading_structure, table_semantics, image_media
  - 表構造のgold差分を優先確認し、表解体/データ表維持/caption/scopeのどれを修正するか決める。
- saga-city/sg02560.html: score=82.3192, differs=4, categories=table_semantics
  - 表構造のgold差分を優先確認し、表解体/データ表維持/caption/scopeのどれを修正するか決める。
- saga-city/sg01171.html: score=84.7977, differs=3, categories=table_semantics, link_text
  - 表構造のgold差分を優先確認し、表解体/データ表維持/caption/scopeのどれを修正するか決める。
- saga-city/sg04008.html: score=84.9787, differs=3, categories=table_semantics
  - 表構造のgold差分を優先確認し、表解体/データ表維持/caption/scopeのどれを修正するか決める。
- saga-city/sg04014.html: score=85.1415, differs=2, categories=table_semantics
  - 表構造のgold差分を優先確認し、表解体/データ表維持/caption/scopeのどれを修正するか決める。

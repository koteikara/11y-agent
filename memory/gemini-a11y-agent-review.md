# gemini-a11y-agent-review.md

## Purpose

この文書は、参考リポジトリ `koteikara/gemini-a11y-agent` を確認し、本リポジトリで再開発する際に参考にできる点、踏襲すべきでない点、引き継げそうな考え方を整理する。

結論として、`gemini-a11y-agent` はそのまま踏襲しない。特定ページ・特定実行環境・特定ルールに寄せて改善を重ねた試作として扱い、失敗モード、検証観点、候補提示UIの考え方を引き継ぐ。

## Inspected Source

- Repository: `https://github.com/koteikara/gemini-a11y-agent`
- Inspected commit: `2f00753cf27912261ba83620d8a72fde9d8220ea`
- Temporary local inspection path: `.tmp-gemini-a11y-agent/` (removed after review)
- Main inspected areas:
  - `README.md`
  - `a11y_agent/`
  - `a11y_agent/rules/a11y_hybrid_detect_fix.jsonl`
  - `apps-script/a11y-sidebar/`
  - `docs/`
  - `tests/`
  - `tools/`

## What This Repository Tried To Do

`gemini-a11y-agent` は、自治体サイトHTMLを対象に、本文抽出とアクセシビリティ補正を自動化する試作である。

主な対象は次のとおり。

- 指定XPath、主に `//*[@id="contents_0"]` 配下の本文抽出。
- table前の導入文や見出しを欠落させないこと。
- data table の caption、thead、th、scope 補正。
- YouTube iframe の title 補完。
- 画像alt生成のVision利用。
- Google Sheetsをジョブ台帳、Google DriveをHTML出力先、Google Colabを実行環境として使う一括処理。
- Google Sheets上でHTML断片を1ページずつ補正するApps Scriptサイドバー案。

## Good Points

### 1. 対象範囲を絞って失敗モードに向き合っている

最初からWCAG全域を自動化しようとしていない。table、iframe、本文抽出、導入文欠落といった、移行実務で起きやすい問題に絞っている。

これは本リポジトリでも引き継げる。最初のPoCでは、全ルール対応ではなく、失敗時の影響が大きく、検証しやすいルールから始めるべきである。

### 2. LLM出力をそのまま信じない設計がある

table修正では、LLMにHTML全体を渡すのではなく、table単体を渡し、戻り値を検証してからDOMノードとして差し戻している。

`table_response_validator.py` では、次のような危険な出力を拒否しようとしている。

- `<row>` や `<cell>` などの非標準タグ。
- table外に出た `tr`、`td`、`th`。
- table以外の可視要素が混じる応答。
- 複数tableの混入。
- 壊れたエスケープ断片。

この「LLM出力は契約で縛り、検証できないものは採用しない」という考え方は強く引き継ぐ。

### 3. table前導入文の欠落を具体的に扱っている

旧版で、table前の説明文、h3、h4、注意文が欠落した問題に対し、chunker側で導入文とtableの関係を扱っている。

特に次の考え方は有用である。

- 最初のdata tableより前の連続テキストを導入ブロックとして保持する。
- table直前のh4は日付見出しなどとしてtable側に紐付ける。
- 更新日だけの行を出力対象から除外する。
- end-trimが導入文を巻き込まないように保護する。

本リポジトリでも、HTML分割時に「本文構造を壊さない」ためのルールとして参考にできる。

### 4. old / ai / gold の成果物管理思想がある

`old`、`ai`、`gold` の成果物を分け、AI出力と人間承認後の最終HTMLを比較できる形にしようとしている。

これは本リポジトリでも重要である。ただし名称は、移行実務に合わせて次のように再設計する余地がある。

- `source`: 旧サイトから取得した元HTML。
- `extracted`: CMS登録に必要なコンテンツHTML。
- `agent`: AGENTが補正したHTML。
- `reviewed`: 作業者が確認・修正したHTML。
- `approved`: 承認者が確認した最終HTML。

### 5. 自動監査ツールの観点が実務的

`tools/audit_output_html_quality.py` は、出力HTMLに対してCritical、High、Mediumの重大度付きで問題を出す。

検出観点は本プロジェクトでも使える。

- 非標準tableタグ。
- table外の `tr` / `td` / `th`。
- captionなしtable。
- th / scope不足。
- 壊れたHTML断片。
- 本文外要素混入。
- CMS制御文字列混入。
- 文字化け。
- 曖昧リンク文言。
- 装飾アイコンalt過剰。
- 出力HTML肥大化。

`done-definition.md` に取り込む価値が高い。

### 6. report-only のルール検出がある

`a11y_hybrid_detect_fix.jsonl` と `hybrid_rules.py` は、自動修正ではなく候補検出から始める設計である。

これは本リポジトリの安全方針に合う。最初から自動修正せず、次の流れを作るのがよい。

1. 検出する。
2. 候補として提示する。
3. ルール・根拠・対象HTMLを記録する。
4. 人間が確認する。
5. 安全なものだけ段階的に自動化する。

### 7. Apps Scriptサイドバー案はGoal 2に近い

`apps-script/a11y-sidebar/` は、HTML断片を貼り付け、候補を順番に確認し、必要に応じてLLMプロンプト生成やAPI候補生成を使う設計である。

これは `workstream.md` の Goal 2、つまり「登録するタイミングで作業者が1ページずつAGENT支援を受けながら進める方式」に近い。

引き継げる要素は次のとおり。

- 候補一覧。
- 個別実行と上から順に実行。
- スキップ。
- 要確認候補。
- 候補ごとの入力欄。
- `data-a11y-candidate-id` のような一時IDによる対象再特定。
- LLM回答をJSONとして検証してから適用する流れ。
- API使用履歴、token数、概算コストの記録。

### 8. ドキュメントに既知課題が残っている

CSSの `rgb()` が全角括弧化する問題、caption id重複、table header方向判定がヒューリスティックであることなど、失敗や限界をドキュメント化している。

これは良い。再開発でも、成功事例だけでなく失敗モードを第一級のナレッジとして扱うべきである。

## Not Good Points

### 1. 特定自治体・特定HTML構造に寄りすぎている

READMEの前提は `//*[@id="contents_0"]` 配下であり、佐賀市のfixtureや `contents_0` に強く寄っている。

本プロジェクトは400以上の顧客と複数のデザインテンプレートを前提にするため、固定XPathを中心にした設計では足りない。

再開発では、テンプレート別・サイトカテゴリー別の抽出プロファイルが必要である。

### 2. Google Colab / Sheets / Drive / Gemini に密結合している

`runner.py` は、Sheets読み込み、URL取得、HTML抽出、LLM呼び出し、Drive保存、Sheets更新を一つの流れで扱っている。

また `config.py` には具体的なSheet IDやDriveパスが含まれている。

これはPoCとしては速いが、本プロジェクトでは危険である。再開発では次を分離する。

- HTML取得。
- コンテンツ抽出。
- アクセシビリティ検出。
- 自動修正。
- 候補提示。
- CMS登録用出力。
- 証跡保存。
- 外部API接続。

### 3. CMS登録モデルがない

出力は基本的にHTMLファイルであり、本リポジトリの前提である「CMS管理画面から、新CMSのデータ構造・テンプレート・入力欄に合う形で登録する」工程のモデルがない。

今回必要なのは、単なるHTML補正ではなく、CMS入力欄・テンプレート・登録単位に合わせた作業支援である。

### 4. 2つのゴールを共通エンジンとして扱えていない

一括処理はPython/Colab、1ページずつの作業支援はApps Scriptサイドバーとして分かれている。

考え方は近いが、共通のルールエンジン、共通の候補形式、共通の証跡形式にはなっていない。

本リポジトリでは、Goal 1とGoal 2の両方が同じ中核エンジンを使えるようにする必要がある。

### 5. LLM表記正規化の保護範囲が弱い

既知課題として、CSS内の `rgb()` が `rgb（...）` のように壊れる可能性がある。

これは、本文テキストの正規化と、HTML属性・CSS・コード断片の保護が十分に分かれていないことを示している。

再開発では、LLMに渡す対象をさらに限定し、属性値、URL、CSS、script、style、コード断片、数値表現を保護する必要がある。

### 6. table判定がヒューリスティックに強く依存している

row / col / none の見出し方向判定、layout table判定、row header昇格などは有用だが、誤判定リスクがある。

これは自動確定ではなく、confidence、判断根拠、要確認フラグを出すべき領域である。

### 7. 失敗時の扱いがログ中心で、証跡として弱い

多くの処理は `print` ログで状況を出す。作業者・承認者・SVが後から確認する証跡としては弱い。

本リポジトリでは、ページ単位、ルール単位、候補単位で構造化された記録が必要である。

### 8. 実ページでの品質が安定していない

`docs/validation-reports/validation-smoke-report.md` では、5ページ試験で次のような結果が出ている。

- Critical: 7090
- High: 3313
- Medium: 2027

特に、福山ページでは `<row>` / `<cell>` のような非標準タグが大量に残り、豊橋ページではHighが多い。

これは、特定fixtureでの改善はあっても、複数自治体・複数HTML構造への一般化はできていないことを示す。

### 9. テスト実行環境が整っていない

この環境で確認したところ、同梱Pythonには `pytest` がなく、`python -m pytest -q` は実行できなかった。

標準 `unittest` で実行できた一部テストでは、次の結果になった。

- `tests.test_table_response_validator`: 5件中1件失敗。
- `tests.test_hybrid_rules_report_only`: 実行分は成功。
- `tests.test_table_header_orientation`: `requests` 未導入でImportError。

`test_rejects_table_shape_breakage` は、単一セルtableを拒否する期待に対し、実装が採用しているため失敗した。

これは、検証環境、依存関係、期待値、実装の整合性を再設計すべきことを示す。

### 10. 既存ナレッジとの対応が浅い

本リポジトリには `a11y-migration-kb/` があり、移行ルール、CMS操作、質問プロトコル、WCAG/JIS根拠が整理されている。

一方、`gemini-a11y-agent` のルールIDは独自で、既存ナレッジとの対応が限定的である。再開発では `a11y-migration-kb/` を正とし、ルールID、処理分類、確認項目、証跡を接続する必要がある。

## Transferable Items

### Concepts To Carry Over

- LLM出力はそのまま採用しない。
- HTML全体をLLMに丸投げしない。
- 修正対象を小さなDOM単位に分離する。
- 検証できない出力は元HTMLを保持し、要確認にする。
- 自動修正より先に report-only 検出を作る。
- old / ai / gold のように、元・AI・人間承認済みを分けて保存する。
- 失敗モードをfixture化する。
- Critical / High / Medium の品質ゲートを置く。
- token数、API呼び出し数、概算コストを記録する。
- 候補ごとにルールID、対象HTML、修正理由、要確認理由を持つ。

### Code Ideas To Reuse Carefully

そのままコピーするのではなく、考え方を再実装する。

- `table_response_validator.py`
  - LLM応答検証の考え方を引き継ぐ。
  - ただし、採用条件は本プロジェクトのHTML契約に合わせて再定義する。
- `tools/audit_output_html_quality.py`
  - 品質監査ルールの観点を引き継ぐ。
  - 本リポジトリの `done-definition.md` やPoC検証に組み込む。
- `hybrid_rules.py`
  - report-only候補抽出の考え方を引き継ぐ。
  - 実装は `a11y-migration-kb/` に合わせて作り直す。
- `apps-script/a11y-sidebar/`
  - ページ単位・候補単位の作業支援UIの考え方を引き継ぐ。
  - CMS管理画面や本プロジェクトの作業UIに合わせて再設計する。
- `chunker.py`
  - table前導入文保護の考え方を引き継ぐ。
  - ただし、佐賀市固有・当番医固有キーワードには依存しない。

### Data / Test Assets To Learn From

- 佐賀市fixture。
- 合成fixture。
- 5ページvalidation smoke output。
- output HTML audit report。
- 既知課題ドキュメント。
- table修正安全性テスト。
- hybrid report-onlyテスト。

これらは、本リポジトリのPoC用fixture設計、品質監査、失敗モード定義の参考になる。

## Items Not To Carry Over

- `//*[@id="contents_0"]` 固定を中心にした抽出設計。
- Google Colab前提のメイン実行環境。
- Sheets / Drive / Gemini / 処理ロジックが密結合した `runner.py` 構造。
- ハードコードされたSheet ID、Driveパス、共有ドライブ前提。
- HTML全文や大きなchunkをLLMに渡して正規化する方式。
- CSS、URL、属性値、コード断片を保護しない表記正規化。
- 特定自治体・特定ページ由来のキーワードに強く依存する判定。
- `print` ログ中心の証跡。
- 作業者確認・承認者確認を外部運用に任せきる設計。
- CMS入力欄やテンプレートを意識しないHTMLファイル出力だけの設計。

## Implications For Goal 1

Goal 1は、CMS登録前にAGENTでHTMLを一括アクセシビリティ最適化する方式である。

`gemini-a11y-agent` のColab一括処理はGoal 1に近いが、そのまま使うべきではない。

引き継ぐべきこと:

- ページ一覧をジョブ台帳として処理する発想。
- 抽出対象XPathやセレクタをページ単位で持つ発想。
- 一括処理後にHTML品質監査を走らせる発想。
- token数・コスト・処理結果を記録する発想。

再設計すべきこと:

- テンプレート別抽出プロファイル。
- `a11y-migration-kb/` に基づくルール実行。
- ルールごとのconfidenceと要確認フラグ。
- CMS登録用HTMLとしての出力契約。
- 一括処理の誤変換を検出するゲート。

## Implications For Goal 2

Goal 2は、CMS登録時に作業者が1ページずつAGENT支援を受けながら進める方式である。

Apps ScriptサイドバーはGoal 2に近い。

引き継ぐべきこと:

- 候補カード。
- スキップ。
- 要確認。
- LLMなし、手動LLM、API連携のモード分け。
- 候補単位でのJSON応答検証。
- 一時IDで対象要素を再特定する方法。
- 使用履歴、token数、コストの記録。

再設計すべきこと:

- Google Sheets貼り付けUIではなく、CMS登録作業と接続するUI。
- 作業者の操作ログと承認者確認ログ。
- ルールごとの根拠表示。
- CMS入力欄単位の差分確認。
- Goal 1と同じ候補形式・証跡形式。

## Recommended Direction For This Repository

本リポジトリでは、`gemini-a11y-agent` の再実装ではなく、次の構造を目指す。

1. Rule Knowledge Layer
   - `a11y-migration-kb/` を正とする。
   - 各ルールを検出条件、修正候補、確認条件、証跡項目に変換する。

2. Extraction Layer
   - URL、HTMLファイル、CMS貼り付けHTMLを入力として扱う。
   - サイトカテゴリー・テンプレートごとの抽出プロファイルを持つ。
   - 抽出結果と抽出根拠を記録する。

3. Candidate Engine
   - HTMLを解析し、ルール候補を出す。
   - 候補は自動修正、AI下書き、人間確認、エスカレーションに分類する。
   - 修正前後、根拠、confidence、要確認理由を持つ。

4. Transform Engine
   - 安全な機械変換だけを自動適用する。
   - LLM修正は小さな対象単位に限定する。
   - 返却HTMLは構造検証を通す。

5. Review / Approval Layer
   - Goal 1では一括処理後の確認画面または確認レポートを出す。
   - Goal 2ではページ単位のステップ実行UIを出す。
   - どちらも同じ候補・証跡形式を使う。

6. Evidence Layer
   - スプレッドシート、CSV、JSONLなどに作業記録を残す。
   - ページ単位だけでなく、ルール候補単位の証跡を残す。

7. Quality Gate
   - Critical / High / Mediumの自動監査を行う。
   - Criticalが残る場合は承認に進めない。
   - Highが残る場合は要確認または差し戻しにする。

## Initial Carry-Over Checklist

本リポジトリで最初に取り込む候補は次のとおり。

- LLM応答検証の完了基準。
- 非標準HTMLタグ検出。
- table外 `tr` / `td` / `th` 検出。
- caption / th / scope のtable監査。
- 本文外要素混入検出。
- CMS制御文字列混入検出。
- 文字化け検出。
- 曖昧リンク文言検出。
- old / agent / reviewed / approved の成果物管理。
- report-only候補検出。
- 候補単位の証跡フォーマット。
- Goal 1 / Goal 2で共通利用できる候補データ構造。

## Open Questions

- 最初のPoC対象はGoal 1、Goal 2、またはハイブリッドのどれにするか。
- CMS管理画面と接続する方法は、ブラウザ操作支援、貼り付け用HTML生成、API連携のどれを優先するか。
- スプレッドシートにはページ単位の記録だけでなく、候補単位の記録を持たせるか。
- 既存 `a11y-migration-kb/` の43ルールを、どの順番で実行可能ルールへ変換するか。
- LLMを使う対象は、最初はtable、リンク文言、alt、iframe titleのどこまでにするか。
- 公開前承認で必要な証跡の最小単位は何か。

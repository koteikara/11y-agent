# project-state.md

## Purpose

この文書は、移行作業とアクセシビリティ修正作業の効率化検討について、現在どこまで進んでいるか、何が未完了かを記録する。

CodexやAGENTが作業を再開するときは、まず `AGENTS.md`、`workstream.md`、このファイルを確認する。

## Current File Structure

- `AGENTS.md`
  - プロジェクトの前提、現状の手作業フロー、制約、エージェントの作業方針を記載する。
- `workstream.md`
  - 効率化のゴールと、想定する3つのワークストリーム(Goal 1: 一括最適化、Goal 2: 1ページ単位支援、Goal 3: コンテンツ抽出)を記載する。
- `memory/project-state.md`
  - 現在の進捗、決定事項、未完了事項、次に検討することを記載する。
- `memory/project-state-archive-2026-07-to-09.md`
  - 2026-07 から 2026-09 中旬までの進捗の経緯と、2026-10-04 に整理する前の未完了事項と次の候補を、そのまま残す。
- `done-definition.md`
  - Codexが自分で検証できる完了基準を記載する。
- `memory/gemini-a11y-agent-review.md`
  - 参考リポジトリ `koteikara/gemini-a11y-agent` の検証結果、良い点、良くない点、引き継げる要素を記載する。
- `memory/github-a11y-projects-research.md`
  - GitHub上のアクセシビリティ、a11y、WCAG関連リポジトリの調査結果と、本プロジェクトへ引き継げる設計要素を記載する。
- `memory/non-github-a11y-resources-research.md`
  - GitHub以外の標準、行政系ガイドライン、実務資料、評価ツール、研究資料の調査結果と、本プロジェクトへ引き継げる設計要素を記載する。
- `memory/michecker-research.md`
  - 公共団体案件で重要な評価ツールであるmiCheckerの位置づけ、使い方、品質ゲート化する際の注意点を記載する。
- `memory/a11yc-resources-research.md`
  - A11ycの駒瑠市教材サイト、A11yc ACS、A11yc libraryの検証結果と、本プロジェクトへ引き継げる要素を記載する。
- `memory/goal2-hosting-candidates.md`
  - Goal 2実行画面のホスト環境候補、Cloud Runを第一候補にする理由、代替候補、未決定事項を記載する。
- `memory/goal2-development-requirements.md`
  - Goal 2開発に必要な画面、API、データ構造、ルール処理、証跡、Cloud Run要件、検証項目を記載する。
- `memory/ai-accessibility-skills-policy.md`
  - AIによるアクセシビリティ生成を、共通基本指示、部品別Skill、生成後レビュー、自動検証と人間確認の分離で扱う方針を記載する。
- `memory/agent-context-relevance-compaction-research.md`
  - 「エージェント履歴を関連度スコアで圧縮する」設計仮説（ユーザーのノート）を、Goal 2 と構造変更1 に照らして検討した結果を記載する。大半は既存の設計と一致し、伸びしろは限定判断の小型分類器と案件内の判断履歴の活用にある。
- `memory/agent-history-compaction-cost-verification.md`
  - 同じノートの改訂版（fast-jev-compaction、Jev など）で費用と時間を減らせるかを、一次資料と会話記録の試算で検証した結果を記載する。本番アプリには効かず、開発エージェントでは要約より費用が増える代わりに圧縮の待ち時間が減る。試算の道具は `scripts/research/simulate-history-compaction.js`。
- `memory/cms-migration-import-failure-patterns.md`
  - CMS の機械取込みが失敗するパターン（ユーザー共有の現場知見）と、課題として起票できる条件の検証を記載する。
- `memory/llm-provider-alternatives-research.md`
  - LLM の提供元を Gemini から移す検討の記録。Google Workspace 経由、さくらの AI Engine、Bedrock、Azure、国産 LLM、自前で動かすモデルの比較と出典、ユーザーの判断を記載する。
- `memory/verification-2026-08-summary.md`
  - 2026年8月に実施した3方式比較の検証作業について、実施状況、所要時間の記録、AI移行で出た指摘、未実施の項目を記載する。
- `goal2-app/`
  - 実行画面群（Goal 1〜3とmiChecker結果比較）を格納する。Goal 2の画面から始まったためこの名前で、package名は `a11y-migration-app`。
  - Node.jsの標準HTTPサーバーで静的UIとKBルールAPIを提供する。
  - Cloud Run互換の `PORT` 環境変数、Dockerfile、テストを含む。
  - `public/goal3.html` / `public/goal3.js` として、Goal 3(旧ページ全体HTMLからのコンテンツ抽出)のPoC画面を同居させている。
  - `server.js` の `/api/fetch-html` が、Goal 3のURL取得(簡易SSRF対策付き)を提供する。
- `goal2-app/CLOUD_RUN_DEPLOY.md`
  - Cloud Run初心者向けに、Google Cloud ConsoleのCloud Run概要画面から始めるステップバイステップのデプロイ手順を記載する。
- `goal2-app/LLM_PROVIDER_SWITCH_INSTRUCTIONS.md`
  - LLM の提供元をさくらの AI Engine を主とする構成へ移す設計書。つなぎの Gemini 設定（L0）、提供元の切り替えの仕組み（L1）、評価（L2）、本番の切り替え（L3）の段階と検証を記載する。
- `goal2-app/TONO_FEEDBACK_FIX_INSTRUCTIONS.md`
  - 遠野市の指摘15件のうちツール側で直す8件の設計と、決定のたびに依存候補を作り直す構造変更1の設計、実装ステージ、検証手順を記載する。
- `.github/workflows/ci.yml`、`scripts/ci/`
  - GitHub ActionsのCI。一時生成物や鍵のファイルの混入、KB生成物とアプリ内コピーの一致、`goal2-app` のテストを確かめる。
- `a11y-migration-kb/`
  - 既存の移行・アクセシビリティ関連ナレッジを格納する。

## Current Progress

2026-07 から 2026-09 中旬（遠野市フィードバック対応の 4.1〜4.3 より前）の経緯は、`memory/project-state-archive-2026-07-to-09.md` に移した。

- 遠野市のAI移行で上がった指摘のうち、`goal2-app/TONO_FEEDBACK_FIX_INSTRUCTIONS.md` の4.1〜4.3（背景色の候補にパッチが無く表の構造候補が選べない、表に「項目／内容1」の見出し行を捏造する、`alt=""` の装飾アイコンに画像名の候補を出す）を直した。設計書の4.4以降と構造変更1は未着手。捏造した見出し行は佐賀市の正解データ側にも含まれていたため、`npm run test:saga-gold` の指標一致は652→648へ下がるが、正解データに合わせて捏造を戻すことはしない判断とした。
- 設計書 `goal2-app/TONO_FEEDBACK_FIX_INSTRUCTIONS.md` の4.4（表のキャプションを1行目のセルから作るのをやめる）と4.5（見出し全体をh2起点へ揃える候補を出す）を直した。4.4では、確信度を下げるとGOAL1の一括採用で表が解体されるため、「文言を調整でしか採用できない」扱いをキャプション専用の候補に限った。4.5では、`canBulkAcceptCandidate()` が `requires_human_review` を見ていないことが分かり、`shift-headings` だけを一括採用から外した。この食い違い自体は範囲が広いため未着手。設計書4.6以降と構造変更1も未着手。
- 構造変更1（`goal2-app/TONO_FEEDBACK_FIX_INSTRUCTIONS.md` 3章）の S1「決定ログの導入」を実装した（PR #131）。`state.decisions` に決定を順序付きで積み、作業中HTMLと最終HTMLを `replay()` で作るようにした。挙動は変えておらず、6章の5コマンドの結果はS1前と同じ（同値テスト17件を新設）。S1で決めた段階差は、`op` の写しをS2へ回すこと、当て順を `seq` ではなく候補配列の添字が決める（ログが決めるのは「どの決定を当てるか」だけ）こと、旧実装 `rebuildWorkingHtmlFor()` をS2で削除すること、`orphaned` がS1では畳み込み済みの決定にも立つことの4つ。当て順は当初 `seq` 順にしていたが、レビューで「画面では作業者の採用順で出力が変わる（S1前は変わらなかった）」ことが佐賀市の実ページで示されたため直した。S2（派生IDと `rebuild` 操作）以降は未着手。
- 構造変更1（`goal2-app/TONO_FEEDBACK_FIX_INSTRUCTIONS.md` 3章）の S2「派生IDと `rebuild` 操作」を実装した（PR #132）。表の構造ビルダー7件をレジストリ化して `(element, params) => htmlString` に揃え、表を丸ごと差し替える構造候補（`planTableTreatments()` の6手段と、`buildMergedCellProposal()` が作るセル結合の5候補）を `{ type: "rebuild", builder, params }` の操作に変えた。決定ログを正本にし（`op`・`order`、`replay()` は2引数、旧実装 `rebuildWorkingHtmlFor()` は削除）、リプレイの当て順を「`rebuild` 以外が先、`rebuild` は内側から」の2段にして、差し替えで生まれた要素に派生ID `nX.s{seq}.{k}` を振るようにした。畳み込み（`foldDescendantFixIntoAncestor()`）は廃止。これは挙動の変更で、構造候補の採用時に未処理だった内容修正は、これまで作業者の採用なしに出力へ入っていたが、S2からは未処理のまま残り、採用したものだけが入る（採用が後になってもリプレイが先に当てるので反映される）。佐賀市の実ページ51件でGOAL1経路の出力はS1と同一。S3（再導出と照合）以降は未着手。
- 構造変更1（`goal2-app/TONO_FEEDBACK_FIX_INSTRUCTIONS.md` 3章）の S3「再導出と照合」を実装した（PR #135）。決定の一かたまりごとに1回、リプレイ→候補の作り直し→照合を走らせるようにし（`rederiveCandidates()`・`reconcile()`）、指紋で前の候補と突き合わせて `candidate_id` と決定を引き継ぐ。対象が無くなった未処理の候補は `withdrawn` としてログへ積み、一覧から外す。`EXCLUSIVE_GROUPS` を入れて調停ロジック5関数を削除し、`conflicted` を新しく作る経路を無くした。リプレイの当て順は世代ごとの `seq` 順になり、`order` は落とした。設計との差は3点で、(1) 指紋 `rule_id|method_label|node_id` は一意にならないため `replace-text` では置換前の文字列まで含める、(2) AIの補完が書き換えた候補は `issue` と `proposal` をまとめて引き継ぐ（結果が `patch` の値と `after_html` にも入るため）、(3) 「1世代に同じ `node_id` の要素ごと差し替えは1件まで」を「固定の変換後HTMLで差し替わる範囲の中の候補は採用しない」まで広げる（実ページでは同じ `node_id` の形は出ず、sg04015 のように範囲で消えるため）。佐賀市の実ページ51件で、GOAL1経路の最終HTMLは51件すべてS2と同一。画面の経路では40件が同一で11件に差が出るが、すべて「再導出で作り直された候補が当たるようになった」か「取り下げで消えた」で説明できる。対象を失う決定（`orphaned`）は9件から0件になった。再導出の時間は要素数が最も多い sg00761（708要素）で決定1件あたり平均71.6ミリ秒・最大108.7ミリ秒で、3.14 の上限300ミリ秒に収まる。S4（画面と証跡）以降は未着手。
- 構造変更1（`goal2-app/TONO_FEEDBACK_FIX_INSTRUCTIONS.md` 3章）の S4「画面と証跡」を実装した（PR #141）。取り下げた候補を写しから証跡に戻し（`status: "withdrawn"`、`completion.withdrawn`）、証跡の候補の行に `generation`・`decision_seq`・`withdrawn_by_seq`・`orphaned`・`orphaned_kind` を、JSON のトップに `decision_log` を足した。`decision_seq` と `orphaned_kind`・`decision_log` は設計書に無い追加で、取り下げの原因の決定と決め直しの履歴を証跡の中で引けるようにし、`orphaned` のうち修正が本当に失われたもの（`lost`）を通知だけの候補（`no-op`）や構造候補の決め直しで対象が作り直されたもの（`target-replaced`）と分けるためである。画面には「再確認」「最終HTMLに未反映」のバッジと「取り下げた候補 N件」の折りたたみを足した。`lost` が残っていても完了判定は変えていない。証跡CSVの既存23列は同じ操作で `main` と一致し、実ページ51件の GOAL1 経路の最終HTMLも51件すべて同一。S5（GOAL1のループ化）は未着手。
- 表の構造変換の手段を一括採用とGOAL1の `autoAcceptSafe` の対象から外した（PR-2.5）。`TABLE_FIX_METHODS_INSTRUCTIONS.md` 2章の確定済み判断がコード側で満たされていなかったのを、`isBulkExcludedCandidate()` を広げる形で直した。`requires_human_review` を一般の条件にするB案は見送り。構造の手段でもキャプション必須にする揃え方は PR-2.6 の候補として残している。
- LLM の提供元の切り替え（`goal2-app/LLM_PROVIDER_SWITCH_INSTRUCTIONS.md`）の L0「つなぎの Gemini 設定」を実装した（PR #143）。`global` の宛先の修正、`GEMINI_TEMPERATURE`、`GEMINI_THINKING_LEVEL` と、LLM の呼び出しの初めてのテスト `test/llm/run-llm-tests.js` を入れた。本番の設定（案 A〜C、推奨は A）を 2026-10-20 より前に替えるのはユーザー。
- 同じ設計書の L1「提供元の切り替えの仕組み」を実装した（PR #144、PR #143 のブランチを基点）。`callLlm()` と gemini、openai-compatible（さくら）のアダプター、スキーマの変換と検証、やり直しと受け皿、`LLM_RECORD_DIR` を入れた。既定の挙動は変えていない。次は L2 の評価で、さくらの API キーが要る。
- 同じ設計書の L2「評価」を行った（PR #146）。佐賀市 51 ページと遠野市 20 ページから集めた 213 件の要求を、Gemini 2.5 Flash、Gemini 3.5 Flash、さくら（gpt-oss-120b と Qwen3-VL）、さくら（gemma-4）に流した。文字はさくらが機械の目安を満たしたが任意の項目を返さず、画像は Gemini のままとする結果になった。人の判定用の CSV を `memory/llm-eval/` に置いた。詳細は `memory/llm-provider-eval-2026-09.md`。
- L2 の所見1（さくらが任意の項目を返さない）を直した（PR #149）。さくらに送るスキーマの `required` を全項目にし、任意の文字列の `""` は取り出したあとに捨てる。再評価では任意の項目がすべて返り、文字のタスクの分類の判定は修正前と変わらなかった（失敗は 154 件中 1 件で再現せず、見出しの見直しを除く p95 は 2.8 秒から 4.0 秒、費用は 8.30 円から 8.38 円）。人の判定用に C2 の CSV を2つ足した。画像のタスクには新しい問題（`extracted_text` の繰り返し、`is_complex` の偏り）が出たが、画像は Gemini のままとする。詳細は `memory/llm-provider-eval-2026-09.md` の「L1 修正後の再評価」。
- リポジトリを整備した。`goal2-app/README.md` を画面一覧とmiChecker関連の機能に合わせて書き替え、package名を `a11y-migration-app` にした。旧複製 `a11y-agent/`、サーバーのログ、`goal2-app/tmp/` を削除し、GitHub Actionsの CI（一時生成物の混入、KB生成物の一致、`goal2-app` のテスト）を足した。テストが起動するサーバーへLLMの鍵を渡さないようにもした（PR #145。詳細は `CHANGELOG.md` の2026-09-24「リポジトリの整備」）
- 本番の Cloud Run を、Vertex AI の `gemini-2.5-flash`(2026-10-20 に廃止)から `gemini-3.5-flash` に替えた(2026-09-25 10:27 日本時間、ユーザーが実施)。`CLOUD_RUN_DEPLOY.md` の案 A のとおり、main の `c8131ee` をビルドし、タグ `gemini35` で確かめてからトラフィックを移した。利用者に届いているのは `goal2-a11y-review-00094-sev`、戻し先は `goal2-a11y-review-00093-7gf`。確認用の API 3件(設定、文字のタスク、画像のタスク)と画面の確認で問題は無かった
- 本番運用の段階の設計書 `goal2-app/PRODUCTION_OPERATIONS_INSTRUCTIONS.md` を作った。ユーザーの決定(IAP、同意は営業が取り記録しない、証跡は共有ドライブ)を段階 P0〜P4 にまとめた。調べる中で、Windows 版の待ち受けと POST の作りから、同じネットワークの別の機器や、ブラウザーで開いた別のサイトが htmlchecker.exe のパスを書き替えて任意の実行ファイルを動かせることを、コードから確かめた(実際に攻撃しての確認はしていない)。P0 として最初に塞ぐ。Codex の二次レビュー(要修正5件)を受けて、IAP のサービスエージェントを作る手順を足し、`PROJECT_CONTEXT.md`、`README.md`、`LLM_DATA_POLICY.md`、この文書に残っていた決定前の記述を直した(PR #148)
- `PROJECT_CONTEXT.md` の `knowledge_mocs` の3つの MOC が ForLLM Vault の `03_MOC` に実在することを、ユーザーが確かめた(2026-09-25)。要確認の注記と未解決事項の項目を消した
- 本番運用の P1 を、IAP から全員で共通のパスワードに変えた(2026-09-28、ユーザーの決定)。使える人を選んで登録するのが難しいためである。仕組みは HTTP の Basic 認証で、アプリ自身が確かめる。Cloud Run でパスワードが無いか16文字より短いときは 503 を返して、設定し忘れで誰でも開ける状態を防ぐ。設計書 3.3 と 4章 P1 を書き替え、IAP のアカウントで作業者の欄を埋める変更(3.5 の3)はやめた
- `goal2-app/PRODUCTION_OPERATIONS_INSTRUCTIONS.md` の P0「手元で動くサーバーの守り」を実装した(PR #150、2026-09-28)。待ち受けを `HOST`(無ければ Cloud Run では `0.0.0.0`、それ以外では `127.0.0.1`)で決め、手元の待ち受けでは `Host` ヘッダーを確かめ、すべての POST で `Content-Type: application/json` と `Origin` の一致を求め、htmlchecker.exe のパスを保存と実行の直前に確かめるようにした。Windows 以外では `POST /api/local-settings` を 404 にした。確かめる処理は `lib/local-guard.js`、テストは `test/local-guard/`。設計との差5つは設計書の 4章 P0 に書いた。Windows の実機での確認と、Windows 版の作り直しと配り直しは未実施で、配り直すまでは配った版の穴が残る
- `goal2-app/PRODUCTION_OPERATIONS_INSTRUCTIONS.md` の P4 で、Node.js を 20 から 24 に上げた(PR #151、2026-09-28)。`Dockerfile`(`node:24-alpine`)、CI の `node-version`、`package.json` の `engines.node`(`>=24`)、Windows 版の作り方の文書と `build-windows-app.bat` の案内を直した。Node 20 のサポートは 2026-04-30 に終わり、Node 22 の保守は 2027-04-30 で終わるため、2028-04-30 まで保守される 24 にした。アプリのコードは変えず、手元の Node 24.21.0 で設計書の5章のテストをすべて通した。Windows で Node 24 から `goal2-app.exe` を作れることと、Cloud Run への反映(マージ後にユーザーが行う)は未確認である
- `goal2-app/PRODUCTION_OPERATIONS_INSTRUCTIONS.md` の P2 のうち、3.5 の画面の変更の1と2、4章 P2 の4を実装した(PR #153、2026-09-28)。Goal 2 に「証跡JSONを保存」を足し、証跡の JSON と CSV を `<日時>_<題名>_<ページの識別>_evidence.<拡張子>` で保存する。GOAL1 の書き出し(バッチ JSON、一覧 CSV、証跡 CSV)は先頭に書き出した日時を付けた。名前は `public/evidence-filename.js` で作り、日本時間は UTC に9時間を足して作る。`WORKER_GUIDE.md` に共有ドライブの保存先と手順の節を足した。証跡の中身は変えていない。ページの識別は設計書の10文字ではなく8文字のハッシュであることが分かり、ユーザーの確認を得て設計書の 2.3 と 3.5 の決まりと例を8文字に直した。「作業者」欄はこれまでどおり作業者が書く(3.5)
- `goal2-app/PRODUCTION_OPERATIONS_INSTRUCTIONS.md` の P1「Cloud Run に共通のパスワードを掛ける」を実装した(PR #154、2026-09-28)。`APP_PASSWORD` があるときは `GET /api/health` を除くすべての要求で HTTP の Basic 認証を求め、両方を SHA-256 にしてから `crypto.timingSafeEqual()` で比べる。Cloud Run で `APP_PASSWORD` が無いか16文字より短いときは 503 を返し、起動時にエラーを1行出す。`/api/` の要求は、パスワードの有無にかかわらず、`Sec-Fetch-Site` が `same-origin` か `none` でなければ 403 にする。確かめる処理は `lib/app-auth.js`、テストは `test/app-auth/`。確かめる順(`Host`、`Sec-Fetch-Site`、パスワード、POST の送り元)と設計との差4つは設計書の 4章 P1 に書いた。本番のシークレットの作成とデプロイ(「本番への適用」)はマージ後にユーザーが行い、そのとき「P1 より前の最後のリビジョン」と「P1 の最初のリビジョン」の名前をここに記録する

## Decisions

- 開発の進め方（2026-10-04 ユーザー確定）: 手元の作業フォルダ `D:\Codex\11y-agent-deploy` で開発し、`main` に直接コミットして `git push origin main` する。GitHub はバックアップとして使い、ブランチと PR は使わない。CI は `main` への push で走る。デプロイも同じフォルダから、push 済みの `main` だけを送る（`goal2-app/CLOUD_RUN_DEPLOY.md`）。push の前に、手元で Fable のサブエージェントに `origin/main..HEAD` の差分をレビューさせ、要修正の指摘を直してから push する（2026-10-04 ユーザー確定。手順は `AGENTS.md` の Agent Working Policy）。指摘に同意できないときはユーザーが判断する。
- （2026-10-04 に上の開発の進め方へ置き換え。PR を使わなくなったため、承認相当と Codex の二次レビューの流れは使わない）レビュー体制（2026-09-17 ユーザー確定。2026-09-24 に設計・レビュー担当を Fable から Opus 5.5 へ置き換え、ユーザー確定）: Opus 5.5 が設計とレビューを担当し、実装は別セッションの Opus が行う。設計書・記録・課題一覧の文書 PR と、構造変更1の各ステージのように段階の区切りになるコード PR には、設計・レビュー担当が「承認相当」を付けたあとに Codex の二次レビューを付け、両方が出そろってからユーザーがマージを判断する。小さな修正 PR は設計・レビュー担当のレビューだけで進める。Codex には `main` の最新を参照させる。指摘が食い違ったときは設計・レビュー担当が再現と根拠で裁定して PR に書く。2026-09-23 までの記録にある「Fable」は、当時の設計・レビュー担当を指す。
- LLM の提供元（2026-09-24、ユーザー確定）: さくらの AI Engine に寄せる。他のプロジェクトですでに使っており、契約と支払いの手続きが済んでいるためである。Google から離れることは条件ではなく、Gemini は受け皿とつなぎとして残す。移行は `goal2-app/LLM_PROVIDER_SWITCH_INSTRUCTIONS.md` の段階に従い、文字のタスクから移す。画像のタスクは、さくらの画像モデルがプレビューのため、評価の結果を見て決める。
- 本番運用（2026-09-25、ユーザー確定）: Cloud Run は全員で共通のパスワードで守る(当初は IAP としたが、使える人を選んで登録するのが難しいため、2026-09-28 にユーザーがパスワード制に変えた。HTTP の Basic 認証をアプリで確かめる)。LLM への送信の同意は営業が自治体（案件）ごとに取り、記録は持たない。証跡は共有ドライブに置き、承認者が見る。保存期間の決まりは無い。段階は `goal2-app/PRODUCTION_OPERATIONS_INSTRUCTIONS.md` にある。
- LLM へのデータ送信と ISMAP（2026-09-24、ユーザー確定）: ISMAP の登録はいまは求めない。送るのは公開済みの自治体ページの HTML と画像で、機密性が低いためである。
- 一括採用の対象から表の構造変換を外す（A案、2026-09-16、ユーザー確定）。`requires_human_review` を一般の条件にするB案は採らない。
- 効率化対象は、移行作業とアクセシビリティ修正作業を一体で扱う。
- AGENTはLLMなどを活用し、機械的に対応できる部分を先に処理する。
- AGENTの出力は最終成果物ではなく、作業者または承認者による確認対象とする。
- 作業者確認と承認者確認は、効率化後も品質保証の工程として残す。
- 作業記録と証跡は、スプレッドシートなど既存の管理方法と接続する。
- heading-review(LLM見出し提案)は、日時・場所・定員等のラベル無し項目が連続する箇所でも`<dl>`化ではなくh4見出し追加を提案する方式を維持する。`<dl>`はCMS入力画面での自治体職員による運用(定義リストの入力・保守)が難しいため、実務上はシンプルな見出し構造の方が扱いやすいとユーザーから明確な判断を得た(2026-07-10)。
- 開発の優先順位は、まずGoal 2から進める。
- Goal 2の初期開発では、Cloud Run上の独立Webアプリを第一候補とする。
- Goal 2の初期PoCでは、CMS本体への直接組み込みではなく、CMS登録予定HTMLを貼り付け、候補レビュー後に最終HTMLと証跡を出力する画面として作る。
- Goal 2の最初の開発単位は、1ページ分のHTML断片を対象にした縦切りPoCとする。
- Goal 2初期PoCは、依存パッケージを増やさず、Node.js標準HTTPサーバーとブラウザDOMParserで実装する。
- Goal 2初期PoCでは、`a11y-migration-kb/build/rules.jsonl` のコピーを `goal2-app/data/rules.jsonl` に配置し、OneDriveの暗号化・オンライン専用属性に依存しない形で読み込む。
- Cloud Runデプロイ手順では、既存Cloud Runサービスと同じ `asia-northeast1` を初期リージョンとする。
- 実案件HTMLを扱う前に、認証、ログ、データ送信ポリシー、証跡保存先、CMS入力欄制約を決める。
- Cloud Runで実案件HTMLを扱う段階では、無認証公開しない。Cloud Run の呼び出し権限は `allUsers` のままとし、アプリ内の共通パスワード(HTTP の Basic 認証)でアクセスを制限する(2026-09-28 決定。`goal2-app/PRODUCTION_OPERATIONS_INSTRUCTIONS.md` の 3.3)。利用者ごとの識別が必要になったら、IAP、IAM、VPN、SSO などへ移る。
- miCheckerはGoal 2初期Cloud Run構成へ直接組み込まず、CMS登録後プレビューの手動確認ゲートとして扱い、結果を証跡化する。
- `koteikara/gemini-a11y-agent` は参考にするが、そのまま踏襲しない。
- 再開発では、`a11y-migration-kb/` を正とし、参考リポジトリの独自ルールや実装は必要に応じて考え方だけを取り込む。
- Goal 1とGoal 2は、別実装として分断せず、共通の候補形式・証跡形式・品質ゲートを使えるように検討する。
- 既存OSSは本プロジェクトの代替品ではなく、検査エンジン、ルール設計、レポート形式、バッチ構成、AI候補提示の参考部品として扱う。
- `axe-core` または `pa11y` は、AGENT出力HTMLとCMS登録後プレビューの自動品質ゲート候補とする。
- ACT Rules / Alfa の考え方は、`a11y-migration-kb/` を実行可能なルール定義へ変換する際の参考にする。
- AWS Content Accessibility Utility の `Audit -> Remediate -> Batch` の責務分離は、Goal 1の一括処理設計の参考にする。
- 本プロジェクトのアクセシビリティ修正対象は、原則としてCMSに登録するコンテンツ部分に限定する。
- コンテンツ部分の修正基準は、外部検査ツールよりも `a11y-migration-kb/` を優先する。
- ページ全体を対象にする外部検査結果は、そのまま移行HTML修正候補にせず、`content`、`old-site-template`、`new-cms-template`、`unknown` に分類して扱う。
- GitHub外の標準・ガイドライン・ツール資料は、`a11y-migration-kb/` を置き換えるものではなく、根拠、補足説明、分類、レビュー観点として対応づける。
- 作業者・承認者・顧客向けの説明では、日本語で説明しやすいWAICとデジタル庁資料を優先的な参照候補にする。
- GOV.UK Content Guidanceは、表、画像、リンク、見出しなどの本文編集ルールを磨くための参考にするが、日本語自治体サイトへそのまま適用しない。
- W3C ATAGは、Goal 2を作業者向けauthoring supportとして設計する際の参考にする。
- miCheckerは、`a11y-migration-kb/` を置き換える主基準ではなく、公共団体案件における実務上の受け入れシグナル・品質ゲート候補として扱う。
- miCheckerで本文コンテンツ起因の明らかな問題が残る場合は、原則として完了扱いにしない。
- miChecker結果は、`content`、`old-site-template`、`new-cms-template`、`unknown` に分類し、本文起因の指摘だけを移行HTML修正候補として扱う。
- miCheckerを使う場合は、バージョン、実行日、検査対象、指摘分類、対応結果、未解消理由を証跡として残す。
- 駒瑠市は、実案件データではなく教材データとして扱い、PoC用の再現可能なOK/NGサンプルに限定して使う。
- A11yc ACS公開サービスへ実案件HTMLを送信する運用は、情報管理・利用制限・外部サービス依存の観点から採用前に確認が必要である。
- A11yc libraryは、公開サービスではなく社内・ローカルで本文HTML断片を検査する候補として技術検証する価値がある。
- Goal 2の実行画面は、A11yc ACS型の「HTML入力、問題一覧、該当箇所表示、根拠表示」を参考にしつつ、本プロジェクトでは「修正候補の採用・編集・却下」と「最終HTML出力」まで拡張する。
- 修正候補の操作は、GitHubのコンフリクト解消に近い候補単位のレビューとして扱い、レンダリングHTML上の問題箇所を見ながら `採用`、`編集して採用`、`却下`、`要確認` を選べるようにする。
- Goal 2では、すべての修正候補が `採用`、`編集して採用`、`却下`、`要確認` のいずれかに分類されるまで、ページ作業を完了扱いにしない。
- 2026-06-29に、Mark Fairchildの記事 "AI-Generated Accessibility: An Update - Frontier Models Still Fail, but Skills Change the Game" を参照し、AIアクセシビリティ生成の共通方針として「短い基本指示」「部品別Skill」「生成後レビュー」「自動検証と人間確認の分離」を採用した。
- 2026-09-15に、遠野市フィードバック対応の構造変更1（決定のたびに依存候補を作り直す、`goal2-app/TONO_FEEDBACK_FIX_INSTRUCTIONS.md` 3章）について次を確定した。一括採用はまとめてログに積んで再導出1回。`conflicted` は新規に作らず証跡の値としてだけ残し、取り下げ（`withdrawn`）で代える。「AIで再確認」ボタンはS4に含めず別PR。再導出の時間の上限は300ミリ秒。
- 遠野市フィードバック対応の実装は、着手順（同設計書5章）に従い別セッションのOpusが行い、レビューは設計書を書いたセッションが行う分担にした（2026-09-15）。

## Not Completed Yet

2026-10-04 に、3つの段に分けて整理し直した。
整理する前の一覧は `memory/project-state-archive-2026-07-to-09.md` にある。

### 決めたが未実施（ユーザーの作業）

- P1 の本番への適用。シークレット `app-password` を作り、パスワードを確かめる処理の入ったイメージを、トラフィックを流さないタグ付きのリビジョンで確かめてから移す（`goal2-app/PRODUCTION_OPERATIONS_INSTRUCTIONS.md` の 4章 P1「本番への適用」）。適用までは、URL を知っていれば誰でも画面と API を使え、Vertex AI の費用もかかる。適用したら、「P1 より前の最後のリビジョン」と「P1 の最初のリビジョン」の名前をここに書く。
- 次のデプロイの前に、作業者とスプレッドシートへ取り込む側に、証跡の変更を知らせる。デプロイでは、タグ付きの URL で、パスワードと AI の下書きに加え、証跡の JSON の保存と CSV の列も確かめる。本番は `c8131ee`（2026-09-25 のデプロイ）のままで、そのあとの 62 コミットが出ていない。次のデプロイでは P1 と P4 に加え、構造変更1 S4（証跡 CSV に5列、JSON に `decision_log`）と P2（証跡の保存名）も出るためである。
- P0 の Windows 版 `goal2-app.exe` の作り直しと配り直し、実機での確認（設計書 5章の最後の3項目）。すでに配った版は、同じネットワークの別の機器から任意の実行ファイルを動かせる。作る PC には Node.js 24 と signtool が要る。配り直すまでは、使うときだけ起動し、ファイアウォールの許可を外すよう担当者に案内する（設計書 P0 の末尾）。
- P2 の共有ドライブの `移行証跡` フォルダーの作成と、メンバーを移行チームと承認者に絞る設定。
- L2 の人の判定。`memory/llm-eval/` の CSV の判定列を埋める。L3 を始める条件の一つ（文言のタスクで「さくらが良い」と「同等」が合わせて 80% 以上）。

### コード未着手（設計書あり、担当は Opus）

- 構造変更1 S5「GOAL1 のループ化」（`goal2-app/TONO_FEEDBACK_FIX_INSTRUCTIONS.md` 3.13）。S3 と S4 からの申し送り（GOAL1 の証跡の `null` のキー、段落を作り替える候補の排他グループなど）を同時に入れる。
- 遠野市フィードバックの 4.6（操作パネルの大きさ）、4.7（通常のテキストに見出しを提案する）、4.8（写真の文字まで文字起こしする）。4.7 と 4.8 は AI への指示の変更なので、評価の結果を添える。
- LLM L3「本番の切り替え」（`goal2-app/LLM_PROVIDER_SWITCH_INSTRUCTIONS.md` 4章 L3、本番運用の P3）。P3 で足す決まり（本番で `LLM_RECORD_DIR` が設定されていたら書き出さずに警告する）と、発注元と自治体への説明文の案を含む。
- 「AIで再確認」ボタン（`TONO_FEEDBACK_FIX_INSTRUCTIONS.md` 3.9、3.14）。AI が書き替えた候補の `after_html` が古いまま当たる制限（3.6）が残っている。
- issue #136（`text.partial-date` が「1/2」を日付と判定する）。ルール側の別件で、構造変更1では扱わない。
- PR-2.6 の候補（構造の手段でもキャプションを必須にする揃え方）。
- 小さめの整備: lock ファイルが無いこと(npm の依存は0件)。`goal2-app/.gcloudignore` と、`build-windows-app.bat` の `esbuild` と `postject` の版の固定は 2026-10-04 に済んだ。

### 未決定（課題候補一覧へ委ねた）

業務側の未決は `memory/project-issue-candidates.md` の ID で管理する。
主なものは、CMS 入力欄の実際の制約（A01、A04）、ページの完了条件（C01〜C04）、本文抽出と意味保持の評価セット（A02、B02、D03）、実案件で使う前提（D01、D02）である。

次の検討候補は、課題候補一覧にまだ入れていない。採否は決まっていない。

- 外部検査エンジン（`axe-core`、`pa11y`、A11yc library）を使うか、使うなら何を対象に検査するか。
- miChecker で抽出済みの HTML 断片を検査するためのラッパーと、CMS 登録後のプレビュー URL を検査する運用。
- `gemini-a11y-agent` の品質監査項目と report-only ルールの引き継ぎ、外部の参照資料と KB の各ルールの対応表。
- Goal 3 の抽出規則の KB への文書化、Goal 1 との接続、`/api/fetch-html` を実案件の旧サイトに使ってよいか。
- 一括処理方式とページ単位方式を組み合わせる案。

## Next Candidate Work

2026-10-04 に Opus 5.5 と Fable で相談し、ユーザーが承認した順番である。

1. ユーザーが Node.js 24 を入れる（`.exe` を作り直す前提）。
2. ユーザーが P1 を本番に適用する。
3. ユーザーが `goal2-app.exe` を作り直して配り直す。
4. ユーザーが共有ドライブのフォルダーを用意する。
5. 1〜4 と並行して、Opus が手元で小さめの作業を進める。順に、このファイルの整理、`goal2-app/.gcloudignore`、`npx esbuild` と `npx postject` の版の固定、4.6。
6. Opus が S5 を進める。P1 を適用し、本番で S4 が落ち着いてから始める。手元に Playwright と佐賀市 fixture（`.tmp-gemini-a11y-agent`）を置いてから push する。
7. Opus が 4.7 と 4.8 を進める。
8. L2 の人の判定と、L3 に要る決定がそろってから L3 を進める。
9. 業務側の未決のうち、最終 HTML の形に響く A01 と、証跡の列が変わったいま決めやすい C01 から具体化する。

ユーザーに決めてもらう事項は次のとおり。

- パスワードの管理者を1人（`PRODUCTION_OPERATIONS_INSTRUCTIONS.md` 6章）。
- 送信の同意が得られない案件があり得るか。あり得るなら同じ設計書 3.4 の案 A か B。
- 共有ドライブのフォルダーにサイト区分の段を入れるか。
- L2 の人の判定をいつ行うか。
- 画像のタスクをさくらのプレビューのモデルに載せるか、このプロジェクト専用の API キーを発行するか、発注元と自治体へ説明するか。
- 4.8 で「画像内の文字を読む」と「内容を説明する」の切り替えまで扱うか。
- 「AIで再確認」ボタンと issue #136 を S5 の前と後のどちらに置くか（推奨は後）。
- 古いクローン4つ（`C:\Codex\11y-agent-deploy`、`C:\Codex\a11y-agent`、`D:\Codex\a11y-agent`、両ドライブの `a11y-agent-clone`）を消すか。

## Update Policy

- 新しい決定があった場合は `Decisions` に追記する。
- 未完了事項が完了した場合は `Current Progress` に移し、`Not Completed Yet` から削除する。
- `Current Progress` は直近の段階の要約にとどめ、細かな経緯は `CHANGELOG.md` に書く。ファイルが大きくなったら、古い部分をアーカイブのファイルへ移す。
- 次に取り組む候補が増えた場合は `Next Candidate Work` に追記する。
- 作業の完了判定は `done-definition.md` を参照する。

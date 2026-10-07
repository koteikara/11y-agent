# embeddinggemma2-kb-search-2026-10.md

## Purpose

Google が 2026-10-06 に公開した埋め込みモデル **EmbeddingGemma 2** が、KB のルール検索（ディレクターが文章で尋ね、関係するルールを探す）に使えるかを調べた記録である。
2026-10-07 に、API での提供状況を公式ページで確かめ、ディレクターの PC と同じ Windows 11 の PC で KB の67ルールを対象に評価した。
料金や提供状況は変わりやすいので、使う前に出典で確かめ直す。

**埋め込み（Embedding）**：文章を数値の並び（ベクトル）に変える処理。
意味が近い文章ほど近い値になるので、言葉が一致しなくても意味で探せる。
文章を生成する Gemini などとは別の種類のモデルである。

## 結論

- KB のルール検索には使える。
  言い換えた質問に強く、上位3件に正解が入る割合は、文字の一致で探す方式の81%から92%に上がった。
- 1位の正解率は文字の一致とほぼ同じ（69%と65%）なので、答えを1つに決める使い方には向かない。
  候補を3件ほど出し、ディレクターが選ぶ使い方に向く。
- 2026-10-07 時点では、EmbeddingGemma 2 を API では使えない。
  使うなら、ディレクターの PC で動かす。
  ページの内容を外に送らず、費用もかからない。
- 今のアプリには、文章で尋ねてルールを探す画面が無い。
  リニューアルでその画面を作るときに、検索の仕組みとして採用を検討する。

## API での提供状況（2026-10-07）

EmbeddingGemma 2 はモデルの重みの配布だけで、ホスト型の API は無い。

- **配布先**：Hugging Face と Kaggle。ライセンスは Apache 2.0 で、商用利用と再配布ができる。
- **Vertex AI**：Model Garden（現在の名称は Gemini Enterprise Agent Platform）への提供は、公式の発表で「近日対応」とされている。
- **Gemini API**：モデル一覧の埋め込みモデルは `gemini-embedding-2-preview` と `gemini-embedding-001` だけで、EmbeddingGemma は無い。
  料金ページにも無い。

API で埋め込みを使うなら、今使えるのは Google の **Gemini Embedding 2** である。
EmbeddingGemma 2 とは別のモデルで、Google のサーバーで動く。

- **料金**：テキストの入力は100万トークンあたり $0.20。KB の67ルール（本文、例を含めて約2万4千字）を一度ベクトルにする費用は、1セントに届かない見積もりである。
- **無料枠**：あるが、規約で、無料枠に送った内容は Google の製品の改善に使われ、人が読むことがあるとされている。
  有料枠では改善に使わない。
  ページの HTML を送るなら有料枠にする（`goal2-app/LLM_DATA_POLICY.md` の方針と合わせる）。
- **提供元**：Gemini API と Vertex AI。2026-04-22 に一般提供になった（公式ブログ）。
  一方、Gemini API のモデル一覧では、2026-10-07 時点でも ID が `-preview` のまま載っている。
  使う前に ID を確かめる。

さくらの AI Engine にも、OpenAI 互換の埋め込み API がある（国内で処理が完結する）。
提供モデルの一覧は今回確かめていない。
LLM の提供元をさくらに寄せる方針（`memory/llm-provider-alternatives-research.md`）に合わせるなら、比べる候補になる。

## 「API が無料」という記事について

SNS や記事に、EmbeddingGemma 2 で「API 代が0円になる」と書いたものがある。
ユーザーが見せた韓国語の X 投稿もその一つだった。
これは、Google が無料の API を出したという意味ではない。
利用者のスマートフォンやブラウザでモデルを動かすので、開発者のサーバーで計算しない、という意味である。

投稿の数値は、次の条件付きで正しい。

- RAM 191MB は文章だけを扱う場合で、Pixel 11 Pro での値である。
  画像や音声まで扱うと約567MB になる。
- 「容量1/6」は、768次元を128次元に縮めた場合（Matryoshka 表現学習）の計算である。

投稿には書かれていないが、モデルを利用者に配る必要があり（数百MB）、遅い端末では動作が重くなる。
ブラウザで動かすための ONNX 形式は、初代の EmbeddingGemma にはあるが、2の版は2026-10-07 時点で見当たらなかった。

## ディレクターの PC で動かす方法

2026-10-07 時点では、Ollama では動かせなかった。

- Ollama の公式ライブラリの `embeddinggemma-2` は、Windows では取得できなかった。
  Ollama 0.35.1 では「新しい Ollama が要る」と断られ、0.40.0 に上げると、`270m` と `270m-bf16-text` の両方が「MLX が要る」と断られた。
  MLX は Apple のチップ向けの実行環境である。
  Linux でも同じ不具合の報告がある。
- Hugging Face の `unsloth/embeddinggemma-2-GGUF` を Ollama 0.40.0 に取り込むと、取得はできたが、Ollama の中の計算部品がモデルの構造を知らず、読み込めなかった（`unknown model architecture: 'gemma-embedding2'`）。

llama.cpp の公式の Windows 版では動いた。
llama.cpp は Ollama の中で使われている計算部品で、EmbeddingGemma 2 への対応は 2026-10-06 に取り込まれた（ggml-org/llama.cpp の PR #30054）。

- **llama.cpp**：リリース `b11457` の `llama-b11457-bin-win-cpu-x64.zip`。展開するだけで、インストールは要らない。
- **モデル**：`unsloth/embeddinggemma-2-GGUF` の `embeddinggemma-2-Q8_0.gguf`（309MB、文章用）。
  画像や音声も扱う場合は、別のファイル（`mmproj-*.gguf`）が要る。

起動のコマンド:

```
llama-server.exe --model embeddinggemma-2-Q8_0.gguf --alias eg2 --embeddings --pooling mean --ctx-size 8192 --batch-size 8192 --ubatch-size 8192 --parallel 1 --host 127.0.0.1 --port 8080
```

`http://127.0.0.1:8080/v1/embeddings` が OpenAI 互換の埋め込み API になる。
Ollama が対応すれば、`ollama pull` だけで同じことができる見込みである。

導入の前に、次の2点を確かめる。

- 会社の PC に llama.cpp や Ollama を入れてよいか。
- 社内のプロキシで `huggingface.co`、`ollama.com`、GitHub のリリースが止められていないか。
  止められている場合は、取得したモデルのファイルを共有ドライブで配る。

## 評価の方法

評価の道具は `memory/embedding-eval/` にある。

- `queries.json`：ディレクターが尋ねそうな質問48問と、正解のルール ID。
  ルールの言葉をそのまま含む質問（easy、14問）と、言い換えた質問（hard、34問）に分けた。
  正解は1問に1〜2件で、どれかが入れば正解とした。
- `eval.mjs`：次の3つの方式で、67ルールを順位付けする。
  - **文字の一致**：文字の2字ずつの組（bigram）で BM25 の点数を付ける。モデルを使わない比較用。
  - **埋め込み**：質問とルールのベクトルの近さ（コサイン類似度）で並べる。
  - **組み合わせ**：上の2つの順位を RRF（k=60）でまとめる。

ルールの文章は、題名、説明、ルール本文、例（ケース、修正前、修正後）をつないだものである。
モデルカードの指定に合わせて、ルールには `title: {題名} | text: {本文}`、質問には `task: search result | query: {質問}` を付けて送った。

再現のコマンド（llama-server を起動したうえで、リポジトリのルートから）:

```
LLAMA_URL=http://127.0.0.1:8080 node memory/embedding-eval/eval.mjs eg2
```

## 評価の結果（2026-10-07）

上位 k 件の中に正解が入った割合:

| 方式 | 質問 | 1位 | 上位3件 | 上位5件 |
|---|---|---|---|---|
| 文字の一致 | 全48問 | 69% | 81% | 81% |
| 文字の一致 | easy 14問 | 93% | 100% | 100% |
| 文字の一致 | hard 34問 | 59% | 74% | 74% |
| 埋め込み | 全48問 | 65% | 92% | 94% |
| 埋め込み | easy 14問 | 86% | 100% | 100% |
| 埋め込み | hard 34問 | 56% | 88% | 91% |
| 組み合わせ | 全48問 | 73% | 83% | 90% |
| 組み合わせ | easy 14問 | 93% | 100% | 100% |
| 組み合わせ | hard 34問 | 65% | 76% | 85% |

速さ（CPU だけ）:

- 67ルールをベクトルにする処理は約79秒かかった。ルールを変えたときに一度やり直せばよい。
- 質問1件の検索は、中央値131ミリ秒、最大161ミリ秒だった。

文字の一致は、上位3件で9問を外した。
埋め込みは、そのうち6問を当てた（「画像を押すと別ページに飛ぶ場合のalt」「表の上に表のタイトルを付ける必要はある？」「文字を赤や緑にして目立たせている」「大きい文字や小さい文字が混在している」「・で始まる行が並んでいる」「見出しがh2の次にいきなりh4になっている」）。
残りの3問は、埋め込みも外した（下の表の1、3、4行目）。

埋め込みが上位3件で外した4問:

| 質問 | 正解 | 埋め込みの上位3件 |
|---|---|---|
| R6.4.1 という書き方 | `text.date-notation` | `text.list`、`text.note-symbol`、`text.sensory-characteristics` |
| 条例の条文をそのまま載せている部分 | `text.quotation` | `table.caption`、`html-structure.heading-required`、`table.cell-merge-toc` |
| ページを開くと数秒後に別のページに移動する | `html-structure.embedded-script-behavior` | `link.cross-page-anchor`、`link.toppage-link`、`link.internal-link` |
| ページの先頭に戻るリンク | `link.in-page-anchor` | `link.internal-link`、`link.cross-page-anchor`、`link.toppage-link` |

4問とも、ルールの文章に質問と同じ種類の具体例が書かれていない。
たとえば日付のルールには和暦の略記（R6.4.1）の例が無く、自動で動くスクリプトのルールは「meta 要素による自動リロード」と書いていて、「別のページに移動する」とは書いていない。
ルールの説明に具体例を足せば当たる見込みがあるが、試していない。

組み合わせは、上位3件では埋め込みだけより悪かった。
文字の一致が外した質問で、文字の一致の上位が混ざって正解を押し下げたためである。
使うなら埋め込みだけでよい。

## 評価の限界

- 質問48問は、評価を行ったエージェント（Claude）がルールの題名を見たうえで作った。
  実際のディレクターの尋ね方とは違う可能性がある。
  導入を決める前に、ディレクターが実際に迷った質問を20〜30問集めて評価し直す。
- 試したのは Q8_0 の量子化の1種類だけで、初代の EmbeddingGemma や Gemini Embedding 2 とは比べていない。
- ルールの文章の組み立て方（題名と本文と例をつなぐ）や、質問の前置きを変えた場合は試していない。

## 次にすること

1. リニューアルで、文章で尋ねてルールを探す画面を作るかを決める。
2. 作るなら、ディレクターの実際の質問で評価し直す。
   比べる相手に、Gemini Embedding 2（有料枠）と、さくらの AI Engine の埋め込みを入れる。
3. 外した4問の型（和暦、条文、自動の移動、先頭に戻る）について、ルールの説明に具体例を足すかを決める。
   足すとルールの文章が変わるので、KB の変更として扱う。

## 出典

- [EmbeddingGemma 2 is a best-in-class open model for natively multimodal embeddings（Google、2026-10-06）](https://blog.google/innovation-and-ai/technology/developers-tools/embeddinggemma-2/)
- [EmbeddingGemma 2: The Developer Guide（Google Developers Blog）](https://developers.googleblog.com/embeddinggemma-2-the-developer-guide/)
- [google/embeddinggemma-2（Hugging Face のモデルカード）](https://huggingface.co/google/embeddinggemma-2)
- [Gemini API のモデル一覧](https://ai.google.dev/gemini-api/docs/models)
- [Gemini API の料金](https://ai.google.dev/gemini-api/docs/pricing)
- [Gemini API の追加利用規約](https://ai.google.dev/gemini-api/terms)
- [Gemini Embedding 2 is now generally available（Google、2026-04-22）](https://blog.google/innovation-and-ai/models-and-research/gemini-models/gemini-embedding-2-generally-available/)
- [Ollama の embeddinggemma-2 のタグ一覧](https://ollama.com/library/embeddinggemma-2/tags)
- [Unsloth の EmbeddingGemma 2 の手順](https://unsloth.ai/docs/models/embeddinggemma-2)
- [llama.cpp PR #30054: model: support embeddinggemma2](https://github.com/ggml-org/llama.cpp/pull/30054)
- [初代の ONNX 版（onnx-community/embeddinggemma-300m-ONNX）](https://huggingface.co/onnx-community/embeddinggemma-300m-ONNX)

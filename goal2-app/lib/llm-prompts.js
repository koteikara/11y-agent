// Task-specific system prompts and structured-output schemas for the /api/llm/enrich
// endpoint. Each task processes a batch of independent items in one request (cheaper than
// one request per candidate) and returns one result object per item, matched back to the
// candidate by `id`. buildUserText() picks only the fields each task actually needs out of
// the item so prompts stay small.

const TASKS = {
  "foreign-language": {
    systemPrompt:
      "あなたは日本語の自治体ウェブサイトのアクセシビリティ改修を支援するアシスタントです。" +
      "与えられた複数のテキスト断片それぞれについて、日本語以外の言語(外国語)の文章・語句が含まれているかを判定してください。" +
      "URL・メールアドレス・型番・固有名詞の英字表記のみの場合は外国語とはみなさないでください。" +
      "外国語が含まれる場合は、その言語のBCP47言語コード(例: en, zh, ko, es, pt, ru, th, vi, fr, de など)と、" +
      "日本語での言語名(例: 英語、中国語、フランス語)を返してください。" +
      "各項目について必ず1件、入力と同じidを持つ結果オブジェクトを返してください。",
    responseSchema: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          id: { type: "STRING" },
          is_foreign: { type: "BOOLEAN" },
          lang_code: { type: "STRING" },
          language_name_ja: { type: "STRING" },
        },
        required: ["id", "is_foreign"],
      },
    },
    buildUserText(items) {
      return JSON.stringify(items.map((item) => ({ id: item.id, text: item.text })));
    },
  },

  "sensory-characteristics": {
    systemPrompt:
      "あなたは日本語の自治体ウェブサイトのアクセシビリティ改修を支援するアシスタントです。" +
      "与えられたテキストそれぞれについて、「右の」「上記の」「下のボタン」のような、形・位置・色だけに依存して案内している表現が、" +
      "実際に問題(音声読み上げや形・位置を認識できない利用者に伝わらない)かどうかを判定してください。" +
      "見出し名やボタン名など、テキストで特定できる情報が併記されていれば問題なしと判定してください。" +
      "各項目について必ず1件、入力と同じidを持つ結果オブジェクトを返し、is_issueがtrueの場合はexplanationにその文章に即した具体的な理由を日本語で書いてください。",
    responseSchema: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          id: { type: "STRING" },
          is_issue: { type: "BOOLEAN" },
          explanation: { type: "STRING" },
        },
        required: ["id", "is_issue"],
      },
    },
    buildUserText(items) {
      return JSON.stringify(items.map((item) => ({ id: item.id, text: item.text })));
    },
  },

  "link-text": {
    systemPrompt:
      "あなたは日本語の自治体ウェブサイトのアクセシビリティ改修を支援するアシスタントです。" +
      "「こちら」「詳細はこちら」のような曖昧なリンク文言を、リンク単体で読んでもリンク先の内容が分かる具体的な文言に書き換えてください。" +
      "各項目には、リンク先のURL(href)・直前の見出し(preceding_heading)・リンクを含む段落等の周辺テキスト(nearby_text)を渡します。" +
      "これらの手がかりから、20文字程度までの自然な日本語のリンク文言(suggested_text)を1つ提案してください。" +
      "手がかりが乏しく確信が持てない場合はconfidenceをlowにしてください。" +
      "各項目について必ず1件、入力と同じidを持つ結果オブジェクトを返してください。",
    responseSchema: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          id: { type: "STRING" },
          suggested_text: { type: "STRING" },
          confidence: { type: "STRING" },
        },
        required: ["id", "suggested_text"],
      },
    },
    buildUserText(items) {
      return JSON.stringify(
        items.map((item) => ({
          id: item.id,
          href: item.href,
          preceding_heading: item.precedingHeading,
          nearby_text: item.nearbyText,
        }))
      );
    },
  },

  "mail-link": {
    systemPrompt:
      "あなたは日本語の自治体ウェブサイトのアクセシビリティ改修を支援するアシスタントです。" +
      "メールアドレスがそのままリンク文言になっている箇所を、「◯◯課へメールを送信」のような分かりやすい文言に書き換えてください。" +
      "各項目には、メールアドレス(mail_address)と、リンクを含む段落等の周辺テキスト(nearby_text)を渡します。" +
      "周辺テキストから担当部署名(課・係・室・センター等)が読み取れればそれを使い、読み取れなければ「担当部署へメールを送信」としてください。" +
      "各項目について必ず1件、入力と同じidを持つ結果オブジェクトを返してください。",
    responseSchema: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          id: { type: "STRING" },
          suggested_text: { type: "STRING" },
        },
        required: ["id", "suggested_text"],
      },
    },
    buildUserText(items) {
      return JSON.stringify(items.map((item) => ({ id: item.id, mail_address: item.mailAddress, nearby_text: item.nearbyText })));
    },
  },

  "toppage-link": {
    systemPrompt:
      "あなたは日本語の自治体ウェブサイトのアクセシビリティ改修を支援するアシスタントです。" +
      "トップページへのリンクの文言を「◯◯市トップページ」のような形に書き換えてください。" +
      "各項目にはページ名の入力欄の値(page_title)を渡します。そこから市区町村名が読み取れればそれを使い、読み取れなければ「サイト名トップページ」としてください。" +
      "各項目について必ず1件、入力と同じidを持つ結果オブジェクトを返してください。",
    responseSchema: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          id: { type: "STRING" },
          suggested_text: { type: "STRING" },
        },
        required: ["id", "suggested_text"],
      },
    },
    buildUserText(items) {
      return JSON.stringify(items.map((item) => ({ id: item.id, page_title: item.pageTitle })));
    },
  },

  "table-caption": {
    systemPrompt:
      "あなたは日本語の自治体ウェブサイトのアクセシビリティ改修を支援するアシスタントです。" +
      "与えられた表(HTML)それぞれについて、その表が何を表しているかを短く要約したキャプション文言(15文字程度まで)を日本語で提案してください。" +
      "表の見出し行・内容から具体的に判断し、「表」「一覧」など内容を特定しない語だけの提案は避けてください。" +
      "各項目について必ず1件、入力と同じidを持つ結果オブジェクトを返してください。",
    responseSchema: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          id: { type: "STRING" },
          suggested_caption: { type: "STRING" },
        },
        required: ["id", "suggested_caption"],
      },
    },
    buildUserText(items) {
      return JSON.stringify(items.map((item) => ({ id: item.id, table_html: item.tableHtml })));
    },
  },

  "cell-merge": {
    systemPrompt:
      "あなたは日本語の自治体ウェブサイトのアクセシビリティ改修を支援するアシスタントです。" +
      "セル結合(rowspan/colspan)を含む表(HTML)それぞれについて、なぜこの表の構造がアクセシビリティ上の問題になりうるか、" +
      "その表の実際の内容に即した具体的な説明(explanation、日本語1〜2文)を書いてください。" +
      "current_categoryには機械的に分類済みのカテゴリ(heading/summary/note/file/mark/layout)が入っているので、" +
      "それを踏まえた説明にしてください(分類そのものは変更しないでください)。" +
      "各項目について必ず1件、入力と同じidを持つ結果オブジェクトを返してください。",
    responseSchema: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          id: { type: "STRING" },
          explanation: { type: "STRING" },
        },
        required: ["id", "explanation"],
      },
    },
    buildUserText(items) {
      return JSON.stringify(items.map((item) => ({ id: item.id, table_html: item.tableHtml, current_category: item.currentCategory })));
    },
  },

  "th-scope": {
    systemPrompt:
      "あなたは日本語の自治体ウェブサイトのアクセシビリティ改修を支援するアシスタントです。" +
      "表(table_html)の中の特定のth要素(target_th_text で本文が一致するもの)について、scope属性の正しい値(col/row/colgroup/rowgroup)を判定してください。" +
      "その見出しセルが列全体の見出しならcol、行全体の見出しならrow、複数列にまたがる見出しグループならcolgroup、複数行にまたがる見出しグループならrowgroupです。" +
      "各項目について必ず1件、入力と同じidを持つ結果オブジェクトを返してください。",
    responseSchema: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          id: { type: "STRING" },
          scope: { type: "STRING" },
        },
        required: ["id", "scope"],
      },
    },
    buildUserText(items) {
      return JSON.stringify(items.map((item) => ({ id: item.id, table_html: item.tableHtml, target_th_text: item.targetThText })));
    },
  },

  // Unlike the other batch tasks, no mechanical detector for this exists at all — a regex
  // alone can't reliably tell a real kaomoji/ASCII-art figure apart from ordinary Japanese
  // text that happens to use similar symbols/brackets, so this is the sole judge rather than
  // an upgrade over an existing heuristic draft. items are a cheap, over-inclusive regex
  // prefilter's matches (see isAsciiArtPrefilterMatch in app.js).
  "ascii-art": {
    systemPrompt:
      "あなたは日本語の自治体ウェブサイトのアクセシビリティ改修を支援するアシスタントです。" +
      "与えられた複数のテキスト断片それぞれについて、次の3種類のいずれかが含まれているかを判定してください: " +
      "(1) 記号を組み合わせた顔文字(例: (・∇・)、m(_ _)m、(^o^))。" +
      "(2) 同じ記号(＊、※、=、-、～、♪等)が8回以上連続するような装飾目的の区切り行。これはスクリーンリーダーが記号を1つずつ読み上げてしまい内容が伝わらない問題があるため対象に含めてください。" +
      "(3) 複数行にわたるアスキーアート(罫線や記号を組み合わせた図案)。" +
      "次のものは対象外です: 曜日・番号・略称などの通常の日本語の丸括弧書き、記号のみで構成された罫線表(表組みの代用)。" +
      "いずれかが含まれる場合はis_ascii_artをtrueにし、以下を判定してください。" +
      "kindは、(1)の場合はsimple、(2)の場合はseparator、(3)の場合はcomplexとしてください。" +
      "matched_textには、入力テキストに実際に含まれる該当箇所の文字列を一字一句変更せずそのまま書き写してください。" +
      "kindがsimpleの場合、suggested_textにその表情・仕草を短い日本語の言い換え(例:「（笑顔で）」「（お辞儀）」)で提案してください。" +
      "kindがseparatorの場合、suggested_textには「区切り線としてhr要素へ置き換える」「読み上げ対象から除外する」等の対応方針を短く提案してください。" +
      "kindがcomplexの場合、suggested_textには画像化する場合のalt候補の方向性を短く提案してください(実際の画像は生成しません)。" +
      "いずれにも該当しない場合は、is_ascii_artをfalseにしてください。" +
      "各項目について必ず1件、入力と同じidを持つ結果オブジェクトを返してください。",
    responseSchema: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          id: { type: "STRING" },
          is_ascii_art: { type: "BOOLEAN" },
          kind: { type: "STRING" },
          matched_text: { type: "STRING" },
          suggested_text: { type: "STRING" },
        },
        required: ["id", "is_ascii_art"],
      },
    },
    buildUserText(items) {
      return JSON.stringify(items.map((item) => ({ id: item.id, text: item.text })));
    },
  },

  // Unlike the other tasks, image-alt processes one image per request (vision calls need
  // the actual image bytes fetched server-side, so they can't be cheaply batched the same
  // way as text items) — buildUserText() here takes a single item, not an array.
  "image-alt": {
    systemPrompt:
      "あなたは日本語の自治体ウェブサイトのアクセシビリティ改修を支援するアシスタントです。" +
      "与えられた画像を見て、画像を見られない利用者にも内容が伝わる代替テキスト(altテキスト)を日本語で提案してください。" +
      "「電話で『こんな画像だよ』と言葉で伝える」イメージで、①主題(何が。画像の主役・主語)＋②様子(どうなっている・何をしている・どういう状態。述語)＋③+α情報(①②以外で分かる情報。どこで・何色・誰と・画像の主役以外の人やものの様子など)を、一文に収まるように整えてください。" +
      "語順は自然に読める順でよく、末尾は「〜の写真」等で結んでよいです。" +
      "「画像」「写真」などの単語だけで終わらせず、何が写っているか具体的に書いてください。長さは内容が伝わる範囲で最大100文字程度までとし、冗長な装飾表現は避けてください。" +
      "内容が完全には判別できない場合でも、見て分かる範囲(被写体の種類など)で具体的に記述してください(例:「機械の部品の写真」「大きな機械の写真」)。" +
      "内容を持たない装飾目的のみの画像(罫線・アイコン等)と判断した場合はis_decorativeをtrueにしてください。" +
      "地図・グラフ・図表・チラシ・ポスターなど、代替テキスト一行では内容を伝えきれない複雑な画像の場合はis_complexをtrueにしてください。" +
      "is_complexがtrueの場合でも、alt_textには画像の主題・内容をできるだけ具体的に説明する文を入れてください" +
      "(「グラフ」「ポスター」のような分類語一語で終わらせず、「人口推移の集計結果を示す折れ線グラフ」「絶景スポットとご当地グルメを紹介する観光地特集のポスター」のように何のグラフ・ポスターかが分かるよう書く)。" +
      "ただしグラフの全数値やチラシ・ポスターの全項目・全写真のような網羅的な詳細まではalt_textに詰め込まず、それはcomplex_detailに回してください。「詳細は以下」という接尾辞は付けないでください(後処理で自動的に付与されます)。" +
      "alt_textに含めなかった網羅的な詳細情報(画像に具体的に何が描かれているか。複数の要素がある場合は列挙してください)は、is_complexがtrueの場合のみcomplex_detailに記述してください。" +
      "近接するキャプション文言(caption)が渡されている場合は、キャプションと重複しない情報を優先してください。",
    responseSchema: {
      type: "OBJECT",
      properties: {
        alt_text: { type: "STRING" },
        is_decorative: { type: "BOOLEAN" },
        is_complex: { type: "BOOLEAN" },
        complex_detail: { type: "STRING" },
      },
      required: ["alt_text"],
    },
    buildUserText(item) {
      return JSON.stringify({ caption: item.caption || "" });
    },
  },

  // Same single-item vision style as image-alt (see note above) — reused via the same
  // /api/llm/image-alt endpoint by passing task: "avoid-text-as-image" in the request body.
  "avoid-text-as-image": {
    systemPrompt:
      "あなたは日本語の自治体ウェブサイトのアクセシビリティ改修を支援するアシスタントです。" +
      "与えられた画像を見て、バナーや告知画像のように、本来は本文テキストとして提供すべき見出し・告知文・日付・案内文等の文字情報が、" +
      "画像の中に描き込まれているかを判定してください。" +
      "装飾的な書体・大きな飾り文字・複数の写真を組み合わせたポスター調のデザインであっても、" +
      "そこに書かれている見出しやキャッチコピー、企画タイトル(例:「観光地特集」「〇〇まつり開催中」)は対象に含めてください" +
      "(見た目が凝っていることは除外理由になりません)。" +
      "対象外となる「ロゴ・アイコン」とは、サイト運営者やブランドを示す小さな企業名・サービス名のマーク(コーナーに小さく入る運営者名等)のみを指します。" +
      "画像の主題として大きく配置された見出し・タイトル文字は、たとえ字体が装飾的でもロゴ扱いにせず対象に含めてください。" +
      "写真の中にたまたま写り込んでいる看板・商品パッケージ等の文字も対象外です。" +
      "画像自体が文字情報を伝える目的で作られている場合はhas_embedded_textをtrueにし、" +
      "画像内の主要な文字情報をそのまま日本語テキストとしてextracted_textに書き起こしてください" +
      "(複数の見出し・キャッチコピーがある場合は全て列挙し、改行はスペースでつなげてよい)。",
    responseSchema: {
      type: "OBJECT",
      properties: {
        has_embedded_text: { type: "BOOLEAN" },
        extracted_text: { type: "STRING" },
      },
      required: ["has_embedded_text"],
    },
    buildUserText(item) {
      return JSON.stringify({ caption: item.caption || "" });
    },
  },

  // Unlike the other text tasks, heading-review reasons over the whole document's outline
  // at once rather than independent per-candidate items — it is called with a single
  // synthetic item ({ id: "outline", blocks: [...] }) so it can reuse the same batched
  // /api/llm/enrich endpoint and one-result-per-item response shape as everything else.
  "heading-review": {
    systemPrompt:
      "あなたは日本語の自治体ウェブサイトのアクセシビリティ改修を支援するアシスタントです。" +
      "文書を構成する見出し・段落を出現順に受け取ります(各要素にblock_id・タグ名(h1〜h6またはp)が付いています)。以下の3点を判定してください。" +
      "(1) 見出し(タグがh1〜h6)のうち、その文言だけでは直後のセクション内容を説明できていない曖昧な見出し(「概要」「詳細」「その他」等)があれば、vague_headingsにblock_idと理由を列挙してください。既に内容を具体的に説明している見出しは対象外です。" +
      "(2) 見出しの無い長い文章(複数の文からなる段落、または複数の段落にまたがるまとまり)の先頭に見出しを追加すると文書構造が分かりやすくなる箇所があれば、missing_headingsに、見出しレベル(2〜4の数字)・見出し文言(suggested_text)・理由を列挙してください。" +
      "1文だけの短い段落・既に前後の文脈から内容が明らかな断片的な段落・すでに他の段落と話題が連続している短い段落には、見出しを追加しないでください。ページ全体が短い断片の寄せ集めである場合、無理に全ての段落へ見出しを付けようとしないでください。本当に構造が読み取りにくい箇所のみを対象にしてください。" +
      "before_block_idには、その見出し文言(suggested_text)が要約している内容そのものを持つ段落、つまり新しい見出しの直後に続くべき段落のblock_idを指定してください(見出しの内容と段落の内容が対応している必要があります。1つ前の段落のblock_idを指定しないでください)。確信が持てない場合は無理に提案しないでください。" +
      "「【とき】」「【ところ】」「[NOTE]」のように、段落全体が短いカッコ書きのラベルだけで構成されている場合、そのラベル自体が既に見出し相当の役割を果たしています。この場合はbefore_block_idにそのラベル段落自身を指定し、suggested_textにはカッコを外したラベル文言をそのまま入れてください(例:「【とき】」→「とき」。実際にはその段落がカッコを外した見出し要素そのものに変換されるので、意味を言い換えた見出し文言(例:「開催日時」)を考える必要はありません)。" +
      "(3) 見出し(タグがh1〜h6)のうち、直前の見出しとの単純なレベル差だけでは判断できない、内容面から見て現在のレベルが不自然なものがあれば、heading_level_fixesに、block_id・修正後の見出しレベル(2〜6の数字)・理由を列挙してください。特に、複数の独立したセクション(例:個別のお知らせ記事や事業紹介が連続して並ぶ一覧ページ)が1つの文書に含まれる場合、直前に来る無関係な見出し(そのセクション内部の小見出しなど)の階層に引きずられて、本来は前のセクションの見出しと同じレベルであるべき見出しが不自然に深いままになっていることがあります(例:1つ目の記事のタイトル見出しと2つ目の記事のタイトル見出しは、通常同じレベルであるべきです)。そのようなケースを優先的に確認してください。段落(pタグ)は対象外です。確信が持てない場合は無理に提案しないでください。" +
      "block_idは必ず入力に実在するものだけを使ってください。",
    responseSchema: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          id: { type: "STRING" },
          vague_headings: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: { block_id: { type: "STRING" }, reason: { type: "STRING" } },
              required: ["block_id", "reason"],
            },
          },
          missing_headings: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: {
                before_block_id: { type: "STRING" },
                level: { type: "STRING" },
                suggested_text: { type: "STRING" },
                reason: { type: "STRING" },
              },
              required: ["before_block_id", "level", "suggested_text", "reason"],
            },
          },
          heading_level_fixes: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: {
                block_id: { type: "STRING" },
                level: { type: "STRING" },
                reason: { type: "STRING" },
              },
              required: ["block_id", "level", "reason"],
            },
          },
        },
        required: ["id", "vague_headings", "missing_headings", "heading_level_fixes"],
      },
    },
    buildUserText(items) {
      return JSON.stringify(items.map((item) => ({ id: item.id, blocks: item.blocks })));
    },
  },

  // heritage-check reasons over the whole page at once (like heading-review) to decide whether
  // the page is an individual named-subject / cultural-property introduction page — a case where
  // images support one specific subject (仏像・美術工芸品・史跡等) and should be named after that
  // subject, rather than being folded into the generic image+related-links "showcase" treatment.
  // Called with a single synthetic item ({ id, page_title, headings, images, link_count }).
  "heritage-check": {
    systemPrompt:
      "あなたは日本語の自治体ウェブサイトのアクセシビリティ改修を支援するアシスタントです。" +
      "1ページ分の情報(ページタイトル・見出し一覧・画像一覧(各画像にblock_id・alt・キャプション)・ページ内リンク総数)を受け取ります。" +
      "このページが「特定の対象を個別に紹介するページ」かどうかを判定してください。" +
      "対象とは、文化財・仏像・美術工芸品・史跡・記念物・特定の建造物や作品など、固有名を持つ単一の題材を指します。" +
      "そのようなページでは、画像はページ全体の寄せ集めではなく、その対象の説明補助になっています。" +
      "該当する場合のみis_individual_subject_pageをtrueにし、対象名(subject_name)、その対象を最もよく表す代表画像のblock_id(target_image_id、必ず入力の画像一覧に実在するものだけ)、判定理由(reason)を返してください。" +
      "イベント告知・お知らせ一覧・複数の話題をまとめた案内ページ・観光特集のように複数の対象を横断的に紹介するページ・画像が主題を持たない装飾/バナーだけのページは対象外です(is_individual_subject_pageをfalseにしてください)。" +
      "確信が持てない場合はfalseにしてください。",
    responseSchema: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          id: { type: "STRING" },
          is_individual_subject_page: { type: "BOOLEAN" },
          subject_name: { type: "STRING" },
          target_image_id: { type: "STRING" },
          reason: { type: "STRING" },
        },
        required: ["id", "is_individual_subject_page"],
      },
    },
    buildUserText(items) {
      return JSON.stringify(
        items.map((item) => ({
          id: item.id,
          page_title: item.page_title || "",
          headings: item.headings || [],
          images: item.images || [],
          link_count: item.link_count || 0,
        }))
      );
    },
  },
};

// 全タスク共通で末尾に付与する「自然な日本語」の指針。生成文がLLM特有の不自然な言い回しに
// ならないようにする(a11y-migration-kb/guidelines/natural-japanese.md、原典は k16shikano 氏の
// SKILL.md / Unlicense を短文生成向けに抜粋)。短文向けに、空虚な定型句・強調語の排除、能動態、
// 冗長回避、「い形容詞＋です」回避に絞る。
const NATURAL_JAPANESE_GUIDANCE =
  "なお、提案する日本語は自然で簡潔にしてください。" +
  "「重要なのは」「〜において」「〜という側面から」「〜の観点から」「多角的」「包括的」「総合的」「掘り下げる」のような中身の無い定型句や、" +
  "「非常に」「極めて」「大いに」のような中身の無い強調語、同じ内容の言い換えの繰り返しを避け、能動態で具体的に書いてください。" +
  "「難しいです」のような「い形容詞＋です」は「〜しにくい」「困難です」等に整えてください。";

for (const task of Object.values(TASKS)) {
  if (typeof task.systemPrompt === "string") {
    task.systemPrompt += NATURAL_JAPANESE_GUIDANCE;
  }
}

function getTaskConfig(task) {
  return TASKS[task] || null;
}

module.exports = {
  getTaskConfig,
  TASKS,
};

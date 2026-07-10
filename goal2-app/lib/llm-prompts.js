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

  // Unlike the other tasks, image-alt processes one image per request (vision calls need
  // the actual image bytes fetched server-side, so they can't be cheaply batched the same
  // way as text items) — buildUserText() here takes a single item, not an array.
  "image-alt": {
    systemPrompt:
      "あなたは日本語の自治体ウェブサイトのアクセシビリティ改修を支援するアシスタントです。" +
      "与えられた画像を見て、画像を見られない利用者にも内容が伝わる簡潔な代替テキスト(altテキスト、30文字程度まで)を日本語で提案してください。" +
      "「画像」「写真」などの単語だけで終わらせず、何が写っているか具体的に書いてください。" +
      "内容を持たない装飾目的のみの画像(罫線・アイコン等)と判断した場合はis_decorativeをtrueにしてください。" +
      "地図・グラフ・図表など、alt一行では内容を伝えきれない複雑な画像の場合はis_complexをtrueにしてください。" +
      "近接するキャプション文言(caption)が渡されている場合は、キャプションと重複しない情報を優先してください。",
    responseSchema: {
      type: "OBJECT",
      properties: {
        alt_text: { type: "STRING" },
        is_decorative: { type: "BOOLEAN" },
        is_complex: { type: "BOOLEAN" },
      },
      required: ["alt_text"],
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
      "文書を構成する見出し・段落を出現順に受け取ります(各要素にblock_idが付いています)。以下の2点を判定してください。" +
      "(1) 見出し(タグがh1〜h6)のうち、その文言だけでは直後のセクション内容を説明できていない曖昧な見出し(「概要」「詳細」「その他」等)があれば、vague_headingsにblock_idと理由を列挙してください。既に内容を具体的に説明している見出しは対象外です。" +
      "(2) 見出しの無い長い文章(複数の文からなる段落、または複数の段落にまたがるまとまり)の先頭に見出しを追加すると文書構造が分かりやすくなる箇所があれば、missing_headingsに、見出しレベル(2〜4の数字)・見出し文言(suggested_text)・理由を列挙してください。" +
      "1文だけの短い段落・既に前後の文脈から内容が明らかな断片的な段落・すでに他の段落と話題が連続している短い段落には、見出しを追加しないでください。ページ全体が短い断片の寄せ集めである場合、無理に全ての段落へ見出しを付けようとしないでください。本当に構造が読み取りにくい箇所のみを対象にしてください。" +
      "before_block_idには、その見出し文言(suggested_text)が要約している内容そのものを持つ段落、つまり新しい見出しの直後に続くべき段落のblock_idを指定してください(見出しの内容と段落の内容が対応している必要があります。1つ前の段落のblock_idを指定しないでください)。確信が持てない場合は無理に提案しないでください。" +
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
        },
        required: ["id", "vague_headings", "missing_headings"],
      },
    },
    buildUserText(items) {
      return JSON.stringify(items.map((item) => ({ id: item.id, blocks: item.blocks })));
    },
  },
};

function getTaskConfig(task) {
  return TASKS[task] || null;
}

module.exports = {
  getTaskConfig,
  TASKS,
};

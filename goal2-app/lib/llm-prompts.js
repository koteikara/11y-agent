// Task-specific system prompts and structured-output schemas for the /api/llm/enrich
// endpoint. Each task processes a batch of independent short text items in one request
// (cheaper than one request per candidate) and returns one result object per item, matched
// back to the candidate by `id`.

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
};

function getTaskConfig(task) {
  return TASKS[task] || null;
}

module.exports = {
  getTaskConfig,
  TASKS,
};

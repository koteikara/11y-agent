// テストで起動するサーバーに渡す環境変数を作る。
// 開発環境に LLM の鍵(GEMINI_API_KEY、SAKURA_AI_API_KEY など)があっても、
// テストが実際の API を呼ばないように、LLM 関係の変数を外してから渡す。
// LLM を使う経路のテストは test/llm/ にあり、そちらはモックのサーバーを使う。
const LLM_ENV_PREFIXES = ["GEMINI_", "LLM_", "SAKURA_AI_", "USD_JPY_RATE"];

function serverEnv(extra) {
  const env = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (!LLM_ENV_PREFIXES.some((prefix) => key.startsWith(prefix))) env[key] = value;
  }
  return { ...env, ...extra };
}

module.exports = { LLM_ENV_PREFIXES, serverEnv };

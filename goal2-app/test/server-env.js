// テストで起動するサーバーに渡す環境変数を作る。
// 開発環境に LLM の鍵(GEMINI_API_KEY、SAKURA_AI_API_KEY など)があっても、
// テストが実際の API を呼ばないように、LLM 関係の変数を外してから渡す。
// LLM を使う経路のテストは test/llm/ にあり、そちらはモックのサーバーを使う。
// 共通のパスワード(APP_PASSWORD)と Cloud Run の印(K_SERVICE)も外す。
// 開発環境にあると、テストのサーバーがパスワードを求めたり 503 を返したりするためである。
// これらを確かめるテスト(test/app-auth/、test/local-guard/)は、extra で明示して渡す。
const LLM_ENV_PREFIXES = ["GEMINI_", "LLM_", "SAKURA_AI_", "USD_JPY_RATE"];
const APP_ENV_KEYS = ["APP_PASSWORD", "K_SERVICE"];

function serverEnv(extra) {
  const env = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (LLM_ENV_PREFIXES.some((prefix) => key.startsWith(prefix))) continue;
    if (APP_ENV_KEYS.includes(key)) continue;
    env[key] = value;
  }
  return { ...env, ...extra };
}

module.exports = { LLM_ENV_PREFIXES, APP_ENV_KEYS, serverEnv };

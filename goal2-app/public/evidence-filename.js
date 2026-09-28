// 証跡を共有ドライブに置くときのファイル名を作る(PRODUCTION_OPERATIONS_INSTRUCTIONS.md の 3.5)。
// Goal 2(public/app.js)と GOAL1(public/goal1.js)の両方から使う。
// ブラウザーでは <script> で読み、window.evidenceFilename から使う。Node からは require() で読める(テスト用)。
//
// Goal 2: <日時>_<題名>_<ページの識別>_<種類>.<拡張子>
//   例: 20260925-1430_固定資産評価審査委員会_goal2_3f9a1c07b2_evidence.json
// GOAL1:  <日時>_<バッチID><後ろに付ける文字>.<拡張子>
//   例: 20260925-1430_batch_1758778200000-summary.csv
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  } else {
    root.evidenceFilename = api;
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const JST_OFFSET_MS = 9 * 60 * 60 * 1000;
  const TITLE_MAX_CHARS = 30;
  const UNTITLED = "無題";

  function pad2(number) {
    return String(number).padStart(2, "0");
  }

  // 日時を日本時間の YYYYMMDD-HHMM にする。実行する PC の時刻帯に左右されないよう、
  // UTC に9時間を足してから UTC の値として読む。value が無いか読めないときは now を使う。
  function formatJstStamp(value, now) {
    let date = value instanceof Date ? value : value ? new Date(value) : null;
    if (!date || Number.isNaN(date.getTime())) {
      date = now instanceof Date ? now : new Date(now == null ? Date.now() : now);
    }
    const jst = new Date(date.getTime() + JST_OFFSET_MS);
    return (
      `${jst.getUTCFullYear()}${pad2(jst.getUTCMonth() + 1)}${pad2(jst.getUTCDate())}` +
      `-${pad2(jst.getUTCHours())}${pad2(jst.getUTCMinutes())}`
    );
  }

  // 題名をファイル名に使える形にする。
  // - Windows と Google ドライブで使えない \ / : * ? " < > | と、改行・タブなどの制御文字を _ に替える。
  // - 前後の空白を除き、先頭30文字にする。サロゲートペア(絵文字など)を分けないよう、文字単位で数える。
  // - 末尾の . と空白を除く(Windows では使えない)。空になったら「無題」にする。
  function sanitizeTitle(title) {
    const replaced = String(title == null ? "" : title)
      .trim()
      .replace(/[\\/:*?"<>|\u0000-\u001f\u007f]/g, "_");
    const truncated = Array.from(replaced).slice(0, TITLE_MAX_CHARS).join("");
    const cleaned = truncated.replace(/[.\s]+$/u, "");
    return cleaned || UNTITLED;
  }

  // Goal 2 の証跡などの名前。generatedAt は証跡の generated_at、pageSessionId は page_session_id。
  function goal2Filename({ generatedAt, pageTitle, pageSessionId, kind = "evidence", extension, now } = {}) {
    const stamp = formatJstStamp(generatedAt, now);
    return `${stamp}_${sanitizeTitle(pageTitle)}_${pageSessionId}_${kind}.${extension}`;
  }

  // GOAL1 の書き出しの名前。日時は書き出す時刻(now)を使う。suffix は "-summary" など。
  function goal1Filename({ batchId, suffix = "", extension, now } = {}) {
    return `${formatJstStamp(null, now)}_${batchId}${suffix}.${extension}`;
  }

  return { formatJstStamp, sanitizeTitle, goal2Filename, goal1Filename };
});

// 新ページタイトルの案を作る(移行管理シートの「新ページタイトル」)。手順書(1-1 移行管理シート作成)の
// 「禁則文字や機種依存文字、スラッシュやドット区切りの日付、（日）のような曜日の表記を整える」を、規則で
// できる所まで行う。直した点(changes)と、規則では決めきれず人が見る点(checks)を分けて返す。
// 旧タイトルは書き換えない(シートでは旧タイトルの列を残し、新タイトルの列に案を入れる)。

const WEEKDAYS = { 月: "月曜日", 火: "火曜日", 水: "水曜日", 木: "木曜日", 金: "金曜日", 土: "土曜日", 日: "日曜日" };
const CIRCLED = "①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳";
const ROMAN = { "Ⅰ": "I", "Ⅱ": "II", "Ⅲ": "III", "Ⅳ": "IV", "Ⅴ": "V", "Ⅵ": "VI", "Ⅶ": "VII", "Ⅷ": "VIII", "Ⅸ": "IX", "Ⅹ": "X" };
const DEPENDENT = { "㈱": "（株）", "㈲": "（有）", "㈹": "（代）", "№": "No.", "℡": "TEL", "㎡": "平方メートル", "㎝": "センチメートル", "㎜": "ミリメートル", "㎞": "キロメートル", "㎏": "キログラム" };

// options.halfwidthAlnum: 全角の英数字を半角にするか。手順書(1-1)の「サクラエディタで一括置換できるもの」に
// ある規則だが、自治体の表記の方針で全角を使うこともあるので、案件の設定で切れるようにする。
function normalizeTitle(original, { halfwidthAlnum = true } = {}) {
  const changes = [];
  const checks = [];
  let title = String(original || "");
  const apply = (pattern, replace, label) => {
    const next = title.replace(pattern, replace);
    if (next !== title) {
      changes.push(label);
      title = next;
    }
  };
  // 全角の英数字と記号の一部を半角に、半角のカタカナを全角にする(NFKC は、濁点の分かれたカタカナもつなげる)。
  if (halfwidthAlnum) apply(/[Ａ-Ｚａ-ｚ０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0), "全角の英数字を半角に");
  apply(/　/g, " ", "全角の空白を半角に");
  apply(/[ｦ-ﾟ]+/g, (s) => s.normalize("NFKC"), "半角のカタカナを全角に");
  apply(new RegExp(`[${CIRCLED}]`, "g"), (c) => `(${CIRCLED.indexOf(c) + 1})`, "丸数字を (1) の形に");
  apply(/[ⅠⅡⅢⅣⅤⅥⅦⅧⅨⅩ]/g, (c) => ROMAN[c], "ローマ数字の記号を英字に");
  apply(/[㈱㈲㈹№℡㎡㎝㎜㎞㎏]/g, (c) => DEPENDENT[c], "機種依存文字を言い換え");
  // 年月日がそろった日付(2020/1/1、2020.1.1)は、年月日の形にする。前後に数字が続くもの、月や日が
  // ありえない数のものは日付とみなさない(電話番号や版の番号に当てないため)。
  apply(
    /(?<![\d.．／/])(\d{4})[/.．／](\d{1,2})[/.．／](\d{1,2})(?![\d.．／/])/g,
    (match, y, m, d) => (Number(m) >= 1 && Number(m) <= 12 && Number(d) >= 1 && Number(d) <= 31 ? `${y}年${Number(m)}月${Number(d)}日` : match),
    "年月日の日付を「年月日」の形に"
  );
  // 曜日の略は、日付のすぐあと(4日（火）、8/4（火）、2020年1月1日（水）)だけ「火曜日」の形にする。
  // 「保育料（月）」は月額、「定員（日）」は1日あたりの意味なので、日付のあとでなければ要確認にする。
  apply(
    /(\d{1,2}日|\d{1,2}[/.．／]\d{1,2})(\s*)([（(])([月火水木金土日])([)）])/g,
    (_, date, space, open, day, close) => `${date}${space}${open}${WEEKDAYS[day]}${close}`,
    "曜日の略を「火曜日」の形に"
  );
  if (/[（(][月火水木金土日][)）]/.test(title)) checks.push("（月）（日）などの略(曜日なら「月曜日」に。月額や1日あたりの意味なら直さない)");
  // 月と日だけ(8/4、3.5)や、元号の略(h26、R2)は、日付か番号かを規則では決めきれないので、人が見る。
  if (/(^|[^\d.．])\d{1,2}[/.．／]\d{1,2}(?![\d.．])/.test(title)) checks.push("「8/4」の形(日付なら「8月4日」に)");
  if (/(^|[^A-Za-z])[HhRrSs]\d{1,2}(年|年度)?(?![\d])/.test(title)) checks.push("元号の略(h26 など)");
  if (/[①-⓿☀-➿㈀-㏿]/.test(title)) checks.push("ほかの機種依存文字");
  if (title !== title.trim() || /\s{2,}/.test(title)) {
    apply(/\s+/g, " ", "空白を整える");
    title = title.trim();
  }
  return { title, changes, checks };
}

module.exports = { normalizeTitle };

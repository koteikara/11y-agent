// 案件のフォルダの読み書き。形は docs/renewal/ARCHITECTURE.md の「案件のフォルダの形」。
// 共有ドライブ(Drive for desktop)の同期が書きかけのファイルを拾わないよう、書くときは
// 一時ファイルに書いてから名前を変える。
const fs = require("fs");
const path = require("path");

const DEFAULT_SETTINGS = {
  // 取得の決まり(「取得の守り」)。allowedHosts に無いサーバーは取りに行かない。
  // privateHosts は、社内のネットワークのアドレスにあってもよいサーバー(CMS の取込環境など)。
  fetch: {
    allowedHosts: [],
    privateHosts: [],
    intervalMs: 1000,
    concurrency: 2,
    timeoutMs: 15000,
    maxBytes: 3000000,
    retries: 1,
  },
  // 構造の型。similarity は、同じ型とみなす構造の重なり(0〜1)。minPages 未満の型は承認に回さず、
  // 汎用の判定で抜く。approved は承認した型(型の番号ごとに、範囲と代表の構造)。
  templates: {
    similarity: 0.8,
    minPages: 10,
    approved: {},
  },
  // ルールごとの扱い。autoAccept は「確認不要に入れてよい」と決めたルールで、初めは空にする。
  rules: {
    autoAccept: [],
    disabled: [],
  },
  // 本文を AI(さくらか Gemini)に送るか。自治体の同意を確かめてから true にする。
  ai: {
    enabled: false,
  },
  ruleScopeMode: "kb",
  // 確認の時間の見積もり(分)と、日程の前提(FLOW.md の「日程の目安」)。costs は段3で実測に置き換える。
  review: {
    costs: {
      page: { thorough: 1.0, quick: 0.3, none: 0 },
      candidate: { structural: 1.5, meaning: 0.75, small: 0.15 },
    },
    hoursPerDay: 5,
    availableDays: 50,
  },
};

function mergeDefaults(defaults, value) {
  if (Array.isArray(defaults)) return Array.isArray(value) ? value : defaults;
  if (defaults && typeof defaults === "object") {
    const result = {};
    const source = value && typeof value === "object" ? value : {};
    for (const key of new Set([...Object.keys(defaults), ...Object.keys(source)])) {
      result[key] = key in defaults ? mergeDefaults(defaults[key], source[key]) : source[key];
    }
    return result;
  }
  return value === undefined ? defaults : value;
}

function readJson(filePath, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return fallback;
    throw new Error(`${filePath} を読めませんでした: ${error.message}`);
  }
}

function writeFileAtomic(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tmp = `${filePath}.tmp-${process.pid}`;
  fs.writeFileSync(tmp, content);
  fs.renameSync(tmp, filePath);
}

function writeJson(filePath, value) {
  writeFileAtomic(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

// 移行管理 ID はフォルダの名前になる。半角英数字と一般的な記号だけを許す(CMS の取込の約束と同じ)。
function assertSafeId(id) {
  if (typeof id !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/.test(id)) {
    throw new Error(`移行管理 ID に使えない文字があります: ${JSON.stringify(id)}`);
  }
  return id;
}

function openProject(root) {
  const projectRoot = path.resolve(root);
  if (!fs.existsSync(projectRoot)) throw new Error(`案件のフォルダがありません: ${projectRoot}`);
  const p = (...parts) => path.join(projectRoot, ...parts);

  return {
    root: projectRoot,
    paths: {
      input: p("input", "pages.json"),
      settings: p("project", "settings.json"),
      settingsHistory: p("project", "settings-history.jsonl"),
      summary: p("project", "summary.json"),
      templates: p("project", "templates.json"),
      status: p("project", "status.csv"),
      metrics: p("project", "metrics.json"),
      logs: p("logs"),
    },
    pageDir(id) {
      return p("pages", assertSafeId(id));
    },
    pageFile(id, name) {
      return path.join(this.pageDir(id), name);
    },

    readInput() {
      const input = readJson(this.paths.input);
      if (!input || !Array.isArray(input.pages)) {
        throw new Error(`入力がありません。GAS のメニューで ${this.paths.input} を書き出してください。`);
      }
      const seen = new Set();
      for (const page of input.pages) {
        assertSafeId(page.id);
        if (seen.has(page.id)) throw new Error(`移行管理 ID が重なっています: ${page.id}`);
        seen.add(page.id);
        if (!page.oldUrl) throw new Error(`${page.id}: 旧 URL がありません`);
      }
      return input;
    },

    readSettings() {
      return mergeDefaults(DEFAULT_SETTINGS, readJson(this.paths.settings, {}));
    },

    // 案件の設定を書き換える。変更は履歴に残す(誰が、どの道具から)。
    updateSettings(mutator, { actor, tool, note }) {
      const settings = this.readSettings();
      mutator(settings);
      writeJson(this.paths.settings, settings);
      fs.mkdirSync(path.dirname(this.paths.settingsHistory), { recursive: true });
      fs.appendFileSync(
        this.paths.settingsHistory,
        `${JSON.stringify({ at: new Date().toISOString(), actor: actor || "unknown", tool, note })}\n`
      );
      return settings;
    },

    readPageJson(id, name) {
      return readJson(this.pageFile(id, name));
    },
    writePageJson(id, name, value) {
      writeJson(this.pageFile(id, name), value);
    },
    readPageText(id, name) {
      try {
        return fs.readFileSync(this.pageFile(id, name), "utf8");
      } catch (error) {
        if (error.code === "ENOENT") return null;
        throw error;
      }
    },
    writePageText(id, name, text) {
      writeFileAtomic(this.pageFile(id, name), text);
    },

    readJson,
    writeJson,
    writeFileAtomic,

    // 実行の記録。本文や HTML は書かない(件数、移行管理 ID、理由だけ)。
    openLog(command) {
      fs.mkdirSync(this.paths.logs, { recursive: true });
      const stamp = new Date().toISOString().replace(/[:.]/g, "-");
      const file = path.join(this.paths.logs, `run-${stamp}-${command}.jsonl`);
      return {
        file,
        write(entry) {
          fs.appendFileSync(file, `${JSON.stringify({ at: new Date().toISOString(), command, ...entry })}\n`);
        },
      };
    },
  };
}

module.exports = { openProject, DEFAULT_SETTINGS, mergeDefaults, assertSafeId };

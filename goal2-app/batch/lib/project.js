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
    // 名乗り(ユーザーエージェント)。空なら一括処理の名乗りを使う。知らない名乗りを止めるサイトで変える。
    userAgent: "",
  },
  // 巡回(ページの一覧づくり)。startUrls から、fetch.allowedHosts のサーバーの中だけをたどる。
  // include は URL の頭(空なら全部)、exclude は外す URL の正規表現。reuseDays は、取得が巡回で取った
  // ページを使い回す新しさの上限(日)。
  crawl: {
    startUrls: [],
    maxPages: 20000,
    maxDepth: 20,
    include: [],
    exclude: [],
    useSitemap: true,
    useRobots: true,
    reuseDays: 14,
    // スクリプトでメニューを描くページを Chromium で開くか。auto は、始まりのページと、スクリプトがあるのに
    // 巡回の範囲のリンクが renderMinLinks より少ないページだけを開く。always、never も選べる。
    render: "auto",
    renderMinLinks: 3,
    // URL から外してよい項目。外してから、同じページかを決める(セッションの番号、広告の印など)。
    ignoreParams: ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "fbclid", "gclid", "jsessionid", "phpsessid", "sessionid"],
    // 巡回のあいだ Cookie を引き継ぐか。
    cookies: true,
    // ファイルの大きさと更新日を聞くか(HEAD。旧サイトへの要求がファイルの数だけ増える)。
    fileHead: false,
  },
  // コンテンツパターンの抽出(サブサイトの候補)。minPages 未満の群は候補にしない。proposals は、上位の
  // いくつを「サブサイト候補」として印を付けるか(桜井市の仕様書の例では3つ)。
  patterns: {
    minPages: 10,
    proposals: 3,
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

// ページごとのファイルを裏で書く待ち行列。共有ドライブ(Drive for desktop)では、ファイルの操作が1回
// 0.25〜0.5秒かかり、1件ずつ書くと巡回や取得が書き込みに引っ張られる(段2の試走)。並べて書くと
// 1ファイルあたり約0.08秒になるので、WRITE_CONCURRENCY 件まで並べて書く。同じファイルへの書き込みは
// 出した順に書く。書き終わりを待つのは flush()。ページごとのファイルは、一時ファイルを経ずに直接書く
// (名前を変える操作のぶん遅くなるため)。読む側は、書きかけのファイルを読めないものとして扱う。
const WRITE_CONCURRENCY = 8;

function createWriteQueue() {
  const pending = [];
  const lastByPath = new Map();
  const madeDirs = new Set();
  const inFlight = new Set();
  let running = 0;
  let firstError = null;

  const pump = () => {
    while (running < WRITE_CONCURRENCY && pending.length) {
      const task = pending.shift();
      running += 1;
      task().finally(() => {
        running -= 1;
        pump();
      });
    }
  };
  // 待ち行列に入れ、書き終わったら解決する約束を返す。
  const enqueue = (filePath, content) =>
    new Promise((resolve) => {
      pending.push(async () => {
        try {
          const dir = path.dirname(filePath);
          if (!madeDirs.has(dir)) {
            await fs.promises.mkdir(dir, { recursive: true });
            madeDirs.add(dir);
          }
          await fs.promises.writeFile(filePath, content);
        } catch (error) {
          firstError = firstError || error;
        }
        resolve();
      });
      pump();
    });

  return {
    write(filePath, content) {
      // 同じファイルは、前の書き込みが終わってから書く(あとから出した中身が残るように)。
      const previous = lastByPath.get(filePath) || Promise.resolve();
      const done = previous.then(() => enqueue(filePath, content));
      lastByPath.set(filePath, done);
      inFlight.add(done);
      done.then(() => {
        inFlight.delete(done);
        if (lastByPath.get(filePath) === done) lastByPath.delete(filePath);
      });
    },
    async flush() {
      while (inFlight.size) await Promise.all([...inFlight]);
      if (firstError) {
        const error = firstError;
        firstError = null;
        throw new Error(`ファイルを書けませんでした: ${error.message}`);
      }
    },
  };
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
  const writes = createWriteQueue();
  const logBuffers = [];

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
    // ページごとのファイルは、裏の待ち行列で書く。書き終わりは flush() で待つ。
    writePageJson(id, name, value) {
      writes.write(this.pageFile(id, name), `${JSON.stringify(value, null, 2)}\n`);
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
      writes.write(this.pageFile(id, name), text);
    },
    // ページごとのファイルと同じ待ち行列で、任意のファイルを書く(巡回のページなど)。
    queueWrite(filePath, content) {
      writes.write(filePath, content);
    },
    // 裏で書いているファイルと、ためている実行の記録を、すべて書き終えるまで待つ。
    async flush() {
      await writes.flush();
      for (const buffer of logBuffers) buffer.flush();
    },

    readJson,
    writeJson,
    writeFileAtomic,

    // 実行の記録。本文や HTML は書かない(件数、移行管理 ID、理由だけ)。
    openLog(command) {
      fs.mkdirSync(this.paths.logs, { recursive: true });
      const stamp = new Date().toISOString().replace(/[:.]/g, "-");
      const file = path.join(this.paths.logs, `run-${stamp}-${command}.jsonl`);
      // 1行ずつ追記すると共有ドライブでは遅いので、ためて書く(LOG_BUFFER 行ごとと、flush() のとき)。
      const LOG_BUFFER = 50;
      let lines = [];
      const buffer = {
        flush() {
          if (!lines.length) return;
          fs.appendFileSync(file, lines.join(""));
          lines = [];
        },
      };
      logBuffers.push(buffer);
      return {
        file,
        write(entry) {
          lines.push(`${JSON.stringify({ at: new Date().toISOString(), command, ...entry })}\n`);
          if (lines.length >= LOG_BUFFER) buffer.flush();
        },
        flush: () => buffer.flush(),
      };
    },
  };
}

module.exports = { openProject, DEFAULT_SETTINGS, mergeDefaults, assertSafeId };

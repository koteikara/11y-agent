/**
 * 記録用スプレッドシートの作業時間タイマー
 *
 * 対象シート: 自治体 × 3パターン（通常移行 / AI移行 / miChecker移行）ごとに1シート。
 * シート名は判定に使わず、見出し行に計測用の列があるシートを対象として自動判別する。
 * 見出し行は CONFIG.headerRow（2行目）、データは CONFIG.firstDataRow（3行目）から。
 *
 * 計測は「ツール作業」と「CMS作業」の2区間に分かれる。区間ごとに開始・終了・休憩・作業時間を
 * 記録し、終了時に両区間の合計を CONFIG.totalHeader の列へ書き込む。
 * パターン1（通常移行）のようにツール作業が無いシートは、ツール作業の列を置かなければよい。
 * その場合はCMS作業だけが選べる状態になる。
 *
 * 列は見出しの文字列で引くため、列の位置を変えても動作する。見出しの改行・空白は無視する。
 */
const CONFIG = {
  headerRow: 2,
  firstDataRow: 3,
  phases: [
    {
      key: 'tool',
      label: 'ツール作業',
      headers: {
        start: 'ツール作業開始',
        end: 'ツール作業終了',
        break: 'ツール休憩時間',
        actual: 'ツール作業時間'
      }
    },
    {
      key: 'cms',
      label: 'CMS作業',
      headers: {
        start: 'CMS作業開始',
        end: 'CMS作業終了',
        break: 'CMS休憩時間',
        actual: 'CMS作業時間'
      }
    }
  ],
  totalHeader: '作業時間集計',
  formats: {
    datetime: 'yyyy/MM/dd HH:mm:ss',
    minutes: '0"分"'
  },
  colors: {
    start: '#e1f5fe',
    end: '#e8f5e9',
    actual: '#fff9c4',
    break: '#fff3e0',
    total: '#ede7f6'
  }
};

/** このスクリプトが使うユーザープロパティのキー。終了時はこれだけを消す。 */
const PROP_KEYS = [
  'workingSheet',
  'workingRow',
  'workingPhase',
  'startTimeMs',
  'accumulatedMs',
  'totalBreakMs',
  'isBreaking',
  'breakStartMs',
  'status'
];

/**
 * スプレッドシート起動時にカスタムメニューを追加
 */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('⏱️ 作業記録')
    .addItem('操作パネルを開く', 'showSidebar')
    .addToUi();
}

/**
 * サイドバーの表示
 */
function showSidebar() {
  const html = HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('作業記録タイマー')
    .setWidth(320);
  SpreadsheetApp.getUi().showSidebar(html);
}

/**
 * 見出しの表記ゆれを吸収する。改行・空白（全角含む）を取り除いて比較する。
 */
function normalizeHeader(value) {
  return String(value == null ? '' : value).replace(/[\s　]/g, '');
}

/**
 * 区間の定義を取得
 */
function getPhaseDef(phaseKey) {
  for (let i = 0; i < CONFIG.phases.length; i += 1) {
    if (CONFIG.phases[i].key === phaseKey) return CONFIG.phases[i];
  }
  return null;
}

function getPhaseLabel(phaseKey) {
  const def = getPhaseDef(phaseKey);
  return def ? def.label : String(phaseKey || '');
}

/**
 * 見出し行から、区間ごとの列番号と合計列を解決する。
 * 同じ見出しが複数ある場合は左端の列を採用する。
 */
function resolveColumns(sheet) {
  if (!sheet) return null;
  const lastColumn = sheet.getLastColumn();
  if (lastColumn < 1 || sheet.getLastRow() < CONFIG.headerRow) return null;

  const headerValues = sheet.getRange(CONFIG.headerRow, 1, 1, lastColumn).getValues()[0];
  const index = {};
  headerValues.forEach(function (value, i) {
    const key = normalizeHeader(value);
    if (key && !(key in index)) index[key] = i + 1;
  });

  const phases = {};
  CONFIG.phases.forEach(function (phase) {
    const cols = {};
    let complete = true;
    Object.keys(phase.headers).forEach(function (role) {
      const column = index[normalizeHeader(phase.headers[role])];
      if (column) cols[role] = column;
      else complete = false;
    });
    phases[phase.key] = complete ? cols : null;
  });

  return {
    phases: phases,
    total: index[normalizeHeader(CONFIG.totalHeader)] || null
  };
}

/**
 * サイドバーの初期表示用。今開いているシートで使える区間を返す。
 */
function getSheetContext() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getActiveSheet();
  const cols = resolveColumns(sheet);
  const activeRange = ss.getActiveRange();

  const phases = CONFIG.phases.map(function (phase) {
    return {
      key: phase.key,
      label: phase.label,
      available: Boolean(cols && cols.phases[phase.key])
    };
  });

  return {
    sheetName: sheet.getName(),
    isTarget: phases.some(function (phase) { return phase.available; }),
    phases: phases,
    activeRow: activeRange ? activeRange.getRow() : 0,
    firstDataRow: CONFIG.firstDataRow,
    hasTotal: Boolean(cols && cols.total)
  };
}

/**
 * 開始前のチェック。選択行の既存データと、他の行・区間で計測中かどうかを返す。
 */
function checkExistingData(phaseKey) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getActiveSheet();
  const cols = resolveColumns(sheet);

  if (!cols || !cols.phases[phaseKey]) {
    return { error: '対象外のシートです。' + CONFIG.headerRow + '行目の見出しに「' + getPhaseLabel(phaseKey) + '」の計測列が見つかりません。' };
  }

  const activeRange = ss.getActiveRange();
  if (!activeRange) return { error: '記録する行を選択してください' };

  const row = activeRange.getRow();
  if (row < CONFIG.firstDataRow) {
    return { error: CONFIG.firstDataRow + '行目以降のデータ行を選択してください（' + CONFIG.headerRow + '行目は見出しです）' };
  }

  const props = PropertiesService.getUserProperties();
  const savedRow = props.getProperty('workingRow');
  const savedSheet = props.getProperty('workingSheet');
  const savedPhase = props.getProperty('workingPhase');

  if (savedRow && (Number(savedRow) !== row || savedSheet !== sheet.getName() || savedPhase !== phaseKey)) {
    return {
      isRunningElsewhere: true,
      runningInfo: savedSheet + 'の' + savedRow + '行目（' + getPhaseLabel(savedPhase) + '）'
    };
  }

  const phaseCols = cols.phases[phaseKey];
  const startValue = sheet.getRange(row, phaseCols.start).getValue();
  const workMin = sheet.getRange(row, phaseCols.actual).getValue();

  return {
    row: row,
    sheetName: sheet.getName(),
    phaseKey: phaseKey,
    phaseLabel: getPhaseLabel(phaseKey),
    hasData: startValue !== '' && startValue !== null,
    workMin: typeof workMin === 'number' ? workMin : 0
  };
}

/**
 * 計測状態の復旧用データ
 */
function getTimerStatus() {
  const props = PropertiesService.getUserProperties();
  if (!props.getProperty('workingRow')) return null;

  const startTimeMs = props.getProperty('startTimeMs');
  const breakStartMs = props.getProperty('breakStartMs');
  const phaseKey = props.getProperty('workingPhase');

  return {
    startTime: startTimeMs ? parseInt(startTimeMs, 10) : null,
    accumulatedMs: parseInt(props.getProperty('accumulatedMs') || '0', 10),
    totalBreakMs: parseInt(props.getProperty('totalBreakMs') || '0', 10),
    isBreaking: props.getProperty('isBreaking') === 'true',
    breakStart: breakStartMs ? parseInt(breakStartMs, 10) : null,
    status: props.getProperty('status') || 'idle',
    sheetName: props.getProperty('workingSheet'),
    row: parseInt(props.getProperty('workingRow'), 10),
    phaseKey: phaseKey,
    phaseLabel: getPhaseLabel(phaseKey)
  };
}

/**
 * 休憩の開始・終了状態を保存
 */
function setBreakStatus(isBreaking, breakStartMs) {
  const props = PropertiesService.getUserProperties();
  props.setProperty('isBreaking', isBreaking ? 'true' : 'false');
  if (isBreaking && breakStartMs) {
    props.setProperty('breakStartMs', String(breakStartMs));
    props.setProperty('status', 'breaking');
  } else {
    props.deleteProperty('breakStartMs');
    props.setProperty('status', 'working');
  }
}

/**
 * 計測のメイン処理
 * type: start / suspend / resume / end
 * mode: new / accumulate （startのときのみ使用）
 */
function processRecord(type, mode, phaseKey) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const props = PropertiesService.getUserProperties();
    const now = new Date();

    if (type === 'start') {
      const sheet = ss.getActiveSheet();
      const cols = resolveColumns(sheet);
      if (!cols || !cols.phases[phaseKey]) return 'エラー: 対象外のシートです';

      const activeRange = ss.getActiveRange();
      if (!activeRange) return 'エラー: 記録する行を選択してください';

      const row = activeRange.getRow();
      if (row < CONFIG.firstDataRow) {
        return 'エラー: ' + CONFIG.firstDataRow + '行目以降のデータ行を選択してください';
      }

      const phaseCols = cols.phases[phaseKey];
      let accumulatedMs = 0;
      let breakMs = 0;

      if (mode === 'accumulate') {
        // 既存の作業時間は休憩を引いたあとの値なので、それを起点にする。
        // 休憩時間の列は差し引き済みのため読み込まない（読むと二重に引かれる）。
        // シートの休憩時間の列は、これ以降の休憩を加算して累計を保つ。
        const existingWorkMin = sheet.getRange(row, phaseCols.actual).getValue() || 0;
        accumulatedMs = toMs(existingWorkMin);
        breakMs = 0;
      } else {
        // 新規（上書き）で開始するときは、その区間の既存値を消してから始める
        sheet.getRange(row, phaseCols.end).clearContent().setBackground(null);
        sheet.getRange(row, phaseCols.break).clearContent().setBackground(null);
        sheet.getRange(row, phaseCols.actual).clearContent().setBackground(null);
      }

      props.setProperties({
        workingSheet: sheet.getName(),
        workingRow: String(row),
        workingPhase: phaseKey,
        startTimeMs: String(now.getTime()),
        accumulatedMs: String(accumulatedMs),
        totalBreakMs: String(breakMs),
        isBreaking: 'false',
        status: 'working'
      });
      props.deleteProperty('breakStartMs');

      sheet.getRange(row, phaseCols.start)
        .setValue(now)
        .setNumberFormat(CONFIG.formats.datetime)
        .setBackground(CONFIG.colors.start);

      const label = getPhaseLabel(phaseKey);
      return mode === 'accumulate'
        ? '【累計再開】' + row + '行目の' + label + 'を続きから計測します'
        : '【新規開始】' + row + '行目の' + label + 'の計測を開始しました';
    }

    if (type === 'suspend') {
      const startTimeMs = props.getProperty('startTimeMs');
      if (!startTimeMs) return '計測中ではありません';
      const accumulatedMs = parseInt(props.getProperty('accumulatedMs') || '0', 10);
      props.setProperty('accumulatedMs', String(accumulatedMs + (now.getTime() - parseInt(startTimeMs, 10))));
      props.deleteProperty('startTimeMs');
      props.setProperty('status', 'suspended');
      return '作業を一時中断しました';
    }

    if (type === 'resume') {
      if (!props.getProperty('workingRow')) return '計測中の記録がありません';
      props.setProperty('startTimeMs', String(now.getTime()));
      props.setProperty('status', 'working');
      return '作業を再開しました';
    }

    if (type === 'end') {
      const savedRow = props.getProperty('workingRow');
      const savedSheetName = props.getProperty('workingSheet');
      const savedPhase = props.getProperty('workingPhase');
      if (!savedRow) return '記録が見つかりません';

      const row = parseInt(savedRow, 10);
      const sheet = ss.getSheetByName(savedSheetName);
      if (!sheet) {
        clearSession();
        return 'エラー: シート「' + savedSheetName + '」が見つかりません。計測状態をクリアしました。';
      }

      const cols = resolveColumns(sheet);
      const phaseCols = cols ? cols.phases[savedPhase] : null;
      if (!phaseCols) {
        clearSession();
        return 'エラー: 「' + savedSheetName + '」に計測列が見つかりません。計測状態をクリアしました。';
      }

      let totalBreakMs = parseInt(props.getProperty('totalBreakMs') || '0', 10);

      // 休憩したまま終了した場合、その休憩分をここで締める
      if (props.getProperty('isBreaking') === 'true') {
        const breakStartMs = props.getProperty('breakStartMs');
        if (breakStartMs) {
          const breakMin = Math.floor((now.getTime() - parseInt(breakStartMs, 10)) / 60000);
          if (breakMin > 0) {
            addMinutesToCell(sheet.getRange(row, phaseCols.break), breakMin, CONFIG.colors.break);
            totalBreakMs += toMs(breakMin);
          }
        }
      }

      const startTimeMs = props.getProperty('startTimeMs');
      const accumulatedMs = parseInt(props.getProperty('accumulatedMs') || '0', 10);
      const elapsedMs = accumulatedMs + (startTimeMs ? now.getTime() - parseInt(startTimeMs, 10) : 0);
      const workMin = Math.max(0, Math.floor((elapsedMs - totalBreakMs) / 60000));

      sheet.getRange(row, phaseCols.end)
        .setValue(now)
        .setNumberFormat(CONFIG.formats.datetime)
        .setBackground(CONFIG.colors.end);
      sheet.getRange(row, phaseCols.actual)
        .setValue(workMin)
        .setNumberFormat(CONFIG.formats.minutes)
        .setBackground(CONFIG.colors.actual);

      const total = writeTotal(sheet, row, cols);
      clearSession();

      const label = getPhaseLabel(savedPhase);
      return '【' + savedSheetName + '】' + row + '行目の' + label + 'を' + workMin + '分で集計しました'
        + (total === null ? '' : '（合計 ' + total + '分）');
    }

    return '不明な操作です';
  } catch (e) {
    return 'エラー: ' + e.message;
  }
}

/**
 * 両区間の作業時間を合計して集計列へ書き込む。集計列が無いシートでは何もしない。
 */
function writeTotal(sheet, row, cols) {
  if (!cols || !cols.total) return null;

  let total = 0;
  CONFIG.phases.forEach(function (phase) {
    const phaseCols = cols.phases[phase.key];
    if (!phaseCols) return;
    const value = sheet.getRange(row, phaseCols.actual).getValue();
    if (typeof value === 'number') total += value;
  });

  sheet.getRange(row, cols.total)
    .setValue(total)
    .setNumberFormat(CONFIG.formats.minutes)
    .setBackground(CONFIG.colors.total);

  return total;
}

/**
 * 休憩時間を、計測中の区間の休憩列へ加算する
 */
function addBreakTime(min) {
  try {
    const minutes = Math.floor(min);
    if (!minutes || minutes <= 0) return;

    const props = PropertiesService.getUserProperties();
    const savedRow = props.getProperty('workingRow');
    const savedSheetName = props.getProperty('workingSheet');
    const savedPhase = props.getProperty('workingPhase');
    if (!savedRow) return;

    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(savedSheetName);
    if (!sheet) return;

    const cols = resolveColumns(sheet);
    const phaseCols = cols ? cols.phases[savedPhase] : null;
    if (!phaseCols) return;

    addMinutesToCell(sheet.getRange(parseInt(savedRow, 10), phaseCols.break), minutes, CONFIG.colors.break);

    const currentTotalMs = parseInt(props.getProperty('totalBreakMs') || '0', 10);
    props.setProperty('totalBreakMs', String(currentTotalMs + toMs(minutes)));
  } catch (e) {
    console.error(e.toString());
  }
}

/**
 * 分単位のセルへ加算する
 */
function addMinutesToCell(range, minutes, background) {
  const current = range.getValue();
  const base = typeof current === 'number' ? current : 0;
  range.setValue(base + minutes)
    .setNumberFormat(CONFIG.formats.minutes)
    .setBackground(background);
}

function toMs(minutes) {
  const value = typeof minutes === 'number' ? minutes : 0;
  return value * 60 * 1000;
}

/**
 * このスクリプトのプロパティだけを消す
 */
function clearSession() {
  const props = PropertiesService.getUserProperties();
  PROP_KEYS.forEach(function (key) {
    props.deleteProperty(key);
  });
}

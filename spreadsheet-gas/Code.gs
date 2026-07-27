/**
 * 記録対象シートと列、および機能モードの定義
 * start: 開始時刻, end: 終了時刻, break: 休憩時間(分), actual: 実働時間(分)
 * すべてのシートで isTestMode: true とし、累計再開機能を有効化しました。
 */
const CONFIG = {
  sheets: {
    'HTML適正化_検証': { start: 7, end: 8, break: 9, actual: 10, isTestMode: true },
    '一覧': { start: 89, end: 90, break: 91, actual: 92, isTestMode: true },
    '作業記録検証': { start: 7, end: 8, break: 9, actual: 10, isTestMode: true }
  }
};

/**
 * スプレッドシート起動時にカスタムメニューを追加
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('⏱️ 作業記録')
    .addItem('操作パネルを開く', 'showSidebar')
    .addToUi();
}

/**
 * サイドバーの表示ロジック
 */
function showSidebar() {
  const template = HtmlService.createTemplateFromFile('Index');
  const activeSheetName = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet().getName();
  
  // 初期表示用に、現在開いているシートの名前をテンプレートに渡す
  template.sheetName = CONFIG.sheets[activeSheetName] ? activeSheetName : "対象外のシートです"; 
  
  const html = template.evaluate()
      .setTitle('作業記録タイマー')
      .setWidth(300);
      
  SpreadsheetApp.getUi().showSidebar(html);
}

/**
 * 現在の動作状況に基づいたアクティブな設定（シート・列）を取得
 */
function getActiveConfig() {
  const props = PropertiesService.getUserProperties();
  const savedSheet = props.getProperty('currentWorkingSheet');
  const activeSheetName = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet().getName();
  
  // 作業中なら保存されたシートを優先、待機中なら今見ているシートを使用
  const targetSheetName = savedSheet || activeSheetName;
  const cfg = CONFIG.sheets[targetSheetName];
  
  return { 
    name: targetSheetName, 
    cols: cfg, 
    isTestMode: cfg ? cfg.isTestMode : false 
  };
}

/**
 * 既存データのチェックと他タスクの実行確認
 */
function checkExistingData() {
  const cfg = getActiveConfig();
  if (!cfg.cols) return null;

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(cfg.name);
  if (!sheet) return null;

  const activeRow = ss.getActiveRange().getRow();
  if (activeRow <= 1) return null;

  const startTime = sheet.getRange(activeRow, cfg.cols.start).getValue();
  const workMin = sheet.getRange(activeRow, cfg.cols.actual).getValue();
  const props = PropertiesService.getUserProperties();
  const savedRow = props.getProperty('currentWorkingRow');
  const savedSheet = props.getProperty('currentWorkingSheet');

  // 既に別の場所（別の行や別のシート）で計測中の場合、切り替えを促す情報を返す
  if (savedRow && (savedRow != activeRow || savedSheet != cfg.name)) {
    return { isRunningElsewhere: true, runningInfo: savedSheet + "の" + savedRow + "行目" };
  }

  // 選択した行の既存データ状態を返す
  return { 
    hasData: startTime !== "", 
    workMin: typeof workMin === 'number' ? workMin : 0,
    isTestMode: cfg.isTestMode
  };
}

/**
 * タイマーのセッション復旧データを取得
 */
function getTimerStatus() {
  const props = PropertiesService.getUserProperties();
  const startTimeMs = props.getProperty('startTimeMs');
  const workingSheet = props.getProperty('currentWorkingSheet');
  const breakStartMs = props.getProperty('breakStartMsMs');
  
  if (!props.getProperty('currentWorkingRow')) return null;

  return {
    startTime: startTimeMs ? parseInt(startTimeMs) : null,
    accumulatedMs: parseInt(props.getProperty('accumulatedMs') || '0'),
    totalBreakMs: parseInt(props.getProperty('totalBreakMs') || '0'),
    isBreaking: props.getProperty('isBreaking') === 'true',
    breakStart: breakStartMs ? parseInt(breakStartMs) : null,
    status: props.getProperty('status') || 'idle',
    sheetName: workingSheet
  };
}

/**
 * 休憩ステータス（進行中かどうか）を保存
 */
function setBreakStatus(isBreaking, breakStartMs) {
  const props = PropertiesService.getUserProperties();
  props.setProperty('isBreaking', isBreaking.toString());
  if (isBreaking && breakStartMs) {
    props.setProperty('breakStartMsMs', breakStartMs.toString());
    props.setProperty('status', 'breaking');
  } else {
    props.deleteProperty('breakStartMsMs');
    props.setProperty('status', 'working');
  }
}

/**
 * 計測のメイン処理
 */
function processRecord(type, mode) {
  try {
    const cfg = getActiveConfig();
    if (!cfg.cols) return "エラー: 対象外のシートです。";

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(cfg.name);
    const props = PropertiesService.getUserProperties();
    const now = new Date();
    
    // --- 開始処理 ---
    if (type === 'start') {
      const activeRow = ss.getActiveRange().getRow();
      let accMs = 0;
      let breakMs = 0;

      // 累計モード：累計再開が選択された場合のみ値をロード
      if (cfg.isTestMode && mode === 'accumulate') {
        const existingWorkMin = sheet.getRange(activeRow, cfg.cols.actual).getValue() || 0;
        const existingBreakMin = sheet.getRange(activeRow, cfg.cols.break).getValue() || 0;
        accMs = existingWorkMin * 60 * 1000;
        breakMs = existingBreakMin * 60 * 1000;
      }

      props.setProperty('currentWorkingSheet', cfg.name);
      props.setProperty('currentWorkingRow', activeRow.toString());
      props.setProperty('startTimeMs', now.getTime().toString());
      props.setProperty('accumulatedMs', accMs.toString());
      props.setProperty('totalBreakMs', breakMs.toString());
      props.setProperty('status', 'working');
      
      sheet.getRange(activeRow, cfg.cols.start)
           .setValue(now)
           .setNumberFormat('yyyy/MM/dd HH:mm:ss')
           .setBackground('#e1f5fe');
      
      return (cfg.isTestMode && mode === 'accumulate') ? 
        `【累計再開】行 ${activeRow} の続きから計測を開始しました` : 
        `【新規開始】行 ${activeRow} で記録を開始しました`;
    } 

    // --- 中断処理 ---
    if (type === 'suspend') {
      const startTimeMs = parseInt(props.getProperty('startTimeMs'));
      const accumulatedMs = parseInt(props.getProperty('accumulatedMs') || '0');
      const sessionMs = now.getTime() - startTimeMs;
      props.setProperty('accumulatedMs', (accumulatedMs + sessionMs).toString());
      props.deleteProperty('startTimeMs');
      props.setProperty('status', 'suspended');
      return "作業を一時中断しました";
    }

    // --- 再開処理 ---
    if (type === 'resume') {
      props.setProperty('startTimeMs', now.getTime().toString());
      props.setProperty('status', 'working');
      return "作業を再開しました";
    }
    
    // --- 終了（集計）処理 ---
    if (type === 'end') {
      const savedRow = props.getProperty('currentWorkingRow');
      const savedSheetName = props.getProperty('currentWorkingSheet');
      if (!savedRow) return "記録が見つかりません";
      
      const row = parseInt(savedRow);
      const targetSheet = ss.getSheetByName(savedSheetName);
      const tCfg = CONFIG.sheets[savedSheetName];

      const startTimeMs = props.getProperty('startTimeMs');
      const accumulatedMs = parseInt(props.getProperty('accumulatedMs') || '0');
      const totalBreakMs = parseInt(props.getProperty('totalBreakMs') || '0');
      
      let finalWorkMs = accumulatedMs + (startTimeMs ? (now.getTime() - parseInt(startTimeMs)) : 0);
      const totalWorkMin = Math.floor((finalWorkMs - totalBreakMs) / (1000 * 60));
      
      targetSheet.getRange(row, tCfg.end).setValue(now).setNumberFormat('yyyy/MM/dd HH:mm:ss').setBackground('#e8f5e9');
      targetSheet.getRange(row, tCfg.actual).setValue(totalWorkMin).setNumberFormat('0"分"').setBackground('#fff9c4');
      
      props.deleteAllProperties(); // セッション終了時にクリア
      return `【${savedSheetName}】行 ${row} の集計を完了しました`;
    }
  } catch (e) {
    return "エラー: " + e.message;
  }
}

/**
 * 休憩時間をシートの該当セルへ加算
 */
function addBreakTime(min) {
  try {
    const cfg = getActiveConfig();
    const props = PropertiesService.getUserProperties();
    const rowStr = props.getProperty('currentWorkingRow');
    if (!rowStr || !cfg.cols) return;
    
    const row = parseInt(rowStr);
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(cfg.name);
    const breakRange = sheet.getRange(row, cfg.cols.break);
    const current = breakRange.getValue() || 0;
    
    breakRange.setValue(current + min).setNumberFormat('0"分"').setBackground('#fff3e0');
    
    const currentTotalMs = parseInt(props.getProperty('totalBreakMs') || '0');
    props.setProperty('totalBreakMs', (currentTotalMs + (min * 60 * 1000)).toString());
  } catch (e) {
    console.error(e.toString());
  }
}

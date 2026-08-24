const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

// 数据文件路径
const dataDir = path.join(app.getPath('userData'), 'data');
const dataFile = path.join(dataDir, 'records.json');
const settingsFile = path.join(dataDir, 'settings.json');

// 确保数据目录存在
function ensureDataDir() {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
}

// 读取 JSON 文件
function readJSON(filePath, fallback = {}) {
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    }
  } catch (e) {
    console.error('读取文件失败:', filePath, e);
  }
  return fallback;
}

// 写入 JSON 文件
function writeJSON(filePath, data) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    return true;
  } catch (e) {
    console.error('写入文件失败:', filePath, e);
    return false;
  }
}

// 旧版单用户格式迁移：{ "2026-07-07": {...} } -> { "井建恒": { "2026-07-07": {...} } }
function migrateRecords(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return data;
  const keys = Object.keys(data);
  if (keys.length > 0 && keys.every(k => /^\d{4}-\d{2}-\d{2}$/.test(k))) {
    return { '井建恒': data };
  }
  return data;
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1000,
    height: 750,
    minWidth: 840,
    minHeight: 620,
    title: '工作记录本',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  win.setMenuBarVisibility(false);
}

app.whenReady().then(() => {
  ensureDataDir();

  // 开机自启动（默认开启）
  app.setLoginItemSettings({
    openAtLogin: true,
    path: process.execPath
  });

  createWindow();

  // ===== 记录 CRUD（按打卡人分层存储） =====

  ipcMain.handle('load-records', () => {
    const data = readJSON(dataFile, {});
    const migrated = migrateRecords(data);
    if (migrated !== data) {
      writeJSON(dataFile, migrated);
      return migrated;
    }
    return data;
  });

  ipcMain.handle('save-record', (_event, { user, date, record }) => {
    const records = readJSON(dataFile, {});
    const name = (user || '').trim() || '井建恒';
    if (!records[name]) records[name] = {};
    if (record === null) {
      delete records[name][date];
    } else {
      records[name][date] = record;
    }
    const ok = writeJSON(dataFile, records);
    return { success: ok, records };
  });

  // ===== 打卡人管理 =====

  ipcMain.handle('add-user', (_event, { name }) => {
    const records = readJSON(dataFile, {});
    const trimmed = (name || '').trim();
    if (!trimmed) return { success: false, error: '姓名不能为空' };
    if (records[trimmed] !== undefined) return { success: false, error: '该打卡人已存在' };
    records[trimmed] = {};
    const ok = writeJSON(dataFile, records);
    return { success: ok, users: Object.keys(records) };
  });

  ipcMain.handle('remove-user', (_event, { name }) => {
    const records = readJSON(dataFile, {});
    if (records[name] === undefined) return { success: false, error: '打卡人不存在' };
    delete records[name];
    const ok = writeJSON(dataFile, records);
    return { success: ok, users: Object.keys(records) };
  });

  // ===== 导出/导入 =====

  ipcMain.handle('export-data', () => {
    return readJSON(dataFile, {});
  });

  ipcMain.handle('import-data', (_event, imported) => {
    try {
      const ok = writeJSON(dataFile, imported);
      return { success: ok };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  // ===== 一键清除某打卡人的所有记录 =====

  ipcMain.handle('clear-all-records', (_event, { user }) => {
    const records = readJSON(dataFile, {});
    const name = (user || '').trim();
    if (name && records[name] !== undefined) records[name] = {};
    const ok = writeJSON(dataFile, records);
    return { success: ok };
  });

  // ===== 设置存储 =====

  ipcMain.handle('load-settings', () => {
    return readJSON(settingsFile, {});
  });

  ipcMain.handle('save-settings', (_event, settings) => {
    const ok = writeJSON(settingsFile, settings);
    return { success: ok };
  });

  // ===== 开机自启开关 =====

  ipcMain.handle('set-login-settings', (_event, { openAtLogin }) => {
    app.setLoginItemSettings({ openAtLogin, path: process.execPath });
    return { success: true };
  });

  // ===== Excel 导出（渲染进程生成 buffer，主进程保存文件） =====

  ipcMain.handle('save-excel-file', async (_event, { buffer, defaultName }) => {
    const result = await dialog.showSaveDialog({
      title: '导出 Excel',
      defaultPath: defaultName,
      filters: [
        { name: 'Excel 文件', extensions: ['xlsx'] }
      ]
    });
    if (result.canceled || !result.filePath) {
      return { success: false, canceled: true };
    }
    try {
      fs.writeFileSync(result.filePath, Buffer.from(buffer));
      return { success: true, filePath: result.filePath };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  // ===== 导入 Excel（主进程读文件，返回 buffer） =====

  ipcMain.handle('open-excel-file', async () => {
    const result = await dialog.showOpenDialog({
      title: '导入 Excel',
      filters: [
        { name: 'Excel 文件', extensions: ['xlsx', 'xls'] }
      ],
      properties: ['openFile']
    });
    if (result.canceled || result.filePaths.length === 0) {
      return { success: false, canceled: true };
    }
    try {
      const buffer = fs.readFileSync(result.filePaths[0]);
      return { success: true, buffer: Array.from(buffer), filePath: result.filePaths[0] };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });
});

app.on('window-all-closed', () => {
  app.quit();
});

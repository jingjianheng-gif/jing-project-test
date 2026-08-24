const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('workAPI', {
  // 记录
  loadRecords: () => ipcRenderer.invoke('load-records'),
  saveRecord: (user, date, record) => ipcRenderer.invoke('save-record', { user, date, record }),
  clearAllRecords: (user) => ipcRenderer.invoke('clear-all-records', { user }),

  // 打卡人管理
  addUser: (name) => ipcRenderer.invoke('add-user', { name }),
  removeUser: (name) => ipcRenderer.invoke('remove-user', { name }),

  // 导出/导入
  exportData: () => ipcRenderer.invoke('export-data'),
  importData: (data) => ipcRenderer.invoke('import-data', data),

  // 设置
  loadSettings: () => ipcRenderer.invoke('load-settings'),
  saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),
  setLoginSettings: (openAtLogin) => ipcRenderer.invoke('set-login-settings', { openAtLogin }),

  // Excel
  saveExcelFile: (buffer, defaultName) => ipcRenderer.invoke('save-excel-file', { buffer, defaultName }),
  openExcelFile: () => ipcRenderer.invoke('open-excel-file')
});

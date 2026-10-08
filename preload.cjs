// preload.cjs
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  onUpdateAvailable: (callback) => ipcRenderer.on('update_available', callback),
  onUpdateDownloaded: (callback) => ipcRenderer.on('update_downloaded', callback),
  onUpdateNotAvailable: (callback) => ipcRenderer.on('update_not_available', callback),
  onUpdateError: (callback) => ipcRenderer.on('update_error', callback),
  checkUpdates: () => ipcRenderer.send('check_updates'),
  restartApp: () => ipcRenderer.send('restart_app'),
});

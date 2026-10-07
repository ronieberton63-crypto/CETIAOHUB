// main.cjs
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { autoUpdater } = require('electron-updater');

let win;

function createWindow() {
  win = new BrowserWindow({
    width: 1024,
    height: 768,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.cjs'),
      webSecurity: false
    }
  });

  if (!app.isPackaged) {
    win.loadURL('http://localhost:5173');
  } else {
    win.loadFile(path.join(__dirname, 'dist', 'index.html'));
  }

  if (app.isPackaged) {
    win.webContents.on('devtools-opened', () => {
      win.webContents.closeDevTools();
    });
  }
}

app.whenReady().then(() => {
  createWindow();

  // Initialize Auto Updater
  if (app.isPackaged) {
    autoUpdater.checkForUpdatesAndNotify();
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// AutoUpdater Events
autoUpdater.on('update-available', () => {
  if (win) win.webContents.send('update_available');
});

autoUpdater.on('update-downloaded', () => {
  if (win) win.webContents.send('update_downloaded');
});

autoUpdater.on('error', (err) => {
  if (win) win.webContents.send('update_error', err.message);
});

// IPC Main listener to restart app
ipcMain.on('restart_app', () => {
  autoUpdater.quitAndInstall();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

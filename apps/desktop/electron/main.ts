import { app, BrowserWindow } from 'electron';
import path from 'node:path';
import { createProvider } from '../../../packages/ai/model-router';
import { SQLiteDatabase } from './db/sqlite';
import { registerIpcHandlers } from './ipc';

const isDevelopment = !app.isPackaged;

const createMainWindow = async () => {
  const window = new BrowserWindow({
    width: 1600,
    height: 960,
    minWidth: 1280,
    minHeight: 800,
    backgroundColor: '#09111f',
    webPreferences: {
      preload: path.join(app.getAppPath(), 'dist-electron', 'apps', 'desktop', 'electron', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  if (isDevelopment) {
    await window.loadURL('http://localhost:5173');
    window.webContents.openDevTools({ mode: 'detach' });
    return;
  }

  await window.loadFile(path.join(app.getAppPath(), 'apps', 'desktop', 'renderer', 'dist', 'index.html'));
};

app.whenReady().then(async () => {
  const db = SQLiteDatabase.getDatabase(path.join(app.getPath('userData'), 'db'));
  const provider = (() => {
    try {
      return createProvider({
        geminiApiKey: process.env.GEMINI_API_KEY,
        groqApiKey: process.env.GROQ_API_KEY,
        ollamaBaseUrl: process.env.OLLAMA_BASE_URL,
      });
    } catch {
      return null;
    }
  })();

  registerIpcHandlers({
    db,
    appDataPath: app.getAppPath(),
    provider,
  });

  await createMainWindow();

  app.on('activate', async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

import { app, BrowserWindow } from 'electron';
import path from 'node:path';
import { createProvider } from '../../../packages/ai/model-router';
import { SQLiteDatabase } from './db/sqlite';
import { registerIpcHandlers } from './ipc';
import { PythonRuntimeService } from './services/python-runtime.service';

const isDevelopment = !app.isPackaged;
let pythonRuntimeService: PythonRuntimeService | null = null;

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

  // Initialize and auto-start Python Tool Runtime sidecar
  const projectRoot = app.getAppPath();
  pythonRuntimeService = new PythonRuntimeService(projectRoot);
  pythonRuntimeService.start().catch((err) => {
    console.error('Failed to auto-start Python runtime sidecar:', err);
  });

  registerIpcHandlers({
    db,
    appDataPath: app.getAppPath(),
    provider,
    pythonRuntimeService,
  });

  await createMainWindow();

  app.on('activate', async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createMainWindow();
    }
  });
});

app.on('before-quit', () => {
  if (pythonRuntimeService) {
    pythonRuntimeService.stop();
  }
});

app.on('window-all-closed', () => {
  if (pythonRuntimeService) {
    pythonRuntimeService.stop();
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});


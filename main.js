/**
 * Odin's EYE - Main Process
 * @author pradhanska
 * @see https://github.com/pradhanska
 */
const { app, BrowserWindow, ipcMain, desktopCapturer, dialog, session, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { createWorker } = require('tesseract.js');

let mainWindow;
let ocrWorker = null;

// pradhanska: resolve path to bundled OCR assets (tessdata, etc.)
function getOcrAssetsPath() {
  const base = app.isPackaged ? path.join(process.resourcesPath, 'ocr-assets') : path.join(__dirname, 'ocr-assets');
  return base;
}

// pradhanska: create/reuse single Tesseract worker for OCR
async function ensureWorker() {
  if (ocrWorker) return ocrWorker;
  const assets = getOcrAssetsPath();
  const tessdataDir = path.join(assets, 'tessdata');

  // cachePath: worker reads eng.traineddata from disk (avoids fetch).
  // dataPath: path in Tesseract virtual FS where the file is written; must be passed to Init() so Tesseract finds it.
  const workerOpts = { logger: () => {} };
  if (fs.existsSync(tessdataDir)) {
    workerOpts.cachePath = path.resolve(tessdataDir).replace(/\\/g, '/');
    workerOpts.dataPath = '/tessdata';
  }

  ocrWorker = await createWorker('eng', 3, workerOpts);
  return ocrWorker;
}

// pradhanska: create main app window (Odin's EYE)
function createWindow() {
  const iconPath = path.join(__dirname, 'assets', 'icon.png');
  mainWindow = new BrowserWindow({
    width: 900,
    height: 700,
    minWidth: 600,
    minHeight: 500,
    icon: iconPath,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    title: "Odin's EYE",
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });
}

app.whenReady().then(() => {
  // Use system picker for "Capture screen / window" so getDisplayMedia() works in renderer
  session.defaultSession.setDisplayMediaRequestHandler((request, callback) => {
    desktopCapturer.getSources({ types: ['window', 'screen'], thumbnailSize: { width: 1, height: 1 } })
      .then((sources) => {
        if (sources.length) callback({ video: sources[0] });
        else callback({});
      })
      .catch(() => callback({}));
  }, { useSystemPicker: true });
  createWindow();
});

app.on('window-all-closed', async () => {
  if (ocrWorker) {
    await ocrWorker.terminate();
    ocrWorker = null;
  }
  app.quit();
});

// pradhanska: IPC handler – OCR from file path (e.g. Browse)
ipcMain.handle('ocr:image', async (_, payload) => {
  const { imagePath } = payload;
  if (!imagePath || !fs.existsSync(imagePath)) {
    return { ok: false, error: 'File not found' };
  }
  try {
    const worker = await ensureWorker();
    const { data } = await worker.recognize(imagePath);
    return {
      ok: true,
      text: data.text,
      lines: (data.paragraphs || data.lines || []).map(p => ({
        text: p.text?.trim() || '',
        confidence: p.confidence,
      })).filter(l => l.text),
    };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

// pradhanska: IPC handler – OCR from image buffer/base64 (drag-drop, screen capture)
ipcMain.handle('ocr:buffer', async (_, { payload }) => {
  if (payload == null) return { ok: false, error: 'No image data' };
  const base64 = typeof payload === 'string' && payload.startsWith('data:')
    ? payload.replace(/^data:image\/\w+;base64,/, '')
    : payload;
  const buf = typeof base64 === 'string'
    ? Buffer.from(base64, 'base64')
    : Buffer.from(base64);
  if (buf.length === 0) return { ok: false, error: 'Empty image data' };
  const ext = (buf[0] === 0xFF && buf[1] === 0xD8) ? 'jpg' : 'png';
  const tempPath = path.join(os.tmpdir(), `odins-eye-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`);
  try {
    fs.writeFileSync(tempPath, buf);
    const worker = await ensureWorker();
    const { data } = await worker.recognize(tempPath);
    return {
      ok: true,
      text: data.text,
      lines: (data.paragraphs || data.lines || []).map(p => ({
        text: p.text?.trim() || '',
        confidence: p.confidence,
      })).filter(l => l.text),
    };
  } catch (e) {
    return { ok: false, error: e.message };
  } finally {
    try { fs.unlinkSync(tempPath); } catch (_) {}
  }
});

// pradhanska: open file dialog for image selection
ipcMain.handle('dialog:open-file', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp', 'tiff'] }],
    properties: ['openFile'],
  });
  if (canceled || !filePaths.length) return null;
  return filePaths[0];
});

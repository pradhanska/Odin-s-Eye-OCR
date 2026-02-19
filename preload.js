/**
 * Odin's EYE - Preload (secure bridge for renderer)
 * @author pradhanska
 * @see https://github.com/pradhanska
 */
const { contextBridge, ipcRenderer } = require('electron');

// pradhanska: expose only safe APIs to renderer
contextBridge.exposeInMainWorld('odinsEye', {
  ocrImage: (imagePath) => ipcRenderer.invoke('ocr:image', { imagePath }),
  ocrBuffer: (bufferOrBase64) => ipcRenderer.invoke('ocr:buffer', { payload: bufferOrBase64 }),
  openFileDialog: () => ipcRenderer.invoke('dialog:open-file'),
});

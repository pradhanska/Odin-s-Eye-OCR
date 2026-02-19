/**
 * Odin's EYE - Renderer (UI logic)
 * @author pradhanska
 * @see https://github.com/pradhanska
 */
(function () {
  const $ = (id) => document.getElementById(id);
  const dropZone = $('drop-zone');
  const browseBtn = $('browse-btn');
  const resultText = $('result-text');
  const copyAllBtn = $('copy-all-btn');
  const copyFeedback = $('copy-feedback');
  const captureScreenBtn = $('capture-screen-btn');
  const scanScreenBtn = $('scan-screen-btn');
  const screenError = $('screen-error');
  const capturePreview = $('capture-preview');
  const screenTextContainer = $('screen-text-container');
  const screenSelectAllBtn = $('screen-select-all-btn');
  const screenCopyAllBtn = $('screen-copy-all-btn');
  const screenCopyFeedback = $('screen-copy-feedback');
  const regionOverlay = $('region-overlay');
  const regionCanvas = $('region-canvas');
  const regionCaptureBtn = $('region-capture-btn');
  const regionCaptureFullBtn = $('region-capture-full-btn');
  const regionCancelBtn = $('region-cancel-btn');

  let lastCaptureDataUrl = null;
  let fullResCanvas = null;
  let regionCtx = null;
  let regionImageData = null;
  let regionScaleX = 1;
  let regionScaleY = 1;
  let regionStart = null;
  let regionCurrent = null;
  let regionSelectionLocked = false;

  // pradhanska: tab switching (Image / Screen)
  document.querySelectorAll('.tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach((t) => t.classList.remove('active'));
      document.querySelectorAll('.panel').forEach((p) => p.classList.remove('active'));
      tab.classList.add('active');
      $(`panel-${tab.dataset.tab}`).classList.add('active');
    });
  });

  function setResult(text) {
    resultText.textContent = text || '';
    resultText.classList.toggle('empty', !text);
    copyAllBtn.disabled = !text;
  }

  function showCopyFeedback(el, duration = 2000) {
    el.textContent = 'Copied!';
    el.classList.add('success-pulse');
    setTimeout(() => { 
      el.textContent = '';
      el.classList.remove('success-pulse');
    }, duration);
  }

  function setLoadingState(element, loading) {
    if (loading) {
      element.classList.add('loading');
      element.disabled = true;
    } else {
      element.classList.remove('loading');
      element.disabled = false;
    }
  }

  function dataUrlToArrayBuffer(dataUrl) {
    const base64 = dataUrl.replace(/^data:image\/\w+;base64,/, '');
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes.buffer;
  }

  function setImageResult(out) {
    setResult(out.text || '');
  }

  async function runImageOcrPath(imagePath) {
    setResult('');
    resultText.textContent = 'Scanning…';
    resultText.classList.remove('empty');
    setLoadingState(browseBtn, true);
    try {
      const out = await window.odinsEye.ocrImage(imagePath);
      if (out.ok) setImageResult(out);
      else { 
        setResult(''); 
        resultText.textContent = 'Error: ' + (out.error || 'Unknown'); 
        resultText.classList.add('error-msg');
      }
    } catch (e) {
      setResult('');
      resultText.textContent = 'Error: ' + (e.message || 'Unknown');
      resultText.classList.add('error-msg');
    } finally {
      setLoadingState(browseBtn, false);
      setTimeout(() => resultText.classList.remove('error-msg'), 3000);
    }
  }

  async function runImageOcrFile(file) {
    if (!file || !file.type.startsWith('image/')) {
      resultText.textContent = 'Please drop an image file (PNG, JPG, etc.).';
      resultText.classList.add('error-msg');
      setTimeout(() => resultText.classList.remove('error-msg'), 3000);
      return;
    }
    setResult('');
    resultText.textContent = 'Scanning…';
    resultText.classList.remove('empty');
    setLoadingState(browseBtn, true);
    try {
      const base64 = await new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => {
          const dataUrl = r.result;
          resolve(dataUrl.indexOf('base64,') >= 0 ? dataUrl.split('base64,')[1] : '');
        };
        r.onerror = () => reject(new Error('Could not read file'));
        r.readAsDataURL(file);
      });
      const out = await window.odinsEye.ocrBuffer(base64);
      if (out.ok) setImageResult(out);
      else { 
        setResult(''); 
        resultText.textContent = 'Error: ' + (out.error || 'Unknown');
        resultText.classList.add('error-msg');
      }
    } catch (e) {
      setResult('');
      resultText.textContent = 'Error: ' + (e.message || 'Unknown') + '. Try using Browse instead.';
      resultText.classList.add('error-msg');
    } finally {
      setLoadingState(browseBtn, false);
      setTimeout(() => resultText.classList.remove('error-msg'), 3000);
    }
  }

  // pradhanska: drag-and-drop image handling
  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropZone.classList.add('dragover');
  });
  dropZone.addEventListener('dragleave', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
  });
  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropZone.classList.remove('dragover');
    const file = e.dataTransfer?.files?.[0];
    if (file) runImageOcrFile(file);
  });

  browseBtn.addEventListener('click', async () => {
    const path = await window.odinsEye.openFileDialog();
    if (path) runImageOcrPath(path);
  });

  copyAllBtn.addEventListener('click', async () => {
    const text = resultText.textContent;
    if (!text) return;
    await navigator.clipboard.writeText(text);
    showCopyFeedback(copyFeedback);
  });

  function drawRegionOverlay() {
    if (!regionImageData || !regionCtx) return;
    const c = regionCanvas;
    const w = c.width;
    const h = c.height;
    regionCtx.drawImage(regionImageData, 0, 0, w, h);
    if (regionStart && regionCurrent) {
      const x = Math.min(regionStart.x, regionCurrent.x);
      const y = Math.min(regionStart.y, regionCurrent.y);
      const ww = Math.abs(regionCurrent.x - regionStart.x);
      const hh = Math.abs(regionCurrent.y - regionStart.y);
      regionCtx.strokeStyle = '#c9a227';
      regionCtx.lineWidth = 2;
      regionCtx.setLineDash([6, 4]);
      regionCtx.strokeRect(x, y, ww, hh);
      regionCtx.fillStyle = 'rgba(0,0,0,0.35)';
      regionCtx.fillRect(0, 0, c.width, y);
      regionCtx.fillRect(0, y, x, hh);
      regionCtx.fillRect(x + ww, y, c.width - (x + ww), hh);
      regionCtx.fillRect(0, y + hh, c.width, h - (y + hh));
    }
  }

  function getSelectionRectInSource() {
    if (!regionStart || !regionCurrent || !fullResCanvas) return null;
    const x1 = Math.min(regionStart.x, regionCurrent.x);
    const y1 = Math.min(regionStart.y, regionCurrent.y);
    const x2 = Math.max(regionStart.x, regionCurrent.x);
    const y2 = Math.max(regionStart.y, regionCurrent.y);
    const sx1 = Math.max(0, Math.floor(x1 * regionScaleX));
    const sy1 = Math.max(0, Math.floor(y1 * regionScaleY));
    const sx2 = Math.min(fullResCanvas.width, Math.ceil(x2 * regionScaleX));
    const sy2 = Math.min(fullResCanvas.height, Math.ceil(y2 * regionScaleY));
    if (sx2 <= sx1 || sy2 <= sy1) return null;
    return { x: sx1, y: sy1, width: sx2 - sx1, height: sy2 - sy1 };
  }

  function cropToDataUrl(rect) {
    const src = fullResCanvas;
    const c = document.createElement('canvas');
    c.width = rect.width;
    c.height = rect.height;
    const ctx = c.getContext('2d');
    ctx.drawImage(src, rect.x, rect.y, rect.width, rect.height, 0, 0, rect.width, rect.height);
    return c.toDataURL('image/png');
  }

  function closeRegionOverlay() {
    regionOverlay.classList.remove('visible');
    regionStart = null;
    regionCurrent = null;
    regionSelectionLocked = false;
    fullResCanvas = null;
    regionImageData = null;
  }

  function finishCapture(dataUrl) {
    closeRegionOverlay();
    lastCaptureDataUrl = dataUrl;
    const img = document.createElement('img');
    img.src = dataUrl;
    capturePreview.innerHTML = '';
    capturePreview.appendChild(img);
    scanScreenBtn.disabled = false;
    screenTextContainer.innerHTML = 'Click &quot;Scan captured area&quot; to recognize text. Then click any text to copy.';
    screenTextContainer.classList.add('empty');
    screenSelectAllBtn.disabled = true;
    screenCopyAllBtn.disabled = true;
    screenError.textContent = '';
  }

  regionCanvas.addEventListener('mousedown', (e) => {
    e.preventDefault();
    regionSelectionLocked = false;
    const r = regionCanvas.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    regionStart = { x, y };
    regionCurrent = { x, y };
    const onMouseUp = () => {
      document.removeEventListener('mouseup', onMouseUp);
      regionSelectionLocked = true;
      drawRegionOverlay();
    };
    document.addEventListener('mouseup', onMouseUp);
  });

  regionCanvas.addEventListener('mousemove', (e) => {
    if (!regionStart || regionSelectionLocked) return;
    const r = regionCanvas.getBoundingClientRect();
    regionCurrent = { x: e.clientX - r.left, y: e.clientY - r.top };
    drawRegionOverlay();
  });

  regionCanvas.addEventListener('mouseleave', () => {
    if (regionStart) drawRegionOverlay();
  });

  regionCaptureBtn.addEventListener('click', () => {
    const rect = getSelectionRectInSource();
    if (!rect || rect.width < 10 || rect.height < 10) {
      screenError.textContent = 'Select an area first (drag on the image).';
      return;
    }
    const dataUrl = cropToDataUrl(rect);
    finishCapture(dataUrl);
  });

  regionCaptureFullBtn.addEventListener('click', () => {
    if (!fullResCanvas) return;
    finishCapture(fullResCanvas.toDataURL('image/png'));
  });

  regionCancelBtn.addEventListener('click', () => {
    closeRegionOverlay();
    screenError.textContent = '';
  });

  // pradhanska: screen capture + region selector (Snipping Tool style)
  captureScreenBtn.addEventListener('click', async () => {
    screenError.textContent = '';
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false,
      });
      const video = document.createElement('video');
      video.srcObject = stream;
      video.play();
      await new Promise((res, rej) => {
        video.onloadedmetadata = () => res();
        video.onerror = rej;
      });
      const w = video.videoWidth;
      const h = video.videoHeight;
      fullResCanvas = document.createElement('canvas');
      fullResCanvas.width = w;
      fullResCanvas.height = h;
      fullResCanvas.getContext('2d').drawImage(video, 0, 0);
      stream.getTracks().forEach((t) => t.stop());

      const maxW = Math.min(window.innerWidth - 40, w);
      const maxH = Math.min(window.innerHeight - 120, h);
      const scale = Math.min(maxW / w, maxH / h);
      const drawW = Math.round(w * scale);
      const drawH = Math.round(h * scale);
      regionScaleX = w / drawW;
      regionScaleY = h / drawH;

      regionCanvas.width = drawW;
      regionCanvas.height = drawH;
      regionCtx = regionCanvas.getContext('2d');
      regionImageData = document.createElement('canvas');
      regionImageData.width = drawW;
      regionImageData.height = drawH;
      regionImageData.getContext('2d').drawImage(fullResCanvas, 0, 0, w, h, 0, 0, drawW, drawH);

      regionStart = null;
      regionCurrent = null;
      regionSelectionLocked = false;
      drawRegionOverlay();
      regionOverlay.classList.add('visible');
    } catch (e) {
      if (e.name !== 'NotAllowedError') {
        screenError.textContent = 'Could not capture: ' + (e.message || 'Cancelled or not supported.');
      }
    }
  });

  // pradhanska: run OCR on captured area and show copyable text lines
  scanScreenBtn.addEventListener('click', async () => {
    if (!lastCaptureDataUrl) return;
    screenError.textContent = '';
    screenTextContainer.innerHTML = '<div class="spinner"></div>';
    screenTextContainer.classList.remove('empty');
    screenSelectAllBtn.disabled = true;
    screenCopyAllBtn.disabled = true;
    setLoadingState(scanScreenBtn, true);
    try {
      const base64 = lastCaptureDataUrl.replace(/^data:image\/\w+;base64,/, '');
      const out = await window.odinsEye.ocrBuffer(base64);
      setLoadingState(scanScreenBtn, false);
      if (!out.ok) {
        screenTextContainer.innerHTML = '';
        screenTextContainer.classList.add('empty');
        screenTextContainer.textContent = 'OCR failed: ' + (out.error || 'Unknown');
        screenError.textContent = 'OCR failed: ' + (out.error || 'Unknown');
        return;
      }
      const lines = (out.lines && out.lines.length) ? out.lines.map((l) => l.text) : (out.text ? out.text.split(/\n/).map((s) => s.trim()).filter(Boolean) : []);
      screenTextContainer.innerHTML = '';
      screenTextContainer.classList.remove('empty');
      if (lines.length === 0) {
        screenTextContainer.textContent = 'No text recognized.';
        screenTextContainer.classList.add('empty');
        screenSelectAllBtn.disabled = true;
        screenCopyAllBtn.disabled = true;
        return;
      }
      
      // Store all text for select all functionality
      window.currentScreenText = lines.join('\n');
      
      lines.forEach((text, index) => {
        const textLine = document.createElement('div');
        textLine.className = 'text-line';
        textLine.textContent = text;
        textLine.dataset.index = index;
        textLine.addEventListener('click', async () => {
          await navigator.clipboard.writeText(text);
          textLine.classList.add('copied');
          showCopyFeedback(screenCopyFeedback);
          setTimeout(() => textLine.classList.remove('copied'), 1500);
        });
        screenTextContainer.appendChild(textLine);
      });
      
      screenSelectAllBtn.disabled = false;
      screenCopyAllBtn.disabled = false;
      
      // Add success animation
      screenTextContainer.classList.add('success-pulse');
      setTimeout(() => screenTextContainer.classList.remove('success-pulse'), 600);
    } catch (e) {
      setLoadingState(scanScreenBtn, false);
      screenTextContainer.innerHTML = '';
      screenTextContainer.classList.add('empty');
      screenTextContainer.textContent = 'Error: ' + e.message;
      screenError.textContent = 'Error: ' + e.message;
      screenSelectAllBtn.disabled = true;
      screenCopyAllBtn.disabled = true;
    }
  });
  
  // Select all functionality
  screenSelectAllBtn.addEventListener('click', () => {
    const textLines = screenTextContainer.querySelectorAll('.text-line');
    textLines.forEach(line => {
      line.style.background = 'var(--accent-muted)';
      line.style.borderLeft = '3px solid var(--accent-solid)';
    });
    
    // Create a temporary selection
    const range = document.createRange();
    range.selectNodeContents(screenTextContainer);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    
    setTimeout(() => {
      textLines.forEach(line => {
        line.style.background = '';
        line.style.borderLeft = '';
      });
    }, 1000);
  });
  
  // Copy all functionality
  screenCopyAllBtn.addEventListener('click', async () => {
    if (window.currentScreenText) {
      await navigator.clipboard.writeText(window.currentScreenText);
      showCopyFeedback(screenCopyFeedback);
      
      // Visual feedback
      const textLines = screenTextContainer.querySelectorAll('.text-line');
      textLines.forEach(line => {
        line.classList.add('copied');
      });
      setTimeout(() => {
        textLines.forEach(line => {
          line.classList.remove('copied');
        });
      }, 1500);
    }
  });
})();

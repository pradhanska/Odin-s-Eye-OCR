const fs = require('fs');
const path = require('path');
const https = require('https');

const root = path.join(__dirname, '..');
const ocrAssets = path.join(root, 'ocr-assets');
const tessdata = path.join(ocrAssets, 'tessdata');
const coreDest = path.join(ocrAssets, 'tesseract-core');

function copyDir(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  for (const name of fs.readdirSync(src)) {
    const s = path.join(src, name);
    const d = path.join(dest, name);
    if (fs.statSync(s).isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

function download(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    }).on('error', reject);
  });
}

async function main() {
  fs.mkdirSync(ocrAssets, { recursive: true });
  fs.mkdirSync(tessdata, { recursive: true });
  fs.mkdirSync(coreDest, { recursive: true });

  const tesseractPkg = path.join(root, 'node_modules', 'tesseract.js');
  const corePkg = path.join(root, 'node_modules', 'tesseract.js-core');

  if (fs.existsSync(tesseractPkg)) {
    const dist = path.join(tesseractPkg, 'dist');
    if (fs.existsSync(dist)) {
      const w = path.join(dist, 'worker.min.js');
      if (fs.existsSync(w)) {
        fs.copyFileSync(w, path.join(ocrAssets, 'worker.min.js'));
        console.log('Copied worker.min.js');
      }
    }
  }

  if (fs.existsSync(corePkg)) {
    copyDir(corePkg, coreDest);
    console.log('Copied tesseract.js-core');
  }

  const engPath = path.join(tessdata, 'eng.traineddata');
  if (!fs.existsSync(engPath)) {
    console.log('Downloading eng.traineddata for offline OCR...');
    try {
      const buf = await download('https://github.com/tesseract-ocr/tessdata/raw/4.0.0/eng.traineddata');
      fs.writeFileSync(engPath, buf);
      console.log('Downloaded eng.traineddata');
    } catch (e) {
      console.warn('Could not download eng.traineddata:', e.message);
      console.warn('Place eng.traineddata in ocr-assets/tessdata/ for offline OCR.');
    }
  }
}

main().catch(console.error);

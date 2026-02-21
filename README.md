
# Odin's EYE

**Offline OCR** — scan images and your screen for copyable text. Runs entirely on your computer; no data is sent to the internet.

## Features

- **Image scan**: Drag and drop any image (PNG, JPG, etc.) or use **Browse** to pick a file. Recognized text is shown and you can **Copy all**.
- **Screen scan**: Click **Capture screen / window** to choose a screen or application window, then **Scan captured area** to run OCR. Click any recognized text chip to copy it.

All processing is done locally with [Tesseract.js](https://github.com/naptha/tesseract.js). No cloud or API keys required.

## Requirements

- Windows, macOS, or Linux
- Node.js 18+ (for running from source)

## Run from source

1. Install dependencies (this also downloads the English OCR language data once for offline use):

   ```bash
   npm install
   ```

2. Start the app:
   Run start.cmd file

   Or

   ```bash
   npm start
   ```

## Usage

1. **Image tab**: Drop an image on the drop zone or click **Browse** to select a file. Wait for “Scanning…” to finish, then use **Copy all** or select and copy from the text area.
2. **Screen tab**: Click **Capture screen / window**, choose a screen or window in the dialog, then click **Scan captured area**. Click any text chip to copy that line.

## Offline

After `npm install`, the English language data is stored in `ocr-assets/tessdata/`. The app does not need internet to run OCR. Fonts and UI are local; no external requests are made during normal use.

## License

MIT

# Odin-s-Eye-OCR
Odin’s Eye is a powerful, web-based Optical Character Recognition (OCR) application built on top of the open-source Tesseract OCR engine. Designed for accuracy, speed, and usability, it transforms images and scanned documents into editable, searchable text directly from your browser.


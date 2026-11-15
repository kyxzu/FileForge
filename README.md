<div align="center">

# FileForge

**Image tools that keep processing in your browser.**

Convert, compress, resize, and inspect PNG, JPEG, and WebP images with a simple browser interface.

[![JavaScript](https://img.shields.io/badge/JavaScript-vanilla-F7DF1E?logo=javascript&logoColor=222)](https://developer.mozilla.org/en-US/docs/Web/JavaScript) [![Vite](https://img.shields.io/badge/Bundled_with-Vite-646CFF?logo=vite&logoColor=white)](https://vite.dev/)

</div>

## What it does

| Tool | Capabilities |
| --- | --- |
| **Converter** | Convert between PNG, JPEG, and WebP. Adjust quality for JPEG and WebP output. |
| **Compressor** | Keep the source format or choose PNG, JPEG, or WebP. Compare output sizes and download results. |
| **Resizer** | Set maximum width and height; images retain their proportions. |
| **Inspector** | View file type, size, last-modified time, dimensions, aspect ratio, and pixel count. |

Select or drag and drop multiple images. The app previews your selection and lets you remove individual files or clear the list. A light and dark theme toggle remembers your choice in browser storage when available.

## Built with

- Vanilla JavaScript and browser APIs, including Canvas, the File API, and `createImageBitmap`
- CSS
- Vite

## Run locally

**Requirements:** Node.js 20.19+ or 22.12+.

```bash
git clone https://github.com/kyxzu/FileForge.git
cd FileForge
npm ci
npm run dev
```

Open the local URL printed by Vite.

Build and preview the production version:

```bash
npm run build
npm run preview
```

## Privacy

Image selection, inspection, conversion, compression, and resizing run in the browser using browser image and canvas APIs. The application code does not send selected image files to a FileForge server. Images are held in browser memory for processing and previews; downloads are initiated by the browser. The theme preference is stored in local storage when available.

## Contributing

Contributions are welcome. Open an issue to discuss a bug or proposed change, or submit a pull request with a clear description.

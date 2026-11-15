# FileForge

FileForge is a browser-based set of utilities for working with PNG, JPEG, and WebP images. It lets you select multiple images, inspect their properties, convert formats, adjust compression, and resize images while keeping their proportions.

## Features

- Select or drag and drop multiple PNG, JPEG, and WebP images.
- Preview selected images, view file names, formats, and sizes, remove individual files, or clear the selection.
- Inspect image dimensions, aspect ratio, pixel count, file type, file size, and last-modified time.
- Convert images between PNG, JPEG, and WebP, with an adjustable quality setting for JPEG and WebP.
- Compress images while keeping their original format or choosing PNG, JPEG, or WebP output. View size comparisons and download results.
- Resize images to maximum width and height limits while preserving aspect ratio.
- Switch between light and dark themes. The selected theme is saved in browser storage when available.

## Technology

- Vanilla JavaScript and browser APIs, including Canvas, the File API, and createImageBitmap.
- CSS for the interface and themes.
- Vite for local development and production builds.

## Run locally

Requirements: Node.js 20.19+ or 22.12+.

```bash
git clone https://github.com/kyxzu/FileForge.git
cd FileForge
npm ci
npm run dev
```

Open the local URL printed by Vite.

To create and preview a production build:

```bash
npm run build
npm run preview
```

## Privacy and file processing

Image selection, inspection, conversion, compression, and resizing are implemented in the browser using browser image and canvas APIs. The application code does not send selected image files to a FileForge server. Image content is held in browser memory for processing and previews; generated files are downloaded through the browser. The theme preference is stored in local storage when available.

## Contributing

Contributions are welcome. Open an issue to discuss a bug or proposed change, or submit a pull request with a clear description of the update.

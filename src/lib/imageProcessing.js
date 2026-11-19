// Local image processing built on the Canvas API and createImageBitmap().
// These are the original FileForge converter, compressor and resizer
// functions, moved here so the single tools and the batch system share them.

import { MIME_EXTENSIONS, SUPPORTED_FORMATS } from "./format.js";
import { sanitizeFilename, stripExtension, MAX_INPUT_PIXELS } from "./files.js";

// Frees the memory held by a canvas as soon as we are done with it.
export function releaseCanvas(canvas) {
  canvas.width = 0;
  canvas.height = 0;
}

export function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Could not generate the image."))),
      type,
      type === "image/png" ? undefined : quality
    );
  });
}

function createCanvas(width, height) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) {
    releaseCanvas(canvas);
    throw new Error("Canvas is not supported by your browser.");
  }
  return { canvas, context };
}

function safeBaseName(file) {
  return sanitizeFilename(stripExtension(file.name), "image");
}

// Checks which output formats this browser can really encode.
let encodableFormats = null;
export function detectEncodableFormats() {
  if (!encodableFormats) {
    encodableFormats = (async () => {
      const supported = new Set();
      for (const type of SUPPORTED_FORMATS) {
        try {
          const { canvas } = createCanvas(1, 1);
          const blob = await canvasToBlob(canvas, type, 0.8);
          releaseCanvas(canvas);
          if (blob.type === type) supported.add(type);
        } catch {
          // This format is not available in the current browser.
        }
      }
      return supported;
    })();
  }
  return encodableFormats;
}

// ------------------------------------------------------------------
// Convert
// ------------------------------------------------------------------

export async function convertImage(file, format, quality) {
  const bitmap = await createImageBitmap(file);
  let canvas = null;

  try {
    const created = createCanvas(bitmap.width, bitmap.height);
    canvas = created.canvas;

    if (format === "image/jpeg") {
      created.context.fillStyle = "#ffffff";
      created.context.fillRect(0, 0, canvas.width, canvas.height);
    }

    created.context.drawImage(bitmap, 0, 0);

    const blob = await canvasToBlob(canvas, format, quality);
    const extension = MIME_EXTENSIONS[blob.type];

    if (!extension || blob.type !== format) {
      throw new Error("Your browser could not generate the requested format.");
    }

    return {
      original: file,
      blob,
      name: `${safeBaseName(file)}.${extension}`,
      width: bitmap.width,
      height: bitmap.height,
      format: blob.type,
    };
  } finally {
    bitmap.close();
    if (canvas) releaseCanvas(canvas);
  }
}

// ------------------------------------------------------------------
// Compress
// ------------------------------------------------------------------

// For JPEG and WebP: searches for the highest quality (at or below
// `quality`) that fits within `targetBytes`. PNG is lossless, so it is
// encoded once and the target is ignored.
async function encodeWithTarget(canvas, type, quality, targetBytes) {
  const first = await canvasToBlob(canvas, type, quality);
  const hasTarget = targetBytes > 0 && type !== "image/png";

  if (!hasTarget) return { blob: first, qualityUsed: quality, targetReached: null };
  if (first.size <= targetBytes) return { blob: first, qualityUsed: quality, targetReached: true };

  const lowest = await canvasToBlob(canvas, type, 0.1);
  if (lowest.size > targetBytes) {
    return { blob: lowest, qualityUsed: 0.1, targetReached: false };
  }

  let best = { blob: lowest, qualityUsed: 0.1 };
  let low = 0.1;
  let high = quality;

  for (let step = 0; step < 6; step++) {
    const middle = (low + high) / 2;
    const candidate = await canvasToBlob(canvas, type, middle);
    if (candidate.size <= targetBytes) {
      best = { blob: candidate, qualityUsed: middle };
      low = middle;
    } else {
      high = middle;
    }
  }

  return { ...best, targetReached: true };
}

export async function compressImage(file, outputFormat, quality, options = {}) {
  const bitmap = await createImageBitmap(file);
  let canvas = null;

  try {
    const targetFormat = outputFormat === "original" ? file.type : outputFormat;

    if (!SUPPORTED_FORMATS.includes(targetFormat)) {
      throw new Error("Unsupported output format.");
    }

    const created = createCanvas(bitmap.width, bitmap.height);
    canvas = created.canvas;

    // JPEG does not support transparency: fill transparent areas with white.
    if (targetFormat === "image/jpeg") {
      created.context.fillStyle = "#ffffff";
      created.context.fillRect(0, 0, canvas.width, canvas.height);
    }

    created.context.drawImage(bitmap, 0, 0);

    const { blob, qualityUsed, targetReached } = await encodeWithTarget(
      canvas,
      targetFormat,
      quality,
      options.targetBytes || 0
    );

    if (blob.type !== targetFormat) {
      throw new Error(`Your browser could not produce ${targetFormat}.`);
    }

    const savedBytes = file.size - blob.size;

    return {
      original: file,
      blob,
      name: `${safeBaseName(file)}-compressed.${MIME_EXTENSIONS[blob.type]}`,
      width: bitmap.width,
      height: bitmap.height,
      savedBytes,
      savedPercentage: file.size > 0 ? (savedBytes / file.size) * 100 : 0,
      format: targetFormat,
      isPng: targetFormat === "image/png",
      qualityUsed,
      targetReached,
    };
  } finally {
    bitmap.close();
    if (canvas) releaseCanvas(canvas);
  }
}

// ------------------------------------------------------------------
// Resize
// ------------------------------------------------------------------

// Default behaviour (unchanged from the original tool): fit the image inside
// maxWidth x maxHeight, keep its proportions, never enlarge it.
// With { keepAspect: false } the image is stretched to exactly
// maxWidth x maxHeight.
export async function resizeImage(file, maxWidth, maxHeight, options = {}) {
  const keepAspect = options.keepAspect !== false;
  const bitmap = await createImageBitmap(file);
  let canvas = null;

  try {
    let width;
    let height;

    if (keepAspect) {
      const scale = Math.min(1, maxWidth / bitmap.width, maxHeight / bitmap.height);
      width = Math.max(1, Math.round(bitmap.width * scale));
      height = Math.max(1, Math.round(bitmap.height * scale));
    } else {
      width = maxWidth;
      height = maxHeight;
    }

    if (width * height > MAX_INPUT_PIXELS) {
      throw new Error("The resized image would be too large to process.");
    }

    const created = createCanvas(width, height);
    canvas = created.canvas;

    if (file.type === "image/jpeg") {
      created.context.fillStyle = "#fff";
      created.context.fillRect(0, 0, width, height);
    }

    created.context.drawImage(bitmap, 0, 0, width, height);

    const blob = await canvasToBlob(canvas, file.type);
    const extension = MIME_EXTENSIONS[blob.type];

    if (!extension || blob.type !== file.type) {
      throw new Error("Your browser could not preserve this image format.");
    }

    return {
      blob,
      width,
      height,
      name: `${safeBaseName(file)}-resized.${extension}`,
      format: blob.type,
    };
  } finally {
    bitmap.close();
    if (canvas) releaseCanvas(canvas);
  }
}

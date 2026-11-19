// The operations the batch system (and the history) understand.
// Each operation reuses the existing image processing functions.

import { formatLabel, SUPPORTED_FORMATS } from "./format.js";
import { MAX_OUTPUT_DIMENSION, getExtension, sanitizeFilename } from "./files.js";
import { convertImage, compressImage, resizeImage } from "./imageProcessing.js";

export const OPERATIONS = {
  resize: { label: "Image Resizing", shortLabel: "Resize" },
  compress: { label: "Image Compression", shortLabel: "Compress" },
  convert: { label: "Image Conversion", shortLabel: "Convert" },
};

export function operationLabel(operation) {
  return OPERATIONS[operation]?.label || "Unknown operation";
}

// Presets for the batch resizer. They are "fit within" boxes.
export const RESIZE_PRESETS = [
  { id: "custom", label: "Custom size", width: null, height: null },
  { id: "hd", label: "HD 1280 × 720", width: 1280, height: 720 },
  { id: "full-hd", label: "Full HD 1920 × 1080", width: 1920, height: 1080 },
  { id: "square", label: "Square 1080 × 1080", width: 1080, height: 1080 },
  { id: "thumbnail", label: "Thumbnail 256 × 256", width: 256, height: 256 },
];

export const DEFAULT_SETTINGS = {
  resize: { width: 1200, height: 1200, keepAspect: true },
  compress: { format: "original", quality: 75, targetKB: null },
  convert: { format: "image/webp", quality: 85 },
};

function isWholeNumber(value, min, max) {
  return Number.isInteger(value) && value >= min && value <= max;
}

// Returns an error message, or "" when the settings are valid.
export function validateSettings(operation, settings) {
  if (!settings || typeof settings !== "object") return "Settings are missing.";

  if (operation === "resize") {
    if (
      !isWholeNumber(settings.width, 1, MAX_OUTPUT_DIMENSION) ||
      !isWholeNumber(settings.height, 1, MAX_OUTPUT_DIMENSION)
    ) {
      return `Enter whole-number dimensions between 1 and ${MAX_OUTPUT_DIMENSION.toLocaleString()} pixels.`;
    }
    return "";
  }

  if (operation === "compress") {
    if (settings.format !== "original" && !SUPPORTED_FORMATS.includes(settings.format)) {
      return "Choose a supported output format.";
    }
    if (!isWholeNumber(settings.quality, 10, 100)) {
      return "Quality must be between 10 and 100.";
    }
    if (settings.targetKB !== null && settings.targetKB !== undefined) {
      if (!Number.isFinite(settings.targetKB) || settings.targetKB < 1 || settings.targetKB > 100000) {
        return "Target size must be between 1 KB and 100,000 KB.";
      }
    }
    return "";
  }

  if (operation === "convert") {
    if (!SUPPORTED_FORMATS.includes(settings.format)) {
      return "Choose a supported output format.";
    }
    if (!isWholeNumber(settings.quality, 10, 100)) {
      return "Quality must be between 10 and 100.";
    }
    return "";
  }

  return "Unknown operation.";
}

// Plain-language lines describing the settings (used by the history details).
export function describeSettings(operation, settings = {}) {
  if (operation === "resize") {
    return [
      ["Size", settings.keepAspect === false
        ? `Exactly ${settings.width} × ${settings.height} px`
        : `Fit within ${settings.width} × ${settings.height} px`],
      ["Aspect ratio", settings.keepAspect === false ? "Not locked" : "Locked (never enlarged)"],
    ];
  }

  if (operation === "compress") {
    const lines = [
      ["Output format", settings.format === "original" ? "Keep original format" : formatLabel(settings.format)],
      ["Quality", settings.format === "image/png" ? "Not applicable (PNG is lossless)" : `${settings.quality}%`],
    ];
    if (settings.targetKB) lines.push(["Target size", `${settings.targetKB} KB`]);
    return lines;
  }

  if (operation === "convert") {
    return [
      ["Output format", formatLabel(settings.format)],
      ["Quality", settings.format === "image/png" ? "Not applicable (PNG is lossless)" : `${settings.quality}%`],
    ];
  }

  return [];
}

// Output filename for a batch: "photo.png" -> "photo-resized.png", and so on.
// A conversion that keeps the same format gets "-converted" so the output is
// never confused with the original.
function batchOutputName(file, result, operation) {
  let name = sanitizeFilename(result.name, "image");

  if (operation === "convert" && name.toLowerCase() === file.name.toLowerCase()) {
    const extension = getExtension(name);
    name = `${name.slice(0, -(extension.length + 1))}-converted.${extension}`;
  }

  return name;
}

// Runs one operation on one file and returns a normalized result:
// { blob, name, width, height, outputFormat, details }
export async function runOperation(file, operation, settings) {
  const problem = validateSettings(operation, settings);
  if (problem) throw new Error(problem);

  let result;
  const details = {};

  if (operation === "resize") {
    result = await resizeImage(file, settings.width, settings.height, {
      keepAspect: settings.keepAspect,
    });
  } else if (operation === "compress") {
    result = await compressImage(file, settings.format, settings.quality / 100, {
      targetBytes: settings.targetKB ? Math.round(settings.targetKB * 1024) : 0,
    });
    details.qualityUsed = Math.round(result.qualityUsed * 100);
    details.targetReached = result.targetReached;
  } else if (operation === "convert") {
    result = await convertImage(file, settings.format, settings.quality / 100);
  } else {
    throw new Error("Unknown operation.");
  }

  return {
    blob: result.blob,
    name: batchOutputName(file, result, operation),
    width: result.width,
    height: result.height,
    outputFormat: result.blob.type,
    details,
  };
}

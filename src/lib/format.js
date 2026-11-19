// Small formatting helpers shared by every FileForge tool.

export const MIME_EXTENSIONS = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

export const FORMAT_LABELS = {
  "image/png": "PNG",
  "image/jpeg": "JPEG",
  "image/webp": "WebP",
};

export const SUPPORTED_FORMATS = Object.keys(MIME_EXTENSIONS);

export function formatLabel(mimeType) {
  return FORMAT_LABELS[mimeType] || (mimeType ? String(mimeType) : "Unknown");
}

export function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 Bytes";

  const units = ["Bytes", "KB", "MB", "GB", "TB"];
  const index = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1
  );

  return `${(bytes / Math.pow(1024, index)).toFixed(2)} ${units[index]}`;
}

export function formatDateTime(timestamp) {
  if (!Number.isFinite(timestamp)) return "Unknown date";
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(timestamp));
  } catch {
    return new Date(timestamp).toLocaleString();
  }
}

// Describes a size change, for example "42.3% smaller".
export function describeSizeChange(originalSize, outputSize) {
  if (!(originalSize > 0) || !Number.isFinite(outputSize)) return "";
  const difference = outputSize - originalSize;
  if (difference === 0) return "Same file size";
  const percentage = ((Math.abs(difference) / originalSize) * 100).toFixed(1);
  return difference < 0 ? `${percentage}% smaller` : `${percentage}% larger`;
}

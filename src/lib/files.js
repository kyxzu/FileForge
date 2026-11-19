// File validation and safe filename handling.
// Nothing here touches the DOM except validateImageFile (it decodes the image).

export const SUPPORTED_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
]);

const ALLOWED_EXTENSIONS = {
  "image/png": ["png"],
  "image/jpeg": ["jpg", "jpeg"],
  "image/webp": ["webp"],
};

export const MAX_FILE_BYTES = 50 * 1024 * 1024; // 50 MB per file
export const MAX_INPUT_PIXELS = 100_000_000; // 100 megapixels
export const MAX_OUTPUT_DIMENSION = 12000; // per side, matches the Resizer
export const MAX_QUEUE_FILES = 200;

// ------------------------------------------------------------------
// Filenames
// ------------------------------------------------------------------

const RESERVED_WINDOWS_NAMES = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;

export function getExtension(filename) {
  const match = /\.([^./\\]+)$/.exec(String(filename));
  return match ? match[1].toLowerCase() : "";
}

export function stripExtension(filename) {
  return String(filename).replace(/\.[^/.\\]+$/, "");
}

// Produces a name that is safe to use for a download or a ZIP entry.
// It never returns an empty string.
export function sanitizeFilename(name, fallback = "file") {
  let safe = String(name ?? "")
    .normalize("NFC")
    // Control characters, path separators and characters Windows forbids.
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f<>:"/\\|?*]/g, "_")
    // Bidirectional overrides can disguise a file extension.
    .replace(/[‎‏‪-‮⁦-⁩]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^\.+/, "")
    .replace(/[. ]+$/, "");

  if (RESERVED_WINDOWS_NAMES.test(stripExtension(safe))) safe = `_${safe}`;

  if (safe.length > 120) {
    const extension = getExtension(safe);
    const keep = 120 - (extension ? extension.length + 1 : 0);
    safe = extension
      ? `${safe.slice(0, keep)}.${extension}`
      : safe.slice(0, 120);
  }

  return safe || fallback;
}

// Returns `name`, or "name (2).ext", "name (3).ext"... so that no two outputs
// share a filename. `used` is a Set that this function updates.
export function uniqueFilename(name, used) {
  const extensionLength = getExtension(name).length;
  // Keep the extension exactly as written (for example ".PNG").
  const extension = extensionLength ? name.slice(-extensionLength) : "";
  const base = extension ? name.slice(0, -(extension.length + 1)) : name;
  let candidate = name;
  let counter = 2;

  while (used.has(candidate.toLowerCase())) {
    candidate = extension
      ? `${base} (${counter}).${extension}`
      : `${base} (${counter})`;
    counter++;
  }

  used.add(candidate.toLowerCase());
  return candidate;
}

// ------------------------------------------------------------------
// Content sniffing (pure functions, tested in Node)
// ------------------------------------------------------------------

// Identifies PNG, JPEG and WebP by their magic bytes.
export function sniffImageType(bytes) {
  if (!bytes || bytes.length < 12) return null;

  const isPng =
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e &&
    bytes[3] === 0x47 && bytes[4] === 0x0d && bytes[5] === 0x0a &&
    bytes[6] === 0x1a && bytes[7] === 0x0a;
  if (isPng) return "image/png";

  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }

  const ascii = (start, length) =>
    String.fromCharCode(...bytes.subarray(start, start + length));
  if (ascii(0, 4) === "RIFF" && ascii(8, 4) === "WEBP") return "image/webp";

  return null;
}

// Reads width and height from the file header without decoding the image.
// Returns null when the header cannot be read; the caller then falls back to
// decoding. This lets us refuse enormous images before allocating memory.
export function readImageDimensions(bytes, mimeType) {
  try {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

    if (mimeType === "image/png") {
      if (bytes.length < 24) return null;
      return { width: view.getUint32(16), height: view.getUint32(20) };
    }

    if (mimeType === "image/webp") {
      if (bytes.length < 30) return null;
      const chunk = String.fromCharCode(...bytes.subarray(12, 16));
      if (chunk === "VP8X") {
        return {
          width: 1 + (bytes[24] | (bytes[25] << 8) | (bytes[26] << 16)),
          height: 1 + (bytes[27] | (bytes[28] << 8) | (bytes[29] << 16)),
        };
      }
      if (chunk === "VP8 ") {
        return {
          width: view.getUint16(26, true) & 0x3fff,
          height: view.getUint16(28, true) & 0x3fff,
        };
      }
      if (chunk === "VP8L" && bytes[20] === 0x2f) {
        const bits = view.getUint32(21, true);
        return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
      }
      return null;
    }

    if (mimeType === "image/jpeg") {
      let offset = 2;
      while (offset + 9 < bytes.length) {
        if (bytes[offset] !== 0xff) return null;
        const marker = bytes[offset + 1];
        if (marker === 0xff) { offset++; continue; }
        const isFrame =
          marker >= 0xc0 && marker <= 0xcf &&
          marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
        if (isFrame) {
          return {
            height: view.getUint16(offset + 5),
            width: view.getUint16(offset + 7),
          };
        }
        offset += 2 + view.getUint16(offset + 2);
      }
      return null;
    }
  } catch {
    return null;
  }

  return null;
}

// ------------------------------------------------------------------
// Validation
// ------------------------------------------------------------------

export const REJECTION_LABELS = {
  empty: "empty file",
  "too-large": "larger than 50 MB",
  "unsupported-type": "unsupported file type",
  "extension-mismatch": "file extension does not match its type",
  "content-mismatch": "file contents are not a valid PNG, JPEG or WebP image",
  "too-many-pixels": "image is larger than 100 megapixels",
  corrupt: "image could not be decoded",
};

// Checks size, MIME type, extension, file signature, declared dimensions and
// finally that the browser can really decode the image.
// Returns { ok: true, width, height } or { ok: false, code, reason }.
export async function validateImageFile(file) {
  const fail = (code) => ({ ok: false, code, reason: REJECTION_LABELS[code] });

  if (!file || typeof file.size !== "number") return fail("corrupt");
  if (file.size === 0) return fail("empty");
  if (file.size > MAX_FILE_BYTES) return fail("too-large");
  if (!SUPPORTED_MIME_TYPES.has(file.type)) return fail("unsupported-type");

  if (!ALLOWED_EXTENSIONS[file.type].includes(getExtension(file.name))) {
    return fail("extension-mismatch");
  }

  let header;
  try {
    header = new Uint8Array(await file.slice(0, 256 * 1024).arrayBuffer());
  } catch {
    return fail("corrupt");
  }

  if (sniffImageType(header) !== file.type) return fail("content-mismatch");

  const declared = readImageDimensions(header, file.type);
  if (declared && declared.width * declared.height > MAX_INPUT_PIXELS) {
    return fail("too-many-pixels");
  }

  try {
    const bitmap = await createImageBitmap(file);
    const { width, height } = bitmap;
    bitmap.close();
    if (width * height > MAX_INPUT_PIXELS) return fail("too-many-pixels");
    return { ok: true, width, height };
  } catch {
    return fail("corrupt");
  }
}

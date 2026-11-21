// Downloads and ZIP creation. Everything happens in the browser.

import { getPlatform } from "./platform.js";
import { showToast } from "./toast.js";

// Browser download: an <a download> link pointing at an object URL.
function downloadInBrowser(blob, filename) {
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = filename;

  document.body.appendChild(link);
  link.click();
  link.remove();

  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

async function blobToBase64(blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  const chunk = 0x8000;
  for (let index = 0; index < bytes.length; index += chunk) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunk));
  }
  return btoa(binary);
}

// Desktop app (Tauri): native "Save as" dialog, then write the file.
// Returns true when saved, false when the person cancelled the dialog.
export async function saveWithDesktopDialog(blob, filename, tauri = globalThis.__TAURI__) {
  if (!tauri?.dialog?.save || !tauri?.fs?.writeFile) {
    throw new Error("Saving files is not available in this app build.");
  }

  const extension = /\.([^.]+)$/.exec(filename)?.[1];
  const path = await tauri.dialog.save({
    defaultPath: filename,
    filters: extension ? [{ name: extension.toUpperCase(), extensions: [extension] }] : undefined,
  });

  if (!path) return false;

  await tauri.fs.writeFile(path, new Uint8Array(await blob.arrayBuffer()));
  return true;
}

// Android app (Capacitor): write a temporary file, then open the system share
// sheet (Save to Files, Drive, Messages...).
//
// Share.share() resolves when the sheet opens, not when the receiving app has
// finished reading the file, so the temporary copy is NOT deleted right away.
// It is removed before the next share and after TEMP_FILE_LIFETIME_MS
// (Android may also clear the app cache sooner).
// `plugins` can be passed in for testing; otherwise the plugins are loaded
// only here, so the web build never runs them.
export const TEMP_FILE_LIFETIME_MS = 10 * 60 * 1000;
const SHARE_DIRECTORY = "fileforge-share";

export async function saveWithAndroidShare(blob, filename, plugins = null) {
  const { Filesystem, Directory, Share } = plugins || {
    ...(await import("@capacitor/filesystem")),
    ...(await import("@capacitor/share")),
  };

  const removeSharedFiles = () =>
    Filesystem.rmdir({ path: SHARE_DIRECTORY, directory: Directory.Cache, recursive: true }).catch(() => {});

  await removeSharedFiles(); // clear copies left by earlier shares

  const written = await Filesystem.writeFile({
    path: `${SHARE_DIRECTORY}/${filename}`,
    data: await blobToBase64(blob),
    directory: Directory.Cache,
    recursive: true,
  });
  const cleanupTimer = setTimeout(removeSharedFiles, TEMP_FILE_LIFETIME_MS);
  cleanupTimer?.unref?.(); // Node only (tests); browsers return a number

  try {
    await Share.share({ title: filename, dialogTitle: `Save ${filename}`, url: written.uri });
  } catch (error) {
    // Closing the share sheet rejects on some Android versions. That is not an error.
    if (!/cancel/i.test(String(error?.message || error))) throw error;
  }
  return true;
}

// Saves a file the right way for the platform. Never throws: failures are
// reported with a toast and the returned promise resolves to false.
export async function downloadBlob(blob, filename, platform = getPlatform()) {
  try {
    if (platform === "desktop") return await saveWithDesktopDialog(blob, filename);
    if (platform === "android") return await saveWithAndroidShare(blob, filename);
    downloadInBrowser(blob, filename);
    return true;
  } catch (error) {
    console.error(`Could not save ${filename}:`, error);
    showToast(`Could not save ${filename}. ${error?.message || ""}`.trim());
    return false;
  }
}

// CRC-32 lookup table, built once.
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index++) {
    let value = index;
    for (let bit = 0; bit < 8; bit++) {
      value = value & 1 ? (value >>> 1) ^ 0xedb88320 : value >>> 1;
    }
    table[index] = value >>> 0;
  }
  return table;
})();

export function crc32(bytes) {
  let crc = 0xffffffff;
  for (let index = 0; index < bytes.length; index++) {
    crc = CRC_TABLE[(crc ^ bytes[index]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function toDosDateTime(date) {
  const year = Math.max(1980, date.getFullYear());
  return {
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1),
    date: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
  };
}

// Builds a standard (stored, uncompressed) ZIP archive.
// `results` is a list of { name, blob }. Names must already be unique.
export async function createZipArchive(results) {
  const encoder = new TextEncoder();
  const stamp = toDosDateTime(new Date());
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  for (const result of results) {
    const name = encoder.encode(result.name);
    const data = new Uint8Array(await result.blob.arrayBuffer());

    if (data.byteLength > 0xffffffff || offset > 0xffffffff) {
      throw new Error("This batch is too large for a standard ZIP archive.");
    }

    const checksum = crc32(data);

    const local = new Uint8Array(30 + name.length);
    const localView = new DataView(local.buffer);
    localView.setUint32(0, 0x04034b50, true);
    localView.setUint16(4, 20, true);
    localView.setUint16(6, 0x0800, true); // UTF-8 filenames
    localView.setUint16(10, stamp.time, true);
    localView.setUint16(12, stamp.date, true);
    localView.setUint32(14, checksum, true);
    localView.setUint32(18, data.byteLength, true);
    localView.setUint32(22, data.byteLength, true);
    localView.setUint16(26, name.length, true);
    local.set(name, 30);
    // The Blob itself is kept (not the copied bytes) so memory can be freed.
    localParts.push(local, result.blob);

    const central = new Uint8Array(46 + name.length);
    const centralView = new DataView(central.buffer);
    centralView.setUint32(0, 0x02014b50, true);
    centralView.setUint16(4, 20, true);
    centralView.setUint16(6, 20, true);
    centralView.setUint16(8, 0x0800, true);
    centralView.setUint16(12, stamp.time, true);
    centralView.setUint16(14, stamp.date, true);
    centralView.setUint32(16, checksum, true);
    centralView.setUint32(20, data.byteLength, true);
    centralView.setUint32(24, data.byteLength, true);
    centralView.setUint16(28, name.length, true);
    centralView.setUint32(42, offset, true);
    central.set(name, 46);
    centralParts.push(central);

    offset += local.byteLength + data.byteLength;
  }

  const centralSize = centralParts.reduce((total, part) => total + part.length, 0);
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(8, results.length, true);
  endView.setUint16(10, results.length, true);
  endView.setUint32(12, centralSize, true);
  endView.setUint32(16, offset, true);

  return new Blob([...localParts, ...centralParts, end], { type: "application/zip" });
}

import { test } from "node:test";
import assert from "node:assert/strict";
import { getPlatform, isNativeApp } from "../src/lib/platform.js";
import { downloadBlob, saveWithDesktopDialog, saveWithAndroidShare } from "../src/lib/download.js";

test("platform detection", () => {
  assert.equal(getPlatform({}), "web");
  assert.equal(getPlatform({ __TAURI__: {} }), "desktop");
  assert.equal(getPlatform({ __TAURI_INTERNALS__: {} }), "desktop");
  assert.equal(getPlatform({ Capacitor: { isNativePlatform: () => true } }), "android");
  assert.equal(getPlatform({ Capacitor: { isNativePlatform: () => false } }), "web", "Capacitor object in a normal browser is still web");
  assert.equal(isNativeApp({ __TAURI__: {} }), true);
  assert.equal(isNativeApp({}), false);
});

test("desktop: opens a save dialog and writes the chosen file", async () => {
  const calls = [];
  const tauri = {
    dialog: { save: async (options) => { calls.push(["save", options]); return "/home/me/photo-resized.jpg"; } },
    fs: { writeFile: async (path, bytes) => { calls.push(["write", path, [...bytes]]); } },
  };
  const saved = await saveWithDesktopDialog(new Blob([new Uint8Array([1, 2, 3])]), "photo-resized.jpg", tauri);
  assert.equal(saved, true);
  assert.equal(calls[0][1].defaultPath, "photo-resized.jpg");
  assert.deepEqual(calls[0][1].filters, [{ name: "JPG", extensions: ["jpg"] }]);
  assert.deepEqual(calls[1], ["write", "/home/me/photo-resized.jpg", [1, 2, 3]]);
});

test("desktop: cancelling the dialog writes nothing", async () => {
  let wrote = false;
  const tauri = { dialog: { save: async () => null }, fs: { writeFile: async () => { wrote = true; } } };
  assert.equal(await saveWithDesktopDialog(new Blob(["x"]), "a.png", tauri), false);
  assert.equal(wrote, false);
});

test("desktop: a missing plugin gives a clear error", async () => {
  await assert.rejects(() => saveWithDesktopDialog(new Blob(["x"]), "a.png", {}), /not available/);
});

test("android: writes to cache, shares the file, and clears older shares", async () => {
  const calls = [];
  const plugins = {
    Directory: { Cache: "CACHE" },
    Filesystem: {
      rmdir: async (o) => { calls.push(["rmdir", o.path, o.directory]); },
      writeFile: async (o) => { calls.push(["write", o.path, o.directory, o.data]); return { uri: "file:///cache/" + o.path }; },
    },
    Share: { share: async (o) => { calls.push(["share", o.url]); } },
  };
  assert.equal(await saveWithAndroidShare(new Blob([new Uint8Array([104, 105])]), "out.zip", plugins), true);
  assert.deepEqual(calls[0], ["rmdir", "fileforge-share", "CACHE"]);
  assert.deepEqual(calls[1], ["write", "fileforge-share/out.zip", "CACHE", "aGk="]);
  assert.deepEqual(calls[2], ["share", "file:///cache/fileforge-share/out.zip"]);
});

test("android: dismissing the share sheet is not an error, other failures are", async () => {
  const base = { Directory: { Cache: "C" }, Filesystem: { rmdir: async () => {}, writeFile: async () => ({ uri: "u" }) } };
  const dismissed = { ...base, Share: { share: async () => { throw new Error("Share canceled"); } } };
  assert.equal(await saveWithAndroidShare(new Blob(["x"]), "a.png", dismissed), true);
  const broken = { ...base, Share: { share: async () => { throw new Error("No app can handle this"); } } };
  await assert.rejects(() => saveWithAndroidShare(new Blob(["x"]), "a.png", broken), /No app/);
});

test("downloadBlob never throws: it resolves false when saving fails", async () => {
  globalThis.document = { querySelector: () => null };
  const originalError = console.error; console.error = () => {};
  try {
    assert.equal(await downloadBlob(new Blob(["x"]), "a.png", "desktop"), false); // no Tauri plugins in Node
  } finally {
    console.error = originalError; delete globalThis.document;
  }
});

import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_APP_SETTINGS,
  SETTINGS_KEY,
  sanitizeSettings,
  loadSettings,
  getSettings,
  updateSettings,
  resetSettings,
  onSettingsChange,
  withUserDefaults,
} from "../src/lib/settings.js";
import { DEFAULT_SETTINGS } from "../src/lib/operations.js";

function fakeStorage(initial = {}) {
  const data = { ...initial };
  return {
    data,
    getItem: (key) => (key in data ? data[key] : null),
    setItem: (key, value) => {
      data[key] = String(value);
    },
    removeItem: (key) => {
      delete data[key];
    },
  };
}

test("sanitizeSettings fills defaults and rejects invalid values", () => {
  assert.deepEqual(sanitizeSettings(null), DEFAULT_APP_SETTINGS);
  assert.deepEqual(sanitizeSettings("nonsense"), DEFAULT_APP_SETTINGS);
  const result = sanitizeSettings({
    outputFormat: "image/gif",
    quality: 5,
    resizeWidth: 0,
    resizeHeight: 99999,
    keepAspect: "yes",
    viewMode: "table",
    saveHistory: 1,
  });
  assert.deepEqual(result, DEFAULT_APP_SETTINGS);
});

test("sanitizeSettings keeps valid values", () => {
  const input = { outputFormat: "image/webp", quality: 60, resizeWidth: 800, resizeHeight: 600, keepAspect: false, viewMode: "grid", saveHistory: false };
  assert.deepEqual(sanitizeSettings(input), input);
});

test("loadSettings survives corrupted storage", () => {
  const storage = fakeStorage({ [SETTINGS_KEY]: "{not json" });
  assert.deepEqual(loadSettings(storage), DEFAULT_APP_SETTINGS);
});

test("updateSettings validates, saves, and notifies", () => {
  const storage = fakeStorage();
  loadSettings(storage);
  const seen = [];
  const stop = onSettingsChange((settings) => seen.push(settings.quality));

  assert.equal(updateSettings({ quality: 70 }, storage), true);
  assert.equal(getSettings().quality, 70);
  assert.equal(JSON.parse(storage.data[SETTINGS_KEY]).quality, 70);

  updateSettings({ quality: 1000 }, storage); // invalid: falls back to default
  assert.equal(getSettings().quality, null);
  assert.deepEqual(seen, [70, null]);
  stop();
});

test("updateSettings still applies when storage fails", () => {
  const storage = { getItem: () => null, setItem: () => { throw new Error("full"); } };
  loadSettings(storage);
  assert.equal(updateSettings({ viewMode: "grid" }, storage), false);
  assert.equal(getSettings().viewMode, "grid");
});

test("resetSettings removes saved settings", () => {
  const storage = fakeStorage();
  loadSettings(storage);
  updateSettings({ keepAspect: false }, storage);
  resetSettings(storage);
  assert.equal(SETTINGS_KEY in storage.data, false);
  assert.deepEqual(getSettings(), DEFAULT_APP_SETTINGS);
});

test("withUserDefaults leaves tool defaults alone until a preference is chosen", () => {
  const merged = withUserDefaults(DEFAULT_SETTINGS, sanitizeSettings(null));
  assert.deepEqual(merged, DEFAULT_SETTINGS);
  assert.notEqual(merged, DEFAULT_SETTINGS); // a copy
});

test("withUserDefaults applies chosen preferences", () => {
  const merged = withUserDefaults(
    DEFAULT_SETTINGS,
    sanitizeSettings({ outputFormat: "image/jpeg", quality: 50, resizeWidth: 640, resizeHeight: 480, keepAspect: false })
  );
  assert.equal(merged.convert.format, "image/jpeg");
  assert.equal(merged.compress.format, "image/jpeg");
  assert.equal(merged.convert.quality, 50);
  assert.equal(merged.compress.quality, 50);
  assert.deepEqual(merged.resize, { width: 640, height: 480, keepAspect: false });
  assert.equal(DEFAULT_SETTINGS.resize.width, 1200); // original untouched
});

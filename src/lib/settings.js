// User preferences, saved in this browser's local storage under one key.
// (The theme keeps its own existing key, "fileforge-theme", so nothing already
// saved is lost.) Only settings the processing code really uses are listed.
//
// A null output format or quality means "use each tool's own default", which
// keeps today's behaviour until the person chooses something.

import { MAX_OUTPUT_DIMENSION } from "./files.js";

export const SETTINGS_KEY = "fileforge-settings";
export const OUTPUT_FORMATS = ["image/png", "image/jpeg", "image/webp"];
export const VIEW_CHOICES = ["list", "grid"];

export const DEFAULT_APP_SETTINGS = Object.freeze({
  outputFormat: null,
  quality: null,
  resizeWidth: 1200,
  resizeHeight: 1200,
  keepAspect: true,
  viewMode: "list",
  saveHistory: true,
});

function wholeNumber(value, min, max, fallback) {
  return Number.isInteger(value) && value >= min && value <= max ? value : fallback;
}

// Turns anything (including corrupted storage) into a complete, valid object.
export function sanitizeSettings(raw) {
  const source = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  const defaults = DEFAULT_APP_SETTINGS;
  return {
    outputFormat: OUTPUT_FORMATS.includes(source.outputFormat) ? source.outputFormat : defaults.outputFormat,
    quality: wholeNumber(source.quality, 10, 100, defaults.quality),
    resizeWidth: wholeNumber(source.resizeWidth, 1, MAX_OUTPUT_DIMENSION, defaults.resizeWidth),
    resizeHeight: wholeNumber(source.resizeHeight, 1, MAX_OUTPUT_DIMENSION, defaults.resizeHeight),
    keepAspect: typeof source.keepAspect === "boolean" ? source.keepAspect : defaults.keepAspect,
    viewMode: VIEW_CHOICES.includes(source.viewMode) ? source.viewMode : defaults.viewMode,
    saveHistory: typeof source.saveHistory === "boolean" ? source.saveHistory : defaults.saveHistory,
  };
}

function localStore() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

let current = null;
const listeners = new Set();

export function loadSettings(storage = localStore()) {
  let raw = null;
  try {
    raw = JSON.parse(storage?.getItem(SETTINGS_KEY) ?? "null");
  } catch {
    raw = null;
  }
  current = sanitizeSettings(raw);
  return current;
}

export function getSettings() {
  return current ?? loadSettings();
}

// Validates, saves, and tells listeners. Returns false if storage failed (the
// change still applies for this session).
export function updateSettings(changes, storage = localStore()) {
  current = sanitizeSettings({ ...getSettings(), ...changes });
  let saved = true;
  try {
    storage?.setItem(SETTINGS_KEY, JSON.stringify(current));
  } catch {
    saved = false;
  }
  listeners.forEach((listener) => listener(current));
  return saved;
}

export function resetSettings(storage = localStore()) {
  try {
    storage?.removeItem(SETTINGS_KEY);
  } catch {
    // Nothing stored or storage unavailable: defaults still apply.
  }
  current = sanitizeSettings(null);
  listeners.forEach((listener) => listener(current));
  return current;
}

export function onSettingsChange(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// Applies the saved preferences on top of a copy of the batch defaults.
export function withUserDefaults(defaults, settings = getSettings()) {
  const merged = structuredClone(defaults);
  merged.resize.width = settings.resizeWidth;
  merged.resize.height = settings.resizeHeight;
  merged.resize.keepAspect = settings.keepAspect;
  if (settings.outputFormat) {
    merged.convert.format = settings.outputFormat;
    merged.compress.format = settings.outputFormat;
  }
  if (settings.quality !== null) {
    merged.convert.quality = settings.quality;
    merged.compress.quality = settings.quality;
  }
  return merged;
}

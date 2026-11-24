// The chosen file-list view ("list" or "grid"), remembered for this browser
// session only. Storage can be unavailable, so every access is guarded.

import { getSettings } from "./settings.js";

export const VIEW_MODES = ["list", "grid"];
export const DEFAULT_VIEW_MODE = "list";
const KEY = "fileforge-file-view";

function sessionStore() {
  try {
    return globalThis.sessionStorage ?? null;
  } catch {
    return null;
  }
}

export function getViewMode(storage = sessionStore()) {
  try {
    const value = storage?.getItem(KEY);
    return VIEW_MODES.includes(value) ? value : getSettings().viewMode;
  } catch {
    return DEFAULT_VIEW_MODE;
  }
}

export function setViewMode(mode, storage = sessionStore()) {
  if (!VIEW_MODES.includes(mode)) return false;
  try {
    storage?.setItem(KEY, mode);
    return true;
  } catch {
    return false;
  }
}

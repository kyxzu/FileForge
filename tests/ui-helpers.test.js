import { test } from "node:test";
import assert from "node:assert/strict";
import { getViewMode, setViewMode, DEFAULT_VIEW_MODE } from "../src/lib/viewMode.js";
import { formatAddedTime, formatLabel } from "../src/lib/format.js";

function fakeStorage(initial = {}) {
  const data = { ...initial };
  return {
    getItem: (key) => (key in data ? data[key] : null),
    setItem: (key, value) => { data[key] = String(value); },
  };
}

test("view mode defaults to list and remembers a valid choice", () => {
  const storage = fakeStorage();
  assert.equal(getViewMode(storage), DEFAULT_VIEW_MODE);
  assert.equal(setViewMode("grid", storage), true);
  assert.equal(getViewMode(storage), "grid");
});

test("view mode ignores invalid values", () => {
  const storage = fakeStorage({ "fileforge-file-view": "carousel" });
  assert.equal(getViewMode(storage), "list");
  assert.equal(setViewMode("carousel", storage), false);
});

test("view mode survives unavailable or throwing storage", () => {
  const broken = { getItem() { throw new Error("blocked"); }, setItem() { throw new Error("blocked"); } };
  assert.equal(getViewMode(broken), "list");
  assert.equal(setViewMode("grid", broken), false);
  assert.equal(getViewMode(null), "list");
});

test("formatAddedTime handles today, earlier days, and bad input", () => {
  const now = new Date(2026, 10, 21, 15, 0).getTime();
  const today = formatAddedTime(new Date(2026, 10, 21, 9, 5).getTime(), now);
  const earlier = formatAddedTime(new Date(2026, 10, 19, 9, 5).getTime(), now);
  assert.match(today, /\d/);
  assert.ok(!/Nov/.test(today));
  assert.match(earlier, /Nov/);
  assert.equal(formatAddedTime(NaN, now), "");
});

test("formatLabel names the supported image types", () => {
  assert.equal(formatLabel("image/png"), "PNG");
  assert.equal(formatLabel("image/webp"), "WebP");
  assert.equal(formatLabel(""), "Unknown");
});

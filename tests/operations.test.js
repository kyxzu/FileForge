import { test } from "node:test";
import assert from "node:assert/strict";
import { validateSettings, describeSettings } from "../src/lib/operations.js";

test("resize settings are validated", () => {
  assert.equal(validateSettings("resize", { width: 800, height: 600, keepAspect: true }), "");
  assert.notEqual(validateSettings("resize", { width: 0, height: 600 }), "");
  assert.notEqual(validateSettings("resize", { width: 800, height: 12001 }), "");
  assert.notEqual(validateSettings("resize", { width: NaN, height: 600 }), "");
  assert.notEqual(validateSettings("resize", { width: 10.5, height: 600 }), "");
});

test("compress settings are validated", () => {
  assert.equal(validateSettings("compress", { format: "original", quality: 75, targetKB: null }), "");
  assert.equal(validateSettings("compress", { format: "image/webp", quality: 50, targetKB: 200 }), "");
  assert.notEqual(validateSettings("compress", { format: "image/gif", quality: 75 }), "");
  assert.notEqual(validateSettings("compress", { format: "original", quality: 5 }), "");
  assert.notEqual(validateSettings("compress", { format: "original", quality: 75, targetKB: 0 }), "");
});

test("convert settings are validated", () => {
  assert.equal(validateSettings("convert", { format: "image/jpeg", quality: 85 }), "");
  assert.notEqual(validateSettings("convert", { format: "original", quality: 85 }), "");
  assert.notEqual(validateSettings("nonsense", {}), "");
});

test("describeSettings produces readable lines", () => {
  assert.deepEqual(describeSettings("resize", { width: 800, height: 600, keepAspect: true })[0], ["Size", "Fit within 800 × 600 px"]);
});

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  sanitizeFilename, uniqueFilename, sniffImageType, readImageDimensions, getExtension,
} from "../src/lib/files.js";

test("sanitizeFilename removes path separators and forbidden characters", () => {
  assert.equal(sanitizeFilename("../../etc/passwd"), "_.._etc_passwd");
  assert.equal(sanitizeFilename('a<b>c:"d"|e?*.png'), "a_b_c__d__e__.png");
  assert.equal(sanitizeFilename("C:\\Users\\me\\pic.jpg"), "C__Users_me_pic.jpg");
});

test("sanitizeFilename handles hidden, reserved, empty and very long names", () => {
  assert.equal(sanitizeFilename(".hidden.png"), "hidden.png");
  assert.equal(sanitizeFilename("CON.png"), "_CON.png");
  assert.equal(sanitizeFilename("   ..  "), "file");
  assert.equal(sanitizeFilename("", "image"), "image");
  const long = sanitizeFilename("x".repeat(500) + ".png");
  assert.ok(long.length <= 120 && long.endsWith(".png"));
});

test("sanitizeFilename strips bidirectional override characters", () => {
  assert.equal(sanitizeFilename("photo\u202Egpj.exe"), "photogpj.exe");
});

test("sanitizeFilename keeps markup as harmless text", () => {
  assert.equal(sanitizeFilename('<img src=x onerror=alert(1)>.png'), "_img src=x onerror=alert(1)_.png");
});

test("uniqueFilename avoids collisions case-insensitively", () => {
  const used = new Set();
  assert.equal(uniqueFilename("photo.png", used), "photo.png");
  assert.equal(uniqueFilename("Photo.PNG", used), "Photo (2).PNG");
  assert.equal(uniqueFilename("photo.png", used), "photo (3).png");
});

test("getExtension is lowercase and handles missing extensions", () => {
  assert.equal(getExtension("A.JPG"), "jpg");
  assert.equal(getExtension("noext"), "");
});

const png = (w, h) => {
  const b = new Uint8Array(32);
  b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const v = new DataView(b.buffer);
  v.setUint32(16, w); v.setUint32(20, h);
  return b;
};

test("sniffImageType recognises PNG, JPEG and WebP and rejects others", () => {
  assert.equal(sniffImageType(png(1, 1)), "image/png");
  assert.equal(sniffImageType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0])), "image/jpeg");
  const webp = new Uint8Array(32);
  webp.set([..."RIFF"].map((c) => c.charCodeAt(0)), 0);
  webp.set([..."WEBP"].map((c) => c.charCodeAt(0)), 8);
  assert.equal(sniffImageType(webp), "image/webp");
  assert.equal(sniffImageType(new TextEncoder().encode("<svg xmlns='http://www.w3.org/2000/svg'/>")), null);
  assert.equal(sniffImageType(new Uint8Array(4)), null);
});

test("readImageDimensions reads PNG, JPEG and WebP headers", () => {
  assert.deepEqual(readImageDimensions(png(640, 480), "image/png"), { width: 640, height: 480 });

  const jpeg = new Uint8Array(40);
  jpeg.set([0xff, 0xd8, 0xff, 0xc0, 0x00, 0x11, 0x08], 0);
  const jv = new DataView(jpeg.buffer);
  jv.setUint16(7, 300); jv.setUint16(9, 500); // height, width
  // SOF marker is at offset 2 in a real file; place it there.
  const real = new Uint8Array(40);
  real.set([0xff, 0xd8, 0xff, 0xc0, 0x00, 0x11, 0x08, 0x01, 0x2c, 0x01, 0xf4], 0);
  assert.deepEqual(readImageDimensions(real, "image/jpeg"), { width: 500, height: 300 });

  const webp = new Uint8Array(40);
  webp.set([..."RIFF"].map((c) => c.charCodeAt(0)), 0);
  webp.set([..."WEBP"].map((c) => c.charCodeAt(0)), 8);
  webp.set([..."VP8X"].map((c) => c.charCodeAt(0)), 12);
  webp.set([199, 0, 0, 99, 0, 0], 24); // width-1 = 199, height-1 = 99
  assert.deepEqual(readImageDimensions(webp, "image/webp"), { width: 200, height: 100 });
});

test("readImageDimensions returns null for truncated data", () => {
  assert.equal(readImageDimensions(new Uint8Array(4), "image/png"), null);
});

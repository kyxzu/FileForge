import { test } from "node:test";
import assert from "node:assert/strict";
import { crc32, createZipArchive } from "../src/lib/download.js";

test("crc32 matches the standard check value", () => {
  assert.equal(crc32(new TextEncoder().encode("123456789")), 0xcbf43926);
  assert.equal(crc32(new Uint8Array(0)), 0);
});

test("createZipArchive writes a readable archive", async () => {
  const files = [
    { name: "a.txt", blob: new Blob(["hello"]) },
    { name: "b (2).txt", blob: new Blob(["world!"]) },
  ];
  const zip = new Uint8Array(await (await createZipArchive(files)).arrayBuffer());
  const view = new DataView(zip.buffer);

  // End of central directory record is the last 22 bytes.
  const end = zip.length - 22;
  assert.equal(view.getUint32(end, true), 0x06054b50);
  assert.equal(view.getUint16(end + 10, true), 2);

  // Walk the central directory.
  let offset = view.getUint32(end + 16, true);
  const names = [];
  for (let i = 0; i < 2; i++) {
    assert.equal(view.getUint32(offset, true), 0x02014b50);
    const nameLength = view.getUint16(offset + 28, true);
    const localOffset = view.getUint32(offset + 42, true);
    names.push(new TextDecoder().decode(zip.subarray(offset + 46, offset + 46 + nameLength)));
    assert.equal(view.getUint32(localOffset, true), 0x04034b50);
    offset += 46 + nameLength;
  }
  assert.deepEqual(names, ["a.txt", "b (2).txt"]);
});

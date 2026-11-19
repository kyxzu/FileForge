import { test } from "node:test";
import assert from "node:assert/strict";
import {
  addRecords, getAllRecords, deleteRecord, clearHistory, getStorageMode,
  computeStats, createHistoryRecord,
} from "../src/lib/history.js";

const file = (name, size, type = "image/png") => ({ name, size, type });
const done = (op, runId, from, to) =>
  createHistoryRecord({
    runId, source: "batch", operation: op, status: "completed", file: file("a.png", from),
    settings: { width: 10 }, result: { blob: { size: to }, name: "a-out.png", width: 5, height: 5, outputFormat: "image/png", details: {} },
  });

test("falls back to memory storage when IndexedDB is unavailable (Node)", async () => {
  assert.equal(await getStorageMode(), "memory");
});

test("add, read, delete and clear records", async () => {
  await clearHistory();
  const a = done("resize", "r1", 1000, 400);
  const b = done("compress", "r2", 2000, 500);
  await addRecords([a, b]);
  assert.equal((await getAllRecords()).length, 2);
  await deleteRecord(a.id);
  assert.deepEqual((await getAllRecords()).map((r) => r.id), [b.id]);
  await clearHistory();
  assert.equal((await getAllRecords()).length, 0);
});

test("records never contain file data and store plain values only", () => {
  const record = done("convert", "r1", 100, 50);
  const json = JSON.stringify(record);
  assert.ok(!json.includes("blob"));
  assert.equal(record.outputSize, 50);
});

test("failed and cancelled records carry no output information", () => {
  const failed = createHistoryRecord({ runId: "r", source: "tool", operation: "resize", status: "failed", file: file("x.png", 10), settings: {}, errorMessage: "boom" });
  assert.equal(failed.outputSize, null);
  assert.equal(failed.errorMessage, "boom");
  const cancelled = createHistoryRecord({ runId: "r", source: "batch", operation: "resize", status: "cancelled", file: file("x.png", 10), settings: {} });
  assert.equal(cancelled.outputSize, null);
});

test("computeStats counts only completed records", () => {
  const records = [
    done("compress", "run-1", 1000, 400),
    done("compress", "run-1", 2000, 1000),
    done("resize", "run-2", 3000, 3500),
    createHistoryRecord({ runId: "run-3", source: "batch", operation: "convert", status: "failed", file: file("f.png", 999), settings: {}, errorMessage: "x" }),
    createHistoryRecord({ runId: "run-3", source: "batch", operation: "convert", status: "cancelled", file: file("g.png", 999), settings: {} }),
  ];
  const stats = computeStats(records);
  assert.equal(stats.filesProcessed, 3);
  assert.equal(stats.operationsCompleted, 2);
  assert.equal(stats.spaceSavedBytes, 600 + 1000 - 500);
  assert.deepEqual(stats.mostUsed.length, 2); // one run each: a tie
  assert.equal(stats.failed, 1);
  assert.equal(stats.cancelled, 1);
});

test("computeStats picks the most used operation by completed runs", () => {
  const stats = computeStats([
    done("resize", "a", 10, 5), done("resize", "b", 10, 5), done("compress", "c", 10, 5),
  ]);
  assert.deepEqual(stats.mostUsed, ["resize"]);
  assert.equal(stats.mostUsedCount, 2);
});

test("computeStats has no data when nothing completed", () => {
  const stats = computeStats([
    createHistoryRecord({ runId: "r", source: "batch", operation: "resize", status: "failed", file: file("x.png", 1), settings: {}, errorMessage: "e" }),
  ]);
  assert.equal(stats.hasData, false);
  assert.equal(stats.spaceSavedBytes, 0);
});

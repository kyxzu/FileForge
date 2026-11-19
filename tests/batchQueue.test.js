import { test } from "node:test";
import assert from "node:assert/strict";
import { createBatchRunner, summarizeItems, STATUS } from "../src/lib/batchQueue.js";

const makeItems = (count) =>
  Array.from({ length: count }, (_, i) => ({
    id: String(i), file: { name: `f${i}.png`, size: 1000 }, status: STATUS.WAITING, error: "", result: null,
  }));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const okResult = (size = 400) => ({ blob: { size }, name: "x.png" });

test("never exceeds the concurrency limit", async () => {
  const items = makeItems(8);
  let active = 0, peak = 0;
  const runner = createBatchRunner({
    items, concurrency: 2,
    processItem: async () => { active++; peak = Math.max(peak, active); await wait(5); active--; return okResult(); },
  });
  const summary = await runner.run();
  assert.equal(peak, 2);
  assert.equal(summary.completed, 8);
});

test("one failure does not stop the others", async () => {
  const items = makeItems(5);
  const runner = createBatchRunner({
    items, concurrency: 2,
    processItem: async (item) => { if (item.id === "2") throw new Error("bad file"); return okResult(); },
  });
  const summary = await runner.run();
  assert.equal(summary.completed, 4);
  assert.equal(summary.failed, 1);
  assert.equal(items[2].status, STATUS.FAILED);
  assert.equal(items[2].error, "bad file");
});

test("cancel marks waiting and in-flight items as cancelled and discards results", async () => {
  const items = makeItems(6);
  let runner;
  runner = createBatchRunner({
    items, concurrency: 2,
    processItem: async (item) => { if (item.id === "1") runner.cancel(); await wait(5); return okResult(); },
  });
  const summary = await runner.run();
  assert.equal(summary.waiting, 0);
  assert.equal(summary.processing, 0);
  assert.ok(summary.cancelled >= 4);
  assert.equal(items.filter((i) => i.status === STATUS.CANCELLED && i.result).length, 0);
  assert.equal(summary.completed + summary.failed + summary.cancelled, 6);
});

test("items that are not waiting are never processed twice", async () => {
  const items = makeItems(3);
  items[0].status = STATUS.COMPLETED;
  items[0].result = okResult();
  let calls = 0;
  const runner = createBatchRunner({ items, processItem: async () => { calls++; return okResult(); } });
  await runner.run();
  assert.equal(calls, 2);
});

test("run cannot be started twice at once", async () => {
  const runner = createBatchRunner({ items: makeItems(2), processItem: async () => { await wait(10); return okResult(); } });
  const first = runner.run();
  await assert.rejects(() => runner.run(), /already running/);
  await first;
});

test("summarizeItems reports real sizes for completed items only", () => {
  const items = makeItems(3);
  items[0].status = STATUS.COMPLETED; items[0].result = okResult(300);
  items[1].status = STATUS.FAILED;
  items[2].status = STATUS.CANCELLED;
  const s = summarizeItems(items);
  assert.deepEqual([s.completed, s.failed, s.cancelled, s.remaining, s.finished], [1, 1, 1, 0, 3]);
  assert.equal(s.originalBytes, 1000);
  assert.equal(s.outputBytes, 300);
  assert.equal(s.savedBytes, 700);
});

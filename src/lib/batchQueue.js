// Batch queue engine: runs items through `processItem` with controlled
// concurrency. It has no DOM code, so it is easy to test.
//
// An item looks like { id, file, status, error, result }.
// Progress is derived from the real status of every item.

export const STATUS = {
  WAITING: "waiting",
  PROCESSING: "processing",
  COMPLETED: "completed",
  FAILED: "failed",
  CANCELLED: "cancelled",
};

export const STATUS_LABELS = {
  waiting: "Waiting",
  processing: "Processing",
  completed: "Completed",
  failed: "Failed",
  cancelled: "Cancelled",
};

const yieldToBrowser = () => new Promise((resolve) => setTimeout(resolve, 0));

export function summarizeItems(items) {
  const summary = {
    total: items.length,
    completed: 0,
    failed: 0,
    cancelled: 0,
    waiting: 0,
    processing: 0,
    originalBytes: 0,
    outputBytes: 0,
  };

  for (const item of items) {
    summary[item.status]++;
    if (item.status === STATUS.COMPLETED && item.result) {
      summary.originalBytes += item.file.size;
      summary.outputBytes += item.result.blob.size;
    }
  }

  summary.finished = summary.completed + summary.failed + summary.cancelled;
  summary.remaining = summary.waiting + summary.processing;
  summary.savedBytes = summary.originalBytes - summary.outputBytes;
  return summary;
}

// Keeps the browser responsive: at most `concurrency` files at a time.
export function createBatchRunner({ items, processItem, concurrency = 2, onChange = () => {} }) {
  let cancelled = false;
  let running = false;

  async function worker(queue) {
    while (!cancelled) {
      const item = queue.shift();
      if (!item) return;

      // Never process the same item twice.
      if (item.status !== STATUS.WAITING) continue;

      item.status = STATUS.PROCESSING;
      onChange(item);

      try {
        const result = await processItem(item);

        if (cancelled) {
          // The user cancelled while this file was running: discard the result.
          item.status = STATUS.CANCELLED;
          item.result = null;
        } else {
          item.status = STATUS.COMPLETED;
          item.result = result;
        }
      } catch (error) {
        item.result = null;
        if (cancelled) {
          item.status = STATUS.CANCELLED;
        } else {
          item.status = STATUS.FAILED;
          item.error = error?.message || "Processing failed.";
        }
      }

      onChange(item);
      await yieldToBrowser();
    }
  }

  async function run() {
    if (running) throw new Error("This batch is already running.");

    running = true;
    cancelled = false;

    try {
      const queue = items.filter((item) => item.status === STATUS.WAITING);
      const workers = Array.from(
        { length: Math.min(Math.max(1, concurrency), queue.length) },
        () => worker(queue)
      );
      await Promise.all(workers);

      if (cancelled) {
        for (const item of items) {
          if (item.status === STATUS.WAITING) {
            item.status = STATUS.CANCELLED;
            onChange(item);
          }
        }
      }
    } finally {
      running = false;
    }

    return summarizeItems(items);
  }

  return {
    run,
    cancel() {
      cancelled = true;
    },
    isRunning: () => running,
    wasCancelled: () => cancelled,
  };
}

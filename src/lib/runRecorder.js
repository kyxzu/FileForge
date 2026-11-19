// Lets the single-tool dialogs (Converter, Compressor, Resizer) write to the
// same processing history as the batch system.
//
//   const run = startToolRun("convert", { format: "image/webp", quality: 85 });
//   run.success(file, result);   // or run.failure(file, error);

import { createHistoryRecord, saveHistoryRecords, newId } from "./history.js";

export function startToolRun(operation, settings) {
  const runId = newId();

  return {
    runId,

    success(file, result) {
      saveHistoryRecords([
        createHistoryRecord({
          runId,
          source: "tool",
          operation,
          status: "completed",
          file,
          settings,
          result: {
            blob: result.blob,
            name: result.name,
            width: result.width,
            height: result.height,
            outputFormat: result.blob.type,
            details:
              typeof result.qualityUsed === "number"
                ? { qualityUsed: Math.round(result.qualityUsed * 100) }
                : {},
          },
        }),
      ]);
    },

    failure(file, error) {
      saveHistoryRecords([
        createHistoryRecord({
          runId,
          source: "tool",
          operation,
          status: "failed",
          file,
          settings,
          errorMessage: error?.message || "Processing failed.",
        }),
      ]);
    },
  };
}

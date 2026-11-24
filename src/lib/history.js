// Processing history. Only metadata is stored (names, formats, sizes,
// settings, timestamps) in the browser's IndexedDB. Original files, processed
// files and image previews are never stored.
//
// If IndexedDB is unavailable (some private modes), records are kept in memory
// for the current tab only; getStorageMode() reports which one is in use.
import { getSettings } from "./settings.js";

const DB_NAME = "fileforge";
const DB_VERSION = 1;
const STORE = "history";
export const MAX_HISTORY_RECORDS = 1000;

let dbPromise = null;
let memoryRecords = null; // set when IndexedDB cannot be used

export function newId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function openDatabase() {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve) => {
    if (typeof indexedDB === "undefined") {
      resolve(null);
      return;
    }

    let request;
    try {
      request = indexedDB.open(DB_NAME, DB_VERSION);
    } catch {
      resolve(null);
      return;
    }

    request.onupgradeneeded = () => {
      const store = request.result.createObjectStore(STORE, { keyPath: "id" });
      store.createIndex("timestamp", "timestamp");
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
    request.onblocked = () => resolve(null);
  }).then((database) => {
    if (!database) memoryRecords = memoryRecords || [];
    return database;
  });

  return dbPromise;
}

function requestToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function transactionDone(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

// "indexeddb" (saved in this browser) or "memory" (lost when the tab closes).
export async function getStorageMode() {
  return (await openDatabase()) ? "indexeddb" : "memory";
}

export async function addRecords(records) {
  if (!records.length) return;
  const database = await openDatabase();

  if (!database) {
    memoryRecords.push(...records);
    if (memoryRecords.length > MAX_HISTORY_RECORDS) {
      memoryRecords.sort((a, b) => a.timestamp - b.timestamp);
      memoryRecords.splice(0, memoryRecords.length - MAX_HISTORY_RECORDS);
    }
    return;
  }

  const transaction = database.transaction(STORE, "readwrite");
  const store = transaction.objectStore(STORE);
  records.forEach((record) => store.put(record));

  // Keep storage small: drop the oldest records beyond the limit.
  const countRequest = store.count();
  countRequest.onsuccess = () => {
    const excess = countRequest.result - MAX_HISTORY_RECORDS;
    if (excess <= 0) return;
    let removed = 0;
    const cursorRequest = store.index("timestamp").openCursor();
    cursorRequest.onsuccess = () => {
      const cursor = cursorRequest.result;
      if (cursor && removed < excess) {
        cursor.delete();
        removed++;
        cursor.continue();
      }
    };
  };

  await transactionDone(transaction);
}

export async function getAllRecords() {
  const database = await openDatabase();
  if (!database) return [...memoryRecords];

  const transaction = database.transaction(STORE, "readonly");
  return requestToPromise(transaction.objectStore(STORE).getAll());
}

export async function deleteRecord(id) {
  const database = await openDatabase();
  if (!database) {
    memoryRecords = memoryRecords.filter((record) => record.id !== id);
    return;
  }

  const transaction = database.transaction(STORE, "readwrite");
  transaction.objectStore(STORE).delete(id);
  await transactionDone(transaction);
}

export async function clearHistory() {
  const database = await openDatabase();
  if (!database) {
    memoryRecords = [];
    return;
  }

  const transaction = database.transaction(STORE, "readwrite");
  transaction.objectStore(STORE).clear();
  await transactionDone(transaction);
}

// ------------------------------------------------------------------
// Creating records
// ------------------------------------------------------------------

const clip = (value, length) => String(value ?? "").slice(0, length);

// Builds one history record. Only plain values are stored.
//   status: "completed" | "failed" | "cancelled"
export function createHistoryRecord({
  runId,
  source,
  operation,
  status,
  file,
  settings,
  result = null,
  errorMessage = "",
}) {
  return {
    id: newId(),
    runId: clip(runId, 64),
    source: source === "batch" ? "batch" : "tool",
    timestamp: Date.now(),
    status,
    operation,
    fileName: clip(file.name, 255),
    originalFormat: clip(file.type, 40),
    originalSize: file.size,
    outputFormat: status === "completed" ? clip(result?.outputFormat, 40) : "",
    outputSize: status === "completed" ? result.blob.size : null,
    outputName: status === "completed" ? clip(result.name, 255) : "",
    outputWidth: status === "completed" ? result.width : null,
    outputHeight: status === "completed" ? result.height : null,
    settings: JSON.parse(JSON.stringify(settings || {})),
    details: status === "completed" ? JSON.parse(JSON.stringify(result.details || {})) : {},
    errorMessage: status === "failed" ? clip(errorMessage, 300) : "",
  };
}

// Saves records without ever interrupting the user's processing.
export async function saveHistoryRecords(records) {
  if (!getSettings().saveHistory) return; // turned off in Settings
  try {
    await addRecords(records);
  } catch (error) {
    console.warn("FileForge could not save processing history:", error);
  }
}

// ------------------------------------------------------------------
// Statistics (calculated only from stored records)
// ------------------------------------------------------------------

export function computeStats(records) {
  const completed = records.filter((record) => record.status === "completed");

  const runsByOperation = new Map();
  const completedRuns = new Set();
  let spaceSavedBytes = 0;

  for (const record of completed) {
    spaceSavedBytes += record.originalSize - record.outputSize;
    // A "run" is one batch, or one click of a single tool's action.
    const runKey = record.runId || record.id;
    if (!completedRuns.has(runKey)) {
      completedRuns.add(runKey);
      runsByOperation.set(record.operation, (runsByOperation.get(record.operation) || 0) + 1);
    }
  }

  const mostUsedCount = Math.max(0, ...runsByOperation.values());
  const mostUsed = [...runsByOperation]
    .filter(([, count]) => count === mostUsedCount)
    .map(([operation]) => operation);

  return {
    hasData: completed.length > 0,
    filesProcessed: completed.length,
    operationsCompleted: completedRuns.size,
    spaceSavedBytes, // negative when outputs are larger than the originals
    mostUsed,
    mostUsedCount,
    failed: records.filter((record) => record.status === "failed").length,
    cancelled: records.filter((record) => record.status === "cancelled").length,
  };
}

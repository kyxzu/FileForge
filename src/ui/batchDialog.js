// Batch processing dialog. The queue is the same list of files shown on the
// page, so uploads, drag-and-drop and duplicate detection are shared.

import { h } from "../lib/dom.js";
import { formatBytes, formatLabel, describeSizeChange } from "../lib/format.js";
import { uniqueFilename, MAX_QUEUE_FILES } from "../lib/files.js";
import { downloadBlob, createZipArchive } from "../lib/download.js";
import { detectEncodableFormats } from "../lib/imageProcessing.js";
import { OPERATIONS, DEFAULT_SETTINGS, validateSettings, runOperation } from "../lib/operations.js";
import { STATUS, STATUS_LABELS, createBatchRunner, summarizeItems } from "../lib/batchQueue.js";
import { createHistoryRecord, saveHistoryRecords, newId } from "../lib/history.js";
import { showToast } from "../lib/toast.js";
import { confirmDialog } from "./confirmDialog.js";
import { createSettingsPanel } from "./batchSettings.js";

// Large images need a lot of memory while they are processed, so they are
// handled one at a time.
function chooseConcurrency(files) {
  const largest = files.reduce((max, file) => Math.max(max, file.size), 0);
  if (largest > 20 * 1024 * 1024) return 1;
  return Math.min(3, Math.max(1, Math.floor((navigator.hardwareConcurrency || 4) / 2)));
}

function timestampForFilename() {
  const now = new Date();
  const pad = (value) => String(value).padStart(2, "0");
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
}

export function openBatchDialog(upload) {
  if (document.querySelector(".batch-dialog")) return;

  if (upload.getFiles().length === 0) {
    showToast("Upload at least one image first.");
    return;
  }

  // ---------------- state ----------------
  let operation = "resize";
  const savedSettings = structuredClone(DEFAULT_SETTINGS);
  let panel = null;
  let items = [];
  const rows = new Map(); // item id -> { root, chip, meta, error, actions, ... }
  const thumbnails = new Map(); // item id -> object URL
  let encodable = new Set(["image/png", "image/jpeg", "image/webp"]);
  let runner = null;
  let runPromise = null;
  let run = null; // { id, operation, settings, usedNames }

  // ---------------- elements ----------------
  const closeButton = h("button", { class: "converter-close", type: "button", "aria-label": "Close batch processing" }, "×");

  const operationButtons = Object.entries(OPERATIONS).map(([key, info]) =>
    h("button", {
      class: "batch-op", type: "button", role: "radio", "data-operation": key,
      "aria-checked": String(key === operation),
    }, info.label)
  );
  const operationGroup = h(
    "div",
    { class: "batch-ops", role: "radiogroup", "aria-label": "Operation" },
    operationButtons
  );
  const settingsHost = h("fieldset", { class: "batch-settings" }, h("legend", {}, "Settings"));

  const queueTitle = h("h3", {}, "Queue");
  const fileInput = h("input", { type: "file", accept: "image/png,image/jpeg,image/webp", multiple: true, hidden: true });
  const addButton = h("button", { class: "button button-secondary", type: "button" }, "Add files");
  const clearButton = h("button", { class: "button button-quiet", type: "button" }, "Clear queue");
  const list = h("div", { class: "batch-list", role: "list" });
  const emptyState = h("div", { class: "converter-empty" }, "Your queue is empty. Add images to get started.");

  const statTotal = h("strong", {}, "0");
  const statDone = h("strong", {}, "0");
  const statRemaining = h("strong", {}, "0");
  const statFailed = h("strong", {}, "0");
  const statCancelled = h("strong", {}, "0");
  const progressFill = h("div", { class: "batch-progress-fill" });
  const progressBar = h(
    "div",
    { class: "batch-progress-bar", role: "progressbar", "aria-label": "Overall progress", "aria-valuemin": 0, "aria-valuemax": 100, "aria-valuenow": 0 },
    progressFill
  );
  const progressText = h("span", { class: "batch-progress-text", "aria-live": "polite" }, "Ready");

  const summaryBox = h("div", { class: "batch-summary", hidden: true });

  const cancelButton = h("button", { class: "button button-secondary", type: "button", hidden: true }, "Cancel processing");
  const startButton = h("button", { class: "button button-primary", type: "button" }, "Start batch");
  const zipButton = h("button", { class: "button button-secondary", type: "button", hidden: true }, "Download all (ZIP)");

  const dialog = h(
    "dialog",
    { class: "converter-dialog batch-dialog", "aria-labelledby": "batch-title" },
    h(
      "div",
      { class: "converter-header" },
      h("div", {},
        h("span", { class: "converter-label" }, "FILEFORGE / BATCH"),
        h("h2", { id: "batch-title" }, "Batch Processing"),
        h("p", {}, "Process every queued image with one operation.")),
      closeButton
    ),
    h("div", { class: "batch-section" }, operationGroup, settingsHost),
    h(
      "div",
      { class: "batch-section" },
      h("div", { class: "batch-queue-header" }, queueTitle, h("div", { class: "batch-queue-actions" }, addButton, clearButton)),
      fileInput,
      list,
      emptyState
    ),
    h(
      "div",
      { class: "batch-section batch-progress" },
      h("div", { class: "batch-stats" },
        h("div", {}, h("span", {}, "Total"), statTotal),
        h("div", {}, h("span", {}, "Completed"), statDone),
        h("div", {}, h("span", {}, "Remaining"), statRemaining),
        h("div", {}, h("span", {}, "Failed"), statFailed),
        h("div", {}, h("span", {}, "Cancelled"), statCancelled)),
      progressBar,
      progressText
    ),
    summaryBox,
    h("div", { class: "converter-actions batch-actions" }, h("span", { class: "batch-privacy" }, "◈ Processed locally"), h("div", { class: "batch-action-buttons" }, cancelButton, zipButton, startButton)),
    h("div", { class: "converter-footer" }, h("span", {}, "◈ PROCESSED LOCALLY"), h("span", {}, "NO FILE UPLOADS"))
  );

  document.body.appendChild(dialog);

  // ---------------- helpers ----------------
  const isBusy = () => Boolean(runner && runner.isRunning());

  function currentFiles() {
    return items.map((item) => item.file);
  }

  function releaseItem(item) {
    const url = thumbnails.get(item.id);
    if (url) URL.revokeObjectURL(url);
    thumbnails.delete(item.id);
    rows.delete(item.id);
    item.result = null;
  }

  function resetItem(item) {
    item.status = STATUS.WAITING;
    item.error = "";
    item.result = null;
    item.recorded = false;
  }

  // Keeps the item list in step with the shared upload queue.
  function syncItems() {
    const files = upload.getFiles();
    const byFile = new Map(items.map((item) => [item.file, item]));

    items.forEach((item) => {
      if (!files.includes(item.file)) releaseItem(item);
    });

    items = files.map(
      (file) => byFile.get(file) || { id: newId(), file, status: STATUS.WAITING, error: "", result: null, recorded: false }
    );

    items.forEach((item) => {
      if (!rows.has(item.id)) rows.set(item.id, createRow(item));
    });

    list.replaceChildren(...items.map((item) => rows.get(item.id).root));
    emptyState.hidden = items.length > 0;
    list.hidden = items.length === 0;
    queueTitle.textContent = `Queue · ${items.length} ${items.length === 1 ? "file" : "files"}`;

    panel?.refresh();
    updateRows();
    updateProgress();
    updateControls();
  }

  // ---------------- rows ----------------
  function createRow(item) {
    const url = URL.createObjectURL(item.file);
    thumbnails.set(item.id, url);

    const thumbnail = h("img", { class: "file-thumbnail", src: url, alt: "", loading: "lazy", decoding: "async" });
    const name = h("span", { class: "file-name", title: item.file.name }, item.file.name);
    const meta = h("span", { class: "file-details" });
    const error = h("span", { class: "batch-error", role: "alert", hidden: true });
    const chip = h("span", { class: "batch-status" });
    const download = h("button", { class: "button button-secondary batch-download", type: "button", hidden: true }, "Download");
    const remove = h("button", { class: "remove-file batch-remove", type: "button", "aria-label": `Remove ${item.file.name}` }, "×");

    download.addEventListener("click", () => {
      if (item.result) downloadBlob(item.result.blob, item.result.name);
    });
    remove.addEventListener("click", () => {
      if (!isBusy()) upload.removeFile(item.file);
    });

    const root = h(
      "article",
      { class: "file-item batch-item", role: "listitem" },
      thumbnail,
      h("div", { class: "file-info" }, name, meta, error),
      h("div", { class: "batch-item-side" }, chip, download, remove)
    );

    return { root, meta, error, chip, download, remove, item };
  }

  function updateRow(item) {
    const row = rows.get(item.id);
    if (!row) return;

    row.root.dataset.status = item.status;
    row.chip.className = `batch-status status-${item.status}`;
    row.chip.textContent = STATUS_LABELS[item.status];

    const original = `${formatLabel(item.file.type)} · ${formatBytes(item.file.size)}`;

    if (item.status === STATUS.COMPLETED && item.result) {
      const { result } = item;
      const change = describeSizeChange(item.file.size, result.blob.size);
      row.meta.textContent =
        `${formatLabel(item.file.type)} → ${formatLabel(result.outputFormat)} · ${formatBytes(item.file.size)} → ${formatBytes(result.blob.size)}` +
        (change ? ` (${change})` : "") +
        ` · ${result.width} × ${result.height} px`;
      if (result.details?.targetReached === false) {
        row.meta.textContent += " · target size not reached";
      }
    } else {
      row.meta.textContent = original;
    }

    row.error.hidden = item.status !== STATUS.FAILED;
    row.error.textContent = item.status === STATUS.FAILED ? item.error : "";
    row.download.hidden = !(item.status === STATUS.COMPLETED && item.result);
    row.download.setAttribute("aria-label", item.result ? `Download ${item.result.name}` : "Download");
    row.remove.disabled = isBusy();
  }

  function updateRows() {
    items.forEach(updateRow);
  }

  // ---------------- progress and summary ----------------
  function updateProgress() {
    const summary = summarizeItems(items);
    const percent = summary.total === 0 ? 0 : Math.round((summary.finished / summary.total) * 100);

    statTotal.textContent = String(summary.total);
    statDone.textContent = String(summary.completed);
    statRemaining.textContent = String(summary.remaining);
    statFailed.textContent = String(summary.failed);
    statCancelled.textContent = String(summary.cancelled);

    progressFill.style.width = `${percent}%`;
    progressBar.setAttribute("aria-valuenow", String(percent));

    if (isBusy()) {
      progressText.textContent = `Processing… ${summary.finished} of ${summary.total} finished`;
    } else if (summary.finished > 0 && summary.remaining === 0) {
      progressText.textContent = `Finished: ${summary.completed} completed, ${summary.failed} failed, ${summary.cancelled} cancelled`;
    } else {
      progressText.textContent = summary.total === 0 ? "Ready" : `${summary.total} ${summary.total === 1 ? "file" : "files"} ready`;
    }

    return summary;
  }

  function renderSummary() {
    const summary = summarizeItems(items);
    const processed = summary.completed + summary.failed;

    if (processed === 0 && summary.cancelled === 0) {
      summaryBox.hidden = true;
      return;
    }

    const saved = summary.savedBytes;
    const savedText =
      summary.completed === 0 ? "—"
      : saved > 0 ? `${formatBytes(saved)} saved (${((saved / summary.originalBytes) * 100).toFixed(1)}%)`
      : saved < 0 ? `${formatBytes(-saved)} larger`
      : "No size change";

    const cell = (label, value) => h("div", {}, h("span", {}, label), h("strong", {}, value));

    summaryBox.replaceChildren(
      h("span", { class: "compressor-summary-label" }, "COMPLETION SUMMARY"),
      h(
        "div",
        { class: "batch-summary-grid" },
        cell("Total processed", String(processed)),
        cell("Successful", String(summary.completed)),
        cell("Failed", String(summary.failed)),
        summary.cancelled > 0 ? cell("Cancelled", String(summary.cancelled)) : null,
        cell("Original size (successful files)", summary.completed ? formatBytes(summary.originalBytes) : "—"),
        cell("Output size", summary.completed ? formatBytes(summary.outputBytes) : "—"),
        cell("Space saved", savedText)
      )
    );
    summaryBox.hidden = false;
  }

  function updateControls() {
    const busy = isBusy();
    const summary = summarizeItems(items);
    const hasResults = summary.completed > 0;

    settingsHost.disabled = busy;
    operationButtons.forEach((button) => { button.disabled = busy; });
    addButton.disabled = busy || items.length >= MAX_QUEUE_FILES;
    clearButton.disabled = busy || items.length === 0;
    list.querySelectorAll(".batch-remove").forEach((button) => { button.disabled = busy; });

    cancelButton.hidden = !busy;
    zipButton.hidden = busy || !hasResults;
    zipButton.textContent = `Download all (${summary.completed}) as ZIP`;
    startButton.hidden = busy;
    startButton.disabled = items.length === 0;

    if (summary.waiting === 0 && summary.finished > 0) startButton.textContent = "Run again";
    else if (summary.finished > 0) startButton.textContent = `Process ${summary.waiting} waiting`;
    else startButton.textContent = "Start batch";
  }

  // ---------------- operations ----------------
  async function selectOperation(next) {
    if (isBusy()) return;
    if (panel) savedSettings[operation] = panel.read();
    operation = next;

    operationButtons.forEach((button) => {
      const selected = button.dataset.operation === next;
      button.setAttribute("aria-checked", String(selected));
      button.classList.toggle("is-active", selected);
    });

    panel = createSettingsPanel(next, {
      initial: savedSettings[next],
      encodable,
      getFiles: currentFiles,
    });
    settingsHost.replaceChildren(h("legend", {}, "Settings"), panel.el);
  }

  // ---------------- history ----------------
  function recordItem(item) {
    if (item.recorded || !run) return;
    const terminal = [STATUS.COMPLETED, STATUS.FAILED, STATUS.CANCELLED].includes(item.status);
    if (!terminal) return;

    item.recorded = true;
    saveHistoryRecords([
      createHistoryRecord({
        runId: run.id,
        source: "batch",
        operation: run.operation,
        status: item.status,
        file: item.file,
        settings: run.settings,
        result: item.result,
        errorMessage: item.error,
      }),
    ]);
  }

  // ---------------- running ----------------
  async function startBatch() {
    if (isBusy()) return;

    const settings = panel.read();
    const problem = validateSettings(operation, settings);
    if (problem) {
      showToast(problem);
      return;
    }

    if (!items.some((item) => item.status === STATUS.WAITING)) {
      items.forEach(resetItem);
    }

    const waiting = items.filter((item) => item.status === STATUS.WAITING);
    run = {
      id: newId(),
      operation,
      settings: structuredClone(settings),
      usedNames: new Set(
        items.filter((item) => item.result).map((item) => item.result.name.toLowerCase())
      ),
    };

    runner = createBatchRunner({
      items: waiting,
      concurrency: chooseConcurrency(waiting.map((item) => item.file)),
      processItem: async (item) => {
        const result = await runOperation(item.file, run.operation, run.settings);
        result.name = uniqueFilename(result.name, run.usedNames);
        return result;
      },
      onChange: (item) => {
        updateRow(item);
        updateProgress();
        recordItem(item);
      },
    });

    // run() marks the runner as busy synchronously, so the controls must be
    // refreshed after it has been called (not before).
    runPromise = runner.run().finally(() => {
      updateControls();
      updateRows();
      updateProgress();
      renderSummary();
    });

    summaryBox.hidden = true;
    cancelButton.disabled = false;
    updateControls();
    updateRows();
    updateProgress();

    const summary = await runPromise;
    if (dialog.isConnected) {
      const finalSummary = summarizeItems(items);
      showToast(
        runner.wasCancelled()
          ? `Batch cancelled: ${finalSummary.completed} completed, ${finalSummary.cancelled} cancelled.`
          : `Batch finished: ${summary.completed} completed, ${summary.failed} failed.`
      );
    }
  }

  async function downloadZip() {
    const completed = items.filter((item) => item.status === STATUS.COMPLETED && item.result);
    if (completed.length === 0) return;

    zipButton.disabled = true;
    const label = zipButton.textContent;
    zipButton.textContent = "Preparing ZIP…";

    try {
      const archive = await createZipArchive(
        completed.map((item) => ({ name: item.result.name, blob: item.result.blob }))
      );
      downloadBlob(archive, `fileforge-batch-${timestampForFilename()}.zip`);
    } catch (error) {
      showToast(error.message || "Could not prepare the ZIP archive.");
    } finally {
      zipButton.disabled = false;
      zipButton.textContent = label;
    }
  }

  // ---------------- closing ----------------
  let closing = false;
  async function requestClose() {
    if (closing) return;

    if (isBusy()) {
      const confirmed = await confirmDialog({
        title: "Cancel the running batch?",
        message: "Files still waiting will be cancelled and the file being processed will be discarded.",
        confirmLabel: "Cancel batch and close",
        cancelLabel: "Keep processing",
        danger: true,
      });
      if (!confirmed) return;
      runner?.cancel();
      await runPromise;
    }

    closing = true;
    dialog.close();
  }

  let unsubscribe = null;
  dialog.addEventListener("close", () => {
    unsubscribe?.();
    if (isBusy()) runner.cancel();
    items.forEach(releaseItem);
    items = [];
    rows.clear();
    thumbnails.clear();
    dialog.remove();
  });
  dialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    requestClose();
  });
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) requestClose();
  });
  closeButton.addEventListener("click", requestClose);

  // ---------------- wiring ----------------
  operationButtons.forEach((button) =>
    button.addEventListener("click", () => selectOperation(button.dataset.operation))
  );
  addButton.addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", () => {
    upload.addFiles(fileInput.files);
    fileInput.value = "";
  });
  clearButton.addEventListener("click", () => upload.clearFiles());
  startButton.addEventListener("click", startBatch);
  cancelButton.addEventListener("click", () => {
    runner?.cancel();
    cancelButton.disabled = true;
    progressText.textContent = "Cancelling… the file being processed will be discarded.";
  });
  zipButton.addEventListener("click", downloadZip);

  // Drag and drop straight onto the queue.
  dialog.addEventListener("dragover", (event) => {
    if (isBusy()) return;
    event.preventDefault();
    list.classList.add("is-dragging");
  });
  dialog.addEventListener("dragleave", (event) => {
    if (!list.contains(event.relatedTarget)) list.classList.remove("is-dragging");
  });
  dialog.addEventListener("drop", (event) => {
    event.preventDefault();
    list.classList.remove("is-dragging");
    if (!isBusy()) upload.addFiles(event.dataTransfer.files);
  });

  unsubscribe = upload.subscribe(() => {
    if (isBusy()) return; // The queue is locked while a batch runs.
    syncItems();
  });

  selectOperation("resize");
  operationButtons[0].classList.add("is-active");
  syncItems();
  dialog.showModal();

  // Disable output formats this browser cannot encode.
  detectEncodableFormats().then((supported) => {
    encodable = supported;
    if (dialog.isConnected && !isBusy()) {
      savedSettings[operation] = panel.read();
      selectOperation(operation);
    }
  });
}

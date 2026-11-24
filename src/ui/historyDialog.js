// Processing History dialog. Everything shown here comes from the records
// stored in this browser; nothing is estimated or invented.

import { h, replaceContent } from "../lib/dom.js";
import { formatBytes, formatLabel, formatDateTime, describeSizeChange } from "../lib/format.js";
import { OPERATIONS, operationLabel, describeSettings } from "../lib/operations.js";
import {
  getAllRecords, getStorageMode, deleteRecord, clearHistory, computeStats,
} from "../lib/history.js";
import { showToast, notify } from "../lib/toast.js";
import { confirmDialog } from "./confirmDialog.js";

const PAGE_SIZE = 100;

const STATUS_DISPLAY = {
  completed: { icon: "✓", label: "Completed" },
  failed: { icon: "✕", label: "Failed" },
  cancelled: { icon: "○", label: "Cancelled" },
};

function savedText(originalSize, outputSize) {
  const difference = originalSize - outputSize;
  if (difference > 0) return `${formatBytes(difference)} saved`;
  if (difference < 0) return `${formatBytes(-difference)} larger`;
  return "No size change";
}

function formatPair(record) {
  const from = formatLabel(record.originalFormat);
  return record.status === "completed" && record.outputFormat
    ? `${from} → ${formatLabel(record.outputFormat)}`
    : from;
}

export function openHistoryDialog() {
  if (document.querySelector(".history-dialog")) return;

  const state = {
    records: [],
    operation: "all",
    status: "all",
    sort: "newest",
    visible: PAGE_SIZE,
    selectedId: null,
    storage: "indexeddb",
    loaded: false,
    failed: false,
  };

  const closeButton = h("button", { class: "converter-close", type: "button", "aria-label": "Close history" }, "×");
  const notice = h("p", { class: "history-notice" });
  const statsBox = h("div", { class: "history-stats" });
  const toolbar = h("div", { class: "history-toolbar" });
  const content = h("div", { class: "history-content", "aria-live": "polite" });

  const dialog = h(
    "dialog",
    { class: "converter-dialog history-dialog", "aria-labelledby": "history-title" },
    h(
      "div",
      { class: "converter-header" },
      h("div", {},
        h("span", { class: "converter-label" }, "FILEFORGE / HISTORY"),
        h("h2", { id: "history-title" }, "Processing History"),
        h("p", {}, "A record of the operations you ran in this browser.")),
      closeButton
    ),
    notice,
    statsBox,
    toolbar,
    content,
    h("div", { class: "converter-footer" }, h("span", {}, "◈ STORED ONLY IN THIS BROWSER"), h("span", {}, "NO FILE UPLOADS"))
  );

  document.body.appendChild(dialog);

  // ---------------- data ----------------
  async function load() {
    try {
      state.storage = await getStorageMode();
      state.records = await getAllRecords();
      state.failed = false;
    } catch (error) {
      console.warn("FileForge could not read processing history:", error);
      state.failed = true;
    }
    state.loaded = true;
    render();
  }

  function visibleRecords() {
    const filtered = state.records.filter(
      (record) =>
        (state.operation === "all" || record.operation === state.operation) &&
        (state.status === "all" || record.status === state.status)
    );
    const direction = state.sort === "newest" ? -1 : 1;
    return filtered.sort(
      (a, b) => direction * (a.timestamp - b.timestamp) || direction * a.id.localeCompare(b.id)
    );
  }

  // ---------------- rendering ----------------
  function render() {
    notice.textContent =
      state.storage === "memory"
        ? "This browser is not allowing FileForge to save history, so these records last only until this tab is closed."
        : "History is saved only in this browser. FileForge records what was done, not the files themselves, so results cannot be downloaded again from here.";

    const selected = state.records.find((record) => record.id === state.selectedId);
    if (selected) {
      statsBox.hidden = true;
      toolbar.hidden = true;
      renderDetail(selected);
      return;
    }

    state.selectedId = null;
    statsBox.hidden = false;
    toolbar.hidden = false;
    renderStats();
    renderToolbar();
    renderList();
  }

  function renderStats() {
    const stats = computeStats(state.records);

    if (!stats.hasData) {
      statsBox.replaceChildren(
        h("p", { class: "history-stats-empty" }, "Statistics appear after you complete a processing operation.")
      );
      return;
    }

    const cell = (label, value, note) =>
      h("div", { class: "history-stat" }, h("span", {}, label), h("strong", {}, value), note ? h("small", {}, note) : null);

    const saved = stats.spaceSavedBytes;
    replaceContent(
      statsBox,
      cell("Files processed", String(stats.filesProcessed), "Completed only"),
      cell("Operations completed", String(stats.operationsCompleted), "Batches and tool runs"),
      cell(
        saved >= 0 ? "Total space saved" : "Net size increase",
        formatBytes(Math.abs(saved)),
        "Original minus output size"
      ),
      cell(
        stats.mostUsed.length > 1 ? "Most used utility (tie)" : "Most used utility",
        stats.mostUsed.length > 2
          ? `${stats.mostUsed.length} utilities`
          : stats.mostUsed.map((operation) => OPERATIONS[operation]?.shortLabel || operation).join(" / "),
        `${stats.mostUsedCount} ${stats.mostUsedCount === 1 ? "run" : "runs"} each`
      ),
      stats.failed + stats.cancelled > 0
        ? h("p", { class: "history-stats-note" }, `Not counted: ${stats.failed} failed, ${stats.cancelled} cancelled.`)
        : null
    );
  }

  function select(id, label, options, value, onChange) {
    const control = h(
      "select",
      { id },
      options.map(([optionValue, text]) => h("option", { value: optionValue }, text))
    );
    control.value = value;
    control.addEventListener("change", () => {
      onChange(control.value);
      state.visible = PAGE_SIZE;
      render();
    });
    return h("div", { class: "history-filter" }, h("label", { for: id }, label), control);
  }

  function renderToolbar() {
    const clearAll = h("button", { class: "button button-quiet history-clear", type: "button" }, "Clear all history");
    clearAll.disabled = state.records.length === 0;
    clearAll.addEventListener("click", clearAllHistory);

    toolbar.replaceChildren(
      select("history-operation", "Operation",
        [["all", "All operations"], ...Object.entries(OPERATIONS).map(([key, info]) => [key, info.label])],
        state.operation, (value) => { state.operation = value; }),
      select("history-status", "Result",
        [["all", "All results"], ["completed", "Completed"], ["failed", "Failed"], ["cancelled", "Cancelled"]],
        state.status, (value) => { state.status = value; }),
      select("history-sort", "Sort",
        [["newest", "Newest first"], ["oldest", "Oldest first"]],
        state.sort, (value) => { state.sort = value; }),
      clearAll
    );
  }

  function renderList() {
    if (!state.loaded) {
      content.replaceChildren(h("div", { class: "converter-empty" }, "Loading history…"));
      return;
    }
    if (state.failed) {
      content.replaceChildren(h("div", { class: "converter-empty" }, "History could not be read in this browser."));
      return;
    }
    if (state.records.length === 0) {
      content.replaceChildren(
        h("div", { class: "converter-empty" }, "No processing history yet. Images you resize, compress or convert will be listed here.")
      );
      return;
    }

    const records = visibleRecords();
    if (records.length === 0) {
      content.replaceChildren(h("div", { class: "converter-empty" }, "No entries match these filters."));
      return;
    }

    const shown = records.slice(0, state.visible);
    const children = shown.map(renderRow);

    if (records.length > shown.length) {
      children.push(
        h("button", {
          class: "button button-secondary history-more", type: "button",
          onClick: () => { state.visible += PAGE_SIZE; render(); },
        }, `Show more (${records.length - shown.length} remaining)`)
      );
    }

    content.replaceChildren(h("div", { class: "history-list", role: "list" }, children));
  }

  function renderRow(record) {
    const display = STATUS_DISPLAY[record.status] || { icon: "?", label: record.status };

    const sizes = record.status === "completed"
      ? ` · ${formatBytes(record.originalSize)} → ${formatBytes(record.outputSize)} (${describeSizeChange(record.originalSize, record.outputSize)})`
      : ` · ${formatBytes(record.originalSize)}`;

    const open = h(
      "button",
      { class: "history-open", type: "button", "aria-label": `View details for ${record.fileName}` },
      h("span", { class: `history-status status-${record.status}` }, h("span", { "aria-hidden": "true" }, display.icon), ` ${display.label}`),
      h("span", { class: "history-name" }, record.fileName),
      h("span", { class: "history-meta" }, `${operationLabel(record.operation)} · ${formatPair(record)}${sizes}`),
      h("span", { class: "history-date" }, formatDateTime(record.timestamp))
    );
    open.addEventListener("click", () => { state.selectedId = record.id; render(); });

    const remove = h(
      "button",
      { class: "remove-file history-delete", type: "button", title: "Delete this entry", "aria-label": `Delete history entry for ${record.fileName}` },
      "×"
    );
    remove.addEventListener("click", () => removeRecord(record.id));

    return h("article", { class: "history-item", role: "listitem" }, open, remove);
  }

  function renderDetail(record) {
    const display = STATUS_DISPLAY[record.status] || { icon: "?", label: record.status };
    const completed = record.status === "completed";

    const rows = [
      ["File name", record.fileName],
      ["Operation", operationLabel(record.operation)],
      ["Run from", record.source === "batch" ? "Batch processing" : "Single tool"],
      ["Result", `${display.icon} ${display.label}`],
      ["Processed", formatDateTime(record.timestamp)],
      ["Original format", formatLabel(record.originalFormat)],
      completed ? ["Output format", formatLabel(record.outputFormat)] : null,
      ["Original size", formatBytes(record.originalSize)],
      completed ? ["Output size", formatBytes(record.outputSize)] : null,
      completed ? ["Size change", `${savedText(record.originalSize, record.outputSize)} (${describeSizeChange(record.originalSize, record.outputSize)})`] : null,
      completed && record.outputWidth ? ["Output dimensions", `${record.outputWidth} × ${record.outputHeight} px`] : null,
      completed && record.outputName ? ["Output file name", record.outputName] : null,
      ...describeSettings(record.operation, record.settings),
      completed && typeof record.details?.qualityUsed === "number" && record.outputFormat !== "image/png"
        ? ["Quality used", `${record.details.qualityUsed}%`] : null,
      completed && record.details?.targetReached === true ? ["Target size", "Reached"] : null,
      completed && record.details?.targetReached === false ? ["Target size", "Not reached (lowest quality used)"] : null,
      record.status === "failed" && record.errorMessage ? ["Error", record.errorMessage] : null,
    ].filter(Boolean);

    const back = h("button", { class: "button button-secondary", type: "button" }, "← Back to history");
    back.addEventListener("click", () => { state.selectedId = null; render(); });

    const remove = h("button", { class: "button button-quiet", type: "button" }, "Delete this entry");
    remove.addEventListener("click", () => removeRecord(record.id));

    content.replaceChildren(
      h(
        "div",
        { class: "history-detail" },
        h("div", { class: "history-detail-actions" }, back, remove),
        h("h3", {}, record.fileName),
        h(
          "dl",
          { class: "history-detail-list" },
          rows.map(([label, value]) =>
            h("div", { class: "history-detail-row" }, h("dt", {}, label), h("dd", {}, value))
          )
        ),
        h("p", { class: "history-detail-note" },
          "FileForge does not keep processed files or previews. This entry records the operation only, so the result cannot be downloaded again.")
      )
    );
    back.focus();
  }

  // ---------------- actions ----------------
  async function removeRecord(id) {
    try {
      await deleteRecord(id);
      state.records = state.records.filter((record) => record.id !== id);
      if (state.selectedId === id) state.selectedId = null;
      render();
    } catch {
      notify({ type: "error", title: "Not deleted", message: "That history entry could not be deleted." });
    }
  }

  async function clearAllHistory() {
    const count = state.records.length;
    if (count === 0) return;

    const confirmed = await confirmDialog({
      title: "Clear all history?",
      message: `This permanently deletes ${count} ${count === 1 ? "record" : "records"} stored in this browser. Your images are not affected.`,
      confirmLabel: "Clear all history",
      danger: true,
    });
    if (!confirmed) return;

    try {
      await clearHistory();
      state.records = [];
      state.selectedId = null;
      render();
      notify({ type: "success", title: "History cleared", message: "Processing history cleared." });
    } catch {
      notify({ type: "error", title: "Not cleared", message: "History could not be cleared." });
    }
  }

  // ---------------- wiring ----------------
  closeButton.addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });
  dialog.addEventListener("close", () => dialog.remove());

  render();
  dialog.showModal();
  load();
}

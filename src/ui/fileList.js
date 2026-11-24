// The selected-files list, shown as a list or a thumbnail grid.
// Both views are the same elements; only the CSS differs, so there is one
// source of truth for file state and nothing is duplicated between views.
//
// Rendering reconciles against the file list: existing rows (and their
// thumbnail URLs) are reused, new rows are added, removed rows are released.
// Click and keyboard handling is delegated to the container.

import { formatBytes, formatLabel, formatAddedTime } from "../lib/format.js";
import { getViewMode, setViewMode } from "../lib/viewMode.js";

export function createFileListView({ container, toggle, onRemove, fallbackFocus }) {
  const entries = new Map(); // file -> { element, url }
  const fileOf = new WeakMap(); // element -> file
  const addedAt = new WeakMap(); // file -> timestamp
  let mode = getViewMode();
  let activeElement = null;

  container.setAttribute("role", "list");
  container.setAttribute("aria-label", "Selected files");

  const items = () => [...container.children];

  function applyMode(next) {
    mode = next;
    container.dataset.view = mode;
    toggle?.querySelectorAll("[data-view]").forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.view === mode));
    });
  }
  applyMode(mode);

  toggle?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-view]");
    if (!button || button.dataset.view === mode) return;
    applyMode(button.dataset.view);
    setViewMode(mode);
  });

  function createEntry(file) {
    if (!addedAt.has(file)) addedAt.set(file, Date.now());

    const element = document.createElement("article");
    element.className = "file-item";
    element.setAttribute("role", "listitem");

    const url = URL.createObjectURL(file);
    const thumbnail = document.createElement("img");
    thumbnail.className = "file-thumbnail";
    thumbnail.alt = "";
    thumbnail.loading = "lazy";
    thumbnail.decoding = "async";
    thumbnail.src = url;

    const info = document.createElement("div");
    info.className = "file-info";

    const name = document.createElement("span");
    name.className = "file-name";
    name.textContent = file.name;
    name.title = file.name;

    const details = document.createElement("span");
    details.className = "file-details";
    details.textContent = `${formatBytes(file.size)} · ${formatLabel(file.type)}`;

    const added = document.createElement("span");
    added.className = "file-added";
    added.textContent = formatAddedTime(addedAt.get(file));
    details.append(added);

    info.append(name, details);

    const removeButton = document.createElement("button");
    removeButton.className = "remove-file";
    removeButton.type = "button";
    removeButton.textContent = "×";
    removeButton.setAttribute("aria-label", `Remove ${file.name}`);

    element.append(thumbnail, info, removeButton);
    fileOf.set(element, file);
    return { element, url };
  }

  function syncRovingFocus() {
    const rows = items();
    if (!rows.includes(activeElement)) activeElement = rows[0] ?? null;
    rows.forEach((row) => {
      row.tabIndex = row === activeElement ? 0 : -1;
    });
  }

  function render(files) {
    const present = new Set(files);
    for (const [file, entry] of entries) {
      if (present.has(file)) continue;
      URL.revokeObjectURL(entry.url);
      entry.element.remove();
      entries.delete(file);
    }

    let cursor = container.firstElementChild;
    for (const file of files) {
      let entry = entries.get(file);
      if (!entry) {
        entry = createEntry(file);
        entries.set(file, entry);
      }
      if (entry.element === cursor) cursor = cursor.nextElementSibling;
      else container.insertBefore(entry.element, cursor);
    }
    syncRovingFocus();
  }

  function removeRow(row) {
    const file = fileOf.get(row);
    if (!file) return;
    const rows = items();
    const neighbor = rows[rows.indexOf(row) + 1] ?? rows[rows.indexOf(row) - 1];
    onRemove(file);
    // Keep keyboard users in the list.
    const target = neighbor?.isConnected ? neighbor : fallbackFocus;
    if (target) {
      if (target === neighbor) activeElement = neighbor;
      syncRovingFocus();
      target.focus();
    }
  }

  // The row that arrow keys move to from `from`.
  function neighborFor(from, key) {
    const rows = items();
    const index = rows.indexOf(from);
    if (key === "Home") return rows[0];
    if (key === "End") return rows[rows.length - 1];

    const vertical = key === "ArrowUp" || key === "ArrowDown";
    const backward = key === "ArrowUp" || key === "ArrowLeft";
    if (mode === "list" || !vertical) return rows[index + (backward ? -1 : 1)];

    // Grid, up/down: the nearest row above or below, preferring the same column.
    const origin = from.getBoundingClientRect();
    let best = null;
    let bestScore = Infinity;
    for (const row of rows) {
      if (row === from) continue;
      const box = row.getBoundingClientRect();
      const distance = backward ? origin.top - box.top : box.top - origin.top;
      if (distance <= 4) continue;
      const score = distance * 1000 + Math.abs(box.left - origin.left);
      if (score < bestScore) {
        best = row;
        bestScore = score;
      }
    }
    return best;
  }

  container.addEventListener("click", (event) => {
    const button = event.target.closest(".remove-file");
    if (button) removeRow(button.closest(".file-item"));
  });

  container.addEventListener("focusin", (event) => {
    const row = event.target.closest(".file-item");
    if (row && row !== activeElement) {
      activeElement = row;
      syncRovingFocus();
    }
  });

  container.addEventListener("keydown", (event) => {
    const row = event.target;
    if (!row.classList?.contains("file-item")) return;

    if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault();
      removeRow(row);
      return;
    }
    if (!["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    neighborFor(row, event.key)?.focus();
  });

  return { render };
}

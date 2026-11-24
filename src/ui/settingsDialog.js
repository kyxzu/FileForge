// Settings: one dialog for appearance, processing defaults, file management,
// privacy and "about". Every control changes something real: the theme, the
// starting values of the tools, the default file view, or stored data.

import { h, replaceContent } from "../lib/dom.js";
import { MAX_OUTPUT_DIMENSION } from "../lib/files.js";
import { getSettings, updateSettings, resetSettings } from "../lib/settings.js";
import { getAllRecords, clearHistory, getStorageMode } from "../lib/history.js";
import { formatBytes } from "../lib/format.js";
import { notify } from "../lib/toast.js";
import { REPO_URL, CACHE_KEY as GITHUB_CACHE_KEY } from "../lib/github.js";
import { confirmDialog } from "./confirmDialog.js";
import { openHistoryDialog } from "./historyDialog.js";
import { version as APP_VERSION } from "../../package.json";

let counter = 0;
let openDialog = null;

function savedNotice() {
  notify({ type: "success", title: "Settings saved", key: "settings-saved", duration: 2000 });
}

function radioGroup(name, legend, options, selected, onChange) {
  const inputs = options.map(([value, label]) => {
    const input = h("input", { type: "radio", name, value, checked: value === selected });
    input.addEventListener("change", () => input.checked && onChange(value));
    return { input, label: h("label", { class: "settings-choice" }, input, h("span", {}, label)) };
  });
  return {
    element: h("fieldset", { class: "settings-field" }, h("legend", {}, legend), h("div", { class: "settings-choices" }, inputs.map((item) => item.label))),
    set(value) {
      inputs.forEach((item) => (item.input.checked = item.input.value === value));
    },
  };
}

function checkbox(id, label, hint, checked, onChange) {
  const input = h("input", { id, type: "checkbox", checked });
  input.addEventListener("change", () => onChange(input.checked));
  return { input, element: h("div", { class: "settings-field" }, h("label", { class: "settings-choice", for: id }, input, h("span", {}, label)), hint ? h("p", { class: "settings-hint" }, hint) : null) };
}

export function openSettingsDialog({ theme }) {
  if (openDialog?.isConnected) return;

  const id = ++counter;
  const titleId = `settings-title-${id}`;
  const settings = getSettings();

  // ---------------- Appearance ----------------
  const themeGroup = radioGroup(
    "settings-theme",
    "Theme",
    [["dark", "Dark"], ["light", "Light"]],
    theme.get(),
    (value) => {
      theme.set(value);
      savedNotice();
    }
  );

  // ---------------- File processing ----------------
  const formatSelect = h(
    "select",
    { id: `settings-format-${id}` },
    h("option", { value: "" }, "Each tool's own default"),
    h("option", { value: "image/png" }, "PNG"),
    h("option", { value: "image/jpeg" }, "JPEG"),
    h("option", { value: "image/webp" }, "WebP")
  );
  formatSelect.value = settings.outputFormat ?? "";
  formatSelect.addEventListener("change", () => {
    updateSettings({ outputFormat: formatSelect.value || null });
    savedNotice();
  });

  const qualityValue = h("span", {}, `${settings.quality ?? 80}%`);
  const qualitySlider = h("input", {
    id: `settings-quality-${id}`,
    type: "range",
    min: 10,
    max: 100,
    step: 1,
    value: settings.quality ?? 80,
    disabled: settings.quality === null,
  });
  const qualityDefault = checkbox(
    `settings-quality-default-${id}`,
    "Use each tool's own default quality",
    null,
    settings.quality === null,
    (useDefault) => {
      qualitySlider.disabled = useDefault;
      updateSettings({ quality: useDefault ? null : qualitySlider.valueAsNumber });
      savedNotice();
    }
  );
  qualitySlider.addEventListener("input", () => {
    qualityValue.textContent = `${qualitySlider.value}%`;
  });
  qualitySlider.addEventListener("change", () => {
    updateSettings({ quality: qualitySlider.valueAsNumber });
    savedNotice();
  });

  const resizeError = h("p", { class: "settings-error", role: "alert", hidden: true });
  function dimensionInput(key, label) {
    const input = h("input", {
      id: `settings-${key}-${id}`,
      type: "number",
      inputmode: "numeric",
      min: 1,
      max: MAX_OUTPUT_DIMENSION,
      value: settings[key === "width" ? "resizeWidth" : "resizeHeight"],
    });
    input.addEventListener("change", () => {
      const value = Number(input.value);
      if (!Number.isInteger(value) || value < 1 || value > MAX_OUTPUT_DIMENSION) {
        resizeError.textContent = `${label} must be a whole number from 1 to ${MAX_OUTPUT_DIMENSION.toLocaleString()}.`;
        resizeError.hidden = false;
        input.value = getSettings()[key === "width" ? "resizeWidth" : "resizeHeight"];
        return;
      }
      resizeError.hidden = true;
      updateSettings({ [key === "width" ? "resizeWidth" : "resizeHeight"]: value });
      savedNotice();
    });
    return h("div", { class: "settings-field" }, h("label", { for: input.id }, `${label} (px)`), input);
  }

  const aspect = checkbox(
    `settings-aspect-${id}`,
    "Keep aspect ratio when batch resizing",
    "Each image is scaled to fit inside the size above and is never enlarged.",
    settings.keepAspect,
    (value) => {
      updateSettings({ keepAspect: value });
      savedNotice();
    }
  );

  // ---------------- File management ----------------
  const viewGroup = radioGroup(
    "settings-view",
    "Default file view",
    [["list", "List"], ["grid", "Grid"]],
    settings.viewMode,
    (value) => {
      updateSettings({ viewMode: value });
      // Switch the list that is on screen now, using the existing toggle.
      document.querySelector(`#view-toggle [data-view="${value}"]`)?.click();
      savedNotice();
    }
  );

  const historySetting = checkbox(
    `settings-history-${id}`,
    "Save processing history",
    "When off, new work is not recorded. Existing records stay until you delete them.",
    settings.saveHistory,
    (value) => {
      updateSettings({ saveHistory: value });
      savedNotice();
    }
  );

  const storageInfo = h("p", { class: "settings-hint" }, "Checking storage…");
  async function refreshStorage() {
    try {
      const [records, mode] = await Promise.all([getAllRecords(), getStorageMode()]);
      let usage = "";
      try {
        const estimate = await navigator.storage?.estimate?.();
        if (estimate?.usage) usage = ` This site uses about ${formatBytes(estimate.usage)} of browser storage in total.`;
      } catch {
        // The estimate is optional.
      }
      replaceContent(
        storageInfo,
        `${records.length} history ${records.length === 1 ? "record" : "records"}, ${
          mode === "indexeddb" ? "saved in this browser" : "kept in memory only (lost when the tab closes)"
        }.${usage}`
      );
    } catch {
      replaceContent(storageInfo, "Storage information is not available.");
    }
  }

  // ---------------- Privacy ----------------
  const clearHistoryButton = h("button", { class: "button button-secondary", type: "button" }, "Clear processing history");
  clearHistoryButton.addEventListener("click", async () => {
    const confirmed = await confirmDialog({
      title: "Clear all history?",
      message: "This permanently deletes the processing history stored in this browser. Your images are not affected.",
      confirmLabel: "Clear all history",
      danger: true,
    });
    if (!confirmed) return;
    try {
      await clearHistory();
      notify({ type: "success", title: "History cleared", message: "Processing history cleared." });
      refreshStorage();
    } catch {
      notify({ type: "error", title: "Not cleared", message: "History could not be cleared." });
    }
  });

  const resetButton = h("button", { class: "button button-secondary", type: "button" }, "Reset saved preferences");
  resetButton.addEventListener("click", async () => {
    const confirmed = await confirmDialog({
      title: "Reset saved preferences?",
      message: "This clears your settings, your theme choice, and the cached GitHub statistics stored in this browser. Processing history is not affected.",
      confirmLabel: "Reset preferences",
      danger: true,
    });
    if (!confirmed) return;
    resetSettings();
    try {
      localStorage.removeItem(GITHUB_CACHE_KEY);
    } catch {
      // Nothing to remove if storage is unavailable.
    }
    theme.reset();
    notify({ type: "success", title: "Preferences reset", message: "Saved preferences were cleared." });
    dialog.close();
  });

  // ---------------- Layout ----------------
  const section = (title, ...children) =>
    h("section", { class: "settings-section" }, h("h3", {}, title), ...children);

  const closeButton = h("button", { class: "converter-close", type: "button", "aria-label": "Close settings" }, "×");

  const dialog = h(
    "dialog",
    { class: "settings-dialog", "aria-labelledby": titleId },
    h(
      "div",
      { class: "converter-header" },
      h(
        "div",
        {},
        h("span", { class: "converter-label" }, "FILEFORGE / SETTINGS"),
        h("h2", { id: titleId }, "Settings"),
        h("p", {}, "Preferences stay in this browser.")
      ),
      closeButton
    ),
    h(
      "div",
      { class: "settings-body" },
      section("Appearance", themeGroup.element),
      section(
        "File processing",
        h("p", { class: "settings-hint" }, "Starting values for the tools and batch processing. You can still change them each time."),
        h("div", { class: "settings-field" }, h("label", { for: formatSelect.id }, "Default output format"), formatSelect),
        h(
          "div",
          { class: "settings-field" },
          h("label", { for: qualitySlider.id }, "Default quality ", qualityValue),
          qualitySlider
        ),
        qualityDefault.element,
        h("div", { class: "settings-row" }, dimensionInput("width", "Default width"), dimensionInput("height", "Default height")),
        resizeError,
        aspect.element
      ),
      section(
        "File management",
        viewGroup.element,
        historySetting.element,
        storageInfo,
        h(
          "div",
          { class: "settings-actions" },
          h(
            "button",
            {
              class: "button button-secondary",
              type: "button",
              onClick: () => {
                dialog.addEventListener("close", () => openHistoryDialog(), { once: true });
                dialog.close();
              },
            },
            "Open processing history"
          )
        )
      ),
      section(
        "Privacy",
        h(
          "ul",
          { class: "settings-list" },
          h("li", {}, "Images are processed on this device. The app has no server that receives them."),
          h("li", {}, "Saved in this browser: your theme and these settings (local storage), processing history records (IndexedDB), and, only if you use the GitHub statistics button, a cached copy of public repository numbers."),
          h("li", {}, "History stores names, formats, sizes and settings, never your images or results.")
        ),
        h("div", { class: "settings-actions" }, clearHistoryButton, resetButton)
      ),
      section(
        "About",
        h("p", { class: "settings-about" }, `FileForge version ${APP_VERSION}`),
        h("p", { class: "settings-hint" }, "FileForge is open source. The code is public on GitHub, where you can read it, report problems and suggest changes."),
        h(
          "a",
          { class: "button button-secondary settings-link", href: REPO_URL, target: "_blank", rel: "noopener noreferrer" },
          "View on GitHub",
          h("span", { class: "visually-hidden" }, " (opens in a new tab)")
        )
      )
    )
  );

  closeButton.addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });
  dialog.addEventListener("close", () => {
    dialog.remove();
    openDialog = null;
  });

  document.body.appendChild(dialog);
  dialog.showModal();
  openDialog = dialog;
  refreshStorage();
  closeButton.focus();
}

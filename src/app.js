import { formatBytes } from "./lib/format.js";
import { validateImageFile, REJECTION_LABELS, MAX_QUEUE_FILES } from "./lib/files.js";
import { downloadBlob, createZipArchive } from "./lib/download.js";
import { convertImage, compressImage, resizeImage } from "./lib/imageProcessing.js";
import { showToast, notify } from "./lib/toast.js";
import { getSettings } from "./lib/settings.js";
import { REPO_URL, GITHUB_ICON } from "./lib/github.js";
import { openBatchDialog } from "./ui/batchDialog.js";
import { openHistoryDialog } from "./ui/historyDialog.js";
import { openSettingsDialog } from "./ui/settingsDialog.js";
import { createCommandPalette, shortcutLabel } from "./ui/commandPalette.js";
import { renderOpenSourceSection, renderFooterLinks } from "./ui/openSource.js";
import { startToolRun } from "./lib/runRecorder.js";
import { initializeNavigation } from "./ui/navigation.js";
import { createFileListView } from "./ui/fileList.js";

export { showToast };

export function initializeApp() {
  const app = document.querySelector("#app");

  app.innerHTML = `
    <div class="app-shell">
      <header class="navbar">
        <a class="brand" href="#" aria-label="FileForge home">
          <span class="brand-icon" aria-hidden="true">F</span>
          <span>FileForge</span>
        </a>

        <nav class="nav-links" aria-label="Main">
          <a href="#tools" data-nav-section="tools">Tools</a>
          <button class="nav-link-button" id="open-history" type="button">History</button>
          <button class="nav-link-button" id="open-settings" type="button">Settings</button>
          <a href="#privacy" data-nav-section="privacy">Privacy</a>
          <a
            class="nav-github"
            href="${REPO_URL}"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="FileForge on GitHub (opens in a new tab)"
          >
            ${GITHUB_ICON}
            <span>GitHub</span>
          </a>
        </nav>

        <div class="navbar-actions">
          <button class="palette-launcher" id="open-palette" type="button" aria-label="Search commands" aria-keyshortcuts="Control+K Meta+K">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><circle cx="7" cy="7" r="4.5"/><path d="m10.5 10.5 3 3"/></svg>
            <span class="palette-launcher-text">Search</span>
            <kbd class="palette-launcher-key" id="palette-shortcut" aria-hidden="true"></kbd>
          </button>
          <button class="theme-toggle" id="theme-toggle" aria-label="Switch theme">
            ☼
          </button>
          <button
            class="nav-menu-button"
            id="nav-menu-button"
            type="button"
            aria-label="Open menu"
            aria-expanded="false"
            aria-controls="nav-drawer"
          >
            <span class="nav-menu-bars" aria-hidden="true"></span>
          </button>
        </div>
      </header>

      <div class="nav-overlay" id="nav-overlay" hidden></div>
      <aside class="nav-drawer" id="nav-drawer" aria-label="Menu" inert>
        <div class="nav-drawer-header">
          <span class="nav-drawer-title">Menu</span>
          <button class="nav-drawer-close" id="nav-drawer-close" type="button" aria-label="Close menu">
            <span aria-hidden="true">×</span>
          </button>
        </div>
        <nav class="nav-drawer-links" aria-label="Menu links">
          <a href="#tools" data-nav-section="tools">Tools</a>
          <button type="button" data-nav-action="palette">Search commands</button>
          <button type="button" data-nav-action="history">History</button>
          <button type="button" data-nav-action="settings">Settings</button>
          <a href="#privacy" data-nav-section="privacy">Privacy</a>
          <a href="${REPO_URL}" target="_blank" rel="noopener noreferrer">
            ${GITHUB_ICON}
            <span>GitHub<span class="visually-hidden"> (opens in a new tab)</span></span>
          </a>
          <button type="button" data-nav-action="install" hidden>Install app</button>
        </nav>
      </aside>

      <main>
        <section class="hero">
          <p class="hero-eyebrow">IMAGE WORKSPACE</p>
          <h1>Image tools,<br /><span>made simple.</span></h1>
          <p class="hero-description">
            Convert, compress, resize, and crop images right in your browser.
          </p>
        </section>

        <section class="workspace">
          <div class="section-heading">
            <div>
              <h2>Start with your files</h2>
              <p>Select images to begin processing.</p>
            </div>
            <span class="file-count" id="file-count">0 files</span>
          </div>

          <div class="upload-zone" id="upload-zone">
            <input
              id="file-input"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              multiple
              hidden
            />

            <div class="upload-icon">↑</div>
            <h3>Drop your images here</h3>
            <p>or select files from your device</p>

            <button class="button button-primary" id="browse-button">
              Browse files
            </button>

            <span class="supported-formats">PNG · JPEG · WebP</span>
            <span class="privacy-indicator">◈ Processed locally · files are never uploaded</span>
          </div>

          <div class="file-list" id="file-list" hidden>
            <div class="file-list-header">
              <h3>Selected files</h3>
              <div class="file-list-actions">
                <div class="view-toggle" id="view-toggle" role="group" aria-label="File view">
                  <button type="button" data-view="list" aria-pressed="true" aria-label="List view" title="List view">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><path d="M5.5 4h8M5.5 8h8M5.5 12h8M2.5 4h.01M2.5 8h.01M2.5 12h.01"/></svg>
                  </button>
                  <button type="button" data-view="grid" aria-pressed="false" aria-label="Grid view" title="Grid view">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" aria-hidden="true"><rect x="2.5" y="2.5" width="4.5" height="4.5" rx="1"/><rect x="9" y="2.5" width="4.5" height="4.5" rx="1"/><rect x="2.5" y="9" width="4.5" height="4.5" rx="1"/><rect x="9" y="9" width="4.5" height="4.5" rx="1"/></svg>
                  </button>
                </div>
                <button class="button button-primary" id="open-batch" type="button">
                  Batch process
                </button>
                <button
                  class="button button-quiet"
                  id="clear-files"
                  type="button"
                  title="Clear the whole queue"
                >
                  Clear all
                </button>
              </div>
            </div>
            <div id="file-items"></div>
          </div>
        </section>

        <section class="tools-section" id="tools">
          <div class="section-heading">
            <div>
              <h2>Image tools</h2>
              <p>Choose a tool for your files.</p>
            </div>
          </div>

          <div class="tool-grid">
            <button class="tool-card" data-tool="Image Converter">
              <span class="tool-icon">⇄</span>
              <span class="tool-title">Image Converter</span>
              <span class="tool-description">
                Convert PNG, JPEG, and WebP.
              </span>
              <span class="tool-action">Open tool →</span>
            </button>

            <button class="tool-card" data-tool="Image Compressor">
              <span class="tool-icon">⌁</span>
              <span class="tool-title">Image Compressor</span>
              <span class="tool-description">
                Adjust quality and compare file sizes.
              </span>
              <span class="tool-action">Open tool →</span>
            </button>

            <button class="tool-card" data-tool="Image Resizer">
              <span class="tool-icon">⤢</span>
              <span class="tool-title">Image Resizer</span>
              <span class="tool-description">
                Resize or frame images with visual crop controls.
              </span>
              <span class="tool-action">Open tool →</span>
            </button>

            <button class="tool-card" data-tool="File Inspector">
              <span class="tool-icon">⌕</span>
              <span class="tool-title">File Inspector</span>
              <span class="tool-description">
                Review image format, dimensions, and file size.
              </span>
              <span class="tool-action">Open tool →</span>
            </button>
          </div>
        </section>

        <section class="privacy-section" id="privacy">
          <div class="privacy-icon">◈</div>
          <div class="privacy-body">
            <h2>Files stay on your device</h2>
            <p>
              Image tools process files directly in your browser. Your selected
              images are not sent to a FileForge server.
            </p>
            <ul class="privacy-points">
              <li>Previews, resizing, compression, conversion and inspection all run locally with browser APIs.</li>
              <li>Processing history (file names, formats, sizes, settings and times) is stored only in this browser. Processed files and image previews are not stored.</li>
              <li>Deleting history entries, or clearing history, removes those records from this browser.</li>
              <li>Temporary previews and processing data are released when you close a tool or clear the queue.</li>
              <li>No accounts, analytics or tracking scripts. The optional GitHub statistics contact GitHub only if you ask for them.</li>
            </ul>
          </div>
          <span class="privacy-label">BROWSER-BASED</span>
        </section>

        <div id="open-source-root"></div>
      </main>

      <footer class="footer">
        <a class="footer-brand" href="#">FileForge</a>
        <p>Simple image utilities for everyday work.</p>
        <div class="footer-links" id="footer-links"></div>
      </footer>

      <div class="toast-container" id="toast-container" aria-live="polite"></div>
    </div>
  `;

  const theme = initializeTheme();
  initializeNavigation();

  const upload = initializeUpload();

  initializeToolCards(upload.getFiles, upload.subscribe);

  document
    .querySelector("#open-batch")
    .addEventListener("click", () => openBatchDialog(upload));

  document
    .querySelector("#open-history")
    .addEventListener("click", () => openHistoryDialog());

  document
    .querySelector("#open-settings")
    .addEventListener("click", () => openSettingsDialog({ theme }));

  initializeCommandPalette({ theme, upload });

  renderOpenSourceSection(document.querySelector("#open-source-root"));
  renderFooterLinks(document.querySelector("#footer-links"));
}

// ==========================================
// COMMAND PALETTE
// ==========================================

// Each command presses the same button or card a person would click, so the
// palette never duplicates what the tools do.
function initializeCommandPalette({ theme, upload }) {
  const click = (selector) => () => document.querySelector(selector)?.click();
  const needsImages = () => (upload.getFiles().length === 0 ? "Add images first" : "");

  const palette = createCommandPalette({
    getCommands: () => [
      { id: "add", label: "Add images", hint: "Choose files", keywords: "upload select browse open files", run: click("#browse-button") },
      { id: "converter", label: "Open Image Converter", hint: needsImages(), keywords: "convert format png jpeg webp tool", run: click('[data-tool="Image Converter"]') },
      { id: "compressor", label: "Open Image Compressor", hint: needsImages(), keywords: "compress smaller reduce size tool", run: click('[data-tool="Image Compressor"]') },
      { id: "resizer", label: "Open Image Resizer", hint: needsImages(), keywords: "resize crop scale dimensions tool", run: click('[data-tool="Image Resizer"]') },
      { id: "inspector", label: "Open File Inspector", hint: needsImages(), keywords: "inspect details information metadata tool", run: click('[data-tool="File Inspector"]') },
      { id: "batch", label: "Batch process images", hint: needsImages(), keywords: "batch many all queue", run: click("#open-batch") },
      { id: "history", label: "Open Processing History", keywords: "past records previous log", run: click("#open-history") },
      { id: "settings", label: "Open Settings", keywords: "preferences options defaults", run: click("#open-settings") },
      { id: "theme", label: "Toggle theme", hint: theme.get() === "dark" ? "Switch to light" : "Switch to dark", keywords: "dark light appearance mode", run: () => theme.toggle() },
      { id: "tools", label: "Go to Tools", keywords: "section", run: click('a[href="#tools"]') },
      { id: "privacy", label: "Go to Privacy information", keywords: "section local data", run: click('a[href="#privacy"]') },
      {
        id: "github",
        label: "Open GitHub repository",
        hint: "Opens in a new tab",
        keywords: "source code open source repo",
        run: () => window.open(REPO_URL, "_blank", "noopener,noreferrer"),
      },
    ],
  });

  document.querySelector("#palette-shortcut").textContent = shortcutLabel();
  document.querySelector("#open-palette").addEventListener("click", () => palette.open());
}

// ==========================================
// THEME
// ==========================================

function initializeTheme() {
  const toggle = document.querySelector("#theme-toggle");

  function setTheme(theme) {
    document.documentElement.dataset.theme = theme;

    toggle.textContent = theme === "dark" ? "☼" : "☾";

    toggle.setAttribute(
      "aria-label",
      theme === "dark" ? "Switch to light theme" : "Switch to dark theme"
    );
  }

  let savedTheme = null;
  try {
    savedTheme = localStorage.getItem("fileforge-theme");
  } catch {
    // Theme preferences are optional when browser storage is unavailable.
  }

  const initialTheme =
    savedTheme ||
    (window.matchMedia("(prefers-color-scheme: light)").matches
      ? "light"
      : "dark");

  setTheme(initialTheme);

  const controller = {
    get: () => document.documentElement.dataset.theme,
    set(theme) {
      setTheme(theme);
      try {
        localStorage.setItem("fileforge-theme", theme);
      } catch {
        // Keep the selected theme for this session if storage is unavailable.
      }
    },
    toggle() {
      controller.set(controller.get() === "dark" ? "light" : "dark");
    },
    // Forget the saved choice and follow the system preference again.
    reset() {
      try {
        localStorage.removeItem("fileforge-theme");
      } catch {
        // Nothing saved to remove.
      }
      setTheme(window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark");
    },
  };

  toggle.addEventListener("click", () => controller.toggle());
  return controller;
}

// ==========================================
// FILE UPLOAD
// ==========================================

function initializeUpload() {
  const input = document.querySelector("#file-input");
  const browseButton = document.querySelector("#browse-button");
  const uploadZone = document.querySelector("#upload-zone");
  const fileList = document.querySelector("#file-list");
  const fileItems = document.querySelector("#file-items");
  const fileCount = document.querySelector("#file-count");
  const clearButton = document.querySelector("#clear-files");

  // The selected files are also the batch queue.
  let files = [];
  const listeners = new Set();

  browseButton.addEventListener("click", () => input.click());

  input.addEventListener("change", () => {
    addFiles(input.files);
    input.value = "";
  });

  uploadZone.addEventListener("dragover", (event) => {
    event.preventDefault();
    uploadZone.classList.add("is-dragging");
  });

  uploadZone.addEventListener("dragleave", (event) => {
    if (!uploadZone.contains(event.relatedTarget)) {
      uploadZone.classList.remove("is-dragging");
    }
  });

  uploadZone.addEventListener("drop", (event) => {
    event.preventDefault();
    uploadZone.classList.remove("is-dragging");
    addFiles(event.dataTransfer.files);
  });

  clearButton.addEventListener("click", clearFiles);

  function isDuplicate(file) {
    return files.some(
      (existing) =>
        existing.name === file.name &&
        existing.size === file.size &&
        existing.lastModified === file.lastModified
    );
  }

  function changed() {
    renderFiles();
    listeners.forEach((listener) => listener());
  }

  // Validates every file (size, type, extension, signature, decoding) before
  // it is allowed into the queue.
  async function addFiles(fileCollection) {
    const incomingFiles = Array.from(fileCollection);
    const rejections = new Map();
    const countBefore = files.length;
    let duplicates = 0;
    let overLimit = 0;

    for (const file of incomingFiles) {
      if (files.length >= MAX_QUEUE_FILES) {
        overLimit++;
        continue;
      }

      if (isDuplicate(file)) {
        duplicates++;
        continue;
      }

      const check = await validateImageFile(file);

      if (!check.ok) {
        rejections.set(check.code, (rejections.get(check.code) || 0) + 1);
        continue;
      }

      // Another add may have finished while this file was being checked.
      if (isDuplicate(file)) {
        duplicates++;
        continue;
      }

      files.push(file);
    }

    changed();

    const notes = [];
    const rejected = [...rejections.values()].reduce((total, count) => total + count, 0);

    if (rejected > 0) {
      const reasons = [...rejections]
        .map(([code, count]) => `${count} ${REJECTION_LABELS[code]}`)
        .join("; ");
      notes.push(`${rejected} file(s) skipped: ${reasons}.`);
    }
    if (duplicates > 0) notes.push(`${duplicates} duplicate(s) ignored.`);
    if (overLimit > 0) {
      notes.push(`The queue is limited to ${MAX_QUEUE_FILES} files; ${overLimit} not added.`);
    }

    const added = files.length - countBefore;
    if (added > 0) {
      notify({ type: "success", title: "Images added", message: `${added} ${added === 1 ? "image is" : "images are"} ready.` });
    }
    if (notes.length > 0) notify({ type: "warning", title: "Some files were not added", message: notes.join(" ") });
  }

  function removeFile(file) {
    const index = files.indexOf(file);
    if (index === -1) return;
    files.splice(index, 1);
    changed();
  }

  function clearFiles() {
    if (files.length === 0) return;
    files = [];
    changed();
  }

  const fileListView = createFileListView({
    container: fileItems,
    toggle: document.querySelector("#view-toggle"),
    onRemove: removeFile,
    fallbackFocus: browseButton,
  });

  function renderFiles() {
    fileList.hidden = files.length === 0;

    fileCount.textContent =
      `${files.length} ${files.length === 1 ? "file" : "files"}`;

    fileListView.render(files);
  }

  return {
    getFiles: () => [...files],
    addFiles,
    removeFile,
    clearFiles,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

// ==========================================
// TOOL CARDS
// ==========================================

function initializeToolCards(getFiles, subscribe) {
  const cards = [...document.querySelectorAll("[data-tool]")];

  // Status line on each card: tools need at least one image.
  function updateCardStates() {
    const ready = getFiles().length > 0;
    cards.forEach((card) => {
      card.dataset.state = ready ? "ready" : "idle";
      card.querySelector(".tool-action").textContent = ready ? "Open tool →" : "Add images first";
    });
  }
  subscribe(updateCardStates);
  updateCardStates();

  cards.forEach((card) => {
    card.addEventListener("click", () => {
      const tool = card.dataset.tool;
      const files = getFiles();

      if (files.length === 0) {
        showToast("Upload at least one image first.");
        return;
      }

      if (tool === "File Inspector") {
        showFileInspector(files);
        return;
      }

      if (tool === "Image Converter") {
        showImageConverter(files);
        return;
      }

      if (tool === "Image Compressor") {
        showImageCompressor(files);
        return;
      }

      if (tool === "Image Resizer") showImageResizer(files);
    });
  });
}

// ==========================================
// FILE INSPECTOR
// ==========================================

function showFileInspector(files) {
  const dialog = document.createElement("dialog");
  dialog.className = "inspector-dialog";

  dialog.innerHTML = `
    <div class="inspector-header">
      <div>
        <span class="inspector-label">FILEFORGE / INSPECTION</span>
        <h2>File Inspector</h2>
        <p>Detailed information about your selected files.</p>
      </div>

      <button class="inspector-close" type="button" aria-label="Close inspector">
        ×
      </button>
    </div>

    <div class="inspector-content">
      <p class="inspector-loading">Inspecting your files...</p>
    </div>

    <div class="inspector-footer">
      <span>◈ PROCESSED LOCALLY</span>
      <span class="inspector-count"></span>
    </div>
  `;

  document.body.appendChild(dialog);

  const content = dialog.querySelector(".inspector-content");
  const closeButton = dialog.querySelector(".inspector-close");

  dialog.querySelector(".inspector-count").textContent =
    `${files.length} ${files.length === 1 ? "FILE" : "FILES"}`;

  closeButton.addEventListener("click", () => dialog.close());

  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) {
      dialog.close();
    }
  });

  const inspection = { cancelled: false, urls: [] };
  dialog.addEventListener("close", () => {
    inspection.cancelled = true;
    inspection.urls.forEach((url) => URL.revokeObjectURL(url));
    dialog.remove();
  });

  dialog.showModal();
  inspectFiles(files, content, inspection);
}

async function inspectFiles(files, container, inspection) {
  container.innerHTML = "";

  for (const file of files) {
    const card = document.createElement("article");
    card.className = "inspector-card";

    const preview = document.createElement("img");
    preview.className = "inspector-preview";
    preview.alt = `Preview of ${file.name}`;
    const previewUrl = URL.createObjectURL(file);
    inspection.urls.push(previewUrl);
    preview.src = previewUrl;

    const details = document.createElement("div");
    details.className = "inspector-details";

    const title = document.createElement("h3");
    title.textContent = file.name;

    const status = document.createElement("span");
    status.className = "inspector-status";
    status.textContent = "ANALYZING...";

    details.append(title, status);

    const information = document.createElement("div");
    information.className = "inspector-information";

    addInspectorRow(information, "FILE NAME", file.name);
    addInspectorRow(information, "FILE TYPE", file.type || "Unknown");
    addInspectorRow(information, "FILE SIZE", formatBytes(file.size));

    addInspectorRow(
      information,
      "LAST MODIFIED",
      file.lastModified
        ? new Date(file.lastModified).toLocaleString()
        : "Unknown"
    );

    card.append(preview, details, information);
    container.appendChild(card);

    try {
      const bitmap = await createImageBitmap(file);
      if (inspection.cancelled) {
        bitmap.close();
        return;
      }

      const width = bitmap.width;
      const height = bitmap.height;

      const divisor = getGreatestCommonDivisor(width, height);
      const aspectRatio = `${width / divisor}:${height / divisor}`;

      addInspectorRow(information, "WIDTH", `${width} px`);
      addInspectorRow(information, "HEIGHT", `${height} px`);
      addInspectorRow(information, "DIMENSIONS", `${width} × ${height} px`);
      addInspectorRow(information, "ASPECT RATIO", aspectRatio);

      addInspectorRow(
        information,
        "TOTAL PIXELS",
        (width * height).toLocaleString()
      );

      bitmap.close();

      status.textContent = "INSPECTION COMPLETE";
      status.classList.add("is-complete");
    } catch (error) {
      if (inspection.cancelled) return;
      console.error(`Could not inspect ${file.name}:`, error);

      addInspectorRow(information, "DIMENSIONS", "Unavailable");

      status.textContent = "INSPECTION INCOMPLETE";
      status.classList.add("is-error");
    }
  }
}

function addInspectorRow(container, label, value) {
  const row = document.createElement("div");
  row.className = "inspector-row";

  const labelElement = document.createElement("span");
  labelElement.className = "inspector-row-label";
  labelElement.textContent = label;

  const valueElement = document.createElement("span");
  valueElement.className = "inspector-row-value";
  valueElement.textContent = value;

  row.append(labelElement, valueElement);
  container.appendChild(row);
}

function getGreatestCommonDivisor(a, b) {
  while (b !== 0) {
    const remainder = a % b;
    a = b;
    b = remainder;
  }

  return a || 1;
}

// ==========================================
// IMAGE CONVERTER
// ==========================================

function showImageConverter(files) {
  const dialog = document.createElement("dialog");
  dialog.className = "converter-dialog";

  let previewUrls = [];
  let cancelled = false;

  dialog.innerHTML = `
    <div class="converter-header">
      <div>
        <span class="converter-label">FILEFORGE / CONVERSION</span>
        <h2>Image Converter</h2>
        <p>Convert your images into different formats.</p>
      </div>

      <button class="converter-close" type="button" aria-label="Close">
        ×
      </button>
    </div>

    <div class="converter-controls">
      <div class="converter-control">
        <label for="output-format">Output format</label>

        <select id="output-format">
          <option value="image/png">PNG</option>
          <option value="image/jpeg">JPEG</option>
          <option value="image/webp">WebP</option>
        </select>
      </div>

      <div class="converter-control" id="quality-control">
        <label for="output-quality">
          Image quality
          <span id="quality-value">85%</span>
        </label>

        <input
          type="range"
          id="output-quality"
          min="10"
          max="100"
          value="85"
        />

        <small>Only applies to JPEG and WebP.</small>
      </div>
    </div>

    <div class="converter-actions">
      <span>
        ${files.length} ${files.length === 1 ? "file" : "files"} selected
      </span>

      <button class="button button-primary" id="convert-button">
        Convert images
      </button>
    </div>

    <div class="converter-results" id="converter-results">
      <div class="converter-empty">
        Your converted images will appear here.
      </div>
    </div>

    <div class="converter-footer">
      <span>◈ PROCESSED LOCALLY</span>
      <span>NO FILE UPLOADS</span>
    </div>
  `;

  document.body.appendChild(dialog);

  const closeButton = dialog.querySelector(".converter-close");
  const convertButton = dialog.querySelector("#convert-button");
  const formatSelect = dialog.querySelector("#output-format");
  const qualitySlider = dialog.querySelector("#output-quality");
  const qualityValue = dialog.querySelector("#quality-value");
  const qualityControl = dialog.querySelector("#quality-control");
  const results = dialog.querySelector("#converter-results");

  function setControlsDisabled(disabled) {
    [widthInput, heightInput, modeSelect, cropHorizontal, cropVertical].forEach((control) => {
      control.disabled = disabled;
    });
  }

  function cleanup() {
    cancelled = true;
    previewUrls.forEach((url) => URL.revokeObjectURL(url));
    previewUrls = [];
    dialog.remove();
  }

  closeButton.addEventListener("click", () => dialog.close());

  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) {
      dialog.close();
    }
  });

  dialog.addEventListener("close", cleanup);

  formatSelect.addEventListener("change", () => {
    qualityControl.hidden = formatSelect.value === "image/png";
  });

  qualitySlider.addEventListener("input", () => {
    qualityValue.textContent = `${qualitySlider.value}%`;
  });

  // Saved preferences (Settings) replace this tool's own starting values.
  const prefs = getSettings();
  if (prefs.outputFormat) {
    formatSelect.value = prefs.outputFormat;
    formatSelect.dispatchEvent(new Event("change"));
  }
  if (prefs.quality !== null) {
    qualitySlider.value = prefs.quality;
    qualitySlider.dispatchEvent(new Event("input"));
  }

  convertButton.addEventListener("click", async () => {
    convertButton.disabled = true;
    convertButton.textContent = "Converting...";

    results.innerHTML = `
      <div class="converter-empty" aria-live="polite">
        Processing your images...
      </div>
    `;

    previewUrls.forEach((url) => URL.revokeObjectURL(url));
    previewUrls = [];

    const format = formatSelect.value;
    const quality = Number(qualitySlider.value) / 100;

    const convertedFiles = [];
    const run = startToolRun("convert", {
      format,
      quality: Number(qualitySlider.value),
    });

    for (const [index, file] of files.entries()) {
      if (cancelled) return;
      results.querySelector(".converter-empty").textContent =
        `Converting ${index + 1} of ${files.length}: ${file.name}`;
      try {
        const converted = await convertImage(file, format, quality);
        convertedFiles.push(converted);
        run.success(file, converted);
      } catch (error) {
        console.error(`Conversion failed for ${file.name}:`, error);
        run.failure(file, error);

        convertedFiles.push({
          original: file,
          error: true,
        });
      }
    }

    if (!dialog.isConnected) return;

    renderConversionResults(results, convertedFiles, previewUrls);

    convertButton.disabled = false;
    convertButton.textContent = "Convert again";
  });

  dialog.showModal();
}

function showImageResizer(files) {
  const dialog = document.createElement("dialog");
  dialog.className = "converter-dialog";
  dialog.innerHTML = `
    <div class="converter-header">
      <div>
        <span class="converter-label">FILEFORGE / RESIZING</span>
        <h2>Image Resizer</h2>
        <p>Fit images within bounds or open the visual crop editor.</p>
      </div>
      <button class="converter-close" type="button" aria-label="Close">×</button>
    </div>
    <div class="converter-controls">
      <div class="converter-control">
        <label for="resize-width">Maximum width (px)</label>
        <input id="resize-width" type="number" min="1" max="12000" value="1200">
      </div>
      <div class="converter-control">
        <label for="resize-height">Maximum height (px)</label>
        <input id="resize-height" type="number" min="1" max="12000" value="1200">
      </div>
    </div>
    <div class="converter-actions resizer-actions">
      <span>${files.length} ${files.length === 1 ? "file" : "files"} selected</span>
      <div>
        <button class="button button-secondary" id="open-crop-editor">Open crop editor</button>
        <button class="button button-primary" id="resize-button">Resize images</button>
      </div>
    </div>
    <div class="converter-results" id="resize-results" aria-live="polite">
      <div class="converter-empty">Resized images will appear here.</div>
    </div>
    <div class="converter-footer"><span>◈ PROCESSED LOCALLY</span><span>NO FILE UPLOADS</span></div>`;

  document.body.appendChild(dialog);
  const closeButton = dialog.querySelector(".converter-close");
  const resizeButton = dialog.querySelector("#resize-button");
  const cropButton = dialog.querySelector("#open-crop-editor");
  const results = dialog.querySelector("#resize-results");
  const widthInput = dialog.querySelector("#resize-width");
  const heightInput = dialog.querySelector("#resize-height");
  widthInput.value = getSettings().resizeWidth;
  heightInput.value = getSettings().resizeHeight;
  const urls = [];
  let cancelled = false;

  function cleanup() {
    cancelled = true;
    urls.forEach((url) => URL.revokeObjectURL(url));
    dialog.remove();
  }

  closeButton.addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });
  dialog.addEventListener("close", cleanup);
  cropButton.addEventListener("click", () => {
    dialog.addEventListener("close", () => showImageCropEditor(files), { once: true });
    dialog.close();
  });

  resizeButton.addEventListener("click", async () => {
    const width = Number(widthInput.value);
    const height = Number(heightInput.value);
    if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width > 12000 || height > 12000) {
      showToast("Enter dimensions between 1 and 12,000 pixels.");
      return;
    }
    resizeButton.disabled = true;
    cropButton.disabled = true;
    resizeButton.textContent = "Resizing...";
    urls.forEach((url) => URL.revokeObjectURL(url));
    urls.length = 0;
    results.innerHTML = `<div class="converter-empty" aria-live="polite"></div>`;
    const processed = [];
    const run = startToolRun("resize", { width, height, keepAspect: true });
    for (const [index, file] of files.entries()) {
      if (cancelled) return;
      results.querySelector(".converter-empty").textContent = `Resizing ${index + 1} of ${files.length}: ${file.name}`;
      try {
        const resized = await resizeImage(file, width, height);
        processed.push(resized);
        run.success(file, resized);
      } catch (error) {
        processed.push({ original: file, error: true, message: error.message });
        run.failure(file, error);
      }
    }
    if (cancelled) return;
    results.innerHTML = "";
    processed.forEach((result) => {
      const card = document.createElement("article");
      card.className = "converter-result-card";
      if (result.error) {
        const error = document.createElement("div");
        error.className = "converter-result-error";
        error.textContent = `${result.original.name}: ${result.message}`;
        card.append(error);
      } else {
        const url = URL.createObjectURL(result.blob);
        urls.push(url);
        const image = document.createElement("img");
        image.className = "converter-preview";
        image.src = url;
        image.alt = `Resized ${result.name}`;
        const info = document.createElement("div");
        info.className = "converter-result-info";
        const name = document.createElement("strong");
        name.textContent = result.name;
        const dimensions = document.createElement("span");
        dimensions.textContent = `${result.width} × ${result.height} px`;
        const download = document.createElement("button");
        download.className = "button button-primary";
        download.textContent = "Download";
        download.addEventListener("click", () => downloadBlob(result.blob, result.name));
        info.append(name, dimensions, download);
        card.append(image, info);
      }
      results.append(card);
    });
    resizeButton.disabled = false;
    cropButton.disabled = false;
    resizeButton.textContent = "Resize again";
  });

  dialog.showModal();
}

function showImageCropEditor(files) {
  const dialog = document.createElement("dialog");
  dialog.className = "crop-editor-dialog";
  dialog.innerHTML = `
    <header class="crop-editor-header">
      <div><span class="converter-label">FILEFORGE / CROP</span><h2>Crop image</h2><p>Drag the selection to frame your image. Resize it from a corner.</p></div>
      <button class="converter-close" type="button" aria-label="Close crop editor">×</button>
    </header>
    <div class="crop-editor-layout">
      <section class="crop-editor-workspace">
        <div class="crop-editor-toolbar">
          <label>Image <select id="crop-file"></select></label>
          <div class="crop-editor-tabs" role="tablist" aria-label="Crop shape">
            <button type="button" class="is-active" data-shape="rectangle" role="tab" aria-selected="true">Default crop</button>
            <button type="button" data-shape="circle" role="tab" aria-selected="false">Circle crop</button>
          </div>
        </div>
        <div class="crop-editor-stage" id="crop-stage">
          <canvas id="crop-source" aria-label="Image crop selection"></canvas>
        </div>
        <p class="crop-editor-hint">Drag inside the selection to move it. Drag a corner to resize.</p>
      </section>
      <aside class="crop-editor-settings">
        <div class="crop-editor-preview-wrap"><strong>Preview</strong><canvas id="crop-preview" aria-label="Cropped image preview"></canvas></div>
        <h3>Crop settings</h3>
        <label class="crop-field">Aspect ratio
          <select id="crop-ratio">
            <option value="1:1">Square (1:1)</option><option value="4:3">Standard (4:3)</option><option value="3:2">Photo (3:2)</option><option value="16:9">Wide (16:9)</option><option value="9:16">Portrait (9:16)</option><option value="original">Original</option><option value="free">Free</option>
          </select>
        </label>
        <div class="crop-dimensions">
          <label class="crop-field">Width (px)<input id="crop-width" type="number" min="1" max="12000" value="512"></label>
          <label class="crop-field">Height (px)<input id="crop-height" type="number" min="1" max="12000" value="512"></label>
        </div>
        <label class="crop-field">Target file
          <select id="crop-format"><option value="image/jpeg">.JPG</option><option value="image/png">.PNG</option><option value="image/webp">.WEBP</option></select>
        </label>
        <label class="crop-field" id="crop-quality-wrap">Image quality <span id="crop-quality-label">90%</span>
          <input id="crop-quality" type="range" min="10" max="100" value="90">
        </label>
        <button class="button button-primary crop-download" id="crop-download">Download crop</button>
        <p class="crop-editor-note">Crop processing happens in your browser. Circle crops have a transparent background in PNG and WebP; JPG uses a white background.</p>
      </aside>
    </div>`;
  document.body.appendChild(dialog);

  const sourceCanvas = dialog.querySelector("#crop-source");
  const previewCanvas = dialog.querySelector("#crop-preview");
  const stage = dialog.querySelector("#crop-stage");
  const fileSelect = dialog.querySelector("#crop-file");
  const ratioSelect = dialog.querySelector("#crop-ratio");
  const widthInput = dialog.querySelector("#crop-width");
  const heightInput = dialog.querySelector("#crop-height");
  const formatSelect = dialog.querySelector("#crop-format");
  const quality = dialog.querySelector("#crop-quality");
  const qualityLabel = dialog.querySelector("#crop-quality-label");
  const qualityWrap = dialog.querySelector("#crop-quality-wrap");
  const downloadButton = dialog.querySelector("#crop-download");
  const ctx = sourceCanvas.getContext("2d");
  const previewCtx = previewCanvas.getContext("2d");
  const state = { bitmap: null, file: null, crop: null, shape: "rectangle", dragging: false, resizing: false, pointer: null, frame: null };

  files.forEach((file, index) => {
    const option = document.createElement("option");
    option.value = String(index);
    option.textContent = file.name;
    fileSelect.append(option);
  });

  function setCropFromRatio() {
    if (!state.bitmap) return;
    const ratioValue = ratioSelect.value;
    const ratio = ratioValue === "original" ? state.bitmap.width / state.bitmap.height : ratioValue === "free" ? null : ratioValue.split(":").map(Number).reduce((a, b) => a / b);
    const maxW = state.bitmap.width;
    const maxH = state.bitmap.height;
    let w = maxW;
    let h = ratio ? w / ratio : maxH;
    if (h > maxH) { h = maxH; w = ratio ? h * ratio : maxW; }
    state.crop = { x: (maxW - w) / 2, y: (maxH - h) / 2, w, h };
    if (state.shape === "circle") {
      const side = Math.min(w, h);
      state.crop = { x: (maxW - side) / 2, y: (maxH - side) / 2, w: side, h: side };
    }
    widthInput.value = String(Math.max(1, Math.round(state.crop.w)));
    heightInput.value = String(Math.max(1, Math.round(state.crop.h)));
    draw();
  }

  function draw() {
    if (!state.bitmap) return;
    const box = stage.getBoundingClientRect();
    const maxW = Math.max(200, box.width - 28);
    const maxH = Math.max(180, Math.min(620, window.innerHeight * 0.65));
    const scale = Math.min(maxW / state.bitmap.width, maxH / state.bitmap.height);
    const canvasW = Math.max(1, Math.round(state.bitmap.width * scale));
    const canvasH = Math.max(1, Math.round(state.bitmap.height * scale));
    sourceCanvas.width = canvasW;
    sourceCanvas.height = canvasH;
    sourceCanvas.style.width = canvasW + "px";
    sourceCanvas.style.height = canvasH + "px";
    ctx.drawImage(state.bitmap, 0, 0, canvasW, canvasH);
    const s = canvasW / state.bitmap.width;
    const c = state.crop;
    const x = c.x * s, y = c.y * s, w = c.w * s, h = c.h * s;
    ctx.save();
    ctx.fillStyle = "rgba(7, 12, 18, .68)";
    ctx.beginPath();
    ctx.rect(0, 0, canvasW, canvasH);
    if (state.shape === "circle") { ctx.arc(x + w / 2, y + h / 2, w / 2, 0, Math.PI * 2, true); }
    else ctx.rect(x, y, w, h);
    ctx.fill("evenodd");
    ctx.restore();
    ctx.save();
    ctx.strokeStyle = "#50a9ff";
    ctx.lineWidth = 2;
    if (state.shape === "circle") { ctx.beginPath(); ctx.arc(x + w / 2, y + h / 2, w / 2, 0, Math.PI * 2); ctx.stroke(); }
    else { ctx.strokeRect(x, y, w, h); [[x,y],[x+w,y],[x,y+h],[x+w,y+h]].forEach(([px,py]) => { ctx.fillStyle="#fff"; ctx.fillRect(px-4,py-4,8,8); ctx.strokeRect(px-4,py-4,8,8); }); }
    ctx.restore();

    const outW = Math.min(12000, Math.max(1, Number(widthInput.value) || 1));
    const outH = Math.min(12000, Math.max(1, Number(heightInput.value) || 1));
    const previewScale = Math.min(1, 240 / outW, 200 / outH);
    previewCanvas.width = Math.max(1, Math.round(outW * previewScale));
    previewCanvas.height = Math.max(1, Math.round(outH * previewScale));
    previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
    if (formatSelect.value === "image/jpeg") { previewCtx.fillStyle="#fff"; previewCtx.fillRect(0,0,previewCanvas.width,previewCanvas.height); }
    previewCtx.save();
    if (state.shape === "circle") { previewCtx.beginPath(); previewCtx.arc(previewCanvas.width/2,previewCanvas.height/2,Math.min(previewCanvas.width,previewCanvas.height)/2,0,Math.PI*2); previewCtx.clip(); }
    previewCtx.drawImage(state.bitmap, c.x,c.y,c.w,c.h,0,0,previewCanvas.width,previewCanvas.height);
    previewCtx.restore();
  }

  async function loadSelectedFile() {
    if (state.bitmap) state.bitmap.close();
    state.file = files[Number(fileSelect.value)];
    try {
      state.bitmap = await createImageBitmap(state.file);
      setCropFromRatio();
    } catch {
      showToast("Could not open this image in the crop editor.");
    }
  }

  function applyDimensionChange(changed) {
    if (!state.bitmap || !state.crop) return;
    let w = Math.min(state.bitmap.width, Math.max(1, Number(widthInput.value) || 1));
    let h = Math.min(state.bitmap.height, Math.max(1, Number(heightInput.value) || 1));
    const ratioValue = ratioSelect.value;
    const ratio = state.shape === "circle" ? 1 : ratioValue === "free" ? null : ratioValue === "original" ? state.bitmap.width/state.bitmap.height : ratioValue.split(":").map(Number).reduce((a,b)=>a/b);
    if (ratio) { if (changed === "width") h = w / ratio; else w = h * ratio; }
    if (state.shape === "circle") w = h = Math.min(w,h);
    const factor = Math.min(1, state.bitmap.width/w, state.bitmap.height/h);
    w *= factor; h *= factor;
    state.crop.w=w; state.crop.h=h;
    state.crop.x=Math.min(Math.max(0,state.crop.x),state.bitmap.width-w);
    state.crop.y=Math.min(Math.max(0,state.crop.y),state.bitmap.height-h);
    widthInput.value=String(Math.max(1,Math.round(w)));
    heightInput.value=String(Math.max(1,Math.round(h)));
    draw();
  }

  function pointerDown(event) {
    const rect=sourceCanvas.getBoundingClientRect(), s=rect.width/state.bitmap.width;
    const px=(event.clientX-rect.left)/s, py=(event.clientY-rect.top)/s, c=state.crop;
    const nearCorner=(px>c.x+c.w-18/s && py>c.y+c.h-18/s);
    state.resizing=nearCorner && state.shape!=="circle";
    state.dragging=!state.resizing && px>=c.x && px<=c.x+c.w && py>=c.y && py<=c.y+c.h;
    if (!state.dragging && !state.resizing) return;
    state.pointer={x:px,y:py,crop:{...c}};
    sourceCanvas.setPointerCapture(event.pointerId);
  }
  function pointerMove(event) {
    if (!state.pointer) return;
    const rect=sourceCanvas.getBoundingClientRect(), s=rect.width/state.bitmap.width;
    const px=(event.clientX-rect.left)/s, py=(event.clientY-rect.top)/s;
    const dx=px-state.pointer.x, dy=py-state.pointer.y, c=state.pointer.crop;
    if (state.resizing) {
      const ratio=state.shape==="circle"?1:(ratioSelect.value==="free"?null:ratioSelect.value==="original"?state.bitmap.width/state.bitmap.height:ratioSelect.value.split(":").map(Number).reduce((a,b)=>a/b));
      let w=Math.max(24/s,c.w+dx), h=ratio?w/ratio:Math.max(24/s,c.h+dy);
      const factor=Math.min(1,(state.bitmap.width-c.x)/w,(state.bitmap.height-c.y)/h);
      w*=factor; h*=factor; state.crop={...c,w,h};
      widthInput.value=String(Math.round(w)); heightInput.value=String(Math.round(h));
    } else {
      state.crop.x=Math.min(Math.max(0,c.x+dx),state.bitmap.width-c.w);
      state.crop.y=Math.min(Math.max(0,c.y+dy),state.bitmap.height-c.h);
    }
    draw();
  }
  function pointerUp() { state.pointer=null; state.dragging=false; state.resizing=false; }

  dialog.querySelector(".converter-close").addEventListener("click",()=>dialog.close());
  dialog.addEventListener("click",event=>{if(event.target===dialog)dialog.close();});
  dialog.addEventListener("close",()=>{if(state.bitmap)state.bitmap.close();dialog.remove();});
  fileSelect.addEventListener("change",loadSelectedFile);
  ratioSelect.addEventListener("change",setCropFromRatio);
  widthInput.addEventListener("input",()=>applyDimensionChange("width"));
  heightInput.addEventListener("input",()=>applyDimensionChange("height"));
  formatSelect.addEventListener("change",()=>{qualityWrap.hidden=formatSelect.value==="image/png";draw();});
  quality.addEventListener("input",()=>{qualityLabel.textContent=quality.value+"%";});
  dialog.querySelectorAll("[data-shape]").forEach(tab=>tab.addEventListener("click",()=>{
    state.shape=tab.dataset.shape;
    dialog.querySelectorAll("[data-shape]").forEach(item=>{item.classList.toggle("is-active",item===tab);item.setAttribute("aria-selected",String(item===tab));});
    if(state.shape==="circle"){ratioSelect.value="1:1";ratioSelect.disabled=true;}else ratioSelect.disabled=false;
    setCropFromRatio();
  }));
  sourceCanvas.addEventListener("pointerdown",pointerDown);
  sourceCanvas.addEventListener("pointermove",pointerMove);
  sourceCanvas.addEventListener("pointerup",pointerUp);
  sourceCanvas.addEventListener("pointercancel",pointerUp);
  window.addEventListener("resize",draw);
  dialog.addEventListener("close",()=>window.removeEventListener("resize",draw),{once:true});
  downloadButton.addEventListener("click",async()=>{
    if(!state.bitmap||!state.file)return;
    const width=Math.min(12000,Math.max(1,Number(widthInput.value)||1));
    const height=Math.min(12000,Math.max(1,Number(heightInput.value)||1));
    if(width*height>64_000_000){showToast("Crop output cannot exceed 64 million pixels.");return;}
    const canvas=document.createElement("canvas");canvas.width=width;canvas.height=height;
    const context=canvas.getContext("2d");if(!context){showToast("Canvas is not supported.");return;}
    if(formatSelect.value==="image/jpeg"){context.fillStyle="#fff";context.fillRect(0,0,width,height);}
    if(state.shape==="circle"){context.beginPath();context.arc(width/2,height/2,Math.min(width,height)/2,0,Math.PI*2);context.clip();}
    context.drawImage(state.bitmap,state.crop.x,state.crop.y,state.crop.w,state.crop.h,0,0,width,height);
    downloadButton.disabled=true;downloadButton.textContent="Preparing...";
    try{
      const type=formatSelect.value;
      const blob=await new Promise((resolve,reject)=>canvas.toBlob(value=>value?resolve(value):reject(new Error("Could not create this crop.")),type,type==="image/png"?undefined:Number(quality.value)/100));
      if(blob.type!==type)throw new Error("Your browser could not create the selected format.");
      const extension={"image/jpeg":"jpg","image/png":"png","image/webp":"webp"}[type];
      downloadBlob(blob,`${state.file.name.replace(/\.[^/.]+$/,"")}-crop.${extension}`);
    }catch(error){notify({ type: "error", title: "Crop failed", message: error.message });}
    finally{downloadButton.disabled=false;downloadButton.textContent="Download crop";}
  });
  formatSelect.value="image/jpeg";
  qualityWrap.hidden=false;
  dialog.showModal();
  loadSelectedFile();
}

function renderConversionResults(container, convertedFiles, previewUrls) {
  container.innerHTML = "";

  convertedFiles.forEach((result) => {
    const card = document.createElement("article");
    card.className = "converter-result-card";

    if (result.error) {
      const errorBox = document.createElement("div");
      errorBox.className = "converter-result-error";

      const title = document.createElement("strong");
      title.textContent = "Conversion failed";

      const filename = document.createElement("span");
      filename.textContent = result.original.name;

      errorBox.append(title, filename);
      card.appendChild(errorBox);
      container.appendChild(card);
      return;
    }

    const previewUrl = URL.createObjectURL(result.blob);
    previewUrls.push(previewUrl);

    const preview = document.createElement("img");
    preview.className = "converter-preview";
    preview.src = previewUrl;
    preview.alt = `Converted ${result.name}`;

    const information = document.createElement("div");
    information.className = "converter-result-info";

    const name = document.createElement("strong");
    name.textContent = result.name;

    const dimensions = document.createElement("span");
    dimensions.textContent = `${result.width} × ${result.height} px`;

    const comparison = document.createElement("div");
    comparison.className = "converter-size-comparison";

    const originalSize = document.createElement("span");
    originalSize.textContent =
      `Original: ${formatBytes(result.original.size)}`;

    const convertedSize = document.createElement("span");
    convertedSize.textContent =
      `Converted: ${formatBytes(result.blob.size)}`;

    const difference = document.createElement("span");

    const sizeDifference = result.blob.size - result.original.size;
    const percentage = result.original.size > 0
      ? (Math.abs(sizeDifference) / result.original.size * 100).toFixed(1)
      : "0.0";

    if (sizeDifference < 0) {
      difference.textContent = `${percentage}% smaller`;
    } else if (sizeDifference > 0) {
      difference.textContent = `${percentage}% larger`;
    } else {
      difference.textContent = "Same file size";
    }

    comparison.append(originalSize, convertedSize, difference);

    const downloadButton = document.createElement("button");
    downloadButton.className = "button button-primary";
    downloadButton.textContent = "Download";

    downloadButton.addEventListener("click", () => {
      downloadBlob(result.blob, result.name);
    });

    information.append(name, dimensions, comparison, downloadButton);

    card.append(preview, information);
    container.appendChild(card);
  });
}

// ==========================================
// IMAGE COMPRESSOR
// ==========================================

function showImageCompressor(files) {
  const dialog = document.createElement("dialog");
  dialog.className = "compressor-dialog";

  let previewUrls = [];
  let compressedResults = [];
  let cancelled = false;

  dialog.innerHTML = `
    <div class="compressor-header">
      <div>
        <span class="compressor-label">FILEFORGE / OPTIMIZATION</span>
        <h2>Image Compressor</h2>
        <p>Reduce image file sizes while controlling quality.</p>
      </div>

      <button
        class="compressor-close"
        type="button"
        aria-label="Close compressor"
      >
        ×
      </button>
    </div>

    <div class="compressor-settings">
      <div class="compressor-setting">
        <label for="compression-format">Output format</label>

        <select id="compression-format">
          <option value="original">Keep original format</option>
          <option value="image/jpeg">JPEG</option>
          <option value="image/webp">WebP</option>
          <option value="image/png">PNG</option>
        </select>

        <small>
          Choose whether to preserve each file's format or convert it.
        </small>
      </div>

      <div class="compressor-setting" id="compression-quality-control">
        <label for="compression-quality">
          Compression quality
          <span id="compression-quality-value">75%</span>
        </label>

        <input
          type="range"
          id="compression-quality"
          min="10"
          max="100"
          value="75"
        />

        <small id="compression-quality-note">
          Lower quality generally produces smaller files.
        </small>
      </div>
    </div>

    <div class="compressor-notice" id="compressor-notice">
      PNG is a lossless format. Quality adjustment does not apply to PNG.
    </div>

    <div class="compressor-actions">
      <span>
        ${files.length} ${files.length === 1 ? "file" : "files"} selected
      </span>

      <button class="button button-primary" id="compress-button">
        Compress images
      </button>
    </div>

    <div class="compressor-summary" id="compressor-summary" hidden></div>

    <div class="compressor-results" id="compressor-results">
      <div class="compressor-empty">
        Your compressed images will appear here.
      </div>
    </div>

    <div class="compressor-footer">
      <span>◈ PROCESSED LOCALLY</span>
      <span>NO FILE UPLOADS</span>
    </div>
  `;

  document.body.appendChild(dialog);

  const closeButton = dialog.querySelector(".compressor-close");
  const formatSelect = dialog.querySelector("#compression-format");
  const qualitySlider = dialog.querySelector("#compression-quality");
  const qualityValue = dialog.querySelector("#compression-quality-value");
  const qualityControl = dialog.querySelector("#compression-quality-control");
  const qualityNote = dialog.querySelector("#compression-quality-note");
  const notice = dialog.querySelector("#compressor-notice");
  const compressButton = dialog.querySelector("#compress-button");
  const results = dialog.querySelector("#compressor-results");
  const summary = dialog.querySelector("#compressor-summary");

  function cleanup() {
    cancelled = true;
    previewUrls.forEach((url) => URL.revokeObjectURL(url));
    previewUrls = [];
    compressedResults = [];
    dialog.remove();
  }

  closeButton.addEventListener("click", () => dialog.close());

  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) {
      dialog.close();
    }
  });

  dialog.addEventListener("close", cleanup);

  qualitySlider.addEventListener("input", () => {
    qualityValue.textContent = `${qualitySlider.value}%`;
  });

  formatSelect.addEventListener("change", updateCompressionSettings);

  // Saved preferences (Settings) replace this tool's own starting values.
  const prefs = getSettings();
  if (prefs.outputFormat) {
    formatSelect.value = prefs.outputFormat;
    formatSelect.dispatchEvent(new Event("change"));
  }
  if (prefs.quality !== null) {
    qualitySlider.value = prefs.quality;
    qualitySlider.dispatchEvent(new Event("input"));
  }

  function updateCompressionSettings() {
    const selectedFormat = formatSelect.value;

    if (selectedFormat === "image/png") {
      qualityControl.classList.add("is-disabled");
      qualitySlider.disabled = true;
      qualityNote.textContent =
        "PNG is lossless. The quality slider cannot reduce its file size.";
      notice.hidden = false;
      return;
    }

    if (selectedFormat !== "original") {
      qualityControl.classList.remove("is-disabled");
      qualitySlider.disabled = false;
      qualityNote.textContent =
        "Lower quality generally produces smaller files.";
      notice.hidden = false;
      notice.textContent =
        "PNG files converted to JPEG or WebP may lose transparency.";
      return;
    }

    const allPng = files.every((file) => file.type === "image/png");

    if (allPng) {
      qualityControl.classList.add("is-disabled");
      qualitySlider.disabled = true;
      qualityNote.textContent =
        "All selected files are PNG. Quality adjustment does not apply.";
      notice.hidden = false;
      notice.textContent =
        "PNG is lossless. Re-encoding it does not guarantee a smaller file.";
    } else {
      qualityControl.classList.remove("is-disabled");
      qualitySlider.disabled = false;
      qualityNote.textContent =
        "Quality applies to JPEG and WebP files. PNG remains lossless.";
      notice.hidden = true;
    }
  }

  updateCompressionSettings();

  compressButton.addEventListener("click", async () => {
    compressButton.disabled = true;
    compressButton.textContent = "Compressing...";

    summary.hidden = true;
    results.innerHTML = `
      <div class="compressor-empty">
        Optimizing your images. Please wait...
      </div>
    `;

    previewUrls.forEach((url) => URL.revokeObjectURL(url));
    previewUrls = [];
    compressedResults = [];

    const quality = Number(qualitySlider.value) / 100;
    const outputFormat = formatSelect.value;
    const run = startToolRun("compress", {
      format: outputFormat,
      quality: Number(qualitySlider.value),
      targetKB: null,
    });

    for (const [index, file] of files.entries()) {
      if (cancelled) return;
      results.querySelector(".compressor-empty").textContent =
        `Compressing ${index + 1} of ${files.length}: ${file.name}`;
      try {
        const compressed = await compressImage(
          file,
          outputFormat,
          quality
        );

        compressedResults.push(compressed);
        run.success(file, compressed);
      } catch (error) {
        console.error(`Compression failed for ${file.name}:`, error);
        run.failure(file, error);

        compressedResults.push({
          original: file,
          error: true,
          errorMessage: error.message || "Unknown error",
        });
      }
    }

    if (!dialog.isConnected) return;

    renderCompressionResults(
      results,
      summary,
      compressedResults,
      previewUrls
    );

    compressButton.disabled = false;
    compressButton.textContent = "Compress again";
  });

  dialog.showModal();
}

function renderCompressionResults(
  container,
  summary,
  compressedFiles,
  previewUrls
) {
  container.innerHTML = "";

  const successfulResults = compressedFiles.filter(
    (result) => !result.error
  );

  const totalOriginalSize = successfulResults.reduce(
    (total, result) => total + result.original.size,
    0
  );

  const totalCompressedSize = successfulResults.reduce(
    (total, result) => total + result.blob.size,
    0
  );

  const totalSaved = totalOriginalSize - totalCompressedSize;

  const totalPercentage = totalOriginalSize > 0
    ? (totalSaved / totalOriginalSize) * 100
    : 0;

  summary.hidden = false;
  summary.innerHTML = "";

  const summaryTitle = document.createElement("span");
  summaryTitle.className = "compressor-summary-label";
  summaryTitle.textContent = "TOTAL RESULTS";

  const summaryValue = document.createElement("strong");
  summaryValue.textContent = totalSaved > 0
    ? `${totalPercentage.toFixed(1)}% smaller`
    : totalSaved < 0
      ? `${Math.abs(totalPercentage).toFixed(1)}% larger`
      : "No size change";

  const summaryDetails = document.createElement("span");
  summaryDetails.textContent =
    `${formatBytes(totalOriginalSize)} → ${formatBytes(totalCompressedSize)}`;

  const summaryMessage = document.createElement("span");
  summaryMessage.textContent = totalSaved > 0
    ? `${formatBytes(totalSaved)} saved across successful files`
    : totalSaved < 0
      ? `${formatBytes(Math.abs(totalSaved))} additional space used`
      : "The total file size remained unchanged";

  summary.append(
    summaryTitle,
    summaryValue,
    summaryDetails,
    summaryMessage
  );

  compressedFiles.forEach((result) => {
    const card = document.createElement("article");
    card.className = "compressor-result-card";

    if (result.error) {
      const errorBox = document.createElement("div");
      errorBox.className = "compressor-result-error";

      const errorTitle = document.createElement("strong");
      errorTitle.textContent = "Compression failed";

      const filename = document.createElement("span");
      filename.textContent = result.original.name;

      const errorMessage = document.createElement("small");
      errorMessage.textContent = result.errorMessage;

      errorBox.append(errorTitle, filename, errorMessage);
      card.appendChild(errorBox);
      container.appendChild(card);
      return;
    }

    const originalUrl = URL.createObjectURL(result.original);
    const compressedUrl = URL.createObjectURL(result.blob);

    previewUrls.push(originalUrl, compressedUrl);

    const previews = document.createElement("div");
    previews.className = "compressor-previews";

    const originalPreview = document.createElement("div");
    originalPreview.className = "compressor-preview-item";

    const originalImage = document.createElement("img");
    originalImage.src = originalUrl;
    originalImage.alt = `Original ${result.original.name}`;

    const originalLabel = document.createElement("span");
    originalLabel.textContent = "ORIGINAL";

    originalPreview.append(originalImage, originalLabel);

    const compressedPreview = document.createElement("div");
    compressedPreview.className = "compressor-preview-item";

    const compressedImage = document.createElement("img");
    compressedImage.src = compressedUrl;
    compressedImage.alt = `Compressed ${result.name}`;

    const compressedLabel = document.createElement("span");
    compressedLabel.textContent = "COMPRESSED";

    compressedPreview.append(compressedImage, compressedLabel);

    previews.append(originalPreview, compressedPreview);

    const information = document.createElement("div");
    information.className = "compressor-result-info";

    const filename = document.createElement("strong");
    filename.textContent = result.name;

    const dimensions = document.createElement("span");
    dimensions.textContent =
      `${result.width} × ${result.height} px`;

    const comparison = document.createElement("div");
    comparison.className = "compressor-comparison";

    const originalSize = document.createElement("span");
    originalSize.textContent =
      `Original: ${formatBytes(result.original.size)}`;

    const compressedSize = document.createElement("span");
    compressedSize.textContent =
      `Compressed: ${formatBytes(result.blob.size)}`;

    const difference = document.createElement("span");

    if (result.savedBytes > 0) {
      difference.textContent =
        `${result.savedPercentage.toFixed(1)}% smaller`;
      difference.classList.add("is-smaller");
    } else if (result.savedBytes < 0) {
      difference.textContent =
        `${Math.abs(result.savedPercentage).toFixed(1)}% larger`;
      difference.classList.add("is-larger");
    } else {
      difference.textContent = "Same file size";
    }

    comparison.append(originalSize, compressedSize, difference);

    const downloadButton = document.createElement("button");
    downloadButton.className = "button button-primary";
    downloadButton.textContent = "Download";

    downloadButton.addEventListener("click", () => {
      downloadBlob(result.blob, result.name);
    });

    information.append(
      filename,
      dimensions,
      comparison,
      downloadButton
    );

    card.append(previews, information);
    container.appendChild(card);
  });

  if (successfulResults.length > 0) {
    const downloadAllButton = document.createElement("button");
    downloadAllButton.className = "button button-primary compressor-download-all";
    downloadAllButton.textContent = `Download all (${successfulResults.length})`;

    downloadAllButton.addEventListener("click", async () => {
      downloadAllButton.disabled = true;
      downloadAllButton.textContent = "Preparing ZIP...";
      try {
        const archive = await createZipArchive(successfulResults);
        downloadBlob(archive, "fileforge-compressed.zip");
      } catch (error) {
        notify({ type: "error", title: "ZIP failed", message: error.message || "Could not prepare the ZIP archive." });
      } finally {
        downloadAllButton.disabled = false;
        downloadAllButton.textContent = `Download all (${successfulResults.length})`;
      }
    });

    container.appendChild(downloadAllButton);
  }
}

// ==========================================
// CONVERTER STYLES
// ==========================================



// ==========================================
// COMPRESSOR STYLES
// ==========================================

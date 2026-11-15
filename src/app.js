export function initializeApp() {
  const app = document.querySelector("#app");

  app.innerHTML = `
    <div class="app-shell">
      <header class="navbar">
        <a class="brand" href="#">
          <span class="brand-icon">F</span>
          <span>FileForge</span>
        </a>

        <nav class="nav-links">
          <a href="#tools">Tools</a>
          <a href="#privacy">Privacy</a>
        </nav>

        <button class="theme-toggle" id="theme-toggle" aria-label="Switch theme">
          ☼
        </button>
      </header>

      <main>
        <section class="hero">
          <div class="status-badge">
            <span class="status-dot"></span>
            FREE FILE UTILITIES
          </div>

          <h1>Your files.<br /><span>Your control.</span></h1>

          <p class="hero-description">
            Convert, compress, and resize your images with simple tools
            designed for privacy and ease of use.
          </p>

          <div class="privacy-badge">
            ◈ Local processing for supported tools
          </div>
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
          </div>

          <div class="file-list" id="file-list" hidden>
            <div class="file-list-header">
              <h3>Selected files</h3>
              <button class="button button-quiet" id="clear-files">
                Clear all
              </button>
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
                Convert between PNG, JPEG, and WebP.
              </span>
              <span class="tool-action">Open tool →</span>
            </button>

            <button class="tool-card" data-tool="Image Compressor">
              <span class="tool-icon">⌁</span>
              <span class="tool-title">Image Compressor</span>
              <span class="tool-description">
                Reduce file size with adjustable quality.
              </span>
              <span class="tool-action">Open tool →</span>
            </button>

            <button class="tool-card" data-tool="Image Resizer">
              <span class="tool-icon">⤢</span>
              <span class="tool-title">Image Resizer</span>
              <span class="tool-description">
                Resize images to your desired dimensions.
              </span>
              <span class="tool-action">Open tool →</span>
            </button>

            <button class="tool-card" data-tool="File Inspector">
              <span class="tool-icon">⌕</span>
              <span class="tool-title">File Inspector</span>
              <span class="tool-description">
                Inspect image dimensions, formats, and sizes.
              </span>
              <span class="tool-action">Open tool →</span>
            </button>
          </div>
        </section>

        <section class="privacy-section" id="privacy">
          <div class="privacy-icon">◈</div>
          <div>
            <h2>Privacy comes first</h2>
            <p>
              Supported image operations are designed to run directly
              in your browser. Your selected files are not intentionally
              uploaded to a FileForge server.
            </p>
          </div>
          <span class="privacy-label">LOCAL PROCESSING</span>
        </section>
      </main>

      <footer class="footer">
        <a class="footer-brand" href="#">FileForge</a>
        <p>Free tools. Open source. Your files stay yours.</p>
        <span>Built for everyone.</span>
      </footer>

      <div class="toast-container" id="toast-container" aria-live="polite"></div>
    </div>
  `;

  initializeTheme();

  const getFiles = initializeUpload();

  initializeToolCards(getFiles);

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

  toggle.addEventListener("click", () => {
    const nextTheme =
      document.documentElement.dataset.theme === "dark" ? "light" : "dark";

    setTheme(nextTheme);
    try {
      localStorage.setItem("fileforge-theme", nextTheme);
    } catch {
      // Keep the selected theme for this session if storage is unavailable.
    }
  });
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

  const supportedTypes = new Set([
    "image/png",
    "image/jpeg",
    "image/webp",
  ]);

  let files = [];
  let thumbnailUrls = [];

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

  clearButton.addEventListener("click", () => {
    files = [];
    renderFiles();
  });

  async function addFiles(fileCollection) {
    const incomingFiles = Array.from(fileCollection);
    let rejected = 0;

    for (const file of incomingFiles) {
      if (!supportedTypes.has(file.type)) {
        rejected++;
        continue;
      }

      const duplicate = files.some(
        (existing) =>
          existing.name === file.name &&
          existing.size === file.size &&
          existing.lastModified === file.lastModified
      );

      if (duplicate) continue;
      try {
        const bitmap = await createImageBitmap(file);
        bitmap.close();
        files.push(file);
      } catch {
        rejected++;
      }
    }

    renderFiles();

    if (rejected > 0) {
      showToast(`${rejected} unsupported or invalid image(s) skipped.`);
    }
  }

  function renderFiles() {
    thumbnailUrls.forEach((url) => URL.revokeObjectURL(url));
    thumbnailUrls = [];

    fileItems.innerHTML = "";
    fileList.hidden = files.length === 0;

    fileCount.textContent =
      `${files.length} ${files.length === 1 ? "file" : "files"}`;

    files.forEach((file, index) => {
      const item = document.createElement("article");
      item.className = "file-item";

      const thumbnail = document.createElement("img");
      thumbnail.className = "file-thumbnail";
      thumbnail.alt = "";

      const thumbnailUrl = URL.createObjectURL(file);
      thumbnailUrls.push(thumbnailUrl);
      thumbnail.src = thumbnailUrl;

      const info = document.createElement("div");
      info.className = "file-info";

      const name = document.createElement("span");
      name.className = "file-name";
      name.textContent = file.name;

      const details = document.createElement("span");
      details.className = "file-details";
      details.textContent = `${formatBytes(file.size)} · ${file.type}`;

      info.append(name, details);

      const removeButton = document.createElement("button");
      removeButton.className = "remove-file";
      removeButton.type = "button";
      removeButton.textContent = "×";
      removeButton.setAttribute("aria-label", `Remove ${file.name}`);

      removeButton.addEventListener("click", () => {
        files.splice(index, 1);
        renderFiles();
      });

      item.append(thumbnail, info, removeButton);
      fileItems.appendChild(item);
    });
  }

  return () => [...files];
}

// ==========================================
// TOOL CARDS
// ==========================================

function initializeToolCards(getFiles) {
  document.querySelectorAll("[data-tool]").forEach((card) => {
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

    for (const [index, file] of files.entries()) {
      if (cancelled) return;
      results.querySelector(".converter-empty").textContent =
        `Converting ${index + 1} of ${files.length}: ${file.name}`;
      try {
        const converted = await convertImage(file, format, quality);
        convertedFiles.push(converted);
      } catch (error) {
        console.error(`Conversion failed for ${file.name}:`, error);

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

async function convertImage(file, format, quality) {
  const bitmap = await createImageBitmap(file);

  try {
    const canvas = document.createElement("canvas");

    canvas.width = bitmap.width;
    canvas.height = bitmap.height;

    const context = canvas.getContext("2d");

    if (!context) {
      throw new Error("Canvas is not supported.");
    }

    if (format === "image/jpeg") {
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
    }

    context.drawImage(bitmap, 0, 0);

    const blob = await new Promise((resolve, reject) => {
      canvas.toBlob(
        (result) => {
          if (result) {
            resolve(result);
          } else {
            reject(new Error("Could not generate converted image."));
          }
        },
        format,
        format === "image/png" ? undefined : quality
      );
    });

    const extensions = {
      "image/png": "png",
      "image/jpeg": "jpg",
      "image/webp": "webp",
    };

    const extension = extensions[blob.type];

    if (!extension || blob.type !== format) {
      throw new Error("Your browser could not generate the requested format.");
    }

    const originalName = file.name.replace(/\.[^/.]+$/, "");

    return {
      original: file,
      blob,
      name: `${originalName}.${extension}`,
      width: bitmap.width,
      height: bitmap.height,
    };
  } finally {
    bitmap.close();
  }
}

function showImageResizer(files) {
  const dialog = document.createElement("dialog");
  dialog.className = "converter-dialog";
  dialog.innerHTML = `
    <div class="converter-header">
      <div>
        <span class="converter-label">FILEFORGE / RESIZING</span>
        <h2>Image Resizer</h2>
        <p>Fit images within bounds or crop them to exact dimensions.</p>
      </div>
      <button class="converter-close" type="button" aria-label="Close">×</button>
    </div>
    <div class="converter-controls">
      <div class="converter-control">
        <label for="resize-width" id="resize-width-label">Maximum width (px)</label>
        <input id="resize-width" type="number" min="1" max="12000" value="1200">
      </div>
      <div class="converter-control">
        <label for="resize-height" id="resize-height-label">Maximum height (px)</label>
        <input id="resize-height" type="number" min="1" max="12000" value="1200">
      </div>
      <div class="converter-control converter-control-wide">
        <label for="resize-mode">Resize mode</label>
        <select id="resize-mode">
          <option value="fit">Fit inside bounds</option>
          <option value="crop">Crop to exact dimensions</option>
        </select>
        <small>Fit keeps the whole image. Crop fills the target size and may trim the edges.</small>
      </div>
      <div class="converter-control" id="crop-horizontal-control" hidden>
        <label for="crop-horizontal">
          Horizontal crop position
          <span class="crop-position-value" id="crop-horizontal-value">50%</span>
        </label>
        <input id="crop-horizontal" type="range" min="0" max="100" value="50">
        <small>Move the crop left or right. This position applies to every selected image.</small>
      </div>
      <div class="converter-control" id="crop-vertical-control" hidden>
        <label for="crop-vertical">
          Vertical crop position
          <span class="crop-position-value" id="crop-vertical-value">50%</span>
        </label>
        <input id="crop-vertical" type="range" min="0" max="100" value="50">
        <small>Move the crop up or down. This position applies to every selected image.</small>
      </div>
    </div>
    <div class="converter-actions">
      <span>${files.length} ${files.length === 1 ? "file" : "files"} selected</span>
      <button class="button button-primary" id="resize-button">Resize images</button>
    </div>
    <div class="converter-results" id="resize-results" aria-live="polite">
      <div class="converter-empty">Processed images will appear here.</div>
    </div>
    <div class="converter-footer"><span>◈ PROCESSED LOCALLY</span><span>NO FILE UPLOADS</span></div>`;

  document.body.appendChild(dialog);
  const closeButton = dialog.querySelector(".converter-close");
  const resizeButton = dialog.querySelector("#resize-button");
  const results = dialog.querySelector("#resize-results");
  const modeSelect = dialog.querySelector("#resize-mode");
  const widthLabel = dialog.querySelector("#resize-width-label");
  const heightLabel = dialog.querySelector("#resize-height-label");
  const cropHorizontal = dialog.querySelector("#crop-horizontal");
  const cropVertical = dialog.querySelector("#crop-vertical");
  const widthInput = dialog.querySelector("#resize-width");
  const heightInput = dialog.querySelector("#resize-height");
  const cropHorizontalControl = dialog.querySelector("#crop-horizontal-control");
  const cropVerticalControl = dialog.querySelector("#crop-vertical-control");
  const urls = [];
  let cancelled = false;

  function updateResizeMode() {
    const isCropMode = modeSelect.value === "crop";
    widthLabel.textContent = isCropMode ? "Target width (px)" : "Maximum width (px)";
    heightLabel.textContent = isCropMode ? "Target height (px)" : "Maximum height (px)";
    cropHorizontalControl.hidden = !isCropMode;
    cropVerticalControl.hidden = !isCropMode;
    resizeButton.textContent = isCropMode ? "Crop images" : "Resize images";
    urls.forEach((url) => URL.revokeObjectURL(url));
    urls.length = 0;
    results.innerHTML = `<div class="converter-empty">Processed images will appear here.</div>`;
  }

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
  modeSelect.addEventListener("change", updateResizeMode);
  cropHorizontal.addEventListener("input", () => {
    dialog.querySelector("#crop-horizontal-value").textContent = `${cropHorizontal.value}%`;
  });
  cropVertical.addEventListener("input", () => {
    dialog.querySelector("#crop-vertical-value").textContent = `${cropVertical.value}%`;
  });

  resizeButton.addEventListener("click", async () => {
    const width = Number(dialog.querySelector("#resize-width").value);
    const height = Number(dialog.querySelector("#resize-height").value);
    const mode = modeSelect.value;
    const isCropMode = mode === "crop";

    if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width > 12000 || height > 12000) {
      showToast("Enter dimensions between 1 and 12,000 pixels.");
      return;
    }

    if (isCropMode && width * height > 64_000_000) {
      showToast("Crop output cannot exceed 64 million pixels.");
      return;
    }

    const horizontalPosition = Number(cropHorizontal.value) / 100;
    const verticalPosition = Number(cropVertical.value) / 100;
    const action = isCropMode ? "Cropping" : "Resizing";
    setControlsDisabled(true);
    resizeButton.disabled = true;
    resizeButton.textContent = isCropMode ? "Cropping..." : "Resizing...";
    urls.forEach((url) => URL.revokeObjectURL(url));
    urls.length = 0;
    results.innerHTML = `<div class="converter-empty" aria-live="polite"></div>`;
    const processed = [];

    for (const [index, file] of files.entries()) {
      if (cancelled) return;
      results.querySelector(".converter-empty").textContent =
        `${action} ${index + 1} of ${files.length}: ${file.name}`;
      try {
        processed.push(
          await resizeImage(file, width, height, mode, horizontalPosition, verticalPosition)
        );
      } catch (error) {
        processed.push({ original: file, error: true, message: error.message });
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
        image.alt = `${isCropMode ? "Cropped" : "Resized"} ${result.name}`;
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
    setControlsDisabled(false);
    resizeButton.disabled = false;
    resizeButton.textContent = isCropMode ? "Crop again" : "Resize again";
  });

  updateResizeMode();
  dialog.showModal();
}

async function resizeImage(file, maxWidth, maxHeight, mode = "fit", cropX = 0.5, cropY = 0.5) {
  const bitmap = await createImageBitmap(file);
  try {
    let width;
    let height;
    let sourceX = 0;
    let sourceY = 0;
    let sourceWidth = bitmap.width;
    let sourceHeight = bitmap.height;

    if (mode === "crop") {
      if (maxWidth * maxHeight > 64_000_000) {
        throw new Error("Crop output cannot exceed 64 million pixels.");
      }

      const targetRatio = maxWidth / maxHeight;
      const sourceRatio = bitmap.width / bitmap.height;
      if (sourceRatio > targetRatio) {
        sourceWidth = bitmap.height * targetRatio;
        sourceX = (bitmap.width - sourceWidth) * cropX;
      } else if (sourceRatio < targetRatio) {
        sourceHeight = bitmap.width / targetRatio;
        sourceY = (bitmap.height - sourceHeight) * cropY;
      }
      width = maxWidth;
      height = maxHeight;
    } else {
      const scale = Math.min(1, maxWidth / bitmap.width, maxHeight / bitmap.height);
      width = Math.max(1, Math.round(bitmap.width * scale));
      height = Math.max(1, Math.round(bitmap.height * scale));
    }

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas is not supported.");

    if (file.type === "image/jpeg") {
      context.fillStyle = "#fff";
      context.fillRect(0, 0, width, height);
    }

    context.drawImage(
      bitmap,
      sourceX,
      sourceY,
      sourceWidth,
      sourceHeight,
      0,
      0,
      width,
      height
    );
    const blob = await new Promise((resolve, reject) =>
      canvas.toBlob(
        (value) => value
          ? resolve(value)
          : reject(new Error("Could not process this image.")),
        file.type
      )
    );
    const extension = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" }[blob.type];
    if (!extension || blob.type !== file.type) {
      throw new Error("Your browser could not preserve this image format.");
    }

    const suffix = mode === "crop" ? "cropped" : "resized";
    return {
      blob,
      width,
      height,
      name: `${file.name.replace(/\.[^/.]+$/, "")}-${suffix}.${extension}`,
    };
  } finally {
    bitmap.close();
  }
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
      } catch (error) {
        console.error(`Compression failed for ${file.name}:`, error);

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

async function compressImage(file, outputFormat, quality) {
  const bitmap = await createImageBitmap(file);

  try {
    const canvas = document.createElement("canvas");

    canvas.width = bitmap.width;
    canvas.height = bitmap.height;

    const context = canvas.getContext("2d");

    if (!context) {
      throw new Error("Canvas is not supported by your browser.");
    }

    let targetFormat =
      outputFormat === "original" ? file.type : outputFormat;

    if (!["image/png", "image/jpeg", "image/webp"].includes(targetFormat)) {
      throw new Error("Unsupported output format.");
    }

    // JPEG does not support transparency.
    // Fill transparent areas with white.
    if (targetFormat === "image/jpeg") {
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
    }

    context.drawImage(bitmap, 0, 0);

    const blob = await new Promise((resolve, reject) => {
      canvas.toBlob(
        (result) => {
          if (result) {
            resolve(result);
          } else {
            reject(new Error("Could not compress this image."));
          }
        },
        targetFormat,
        targetFormat === "image/png" ? undefined : quality
      );
    });

    if (blob.type !== targetFormat) {
      throw new Error(
        `Your browser could not produce ${targetFormat}.`
      );
    }

    const extensions = {
      "image/png": "png",
      "image/jpeg": "jpg",
      "image/webp": "webp",
    };

    const extension = extensions[blob.type];
    const originalName = file.name.replace(/\.[^/.]+$/, "");

    const savedBytes = file.size - blob.size;

    const savedPercentage = file.size > 0
      ? (savedBytes / file.size) * 100
      : 0;

    return {
      original: file,
      blob,
      name: `${originalName}-compressed.${extension}`,
      width: bitmap.width,
      height: bitmap.height,
      savedBytes,
      savedPercentage,
      format: targetFormat,
      isPng: targetFormat === "image/png",
    };
  } finally {
    bitmap.close();
  }
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
        showToast(error.message || "Could not prepare the ZIP archive.");
      } finally {
        downloadAllButton.disabled = false;
        downloadAllButton.textContent = `Download all (${successfulResults.length})`;
      }
    });

    container.appendChild(downloadAllButton);
  }
}

async function createZipArchive(results) {
  const encoder = new TextEncoder();
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  for (const result of results) {
    const name = encoder.encode(result.name);
    const data = new Uint8Array(await result.blob.arrayBuffer());
    if (data.byteLength > 0xffffffff || offset > 0xffffffff) {
      throw new Error("This batch is too large for a standard ZIP archive.");
    }
    const checksum = crc32(data);
    const local = new Uint8Array(30 + name.length);
    const localView = new DataView(local.buffer);
    localView.setUint32(0, 0x04034b50, true);
    localView.setUint16(4, 20, true);
    localView.setUint16(6, 0x0800, true);
    localView.setUint32(14, checksum, true);
    localView.setUint32(18, data.byteLength, true);
    localView.setUint32(22, data.byteLength, true);
    localView.setUint16(26, name.length, true);
    local.set(name, 30);
    localParts.push(local, data);

    const central = new Uint8Array(46 + name.length);
    const centralView = new DataView(central.buffer);
    centralView.setUint32(0, 0x02014b50, true);
    centralView.setUint16(4, 20, true);
    centralView.setUint16(6, 20, true);
    centralView.setUint16(8, 0x0800, true);
    centralView.setUint32(16, checksum, true);
    centralView.setUint32(20, data.byteLength, true);
    centralView.setUint32(24, data.byteLength, true);
    centralView.setUint16(28, name.length, true);
    centralView.setUint32(42, offset, true);
    central.set(name, 46);
    centralParts.push(central);
    offset += local.byteLength + data.byteLength;
  }

  const centralSize = centralParts.reduce((total, part) => total + part.length, 0);
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(8, results.length, true);
  endView.setUint16(10, results.length, true);
  endView.setUint32(12, centralSize, true);
  endView.setUint32(16, offset, true);
  return new Blob([...localParts, ...centralParts, end], { type: "application/zip" });
}

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

// ==========================================
// DOWNLOAD UTILITY
// ==========================================

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = filename;

  document.body.appendChild(link);
  link.click();
  link.remove();

  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

// ==========================================
// CONVERTER STYLES
// ==========================================



// ==========================================
// COMPRESSOR STYLES
// ==========================================



// ==========================================
// UTILITIES
// ==========================================

function formatBytes(bytes) {
  if (bytes === 0) return "0 Bytes";

  const units = ["Bytes", "KB", "MB", "GB", "TB"];

  const index = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1
  );

  return `${(bytes / Math.pow(1024, index)).toFixed(2)} ${units[index]}`;
}

function showToast(message) {
  const container = document.querySelector("#toast-container");
  const toast = document.createElement("div");

  toast.className = "toast";
  toast.textContent = message;

  container.appendChild(toast);

  setTimeout(() => toast.remove(), 3500);
}



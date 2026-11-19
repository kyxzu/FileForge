// Settings controls for each batch operation.
//
//   const panel = createSettingsPanel("resize", { initial, encodable, getFiles });
//   panel.el       -> element to insert
//   panel.read()   -> current settings (validated later by validateSettings)
//   panel.refresh()-> call when the queue changes

import { h } from "../lib/dom.js";
import { MAX_OUTPUT_DIMENSION } from "../lib/files.js";
import { RESIZE_PRESETS } from "../lib/operations.js";

function field(label, control, hint) {
  return h(
    "div",
    { class: "converter-control batch-field" },
    h("label", { for: control.id }, label),
    control,
    hint || null
  );
}

function qualityField(id, state, onInput) {
  const value = h("span", { class: "batch-quality-value" }, `${state.quality}%`);
  const slider = h("input", { id, type: "range", min: 10, max: 100, step: 1, value: state.quality });
  slider.addEventListener("input", () => {
    state.quality = slider.valueAsNumber;
    value.textContent = `${state.quality}%`;
    onInput?.();
  });

  const wrapper = h(
    "div",
    { class: "converter-control batch-field" },
    h("label", { for: id }, "Quality ", value),
    slider
  );
  return { wrapper, slider };
}

function formatSelect(id, state, options, encodable, onChange) {
  const select = h(
    "select",
    { id },
    options.map(([value, label]) => {
      const unavailable = value !== "original" && !encodable.has(value);
      return h(
        "option",
        { value, disabled: unavailable },
        unavailable ? `${label} (not supported by this browser)` : label
      );
    })
  );
  select.value = state.format;
  select.addEventListener("change", () => {
    state.format = select.value;
    onChange?.();
  });
  return select;
}

export function createSettingsPanel(operation, { initial, encodable, getFiles }) {
  const state = { ...initial };
  const el = h("div", { class: "batch-settings-grid" });
  let refresh = () => {};
  let read = () => ({ ...state });

  if (operation === "resize") {
    const hint = h("small", {});
    const widthInput = h("input", {
      id: "batch-width", type: "number", min: 1, max: MAX_OUTPUT_DIMENSION, step: 1,
      inputmode: "numeric", value: state.width,
    });
    const heightInput = h("input", {
      id: "batch-height", type: "number", min: 1, max: MAX_OUTPUT_DIMENSION, step: 1,
      inputmode: "numeric", value: state.height,
    });
    const preset = h(
      "select",
      { id: "batch-preset" },
      RESIZE_PRESETS.map((item) => h("option", { value: item.id }, item.label))
    );
    const lock = h("input", { id: "batch-lock", type: "checkbox" });
    lock.checked = state.keepAspect !== false;

    const updateHint = () => {
      hint.textContent = state.keepAspect
        ? "Each image is scaled to fit inside this box. Proportions are kept and images are never enlarged."
        : "Every image is stretched to exactly this size, which can distort it.";
    };

    widthInput.addEventListener("input", () => { state.width = widthInput.valueAsNumber; preset.value = "custom"; });
    heightInput.addEventListener("input", () => { state.height = heightInput.valueAsNumber; preset.value = "custom"; });
    preset.addEventListener("change", () => {
      const chosen = RESIZE_PRESETS.find((item) => item.id === preset.value);
      if (!chosen || !chosen.width) return;
      state.width = chosen.width;
      state.height = chosen.height;
      widthInput.value = chosen.width;
      heightInput.value = chosen.height;
    });
    lock.addEventListener("change", () => { state.keepAspect = lock.checked; updateHint(); });

    state.keepAspect = lock.checked;
    updateHint();

    el.append(
      field("Preset", preset),
      field(state.keepAspect ? "Maximum width (px)" : "Width (px)", widthInput),
      field(state.keepAspect ? "Maximum height (px)" : "Height (px)", heightInput),
      h(
        "div",
        { class: "converter-control batch-field batch-check" },
        h("label", { for: "batch-lock" }, lock, " Lock aspect ratio"),
        hint
      )
    );

    // Labels switch between "Maximum" and exact wording with the lock.
    lock.addEventListener("change", () => {
      el.querySelector('label[for="batch-width"]').textContent = state.keepAspect ? "Maximum width (px)" : "Width (px)";
      el.querySelector('label[for="batch-height"]').textContent = state.keepAspect ? "Maximum height (px)" : "Height (px)";
    });
  }

  if (operation === "compress") {
    const note = h("small", { class: "batch-note", role: "note" });
    const format = formatSelect(
      "batch-compress-format",
      state,
      [["original", "Keep original format"], ["image/jpeg", "JPEG"], ["image/webp", "WebP"], ["image/png", "PNG"]],
      encodable,
      () => refresh()
    );
    const { wrapper: qualityWrapper, slider } = qualityField("batch-compress-quality", state);
    const target = h("input", {
      id: "batch-target", type: "number", min: 1, max: 100000, step: 1,
      inputmode: "numeric", placeholder: "Optional",
    });
    if (state.targetKB) target.value = state.targetKB;
    target.addEventListener("input", () => {
      state.targetKB = target.value === "" ? null : target.valueAsNumber;
    });

    el.append(
      field("Output format", format),
      qualityWrapper,
      field(
        "Target file size (KB)",
        target,
        h("small", {}, "Optional. For JPEG and WebP, quality is lowered (never below 10%) to try to stay under this size.")
      ),
      note
    );

    refresh = () => {
      const files = getFiles();
      const allPng = files.length > 0 && files.every((file) => file.type === "image/png");
      const lossless = state.format === "image/png" || (state.format === "original" && allPng);

      slider.disabled = lossless;
      target.disabled = lossless;

      if (lossless) note.textContent = "PNG is lossless, so quality and target size do not apply.";
      else if (state.format === "image/jpeg") note.textContent = "Transparent areas become white in JPEG.";
      else if (state.format === "original") note.textContent = "Quality applies to JPEG and WebP files. PNG files stay lossless.";
      else note.textContent = "";
    };

    read = () => ({ ...state, targetKB: target.disabled ? null : state.targetKB });
  }

  if (operation === "convert") {
    const note = h("small", { class: "batch-note", role: "note" });
    const format = formatSelect(
      "batch-convert-format",
      state,
      [["image/png", "PNG"], ["image/jpeg", "JPEG"], ["image/webp", "WebP"]],
      encodable,
      () => refresh()
    );
    const { wrapper: qualityWrapper, slider } = qualityField("batch-convert-quality", state);

    el.append(field("Output format", format), qualityWrapper, note);

    refresh = () => {
      const files = getFiles();
      slider.disabled = state.format === "image/png";

      const notes = [];
      if (state.format === "image/png") notes.push("PNG is lossless, so the quality setting does not apply.");
      if (state.format === "image/jpeg") notes.push("Transparent areas become white in JPEG.");
      if (files.length > 0 && files.every((file) => file.type === state.format)) {
        notes.push("All queued files are already in this format; they will be re-encoded.");
      }
      note.textContent = notes.join(" ");
    };
  }

  refresh();
  return { el, read: () => read(), refresh: () => refresh() };
}

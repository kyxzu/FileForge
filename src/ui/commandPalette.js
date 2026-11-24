// Command palette: Ctrl+K (Cmd+K on Mac), or the Search button in the header.
// It only lists actions that really exist; each command's run() calls the
// same code the visible buttons use. Built on <dialog>, so everything behind it
// is inert while it is open and Escape closes it.

import { h, replaceContent } from "../lib/dom.js";
import { filterCommands, highlightParts } from "../lib/commandSearch.js";

let counter = 0;

export function isMacLike() {
  const platform = navigator.userAgentData?.platform || navigator.platform || "";
  return /mac|iphone|ipad/i.test(platform);
}

export function shortcutLabel() {
  return isMacLike() ? "⌘K" : "Ctrl K";
}

// getCommands() -> [{ id, label, hint?, keywords?, group?, run() }]
export function createCommandPalette({ getCommands }) {
  let dialog = null;

  function open() {
    if (dialog?.isConnected) return;
    // Do not stack on top of another dialog (Settings, a tool, ...).
    if (document.querySelector("dialog[open]")) return;

    const id = ++counter;
    const listId = `palette-list-${id}`;
    const all = getCommands();
    let results = all;
    let active = 0;
    let toRun = null;

    const input = h("input", {
      class: "palette-input",
      type: "text",
      role: "combobox",
      placeholder: "Search commands…",
      autocomplete: "off",
      autocapitalize: "off",
      spellcheck: "false",
      enterkeyhint: "go",
      "aria-label": "Search commands",
      "aria-expanded": "true",
      "aria-controls": listId,
      "aria-autocomplete": "list",
    });
    const list = h("ul", { class: "palette-list", id: listId, role: "listbox", "aria-label": "Commands" });
    const status = h("p", { class: "visually-hidden", role: "status" });
    const empty = h("p", { class: "palette-empty", hidden: true });
    const closeButton = h("button", { class: "palette-close", type: "button", "aria-label": "Close command palette" }, "Esc");

    dialog = h(
      "dialog",
      { class: "palette-dialog", "aria-label": "Command palette" },
      h("div", { class: "palette-search" }, input, closeButton),
      list,
      empty,
      status
    );

    const optionId = (index) => `palette-${id}-option-${index}`;

    function setActive(index, { scroll = true } = {}) {
      active = index;
      [...list.children].forEach((item, position) => {
        const selected = position === index;
        item.setAttribute("aria-selected", String(selected));
        if (selected && scroll) item.scrollIntoView({ block: "nearest" });
      });
      if (results.length) input.setAttribute("aria-activedescendant", optionId(index));
      else input.removeAttribute("aria-activedescendant");
    }

    function render() {
      const query = input.value;
      results = filterCommands(all, query);
      active = 0;

      const items = results.map((command, index) => {
        const item = h(
          "li",
          { class: "palette-item", role: "option", id: optionId(index), "aria-selected": "false" },
          h(
            "span",
            { class: "palette-label" },
            highlightParts(command.label, query).map((part) =>
              part.match ? h("mark", {}, part.text) : part.text
            )
          ),
          command.hint ? h("span", { class: "palette-hint" }, command.hint) : null
        );
        item.addEventListener("mousemove", () => {
          if (active !== index) setActive(index, { scroll: false });
        });
        item.addEventListener("click", () => choose(index));
        return item;
      });

      replaceContent(list, items);
      list.hidden = results.length === 0;
      empty.hidden = results.length !== 0;
      empty.textContent = results.length ? "" : `No commands match “${query.trim()}”.`;
      status.textContent = results.length
        ? `${results.length} ${results.length === 1 ? "command" : "commands"} available`
        : "No matching commands";
      setActive(0, { scroll: false });
    }

    function choose(index) {
      const command = results[index];
      if (!command) return;
      // Run after the palette has closed so the command's own dialog or focus
      // handling starts from a clean page.
      toRun = command;
      dialog.close();
    }

    input.addEventListener("input", render);
    input.addEventListener("keydown", (event) => {
      if (event.isComposing) return;
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        if (!results.length) return;
        const step = event.key === "ArrowDown" ? 1 : -1;
        setActive((active + step + results.length) % results.length);
      } else if (event.key === "Home" || event.key === "End") {
        if (!results.length) return;
        event.preventDefault();
        setActive(event.key === "Home" ? 0 : results.length - 1);
      } else if (event.key === "Enter") {
        event.preventDefault();
        choose(active);
      }
    });
    closeButton.addEventListener("click", () => dialog.close());
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) dialog.close();
    });
    dialog.addEventListener("close", () => {
      const finished = dialog;
      dialog = null;
      finished.remove();
      if (toRun) {
        const command = toRun;
        toRun = null;
        try {
          command.run();
        } catch (error) {
          console.error(`Command "${command.label}" failed:`, error);
        }
      }
    });

    document.body.appendChild(dialog);
    dialog.showModal();
    render();
    input.focus();
  }

  function close() {
    dialog?.close();
  }

  function toggle() {
    if (dialog?.isConnected) close();
    else open();
  }

  document.addEventListener("keydown", (event) => {
    if (event.key.toLowerCase() === "k" && (event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey) {
      event.preventDefault();
      toggle();
    }
  });

  return { open, close, toggle };
}

// A small modal confirmation, styled like the other FileForge dialogs.
// Resolves to true when confirmed and false when cancelled or dismissed.

import { h } from "../lib/dom.js";

let counter = 0;

export function confirmDialog({
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  danger = false,
}) {
  return new Promise((resolve) => {
    const titleId = `confirm-title-${++counter}`;
    const messageId = `confirm-message-${counter}`;
    let confirmed = false;

    const cancelButton = h("button", { class: "button button-secondary", type: "button" }, cancelLabel);
    const confirmButton = h(
      "button",
      { class: `button button-primary${danger ? " is-danger" : ""}`, type: "button" },
      confirmLabel
    );

    const dialog = h(
      "dialog",
      { class: "confirm-dialog", "aria-labelledby": titleId, "aria-describedby": messageId },
      h("h2", { id: titleId }, title),
      h("p", { id: messageId }, message),
      h("div", { class: "confirm-actions" }, cancelButton, confirmButton)
    );

    cancelButton.addEventListener("click", () => dialog.close());
    confirmButton.addEventListener("click", () => {
      confirmed = true;
      dialog.close();
    });
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) dialog.close();
    });
    dialog.addEventListener("close", () => {
      dialog.remove();
      resolve(confirmed);
    });

    document.body.appendChild(dialog);
    dialog.showModal();
    cancelButton.focus();
  });
}

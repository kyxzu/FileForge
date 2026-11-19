// Toast notifications. Moved out of app.js so other modules can use it
// without importing the whole application (app.js still re-exports it).

export function showToast(message) {
  const container = document.querySelector("#toast-container");
  if (!container) return;

  const toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = message;

  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3500);
}

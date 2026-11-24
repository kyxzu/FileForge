// Notifications. showToast(message) still works everywhere it is already used;
// notify() adds a title, a status type, and dismissal rules.
//
//   notify({ type: "success", title: "History cleared", message: "All records removed." })
//
// Types: "info", "success", "warning", "error".
// - info/success/warning dismiss themselves; the person can close them early.
// - error stays until it is closed (a failure should not vanish unseen).
// - The same notification shown again does not stack: it shows a count instead.
// - At most MAX_VISIBLE are shown; the oldest self-dismissing one makes room.

export const MAX_VISIBLE = 4;
const DURATIONS = { info: 4000, success: 4000, warning: 6000, error: 0 };
const ICONS = { info: "i", success: "✓", warning: "!", error: "×" };
const LEAVE_MS = 180;

// key -> { element, timer, count } for notifications currently on screen.
const active = new Map();

function dismiss(key) {
  const entry = active.get(key);
  if (!entry) return;
  active.delete(key);
  clearTimeout(entry.timer);
  entry.element.classList.add("is-leaving");
  setTimeout(() => entry.element.remove(), LEAVE_MS);
}

function schedule(key, entry, duration) {
  clearTimeout(entry.timer);
  if (duration > 0) entry.timer = setTimeout(() => dismiss(key), duration);
}

// A modal dialog covers the rest of the page, so a notification that stays in
// the page would be hidden behind it (and could not be dismissed). While a
// dialog is open the container lives inside the topmost one; when it closes
// the container goes back to the page.
function placeContainer(container) {
  const host = [...document.querySelectorAll("dialog[open]")].at(-1) || document.body;
  if (container.parentElement === host) return;
  host.append(container);
  if (host === document.body) return;
  host.addEventListener(
    "close",
    () => {
      if (container.parentElement === host || !container.isConnected) document.body.append(container);
    },
    { once: true }
  );
}

export function notify({ type = "info", title = "", message = "", duration, key } = {}) {
  if (typeof document === "undefined") return; // Node (unit tests)
  const container = document.querySelector("#toast-container");
  if (!container || (!title && !message)) return;

  placeContainer(container);

  const kind = ICONS[type] ? type : "info";
  const id = key || `${kind}|${title}|${message}`;
  const lifetime = duration ?? DURATIONS[kind];

  // Same notification again: bump the counter and restart the timer.
  const existing = active.get(id);
  if (existing) {
    existing.count += 1;
    existing.badge.textContent = `×${existing.count}`;
    existing.badge.hidden = false;
    schedule(id, existing, lifetime);
    return;
  }

  const element = document.createElement("div");
  element.className = `toast toast-${kind}`;
  if (kind === "error") element.setAttribute("role", "alert");

  const icon = document.createElement("span");
  icon.className = "toast-icon";
  icon.setAttribute("aria-hidden", "true");
  icon.textContent = ICONS[kind];

  const body = document.createElement("div");
  body.className = "toast-body";
  if (title) {
    const heading = document.createElement("strong");
    heading.className = "toast-title";
    heading.textContent = title;
    body.append(heading);
  }
  if (message) {
    const text = document.createElement("span");
    text.className = "toast-message";
    text.textContent = message;
    body.append(text);
  }

  const badge = document.createElement("span");
  badge.className = "toast-count";
  badge.hidden = true;

  const close = document.createElement("button");
  close.type = "button";
  close.className = "toast-close";
  close.setAttribute("aria-label", "Dismiss notification");
  close.textContent = "×";
  close.addEventListener("click", () => dismiss(id));

  element.append(icon, body, badge, close);
  container.append(element);

  const entry = { element, badge, count: 1, timer: 0 };
  active.set(id, entry);
  schedule(id, entry, lifetime);

  // Too many on screen: drop the oldest ones that would leave by themselves.
  while (active.size > MAX_VISIBLE) {
    const oldest = [...active.entries()].find(([, item]) => !item.element.classList.contains("toast-error"));
    if (!oldest || oldest[0] === id) break;
    dismiss(oldest[0]);
  }
}

// Original one-argument API, kept so existing calls do not change.
export function showToast(message, options = {}) {
  notify({ message, ...options });
}

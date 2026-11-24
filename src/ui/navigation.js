// Responsive navigation: mobile drawer and "where am I" highlighting.
// The desktop links and the drawer links point at the same places; the History
// and Install entries in the drawer simply click the existing buttons, so no
// logic is duplicated.

const MOBILE_QUERY = "(max-width: 760px)";

export function initializeNavigation() {
  const menuButton = document.querySelector("#nav-menu-button");
  const drawer = document.querySelector("#nav-drawer");
  const overlay = document.querySelector("#nav-overlay");
  const closeButton = document.querySelector("#nav-drawer-close");
  if (!menuButton || !drawer || !overlay || !closeButton) return;

  const mobile = window.matchMedia(MOBILE_QUERY);
  let isOpen = false;

  const focusable = () =>
    [...drawer.querySelectorAll("a[href], button:not([hidden])")].filter((el) => !el.closest("[hidden]"));

  function syncInstallEntry() {
    const entry = drawer.querySelector('[data-nav-action="install"]');
    const installButton = document.querySelector(".install-button");
    if (entry) entry.hidden = !installButton || installButton.hidden;
  }

  function open() {
    if (isOpen) return;
    isOpen = true;
    syncInstallEntry();
    overlay.hidden = false;
    drawer.inert = false;
    document.documentElement.classList.add("nav-open");
    menuButton.setAttribute("aria-expanded", "true");
    menuButton.setAttribute("aria-label", "Close menu");
    // Next frame so the slide-in transition runs. Focus moves once the drawer is
    // visible, because hidden elements cannot take focus.
    requestAnimationFrame(() => {
      if (!isOpen) return;
      drawer.classList.add("is-open");
      overlay.classList.add("is-open");
      focusable()[0]?.focus();
    });
  }

  function close({ restoreFocus = true } = {}) {
    if (!isOpen) return;
    isOpen = false;
    drawer.classList.remove("is-open");
    overlay.classList.remove("is-open");
    drawer.inert = true;
    document.documentElement.classList.remove("nav-open");
    menuButton.setAttribute("aria-expanded", "false");
    menuButton.setAttribute("aria-label", "Open menu");
    const hide = () => {
      if (!isOpen) overlay.hidden = true;
    };
    // Wait for the fade-out, but never leave the overlay up if no transition runs.
    overlay.addEventListener("transitionend", hide, { once: true });
    setTimeout(hide, 300);
    if (restoreFocus) menuButton.focus();
  }

  menuButton.addEventListener("click", () => (isOpen ? close() : open()));
  closeButton.addEventListener("click", () => close());
  overlay.addEventListener("click", () => close());

  // Selecting a destination closes the drawer.
  drawer.addEventListener("click", (event) => {
    const target = event.target.closest("a[href], button[data-nav-action]");
    if (!target) return;
    if (target.matches("button[data-nav-action]")) {
      const action = target.dataset.navAction;
      close({ restoreFocus: false });
      if (action === "history") document.querySelector("#open-history")?.click();
      if (action === "palette") document.querySelector("#open-palette")?.click();
      if (action === "settings") document.querySelector("#open-settings")?.click();
      if (action === "install") document.querySelector(".install-button")?.click();
    } else {
      close({ restoreFocus: false });
    }
  });

  document.addEventListener("keydown", (event) => {
    if (!isOpen) return;
    if (event.key === "Escape") {
      event.preventDefault();
      close();
      return;
    }
    if (event.key !== "Tab") return;
    // Keep keyboard focus inside the open drawer.
    const items = focusable();
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });

  // Rotating the phone or resizing past the breakpoint must not leave the page locked.
  mobile.addEventListener("change", () => close({ restoreFocus: false }));

  initializeSectionHighlight();
}

// Marks the link of the section currently in view with aria-current.
function initializeSectionHighlight() {
  const links = [...document.querySelectorAll("[data-nav-section]")];
  const sections = [...new Set(links.map((link) => link.dataset.navSection))]
    .map((id) => document.getElementById(id))
    .filter(Boolean);
  if (!sections.length || !("IntersectionObserver" in window)) return;

  const visible = new Set();
  const update = () => {
    // The lowest visible section is the one just scrolled into view.
    const current = [...sections].reverse().find((section) => visible.has(section.id))?.id ?? null;
    for (const link of links) {
      if (link.dataset.navSection === current) link.setAttribute("aria-current", "location");
      else link.removeAttribute("aria-current");
    }
  };

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) visible.add(entry.target.id);
        else visible.delete(entry.target.id);
      }
      update();
    },
    // Only the band just under the navbar counts as "in view".
    { rootMargin: "-80px 0px -55% 0px", threshold: 0 }
  );
  sections.forEach((section) => observer.observe(section));
}

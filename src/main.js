import "./styles/styles.css";
import { initializeApp } from "./app.js";

initializeApp();
initializePwa();

function initializePwa() {
  const navbar = document.querySelector(".navbar");
  const themeToggle = document.querySelector("#theme-toggle");

  if (navbar && themeToggle) {
    const installButton = document.createElement("button");
    installButton.type = "button";
    installButton.className = "install-button button button-primary";
    installButton.textContent = "Install";
    installButton.setAttribute("aria-label", "Install FileForge");
    installButton.hidden = true;
    themeToggle.before(installButton);

    let deferredInstallPrompt = null;
    const isInstalled =
      window.matchMedia("(display-mode: standalone)").matches ||
      window.navigator.standalone === true;

    if (!isInstalled) {
      window.addEventListener("beforeinstallprompt", (event) => {
        event.preventDefault();
        deferredInstallPrompt = event;
        installButton.hidden = false;
      });

      installButton.addEventListener("click", async () => {
        if (!deferredInstallPrompt) return;

        const installPrompt = deferredInstallPrompt;
        deferredInstallPrompt = null;
        installButton.hidden = true;
        await installPrompt.prompt();
      });

      window.addEventListener("appinstalled", () => {
        deferredInstallPrompt = null;
        installButton.hidden = true;
      });
    }
  }

  if ("serviceWorker" in navigator && import.meta.env.PROD) {
    const registerServiceWorker = () => {
      navigator.serviceWorker
        .register(`${import.meta.env.BASE_URL}sw.js`, {
          scope: import.meta.env.BASE_URL,
        })
        .catch((error) => {
          console.warn("FileForge offline support could not be enabled:", error);
        });
    };

    if (document.readyState === "complete") {
      registerServiceWorker();
    } else {
      window.addEventListener("load", registerServiceWorker, { once: true });
    }
  }
}

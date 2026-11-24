import "./styles/styles.css";
import "./styles/features.css";
import "./styles/nav.css";
import "./styles/components.css";
import "./styles/dialogs.css";
import "./styles/notifications.css";
import "./styles/settings.css";
import "./styles/palette.css";
import { initializeApp, showToast } from "./app.js";
import { isNativeApp } from "./lib/platform.js";

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
    installButton.hidden = false;
    themeToggle.before(installButton);

    let deferredInstallPrompt = null;
    // The desktop and Android apps are already installed.
    const isInstalled =
      isNativeApp() ||
      window.matchMedia("(display-mode: standalone)").matches ||
      window.navigator.standalone === true;

    if (isInstalled) {
      installButton.hidden = true;
    } else {
      window.addEventListener("beforeinstallprompt", (event) => {
        event.preventDefault();
        deferredInstallPrompt = event;
      });

      installButton.addEventListener("click", async () => {
        if (!deferredInstallPrompt) {
          showToast("To install FileForge, use Install app or Add to Home Screen in your browser menu.");
          return;
        }

        const installPrompt = deferredInstallPrompt;
        deferredInstallPrompt = null;
        await installPrompt.prompt();
        const choice = await installPrompt.userChoice;
        if (choice.outcome === "accepted") installButton.hidden = true;
      });

      window.addEventListener("appinstalled", () => {
        deferredInstallPrompt = null;
        installButton.hidden = true;
      });
    }
  }

  if ("serviceWorker" in navigator && import.meta.env.PROD && !isNativeApp()) {
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

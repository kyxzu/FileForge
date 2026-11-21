import { defineConfig } from "vite";

// In production builds only, a Content-Security-Policy meta tag is added.
// It makes the browser itself refuse any network request other than the
// app's own files and, if the visitor asks for them, GitHub repository
// statistics (api.github.com). The development server is left untouched
// because Vite's hot reload needs inline scripts and WebSockets.
const contentSecurityPolicy = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data:",
  "connect-src 'self' https://api.github.com",
  "worker-src 'self'",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
].join("; ");

// The Tauri desktop app enforces its own policy from src-tauri/tauri.conf.json.
// Two policies would be intersected and the second would block Tauri's
// internal messaging, so the meta tag is left out of desktop builds.
const isTauriBuild = Boolean(process.env.TAURI_ENV_PLATFORM);

export default defineConfig({
  // Tauri's dev window opens this fixed address.
  server: { port: 5173, strictPort: true },
  plugins: [
    {
      name: "fileforge-content-security-policy",
      apply: "build",
      transformIndexHtml(html) {
        if (isTauriBuild) return html;
        return html.replace(
          "<head>",
          `<head>\n    <meta http-equiv="Content-Security-Policy" content="${contentSecurityPolicy}" />`
        );
      },
    },
  ],
});

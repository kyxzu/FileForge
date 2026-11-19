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

export default defineConfig({
  plugins: [
    {
      name: "fileforge-content-security-policy",
      apply: "build",
      transformIndexHtml(html) {
        return html.replace(
          "<head>",
          `<head>\n    <meta http-equiv="Content-Security-Policy" content="${contentSecurityPolicy}" />`
        );
      },
    },
  ],
});

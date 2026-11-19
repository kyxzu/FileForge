# Contributing to FileForge

Thanks for helping improve FileForge. No account is needed to use the app. You only need a GitHub account to open issues or pull requests.

## Reporting a bug

[Open a bug report](https://github.com/kyxzu/FileForge/issues/new/choose) and include:

- What you did, what you expected, and what happened instead.
- Your browser and version, and your operating system.
- The file type and rough size of the image involved (do **not** attach private images).
- Any message shown in the app or in the browser console (F12, Console).

Search [existing issues](https://github.com/kyxzu/FileForge/issues) first to avoid duplicates.

## Suggesting a feature

Open a feature request and describe the problem you want solved before the solution. FileForge keeps files on the user's device, so ideas that need a server, an account, or tracking will not fit unless they are clearly opt-in and explained to the user.

## Development setup

**Requirements:** Node.js 20.19+ or 22.12+.

```bash
git clone https://github.com/kyxzu/FileForge.git
cd FileForge
npm ci
npm run dev      # development server
npm test         # unit tests
npm run build    # production build (also adds the Content-Security-Policy)
npm run preview  # serve the production build
```

## Where things live

- `src/lib/`: logic without UI (image processing, queue, history, validation, ZIP). Keep this free of page markup so it can be tested in Node.
- `src/ui/`: dialogs.
- `src/app.js`: page layout, theme, upload queue, and the original tool dialogs.
- `src/styles/`: `styles.css` is the original stylesheet; `features.css` holds newer features. Use the existing CSS variables so both themes keep working.

## Code quality expectations

- **Vanilla JavaScript.** Do not add a framework or TypeScript. Avoid new dependencies; if one is truly needed, explain why in the pull request.
- **Never put user-controlled values (filenames, metadata, error text from files) into `innerHTML`.** Use `textContent`, or the `h()` helper in `src/lib/dom.js`.
- **Keep processing local.** No uploads, analytics, or tracking. The only external request allowed is the opt-in GitHub statistics lookup.
- **Clean up.** Revoke object URLs, call `ImageBitmap.close()`, and empty canvases you create. Remove event listeners you add to long-lived elements.
- **Validate settings and files** before processing, and report failures with a clear message instead of failing silently.
- **Do not claim more than the code does** in the UI or documentation, especially for privacy.
- **Match the look:** reuse existing classes and variables, check light and dark themes, and check a narrow (phone-width) screen.
- Add or update unit tests in `tests/` for logic you change in `src/lib/`, and run `npm test` and `npm run build` before submitting.

## Pull requests

1. Fork the repository and create a branch from `main`.
2. Make a focused change with a clear description of what and why.
3. Test it in a browser (and mention what you checked), and run `npm test` and `npm run build`.
4. Open a pull request and fill in the template.

## Licensing

This repository does not currently include a license file. If that matters for your contribution, mention it in your issue or pull request so the maintainer can respond.

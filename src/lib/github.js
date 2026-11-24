// Links to the official FileForge repository and an optional, opt-in
// repository statistics lookup.
//
// Nothing here runs automatically: the GitHub API is contacted only when the
// person asks for live statistics. No token or credential is used.

export const REPO_OWNER = "kyxzu";
export const REPO_NAME = "FileForge";
export const REPO_URL = "https://github.com/kyxzu/FileForge";
export const REPO_GIT_URL = "https://github.com/kyxzu/FileForge.git";
export const DEFAULT_BRANCH = "main";

// Set to true only after GitHub Discussions is enabled for the repository.
// (It could not be verified when this was written, so no link is shown.)
export const DISCUSSIONS_ENABLED = false;

export const GITHUB_LINKS = {
  repository: REPO_URL,
  issues: `${REPO_URL}/issues`,
  newIssue: `${REPO_URL}/issues/new/choose`,
  pullRequests: `${REPO_URL}/pulls`,
  readme: `${REPO_URL}#readme`,
  contributing: `${REPO_URL}/blob/${DEFAULT_BRANCH}/CONTRIBUTING.md`,
  discussions: DISCUSSIONS_ENABLED ? `${REPO_URL}/discussions` : null,
};

// GitHub "mark" icon (16x16 viewBox).
export const GITHUB_ICON = `<svg class="github-icon" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false"><path fill="currentColor" d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>`;

const API_URL = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}`;
export const CACHE_KEY = "fileforge-github-stats";
export const CACHE_TTL_MS = 30 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 8000;

function readCache(storage) {
  try {
    const cached = JSON.parse(storage.getItem(CACHE_KEY));
    if (cached && Number.isFinite(cached.fetchedAt) && cached.data) return cached;
  } catch {
    // Storage may be unavailable or hold invalid data. Ignore it.
  }
  return null;
}

function writeCache(storage, entry) {
  try {
    storage.setItem(CACHE_KEY, JSON.stringify(entry));
  } catch {
    // Caching is optional.
  }
}

// Returns the cached statistics without any network request, or null.
export function getCachedRepoStats(storage = globalThis.localStorage, now = Date.now) {
  const cached = storage ? readCache(storage) : null;
  return cached ? { status: "cached", data: cached.data, fetchedAt: cached.fetchedAt, stale: now() - cached.fetchedAt > CACHE_TTL_MS } : null;
}

// Result: { status: "live" | "cached" | "error", data, fetchedAt, message }
//  - "live":   fetched from GitHub just now
//  - "cached": served from this browser's cache (message explains why when a
//              refresh was attempted and failed)
//  - "error":  nothing available; the rest of FileForge is unaffected
export async function fetchRepoStats({
  force = false,
  fetchImpl = globalThis.fetch,
  storage = globalThis.localStorage,
  now = Date.now,
} = {}) {
  const cached = storage ? readCache(storage) : null;

  if (cached && !force && now() - cached.fetchedAt <= CACHE_TTL_MS) {
    return { status: "cached", data: cached.data, fetchedAt: cached.fetchedAt, message: "" };
  }

  const fallback = (message) =>
    cached
      ? { status: "cached", data: cached.data, fetchedAt: cached.fetchedAt, message }
      : { status: "error", data: null, fetchedAt: null, message };

  if (typeof fetchImpl !== "function") {
    return fallback("Repository statistics are not available in this browser.");
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetchImpl(API_URL, {
      headers: { Accept: "application/vnd.github+json" },
      signal: controller.signal,
      credentials: "omit",
      referrerPolicy: "no-referrer",
    });

    if (response.status === 403 || response.status === 429) {
      const reset = Number(response.headers?.get?.("x-ratelimit-reset"));
      const when = Number.isFinite(reset) && reset > 0
        ? ` Try again after ${new Date(reset * 1000).toLocaleTimeString()}.`
        : " Try again later.";
      return fallback(`GitHub's rate limit was reached.${when}`);
    }

    if (!response.ok) {
      return fallback(`GitHub returned an unexpected response (${response.status}).`);
    }

    const json = await response.json();
    const data = {
      stars: Number(json.stargazers_count) || 0,
      forks: Number(json.forks_count) || 0,
      // GitHub counts open pull requests in this number as well.
      openIssuesAndPulls: Number(json.open_issues_count) || 0,
      pushedAt: typeof json.pushed_at === "string" ? json.pushed_at : null,
    };
    const fetchedAt = now();
    writeCache(storage, { fetchedAt, data });

    return { status: "live", data, fetchedAt, message: "" };
  } catch (error) {
    return fallback(
      error?.name === "AbortError"
        ? "GitHub did not respond in time."
        : "GitHub could not be reached. Check your connection."
    );
  } finally {
    clearTimeout(timer);
  }
}

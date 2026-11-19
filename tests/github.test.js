import { test } from "node:test";
import assert from "node:assert/strict";
import { fetchRepoStats, getCachedRepoStats, GITHUB_LINKS, REPO_URL, CACHE_TTL_MS } from "../src/lib/github.js";

const memoryStorage = () => {
  const map = new Map();
  return { getItem: (k) => map.get(k) ?? null, setItem: (k, v) => map.set(k, v) };
};
const apiResponse = (body, status = 200, headers = {}) => ({
  ok: status >= 200 && status < 300, status, json: async () => body,
  headers: { get: (name) => headers[name.toLowerCase()] ?? null },
});
const sample = { stargazers_count: 5, forks_count: 2, open_issues_count: 3, pushed_at: "2026-11-01T00:00:00Z" };

test("every repository link points at the official repository", () => {
  for (const [name, url] of Object.entries(GITHUB_LINKS)) {
    if (url === null) continue; // Discussions are not linked unless enabled.
    assert.ok(url.startsWith("https://github.com/kyxzu/FileForge"), `${name}: ${url}`);
  }
  assert.equal(REPO_URL, "https://github.com/kyxzu/FileForge");
});

test("live fetch returns data and writes the cache", async () => {
  const storage = memoryStorage();
  let requested;
  const result = await fetchRepoStats({
    fetchImpl: async (url, options) => { requested = { url, options }; return apiResponse(sample); },
    storage, now: () => 1000,
  });
  assert.equal(result.status, "live");
  assert.deepEqual(result.data, { stars: 5, forks: 2, openIssuesAndPulls: 3, pushedAt: "2026-11-01T00:00:00Z" });
  assert.equal(requested.url, "https://api.github.com/repos/kyxzu/FileForge");
  assert.equal(requested.options.headers.Authorization, undefined);
  assert.equal(getCachedRepoStats(storage, () => 1000).status, "cached");
});

test("a fresh cache is served without any request", async () => {
  const storage = memoryStorage();
  await fetchRepoStats({ fetchImpl: async () => apiResponse(sample), storage, now: () => 0 });
  const result = await fetchRepoStats({ fetchImpl: async () => { throw new Error("no network expected"); }, storage, now: () => CACHE_TTL_MS - 1 });
  assert.equal(result.status, "cached");
});

test("rate limiting falls back to the cache and says so", async () => {
  const storage = memoryStorage();
  await fetchRepoStats({ fetchImpl: async () => apiResponse(sample), storage, now: () => 0 });
  const result = await fetchRepoStats({
    force: true, storage, now: () => 5000,
    fetchImpl: async () => apiResponse({}, 403, { "x-ratelimit-reset": "1893456000" }),
  });
  assert.equal(result.status, "cached");
  assert.match(result.message, /rate limit/i);
});

test("network failure without a cache returns an error and never throws", async () => {
  const result = await fetchRepoStats({ storage: memoryStorage(), fetchImpl: async () => { throw new TypeError("offline"); } });
  assert.equal(result.status, "error");
  assert.match(result.message, /could not be reached/i);
});

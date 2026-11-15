const CACHE_NAME = "fileforge-shell-v1";
const SCOPE_URL = new URL(self.registration.scope);
const INDEX_URL = new URL("index.html", SCOPE_URL).href;
const APP_FILES = [
  SCOPE_URL.href,
  INDEX_URL,
  new URL("manifest.webmanifest", SCOPE_URL).href,
  new URL("favicon.svg", SCOPE_URL).href,
  new URL("icons/fileforge-192.png", SCOPE_URL).href,
  new URL("icons/fileforge-512.png", SCOPE_URL).href,
];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await Promise.all(APP_FILES.map((url) => cache.add(url)));

    const htmlResponse = await cache.match(INDEX_URL);
    const html = await htmlResponse.text();
    const assetUrls = [...html.matchAll(/(?:src|href)\s*=\s*["']([^"']+)["']/gi)]
      .map((match) => new URL(match[1], INDEX_URL))
      .filter((url) =>
        url.origin === self.location.origin &&
        url.href.startsWith(SCOPE_URL.href) &&
        /\.(?:js|css|svg|png|webmanifest)$/i.test(url.pathname)
      )
      .map((url) => url.href);

    await Promise.all(
      [...new Set(assetUrls)].map(async (url) => {
        try {
          await cache.add(url);
        } catch {
          // A nonessential asset should not prevent installation.
        }
      })
    );

    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const cacheNames = await caches.keys();
    await Promise.all(
      cacheNames
        .filter((name) => name.startsWith("fileforge-shell-") && name !== CACHE_NAME)
        .map((name) => caches.delete(name))
    );
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const requestUrl = new URL(request.url);

  if (
    request.method !== "GET" ||
    requestUrl.origin !== self.location.origin ||
    !requestUrl.href.startsWith(SCOPE_URL.href)
  ) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            caches.open(CACHE_NAME).then((cache) => cache.put(INDEX_URL, response.clone()));
          }
          return response;
        })
        .catch(async () => {
          return (await caches.match(INDEX_URL)) || Response.error();
        })
    );
    return;
  }

  if (/\.(?:js|css|svg|png|webmanifest)$/i.test(requestUrl.pathname)) {
    event.respondWith(
      caches.match(request).then(async (cachedResponse) => {
        if (cachedResponse) return cachedResponse;

        const response = await fetch(request);
        if (response.ok) {
          const cache = await caches.open(CACHE_NAME);
          await cache.put(request, response.clone());
        }
        return response;
      })
    );
  }
});

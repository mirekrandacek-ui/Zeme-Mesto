const CACHE_PREFIX = "zememesto-native-shell-";
const CACHE_NAME = `${CACHE_PREFIX}v1`;
const ROOT_URL = "/";
const OFFLINE_URL = "/offline.html";

async function cacheResponse(cache, request, response) {
  if (response && response.ok && response.type === "basic") {
    await cache.put(request, response.clone());
  }
}

async function warmAppShell() {
  const cache = await caches.open(CACHE_NAME);

  try {
    await cache.add(OFFLINE_URL);
  } catch {}

  const rootResponse = await fetch(ROOT_URL, {
    cache: "no-store",
  });

  if (!rootResponse.ok) return;

  await cache.put(ROOT_URL, rootResponse.clone());

  const html = await rootResponse.text();

  const assetUrls = Array.from(
    new Set(
      Array.from(
        html.matchAll(/(?:src|href)=["']([^"']+)["']/g),
        (match) => match[1]
      ).filter((url) => url.startsWith("/_next/static/"))
    )
  );

  await Promise.all(
    assetUrls.map(async (url) => {
      try {
        const response = await fetch(url, {
          cache: "no-store",
        });

        await cacheResponse(cache, url, response);
      } catch {}
    })
  );
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      try {
        await warmAppShell();
      } catch {}

      await self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const cacheNames = await caches.keys();

      await Promise.all(
        cacheNames
          .filter(
            (cacheName) =>
              cacheName.startsWith(CACHE_PREFIX) &&
              cacheName !== CACHE_NAME
          )
          .map((cacheName) => caches.delete(cacheName))
      );

      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;

  if (request.method !== "GET") return;

  const url = new URL(request.url);

  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const response = await fetch(request);

          if (url.pathname === "/") {
            const cache = await caches.open(CACHE_NAME);
            await cacheResponse(cache, ROOT_URL, response);
          }

          return response;
        } catch {
          return (
            (await caches.match(ROOT_URL)) ||
            (await caches.match(OFFLINE_URL))
          );
        }
      })()
    );

    return;
  }

  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      (async () => {
        const cached = await caches.match(request);

        if (cached) return cached;

        const response = await fetch(request);
        const cache = await caches.open(CACHE_NAME);

        await cacheResponse(cache, request, response);

        return response;
      })()
    );
  }
});

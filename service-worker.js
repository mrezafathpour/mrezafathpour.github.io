// Shows offline.html when a page cannot be loaded without a connection.
// Pages are always fetched from the network first, so the app itself is never
// served stale from here; only the offline page (and its icon) is cached.
// Paths are relative to this file, so it works under any path the site is
// served from.

// Bump the version whenever offline.html changes, so the new one is cached
const CACHE = "offline-v5";
const OFFLINE_URL = "offline.html";
const PRECACHE = [OFFLINE_URL, "icons/favicon.svg"];

self.addEventListener("install", (event) => {
    event.waitUntil(
        caches
            .open(CACHE)
            // "reload" skips the browser's HTTP cache, so a fresh copy is stored
            .then((cache) =>
                cache.addAll(
                    PRECACHE.map((url) => new Request(url, { cache: "reload" }))
                )
            )
            .then(() => self.skipWaiting())
    );
});

self.addEventListener("activate", (event) => {
    event.waitUntil(
        (async () => {
            const keys = await caches.keys();
            await Promise.all(
                keys
                    .filter((key) => key !== CACHE)
                    .map((key) => caches.delete(key))
            );

            // Preloads go through the browser's HTTP cache, which would serve
            // a recently visited page offline instead of offline.html; turned
            // off here as the first version of this file had turned them on
            if (self.registration.navigationPreload) {
                await self.registration.navigationPreload.disable();
            }

            await self.clients.claim();
        })()
    );
});

self.addEventListener("fetch", (event) => {
    const { request } = event;

    if (request.mode === "navigate") {
        event.respondWith(
            (async () => {
                try {
                    // GitHub Pages lets browsers reuse a page for 10 minutes
                    // without asking; "no-cache" always checks with the
                    // server (cheap when unchanged), so going offline is
                    // noticed at once. Redirects are left to the browser.
                    return await fetch(request.url, {
                        cache: "no-cache",
                        credentials: "same-origin",
                        redirect: "manual",
                    });
                } catch {
                    const cache = await caches.open(CACHE);
                    return cache.match(OFFLINE_URL);
                }
            })()
        );
        return;
    }

    // The offline page's icon, which it cannot fetch while offline
    if (new URL(request.url).pathname.endsWith("/icons/favicon.svg")) {
        event.respondWith(
            caches
                .match(request)
                .then((cached) => cached || fetch(request))
        );
    }
});

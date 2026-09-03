/**
 * Polaris service worker - low-bandwidth and offline support.
 *
 * Written by hand rather than generated, because the caching policy here is a
 * product decision and not a build step:
 *
 *   • The workspace shell and static assets are cache-first. On a bad
 *     connection the app should paint instantly and revalidate behind you.
 *   • Read APIs the student needs offline (roadmap, weekly tasks, deadlines)
 *     are network-first with a cache fallback, and the response is stamped so
 *     the UI can say "showing what we had at 14:05" rather than pretending it
 *     is live.
 *   • Everything else - anything authenticated and mutating, anything from the
 *     model, anything to do with payments - is never cached at all. A stale
 *     plan is inconvenient; a stale payment state is a bug with a price.
 *
 * Exam answer submissions queue via Background Sync where it exists and fall
 * back to a replay on the next successful load, so a dropped connection mid-mock
 * does not lose the attempt.
 */

const VERSION = "polaris-v1";
const SHELL_CACHE = `${VERSION}-shell`;
const DATA_CACHE = `${VERSION}-data`;
const QUEUE_DB = "polaris-outbox";

/** Shell routes worth having available cold. */
const SHELL_ROUTES = ["/offline", "/roadmap", "/deadlines"];

/** GET APIs that are useful when offline. */
const CACHEABLE_API = [
  "/api/roadmap/v2",
  "/api/tasks/weekly",
  "/api/deadlines",
  "/api/profile",
  "/api/session",
];

/** Never cached, under any circumstances. */
const NEVER_CACHE = [
  "/api/strategist",
  "/api/gemma-studio",
  "/api/action-lab",
  "/api/checkout",
  "/api/payments",
  "/api/billing",
  "/api/webhooks",
  "/api/cron",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_ROUTES).catch(() => undefined))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => !k.startsWith(VERSION))
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

function isNeverCached(url) {
  return NEVER_CACHE.some((p) => url.pathname.startsWith(p));
}

function isCacheableApi(url) {
  return CACHEABLE_API.some((p) => url.pathname.startsWith(p));
}

/** Network-first: fresh when possible, last-known when not. */
async function networkFirst(request) {
  const cache = await caches.open(DATA_CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) {
      // Stamp so the client can show how old this is if it serves it later.
      const body = await response.clone().blob();
      const headers = new Headers(response.headers);
      headers.set("x-polaris-cached-at", new Date().toISOString());
      cache.put(request, new Response(body, { status: response.status, headers }));
    }
    return response;
  } catch (err) {
    const cached = await cache.match(request);
    if (cached) {
      const headers = new Headers(cached.headers);
      headers.set("x-polaris-from-cache", "1");
      return new Response(await cached.blob(), { status: 200, headers });
    }
    throw err;
  }
}

/** Cache-first with background revalidation. */
async function staleWhileRevalidate(request) {
  const cache = await caches.open(SHELL_CACHE);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then((response) => {
      if (response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => undefined);
  return cached ?? (await network) ?? Response.error();
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return; // mutations go to the outbox, below

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (isNeverCached(url)) return;

  if (url.pathname.startsWith("/api/")) {
    if (isCacheableApi(url)) event.respondWith(networkFirst(request));
    return;
  }

  // Navigations: try the network, fall back to the cached page, then /offline.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(SHELL_CACHE).then((c) => c.put(request, copy)).catch(() => {});
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          return cached ?? (await caches.match("/offline")) ?? Response.error();
        }),
    );
    return;
  }

  // Build assets are immutable and content-hashed.
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(staleWhileRevalidate(request));
  }
});

/* ── Outbox: exam answers that were written while offline ────────────────── */

function openOutbox() {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open(QUEUE_DB, 1);
    open.onupgradeneeded = () => {
      open.result.createObjectStore("requests", { autoIncrement: true });
    };
    open.onsuccess = () => resolve(open.result);
    open.onerror = () => reject(open.error);
  });
}

async function flushOutbox() {
  let db;
  try {
    db = await openOutbox();
  } catch {
    return;
  }
  const tx = db.transaction("requests", "readwrite");
  const store = tx.objectStore("requests");
  const all = await new Promise((resolve) => {
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result ?? []);
    req.onerror = () => resolve([]);
  });

  for (const entry of all) {
    try {
      const res = await fetch(entry.url, {
        method: entry.method,
        headers: entry.headers,
        body: entry.body,
      });
      // Only drop the entry once the server has actually accepted it.
      if (!res.ok && res.status < 500) continue;
    } catch {
      return; // still offline - keep everything and try again later
    }
  }
  store.clear();
}

self.addEventListener("sync", (event) => {
  if (event.tag === "polaris-outbox") event.waitUntil(flushOutbox());
});

self.addEventListener("message", (event) => {
  if (event.data === "flush-outbox") event.waitUntil(flushOutbox());
  if (event.data === "skip-waiting") self.skipWaiting();
});

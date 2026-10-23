/* eslint-disable no-restricted-globals */
/**
 * Precision Resume Studio service worker.
 *
 * SOURCE FILE. This is not imported by the app. The build (the small inline
 * plugin in vite.config.js) copies it to dist/sw.js and substitutes the two
 * placeholders at the bottom of this comment:
 *
 *   __PRECACHE_MANIFEST__  JSON array of same-origin URLs to precache
 *   __CACHE_VERSION__      a version string derived from the asset list
 *
 * CACHING STRATEGY
 *   HTML shell (navigations)  network-first, cache fallback
 *       A deploy must be picked up on the next load, but an offline load must
 *       still open the app. Network-first is the only strategy that does both.
 *   /assets/*                 cache-first
 *       Filenames are content-hashed and therefore immutable; re-fetching them
 *       is pure waste.
 *   Other same-origin GETs    cache-first, network fallback (icons, manifest,
 *       textures). These are small and change rarely.
 *   Everything else           NOT INTERCEPTED.
 *       That covers every cross-origin request (Google Fonts, the AI provider
 *       endpoints) and the local job agent on :3457. The agent is dynamic and
 *       holds live job results; caching it would serve stale postings.
 *
 * FAILURE POLICY
 *   A service worker must never be able to break the app. Install uses
 *   allSettled and tolerates individual precache misses; every fetch handler
 *   falls through to the network on error; nothing here throws to the page.
 */

const PRECACHE_URLS = __PRECACHE_MANIFEST__;
const CACHE_VERSION = __CACHE_VERSION__;

const CACHE_PREFIX = 'precision-resume';
const CACHE_NAME = `${CACHE_PREFIX}-${CACHE_VERSION}`;

/** The local job-discovery / apply agent. Never cache, never touch. */
const AGENT_PORT = '3457';

/** True for requests this worker must leave completely alone. */
function isBypassed(request, url) {
  // Cross-origin: the browser handles it, we never see a cache entry.
  if (url.origin !== self.location.origin) return true;

  // The job agent runs on localhost:3457 on the user's own machine.
  if (url.port === AGENT_PORT) return true;

  // Anything that is not a plain GET (POST to the agent, range requests).
  if (request.method !== 'GET') return true;

  // Vite dev server / HMR endpoints, in case a stale worker is still installed
  // from a previous session.
  if (url.pathname.startsWith('/@') || url.pathname.startsWith('/__')) return true;
  if (url.pathname === '/sw.js') return true;

  return false;
}

/** A navigation request for the app shell. */
function isShellRequest(request, url) {
  if (request.mode === 'navigate') return true;
  return url.pathname === '/' || url.pathname === '/index.html';
}

// --- install: precache the shell ------------------------------------------

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);

      // Individually, so one 404 cannot abort the whole install. A worker with
      // 95% of the shell cached is far better than no worker at all.
      const results = await Promise.allSettled(
        PRECACHE_URLS.map(async (url) => {
          // `reload` bypasses the HTTP cache so we store the deploy's bytes,
          // not a stale intermediary copy.
          const response = await fetch(url, { cache: 'reload' });
          if (response.ok) await cache.put(url, response);
          return url;
        })
      );

      const failed = results.filter((r) => r.status === 'rejected').length;
      if (failed > 0) {
        // Not fatal. The network-first shell path covers the gaps.
        console.warn(`[sw] precache: ${failed}/${PRECACHE_URLS.length} URLs unavailable`);
      }

      // Take over as soon as possible; the shell is network-first, so a new
      // worker can never pin the user to an old build.
      await self.skipWaiting();
    })()
  );
});

// --- activate: drop every previous version --------------------------------

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names
          .filter((name) => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
      await self.clients.claim();
    })()
  );
});

// --- fetch ----------------------------------------------------------------

self.addEventListener('fetch', (event) => {
  const { request } = event;

  let url;
  try {
    url = new URL(request.url);
  } catch (err) {
    return; // Unparseable URL: let the browser deal with it.
  }

  if (isBypassed(request, url)) return;

  if (isShellRequest(request, url)) {
    event.respondWith(networkFirstShell(request, url));
    return;
  }

  // Everything else that survived the bypass list: hashed assets, icons, the
  // manifest, textures. All immutable-or-rarely-changing, so cache-first.
  event.respondWith(cacheFirst(request));
});

/**
 * Network-first for the shell: a deploy is visible on the next load, and an
 * offline load still opens the app from cache.
 */
async function networkFirstShell(request, url) {
  const cache = await caches.open(CACHE_NAME);

  try {
    const response = await fetch(request);
    if (response && response.ok) {
      // Store under both keys so a direct /index.html navigation and a /
      // navigation both find a copy.
      cache.put('/index.html', response.clone());
      cache.put('/', response.clone());
    }
    return response;
  } catch (err) {
    const cached = (await cache.match(request)) || (await cache.match('/index.html')) || (await cache.match('/'));
    if (cached) return cached;

    // Nothing cached and the network is down: give a real answer rather than
    // the browser's generic offline page.
    return new Response(
      '<!doctype html><meta charset="utf-8"><title>Offline</title>' +
        '<body style="font-family:system-ui;background:#140715;color:#fdf2f8;padding:3rem">' +
        '<h1 style="font-size:1.25rem">You are offline</h1>' +
        '<p style="opacity:.8">Precision Resume Studio could not load its app shell. ' +
        'Reconnect and reload. Your saved resumes are still in this browser.</p>',
      { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    );
  }
}

/** Cache-first, with a network fallback that backfills the cache. */
async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);

  const cached = await cache.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    // Only cache successful, same-origin, basic responses. An opaque cross-
    // origin response has status 0 and would poison the cache.
    if (response && response.ok && response.type === 'basic') {
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    // Offline and not cached: propagate so the page sees a normal network
    // error instead of a fabricated response.
    throw err;
  }
}

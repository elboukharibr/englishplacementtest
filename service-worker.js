const CACHE_NAME = 'english-placement-test-v1';
const OFFLINE_URL = 'offline.html'; // This will be a dynamically generated response

// Basic offline HTML page content
const OFFLINE_HTML_CONTENT = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Offline - English Test</title>
  <style>
    body { font-family: sans-serif; margin: 0; padding: 20px; text-align: center; background-color: #f1f5f9; color: #333; }
    .container { max-width: 600px; margin: 50px auto; padding: 20px; background-color: #fff; border-radius: 8px; box-shadow: 0 0 10px rgba(0,0,0,0.1); }
    h1 { color: #4338ca; }
  </style>
</head>
<body>
  <div class="container">
    <h1>You are offline</h1>
    <p>Please check your internet connection to use the English Placement Test.</p>
  </div>
</body>
</html>
`;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Cache the offline.html content as a Response object
      const offlinePageResponse = new Response(OFFLINE_HTML_CONTENT, {
        headers: { 'Content-Type': 'text/html' }
      });
      return cache.put(OFFLINE_URL, offlinePageResponse);
    })
  );
  self.skipWaiting(); // Force the waiting service worker to become the active service worker.
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim(); // Take control of all open clients without waiting for reload
});

self.addEventListener('fetch', (event) => {
  // We only want to call event.respondWith() if this is a navigation request
  // for an HTML page.
  if (event.request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          // First, try to use the navigation preload response if it's supported.
          const preloadResponse = await event.preloadResponse;
          if (preloadResponse) {
            return preloadResponse;
          }

          const networkResponse = await fetch(event.request);
          return networkResponse;
        } catch (error) {
          // catch is only triggered if an exception is thrown, which implies the network request failed.
          console.log('Fetch failed; returning offline page instead.', error);

          const cache = await caches.open(CACHE_NAME);
          const cachedResponse = await cache.match(OFFLINE_URL);
          return cachedResponse;
        }
      })()
    );
  }

  // If our Navaigation Handler didn't respond to the event,
  // then there are other fetch handlers to check.
  // For other requests (CSS, JS, images), you might want to implement
  // a cache-first or network-first strategy. For simplicity, this is omitted.
});
const CACHE_NAME = 'aquasync-v1.5.1';

const PRECACHE_URLS = [
    './',
    './Index.html',
    './manifest.json',
    './src/main.js',
    './src/api.js',
    './src/state.js',
    './src/ui-factory.js',
    './src/components/analytics/Charts.js',
    './src/components/analytics/Overview.js',
    './src/components/hardware/ColorMixer.js',
    './src/components/hardware/PrimaryControlCard.js',
    './src/components/hardware/ScheduleCard.js',
    './src/components/system/Companion.js'
];

self.addEventListener('install', event => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(PRECACHE_URLS))
    );
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);

    // Bypass cache for API calls (Firebase & Local ESP32)
    if (
        url.hostname.includes('firebase') || 
        url.hostname.includes('firebasedatabase.app') ||
        url.hostname.match(/^[0-9.]+$/) // Match IPv4 for local ESP32
    ) {
        return; // Let the browser handle standard network request without caching
    }

    // Network-First strategy for App Files (HTML, JS, CSS, Icons)
    event.respondWith(
        fetch(event.request)
            .then(networkResponse => {
                // If the fetch was successful, dynamically add it to the cache
                if (networkResponse.ok && event.request.method === 'GET') {
                    const clonedResponse = networkResponse.clone();
                    caches.open(CACHE_NAME).then(cache => {
                        cache.put(event.request, clonedResponse);
                    });
                }
                return networkResponse;
            })
            .catch(() => {
                // If network fails (offline), fallback to cache
                return caches.match(event.request);
            })
    );
});

const CACHE_VERSION = '1.6.0'; // Update this version when deploying changes
const CACHE_NAME = 'new-life-v' + CACHE_VERSION;
const STATIC_CACHE = 'new-life-static-v1';

// Install service worker and force immediate activation
self.addEventListener('install', (event) => {
  console.log('Service Worker installing version:', CACHE_VERSION);
  self.skipWaiting(); // Force immediate activation
  
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return cache.addAll([
        '/manifest.json',
        '/icon-192.png',
        '/icon-512.png',
        '/favicon-simple.svg',
        '/favicon-new.ico'
      ]);
    })
  );
});

// Network-first strategy for fresh content
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') return;
  
  // Skip external requests
  if (!event.request.url.startsWith(self.location.origin)) return;
  
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // If network request succeeds, update cache and return response
        if (response.status === 200) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        // If network fails, try cache
        return caches.match(event.request).then((response) => {
          if (response) {
            return response;
          }
          // If not in cache either, return offline page
          if (event.request.destination === 'document') {
            return caches.match('/');
          }
        });
      })
  );
});

// Clean old caches and claim all clients
self.addEventListener('activate', (event) => {
  console.log('Service Worker activating version:', CACHE_VERSION);
  event.waitUntil(
    Promise.all([
      // Clean old caches
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME && cacheName !== STATIC_CACHE) {
              console.log('Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      }),
      // Take control of all pages
      self.clients.claim()
    ])
  );
});

// Listen for messages from main thread
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CHECK_UPDATE') {
    // Force update check
    event.ports[0].postMessage({ type: 'UPDATE_AVAILABLE' });
  }
});

// Push notification handlers
self.addEventListener('push', function(event) {
  if (!event.data) return;
  
  try {
    const data = event.data.json();
    const options = {
      body: data.body || '',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      vibrate: [200, 100, 200],
      tag: 'sos-medication-' + Date.now(),
      requireInteraction: true,
      data: data.data || {},
      dir: 'rtl',
      lang: 'he'
    };
    
    event.waitUntil(
      self.registration.showNotification(data.title || 'התראה', options)
    );
  } catch (error) {
    console.error('Error showing notification:', error);
  }
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  
  const data = event.notification.data || {};
  let url = '/medication-distribution';
  
  if (data.type === 'sosMedication' && data.patientId) {
    url = '/medication-distribution?patient=' + data.patientId;
  }
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if (client.url.includes(self.registration.scope) && 'focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});
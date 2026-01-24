// Service Worker for Push Notifications
// This file handles push events and notification clicks

self.addEventListener('push', function(event) {
  if (!event.data) {
    console.log('Push event without data');
    return;
  }

  const data = event.data.json();

  const options = {
    body: data.body || 'Bill update notification',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: data.tag || 'bill-update',
    data: {
      url: data.url || '/',
      billId: data.billId,
      eventType: data.eventType,
    },
    actions: [
      {
        action: 'view',
        title: 'View Bill',
      },
      {
        action: 'dismiss',
        title: 'Dismiss',
      },
    ],
    requireInteraction: data.requireInteraction || false,
    vibrate: [200, 100, 200],
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'TexLegAI', options)
  );
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();

  if (event.action === 'dismiss') {
    return;
  }

  const url = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(function(clientList) {
        // Check if there's already a window open with the URL
        for (const client of clientList) {
          if (client.url === url && 'focus' in client) {
            return client.focus();
          }
        }
        // Open a new window if none found
        if (clients.openWindow) {
          return clients.openWindow(url);
        }
      })
  );
});

self.addEventListener('notificationclose', function(event) {
  // Track notification dismissals if needed
  console.log('Notification closed:', event.notification.tag);
});

// Handle service worker installation
self.addEventListener('install', function(event) {
  console.log('Service Worker installing.');
  self.skipWaiting();
});

// Handle service worker activation
self.addEventListener('activate', function(event) {
  console.log('Service Worker activating.');
  event.waitUntil(clients.claim());
});

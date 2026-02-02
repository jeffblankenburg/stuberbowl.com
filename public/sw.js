// Service Worker for Stuber Bowl Push Notifications

// Handle push events
self.addEventListener('push', (event) => {
  if (!event.data) {
    console.log('Push event with no data')
    return
  }

  const data = event.data.json()
  const { title, body, icon, badge, data: notificationData } = data

  // Show the notification
  const options = {
    body: body || 'New update',
    icon: icon || '/icons/icon-192x192.png',
    badge: badge || '/icons/icon-192x192.png',
    tag: 'stuberbowl-notification',
    renotify: true,
    data: notificationData,
    vibrate: [100, 50, 100],
    actions: [
      {
        action: 'open',
        title: 'Open App'
      },
      {
        action: 'dismiss',
        title: 'Dismiss'
      }
    ]
  }

  event.waitUntil(
    Promise.all([
      self.registration.showNotification(title || 'Stuber Bowl', options),
      ('setAppBadge' in navigator)
        ? navigator.setAppBadge(1).catch(() => {})
        : Promise.resolve()
    ])
  )
})

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  if (event.action === 'dismiss') {
    return
  }

  // Open or focus the app
  const urlToOpen = new URL('/', self.location.origin).href

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(urlToOpen)
          return client.focus()
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen)
      }
    })
  )
})

// Handle messages from the main thread (for badge updates)
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SET_BADGE') {
    if ('setAppBadge' in navigator) {
      if (event.data.count > 0) {
        navigator.setAppBadge(event.data.count)
      } else {
        navigator.clearAppBadge()
      }
    }
  }

  if (event.data && event.data.type === 'CLEAR_BADGE') {
    if ('clearAppBadge' in navigator) {
      navigator.clearAppBadge()
    }
  }
})

// Service worker activation - claim clients immediately
self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim())
})

// Service worker installation
self.addEventListener('install', (event) => {
  self.skipWaiting()
})

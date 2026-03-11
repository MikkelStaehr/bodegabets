// Service Worker for Bodega Bets push notifications

self.addEventListener('push', function (event) {
  const data = event.data ? event.data.json() : {}

  const title = data.title || '⏰ Bodega Bets'
  const options = {
    body: data.body || 'Du har en ny påmindelse!',
    icon: '/next.svg',
    badge: '/next.svg',
    data: {
      url: data.url || '/dashboard',
    },
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', function (event) {
  event.notification.close()

  const url = event.notification.data?.url || '/dashboard'

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(url)
          return client.focus()
        }
      }
      return clients.openWindow(url)
    })
  )
})

// 하루한칸 서비스 워커: 웹 푸시 알림만 다뤄요.
// (화면 파일을 저장해 두는 오프라인 캐시는 쓰지 않아요 → 배포하면 바로 새 화면이 보여요)

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))

// 서버가 보낸 알림 표시. iOS 는 푸시를 받을 때마다 알림을 꼭 띄워야 해요.
self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = { title: '하루한칸', body: event.data ? event.data.text() : '' }
  }
  const scope = self.registration.scope
  event.waitUntil(
    self.registration.showNotification(data.title || '하루한칸', {
      body: data.body || '',
      icon: scope + 'icons/icon-192.png',
      badge: scope + 'icons/badge-96.png',
      tag: data.tag,
      data: { url: data.url || '' },
    }),
  )
})

/**
 * 알림을 열 주소: 알림을 켠 바로 그 사이트(이 서비스 워커의 주소) + '#/calendar/…'
 * 서버는 배포 주소를 보내지만, 화면 경로(# 뒤)만 써서 로그인해 둔 그 사이트에서 열어요.
 * (예: 맥에서 localhost 로 켰으면 localhost, 아이폰 홈 화면 앱이면 github.io)
 */
function targetUrl(raw) {
  const scope = self.registration.scope
  const text = String(raw || '')
  const hash = text.indexOf('#')
  return hash >= 0 ? scope + text.slice(hash) : scope
}

// 알림을 누르면 해당 챌린지 화면으로: 열려 있는 하루한칸 창이 있으면 그 창으로, 없으면 새로 열기
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = targetUrl(event.notification.data && event.notification.data.url)
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      for (const client of windows) {
        if (client.url.startsWith(self.registration.scope)) {
          await client.focus()
          if ('navigate' in client) {
            try {
              await client.navigate(url)
              return
            } catch {
              /* 이동이 막히면 아래에서 새 창 */
            }
          }
          client.postMessage({ type: 'open-url', url })
          return
        }
      }
      await self.clients.openWindow(url)
    })(),
  )
})

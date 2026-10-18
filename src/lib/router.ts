import { useEffect, useState } from 'react'

// 별도 라우터 패키지 없이 주소의 # 뒷부분으로 화면을 바꿉니다.
// 예) #/  →  달력(첫 화면),  #/stats  →  통계,  #/calendar/exercise  →  캘린더별 상세

export type Route =
  | { name: 'home' }
  | { name: 'stats' }
  | { name: 'settings' }
  | { name: 'calendar'; id: string }
  | { name: 'new' }
  | { name: 'edit'; id: string }

export function parseHash(hash: string): Route {
  const path = hash.replace(/^#/, '') || '/'
  const match = path.match(/^\/calendar\/([^/]+)$/)
  if (match) return { name: 'calendar', id: decodeURIComponent(match[1]) }
  const edit = path.match(/^\/edit\/([^/]+)$/)
  if (edit) return { name: 'edit', id: decodeURIComponent(edit[1]) }
  if (path === '/new') return { name: 'new' }
  if (path === '/stats') return { name: 'stats' }
  if (path === '/settings') return { name: 'settings' }
  return { name: 'home' }
}

export function hrefFor(route: Route): string {
  switch (route.name) {
    case 'home':
      return '#/'
    case 'new':
      return '#/new'
    case 'stats':
      return '#/stats'
    case 'settings':
      return '#/settings'
    case 'calendar':
      return `#/calendar/${encodeURIComponent(route.id)}`
    case 'edit':
      return `#/edit/${encodeURIComponent(route.id)}`
  }
}

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parseHash(window.location.hash))

  useEffect(() => {
    const onChange = () => {
      setRoute(parseHash(window.location.hash))
      window.scrollTo({ top: 0 })
    }
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])

  return route
}

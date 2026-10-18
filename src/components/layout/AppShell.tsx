import { useEffect, useState, type ReactNode } from 'react'
import { Menu, X } from 'lucide-react'
import type { Route } from '../../lib/router'
import { useData } from '../../data/DataProvider'
import { SidebarContent, SidebarLogo, type CalendarFilter } from './Sidebar'

interface AppShellProps {
  route: Route
  filter: CalendarFilter
  onFilterChange: (filter: CalendarFilter) => void
  children: ReactNode
}

export function AppShell({ route, filter, onFilterChange, children }: AppShellProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const { calendars } = useData()

  // 화면이 바뀌면 모바일 메뉴를 닫습니다.
  useEffect(() => setMenuOpen(false), [route, filter])

  useEffect(() => {
    if (!menuOpen) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMenuOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [menuOpen])

  const sidebar = <SidebarContent route={route} calendars={calendars} filter={filter} onFilterChange={onFilterChange} />

  return (
    <div className="min-h-screen md:flex">
      {/* PC: 왼쪽 고정 사이드바 */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col gap-8 overflow-y-auto border-r border-line bg-sidebar px-4 py-7 md:flex">
        <SidebarLogo />
        {sidebar}
      </aside>

      {/* 모바일: 상단 바 + 펼치는 메뉴 */}
      <header className="sticky top-0 z-30 border-b border-line bg-sidebar md:hidden">
        <div className="flex h-14 items-center justify-between px-3">
          <SidebarLogo />
          <button
            type="button"
            className="flex h-10 w-10 items-center justify-center rounded-full text-ink-900 hover:bg-line/60"
            onClick={() => setMenuOpen((open) => !open)}
            aria-expanded={menuOpen}
            aria-controls="mobile-menu"
            aria-label={menuOpen ? '메뉴 닫기' : '메뉴 열기'}
          >
            {menuOpen ? <X size={22} strokeWidth={1.6} /> : <Menu size={22} strokeWidth={1.6} />}
          </button>
        </div>
        {menuOpen && (
          <>
            <div className="fixed inset-0 top-14 z-20 bg-ink-900/10" onClick={() => setMenuOpen(false)} aria-hidden="true" />
            <div
              id="mobile-menu"
              className="absolute inset-x-0 top-14 z-30 max-h-[calc(100vh-3.5rem)] overflow-y-auto border-b border-line bg-sidebar px-3 pb-5 pt-3"
            >
              {sidebar}
            </div>
          </>
        )}
      </header>

      <main className="min-w-0 flex-1 p-3 sm:p-5 lg:p-7">{children}</main>
    </div>
  )
}

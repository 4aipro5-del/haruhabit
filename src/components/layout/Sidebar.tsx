import type { ReactNode } from 'react'
import { CalendarDays, ChartColumn, Cloud, HardDrive, Settings, Sprout } from 'lucide-react'
import { useAuth } from '../../data/AuthProvider'
import { useData } from '../../data/DataProvider'
import type { HabitCalendar } from '../../types'
import type { Route } from '../../lib/router'
import { hrefFor } from '../../lib/router'
import { COLOR_STYLES } from '../../lib/colors'
import { isEnded } from '../../lib/activity'
import { todayKey } from '../../lib/date'

/** 'all' 또는 캘린더 id */
export type CalendarFilter = string

interface SidebarProps {
  route: Route
  calendars: HabitCalendar[]
  filter: CalendarFilter
  onFilterChange: (filter: CalendarFilter) => void
}

export function SidebarLogo() {
  return (
    <a href={hrefFor({ name: 'home' })} className="flex items-center gap-2.5 px-2" aria-label="하루한칸 첫 화면">
      <Sprout size={24} strokeWidth={1.6} className="text-leaf-700" />
      <span className="text-xl text-ink-900">하루한칸</span>
    </a>
  )
}

export function SidebarContent({ route, calendars: allCalendars, filter, onFilterChange }: SidebarProps) {
  const onCalendarPage = route.name === 'home'
  // 목표 기간이 끝난 캘린더는 첫 화면 사이드바에서 숨김 (설정 › 캘린더 관리의 '지난 캘린더'에서 볼 수 있음)
  const today = todayKey()
  const calendars = allCalendars.filter((c) => !isEnded(c, today))

  return (
    <div className="flex flex-col gap-1">
      <nav className="flex flex-col gap-1" aria-label="메뉴">
        <NavItem href={hrefFor({ name: 'home' })} active={onCalendarPage} icon={<CalendarDays size={19} strokeWidth={1.6} />}>
          캘린더
        </NavItem>
        <NavItem
          href={hrefFor({ name: 'stats' })}
          active={route.name === 'stats' || route.name === 'calendar'}
          icon={<ChartColumn size={19} strokeWidth={1.6} />}
        >
          통계
        </NavItem>
        <NavItem href={hrefFor({ name: 'settings' })} active={route.name === 'settings'} icon={<Settings size={19} strokeWidth={1.6} />}>
          설정
        </NavItem>
      </nav>

      <div className="my-5 border-t border-line" />

      {/* 새 캘린더는 설정 › 캘린더 관리에서만 만들어요 */}
      <div className="mb-2 flex h-7 items-center px-3">
        <span className="text-sm text-ink-700">내 캘린더</span>
      </div>

      <ul className="flex flex-col gap-0.5" aria-label="달력에 표시할 캘린더">
        <FilterItem active={onCalendarPage && filter === 'all'} onClick={() => onFilterChange('all')} dot="bg-ink-400">
          전체
        </FilterItem>
        {calendars.map((cal) => (
          <FilterItem
            key={cal.id}
            active={onCalendarPage && filter === cal.id}
            onClick={() => onFilterChange(cal.id)}
            dot={COLOR_STYLES[cal.color].dot}
          >
            {cal.name}
          </FilterItem>
        ))}
      </ul>

      <div className="my-5 border-t border-line" />
      <StorageStatus />
    </div>
  )
}

/** 로그인 상태와 저장 상태 (저장 중 / 저장됨 / 저장 실패) */
function StorageStatus() {
  const { user, configured } = useAuth()
  const { mode, sync } = useData()

  if (mode === 'local') {
    return (
      <a href={hrefFor({ name: 'settings' })} className="flex items-start gap-2.5 rounded-xl px-3 py-2 text-sm text-ink-500 hover:bg-line/50">
        <HardDrive size={17} strokeWidth={1.6} className="mt-0.5 shrink-0" />
        <span>
          이 브라우저에 저장 중
          {configured && <span className="block text-ink-400">로그인하면 클라우드에 저장돼요</span>}
        </span>
      </a>
    )
  }

  const syncText = {
    idle: '클라우드에 저장돼요',
    saving: '저장 중…',
    saved: '저장됨',
    error: '저장 실패',
  }[sync.state]

  return (
    <a
      href={hrefFor({ name: 'settings' })}
      className="flex items-start gap-2.5 rounded-xl px-3 py-2 text-sm text-ink-500 hover:bg-line/50"
      title={sync.message}
    >
      <Cloud size={17} strokeWidth={1.6} className="mt-0.5 shrink-0 text-sky-700" />
      <span className="min-w-0">
        <span className="block truncate text-ink-700">{user?.email}</span>
        <span role="status" aria-live="polite" className={sync.state === 'error' ? 'text-peach-700' : 'text-ink-400'}>
          {syncText}
        </span>
      </span>
    </a>
  )
}

function NavItem({ href, active, icon, children }: { href: string; active: boolean; icon: ReactNode; children: ReactNode }) {
  return (
    <a
      href={href}
      aria-current={active ? 'page' : undefined}
      className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] ${
        active ? 'bg-leaf-100/70 text-ink-900' : 'text-ink-700 hover:bg-line/50'
      }`}
    >
      {icon}
      {children}
    </a>
  )
}

function FilterItem({ active, onClick, dot, children }: { active: boolean; onClick: () => void; dot: string; children: ReactNode }) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        aria-pressed={active}
        className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-[15px] ${
          active ? 'bg-leaf-100/70 text-ink-900' : 'text-ink-700 hover:bg-line/50'
        }`}
      >
        <span className={`h-3 w-3 shrink-0 rounded-full ${dot}`} aria-hidden="true" />
        <span className="truncate">{children}</span>
      </button>
    </li>
  )
}

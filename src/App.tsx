import { useEffect, useState } from 'react'
import { hrefFor, useRoute } from './lib/router'
import { todayKey } from './lib/date'
import { AuthProvider, useAuth } from './data/AuthProvider'
import { DataProvider, useData } from './data/DataProvider'
import { loadData } from './data/storage'
import { buildPlan, isPlanEmpty, migratedFingerprint } from './data/migration'
import { AppShell } from './components/layout/AppShell'
import { Paper } from './components/layout/Paper'
import type { CalendarFilter } from './components/layout/Sidebar'
import { CalendarPage } from './pages/CalendarPage'
import { StatsPage } from './pages/StatsPage'
import { SettingsPage } from './pages/SettingsPage'
import { CalendarDetailPage } from './pages/CalendarDetailPage'
import { CalendarFormPage } from './pages/CalendarFormPage'

export default function App() {
  return (
    <AuthProvider>
      <DataProvider>
        <Screens />
      </DataProvider>
    </AuthProvider>
  )
}

function Screens() {
  const route = useRoute()
  const today = todayKey()
  const { notice, user } = useAuth()
  const { calendars, getCalendar, mode, loading, loadError, reload } = useData()
  const [selectedFilter, setFilter] = useState<CalendarFilter>('all')
  // 선택했던 캘린더가 삭제되면 전체 보기로 돌아갑니다.
  const filter = selectedFilter === 'all' || calendars.some((c) => c.id === selectedFilter) ? selectedFilter : 'all'

  const goHome = () => (window.location.hash = hrefFor({ name: 'home' }))

  // 메일 링크(가입 확인·비밀번호 재설정)로 돌아오면 설정 › 계정으로 안내
  useEffect(() => {
    if (notice) window.location.hash = hrefFor({ name: 'settings' })
  }, [notice])

  // 계정이 바뀌면 캘린더 선택을 처음으로
  useEffect(() => setFilter('all'), [user?.id])

  // 사이드바에서 캘린더를 고르면 달력 화면에서 그 캘린더만 보여줍니다.
  const changeFilter = (next: CalendarFilter) => {
    setFilter(next)
    if (route.name !== 'home') goHome()
  }

  const editing = route.name === 'edit' ? getCalendar(route.id) : undefined
  // 클라우드 기록을 불러오는 중이거나 실패하면, 빈 화면 대신 상태를 보여 줌 (설정 화면은 그대로 사용 가능)
  const blocked = mode === 'cloud' && (loading || loadError) && route.name !== 'settings'

  return (
    <AppShell route={route} filter={filter} onFilterChange={changeFilter}>
      {mode === 'cloud' && <MigrationPrompt />}
      {blocked ? (
        <Paper className="flex min-h-[60vh] items-center justify-center px-6">
          {loadError ? (
            <div role="alert" className="flex flex-col items-center gap-4 text-center">
              <p className="text-xl text-ink-900">{loadError}</p>
              <button
                type="button"
                onClick={() => void reload()}
                className="rounded-lg border border-line px-5 py-2.5 text-lg text-ink-700 hover:bg-line/50"
              >
                다시 불러오기
              </button>
            </div>
          ) : (
            <p className="text-xl text-ink-500">클라우드 기록을 불러오는 중…</p>
          )}
        </Paper>
      ) : route.name === 'home' ? (
        <CalendarPage today={today} filter={filter} />
      ) : (
        <Paper className="px-4 py-6 sm:px-8 sm:py-8 lg:pl-12">
          {/* 통계·설정·캘린더 상세는 창 너비에 맞춰 넓게, 캘린더 만들기·수정은 읽기 편한 폭으로 */}
          <div className={route.name === 'new' || route.name === 'edit' ? 'mx-auto max-w-5xl' : 'w-full'}>
            {route.name === 'stats' && <StatsPage today={today} />}
            {route.name === 'settings' && <SettingsPage />}
            {route.name === 'calendar' && <CalendarDetailPage id={route.id} today={today} />}
            {(route.name === 'new' || (route.name === 'edit' && editing?.type === 'personal')) && (
              <CalendarFormPage
                key={route.name === 'edit' ? route.id : 'new'}
                today={today}
                calendar={editing}
                onDone={changeFilter}
                onCancel={() => window.history.back()}
              />
            )}
            {route.name === 'edit' && editing?.type !== 'personal' && (
              <p className="py-20 text-center text-ink-500">수정할 수 있는 개인 캘린더를 찾을 수 없어요.</p>
            )}
          </div>
        </Paper>
      )}
    </AppShell>
  )
}

/** 로그인 후, 이 브라우저에 아직 옮기지 않은 내 기록이 있으면 한 줄로 알려 줌 (자동으로 옮기지 않음) */
function MigrationPrompt() {
  const { user } = useAuth()
  const route = useRoute()
  const [show, setShow] = useState(false)

  useEffect(() => {
    const local = loadData()
    if (!user || !local) return
    let alive = true
    void buildPlan(local).then((plan) => {
      if (alive) setShow(!isPlanEmpty(plan) && migratedFingerprint(user.id) !== plan.fingerprint)
    })
    return () => {
      alive = false
    }
  }, [user])

  if (!show || route.name === 'settings') return null
  return (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-butter-50 px-4 py-3 text-base text-ink-700">
      <span>이 브라우저에 아직 클라우드로 옮기지 않은 기록이 있어요.</span>
      <span className="flex gap-2">
        <a href={hrefFor({ name: 'settings' })} className="rounded-lg bg-ink-900 px-4 py-1.5 text-paper">
          확인하기
        </a>
        <button type="button" onClick={() => setShow(false)} className="rounded-lg px-3 py-1.5 text-ink-500 hover:bg-line/50">
          나중에
        </button>
      </span>
    </div>
  )
}

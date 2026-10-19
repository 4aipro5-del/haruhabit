import { useEffect, useState } from 'react'
import { ChevronRight, Plus } from 'lucide-react'
import { useData } from '../data/DataProvider'
import { AccountSection } from '../components/account/AccountSection'
import { MigrationSection } from '../components/account/MigrationSection'
import { downloadBackup } from '../data/storage'
import { COLOR_STYLES } from '../lib/colors'
import { hrefFor } from '../lib/router'
import { goalSummary } from '../lib/units'
import { isEnded } from '../lib/activity'
import { formatMonthDay, todayKey } from '../lib/date'
import type { HabitCalendar } from '../types'
import { calendarMembers } from '../data/repository'

const COMING_SOON = ['알림']

export function SettingsPage() {
  const { calendars, resetToSample, mode } = useData()
  const today = todayKey()
  const activeCalendars = calendars.filter((c) => !isEnded(c, today))
  const endedCalendars = calendars.filter((c) => isEnded(c, today))
  const [confirmReset, setConfirmReset] = useState(false)
  const [backupFailed, setBackupFailed] = useState(false)

  return (
    <div className="w-full">
      <h1 className="text-[28px] text-ink-900 sm:text-[34px]">설정</h1>

      <section className="mt-6 sm:mt-8">
        <h2 className="mb-3 text-2xl font-semibold text-ink-900">계정</h2>
        <AccountSection />
        {mode === 'cloud' && <NicknameRow />}
      </section>

      <section className="mt-10 sm:mt-12">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-2xl font-semibold text-ink-900">캘린더 관리</h2>
          <a
            href={hrefFor({ name: 'new' })}
            className="flex h-10 w-10 items-center justify-center rounded-full text-ink-700 hover:bg-line/60"
            aria-label="새 캘린더 만들기"
          >
            <Plus size={20} strokeWidth={1.6} />
          </a>
        </div>
        <ul className="border-t border-line">
          {activeCalendars.map((cal) => (
            <CalendarRow key={cal.id} calendar={cal} />
          ))}
        </ul>

        {/* 목표 기간이 끝난 캘린더: 첫 화면 사이드바에서는 숨기고, 여기서만 접어서 보관 */}
        {endedCalendars.length > 0 && (
          <details className="group mt-4">
            <summary className="flex cursor-pointer list-none items-center gap-2 px-2 py-3 text-lg text-ink-500 hover:text-ink-900 sm:text-xl">
              <ChevronRight size={20} className="transition-transform group-open:rotate-90" />
              지난 캘린더 ({endedCalendars.length})
            </summary>
            <ul className="border-t border-line">
              {endedCalendars.map((cal) => (
                <CalendarRow key={cal.id} calendar={cal} ended />
              ))}
            </ul>
          </details>
        )}
      </section>

      {mode === 'cloud' && (
        <section className="mt-10 sm:mt-12">
          <h2 className="mb-3 text-2xl font-semibold text-ink-900">이 브라우저 기록 옮기기</h2>
          <MigrationSection />
        </section>
      )}

      <section className="mt-10 sm:mt-12">
        <h2 className="mb-3 text-2xl font-semibold text-ink-900">데이터</h2>
        <div className="flex flex-wrap items-center justify-between gap-3 border-y border-line px-2 py-4 text-lg sm:text-xl">
          <span className="text-ink-700">{mode === 'cloud' ? '이 브라우저의 로컬 기록' : '이 브라우저에 저장돼요'}</span>
          <span className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setBackupFailed(!downloadBackup())}
              className="rounded-lg border border-line px-4 py-2 text-base text-ink-700 hover:bg-line/50 sm:px-5 sm:py-2.5 sm:text-lg"
            >
              백업 파일 내려받기
            </button>
            {mode === 'cloud' ? null : confirmReset ? (
              <span className="flex items-center gap-1">
                <button type="button" onClick={() => setConfirmReset(false)} className="rounded-lg px-4 py-2 text-base text-ink-700 hover:bg-line/60 sm:text-lg">
                  취소
                </button>
                <button
                  type="button"
                  onClick={() => {
                    resetToSample()
                    setConfirmReset(false)
                  }}
                  className="rounded-lg bg-sun px-4 py-2 text-base text-paper sm:text-lg"
                >
                  모두 지우고 되돌리기
                </button>
              </span>
            ) : (
              <button type="button" onClick={() => setConfirmReset(true)} className="rounded-lg border border-line px-4 py-2 text-base text-ink-700 hover:bg-line/50 sm:px-5 sm:py-2.5 sm:text-lg">
                예시 데이터로 되돌리기
              </button>
            )}
          </span>
        </div>
        {backupFailed && <p className="mt-2 px-2 text-base text-sun">이 브라우저에서 저장된 데이터를 읽지 못했어요.</p>}
      </section>

      <ul className="mt-10 border-t border-line sm:mt-12">
        {COMING_SOON.map((item) => (
          <li key={item} className="flex items-center justify-between gap-3 border-b border-line px-2 py-4 text-lg text-ink-400 sm:text-xl">
            {item}
            <span className="text-base">다음 단계에서 구현 예정</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** 친구(챌린지 멤버)에게 보이는 이름. 이메일은 다른 사람에게 보이지 않음 */
function NicknameRow() {
  const { nickname, setNickname } = useData()
  const [draft, setDraft] = useState(nickname ?? '')
  // 클라우드에서 닉네임을 늦게 받아 오면 칸에 채워 줌
  useEffect(() => setDraft(nickname ?? ''), [nickname])
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)
  const changed = draft.trim() !== (nickname ?? '') && draft.trim().length > 0

  const save = async () => {
    setState('saving')
    setError(null)
    try {
      await setNickname(draft)
      setState('saved')
    } catch (err) {
      setError(err instanceof Error ? err.message : '저장하지 못했어요.')
      setState('error')
    }
  }

  return (
    <div className="mt-3 border-b border-line px-2 pb-4">
      <form
        className="flex flex-wrap items-center gap-3 text-lg sm:text-xl"
        onSubmit={(e) => {
          e.preventDefault()
          if (changed) void save()
        }}
      >
        <label htmlFor="nickname" className="text-ink-900">
          닉네임
        </label>
        <input
          id="nickname"
          type="text"
          maxLength={20}
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value)
            setState('idle')
          }}
          placeholder="친구에게 보일 이름"
          className="w-48 rounded-lg border border-line bg-white/80 px-3 py-2 text-base text-ink-900 placeholder:text-ink-300 sm:w-60"
        />
        <button
          type="submit"
          disabled={!changed || state === 'saving'}
          className="rounded-lg border border-line px-4 py-2 text-base text-ink-700 hover:bg-line/50 disabled:opacity-50"
        >
          {state === 'saving' ? '저장 중…' : state === 'saved' && !changed ? '저장됨' : '저장'}
        </button>
      </form>
      <p className="mt-2 text-base text-ink-500">챌린지 멤버에게는 이 닉네임만 보이고, 이메일 주소는 보이지 않아요.</p>
      {error && <p className="mt-2 text-base text-sun">{error}</p>}
    </div>
  )
}

/**
 * 캘린더 관리 목록의 한 줄
 * - 개인 캘린더·내가 방장인 챌린지: 눌러서 바로 수정
 * - 멤버로 참여한 챌린지: 눌러서 챌린지 화면으로 (나가기는 그 화면에서)
 * - 로그인 전 예시 챌린지: 보기만
 */
function CalendarRow({ calendar: cal, ended = false }: { calendar: HabitCalendar; ended?: boolean }) {
  const personal = cal.type === 'personal'
  const href = personal || cal.role === 'owner'
    ? hrefFor({ name: 'edit', id: cal.id })
    : cal.role === 'member'
      ? hrefFor({ name: 'calendar', id: cal.id })
      : null
  const challengeDetail = `${cal.type === 'shared' ? '공동 목표' : '개인 경쟁'} · ${calendarMembers(cal).length}명${cal.role === 'owner' ? ' · 방장' : ''}`
  const detail = ended
    ? `${cal.endDate ? formatMonthDay(cal.endDate) : ''} 종료`
    : personal
      ? goalSummary(cal)
      : cal.role
        ? challengeDetail
        : null
  const content = (
    <>
      <span className={`h-3.5 w-3.5 shrink-0 rounded-full ${COLOR_STYLES[cal.color].dot} ${ended ? 'opacity-60' : ''}`} aria-hidden="true" />
      <span className="flex-1 truncate">{cal.name}</span>
      <span className="shrink-0 text-base text-ink-400">{detail ?? '예시 챌린지'}</span>
      {href && <ChevronRight size={22} className="shrink-0 text-ink-400" />}
    </>
  )
  const tone = ended ? 'text-ink-500' : href ? 'text-ink-900' : 'text-ink-500'
  return (
    <li className="border-b border-line">
      {href ? (
        <a href={href} className={`flex items-center gap-3 px-2 py-4 text-lg hover:bg-line/30 sm:gap-4 sm:text-xl ${tone}`}>
          {content}
        </a>
      ) : (
        <div className={`flex items-center gap-3 px-2 py-4 text-lg sm:gap-4 sm:text-xl ${tone}`}>{content}</div>
      )}
    </li>
  )
}

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
import { disablePush, enablePush, getPushState, type PushState } from '../lib/push'

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
        {mode === 'cloud' && <JoinByCode />}

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
        <PushRow cloud={mode === 'cloud'} />
      </ul>
    </div>
  )
}

const PUSH_HELP: Record<PushState, string> = {
  on: '이 기기에서 친구가 챌린지에 새 기록을 남기면 알림이 와요. 다른 기기는 각각 따로 켜 주세요.',
  off: '켜면 친구가 공동·경쟁 챌린지에 새 기록을 남길 때 이 기기로 알림이 와요.',
  'ios-install':
    "아이폰은 홈 화면에 추가한 하루한칸 앱에서만 알림을 받을 수 있어요. Safari 아래쪽 공유 버튼 › '홈 화면에 추가'를 누른 뒤, 홈 화면의 하루한칸에서 켜 주세요. (iOS 16.4 이상)",
  denied:
    '알림 권한이 꺼져 있어요. 맥은 시스템 설정 › 알림(또는 브라우저의 사이트 설정)에서, 아이폰은 설정 › 알림 › 하루한칸에서 허용한 뒤 다시 켜 주세요.',
  unsupported: '이 브라우저는 웹 푸시 알림을 지원하지 않아요. 맥에서는 Safari·Chrome, 아이폰에서는 홈 화면에 추가한 하루한칸 앱에서 켤 수 있어요.',
  'not-ready': '알림 설정이 아직 준비되지 않았어요. 잠시 후 다시 확인해 주세요.',
}

/** 챌린지 활동 알림 (이 기기만 켜고 끔, 기본 꺼짐) */
function PushRow({ cloud }: { cloud: boolean }) {
  const [state, setState] = useState<PushState | null>(null)
  const [working, setWorking] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!cloud) return
    let alive = true
    void getPushState().then((s) => alive && setState(s))
    return () => {
      alive = false
    }
  }, [cloud])

  const toggle = async () => {
    if (working || !state) return
    setWorking(true)
    setError(null)
    try {
      setState(state === 'on' ? await disablePush() : await enablePush())
    } catch (err) {
      setError(err instanceof Error ? err.message : '알림 설정을 바꾸지 못했어요.')
    } finally {
      setWorking(false)
    }
  }

  const canToggle = cloud && (state === 'on' || state === 'off')
  const on = state === 'on'
  return (
    <li className="border-b border-line px-2 py-4">
      <div className="flex items-center justify-between gap-3 text-lg sm:text-xl">
        <span className="text-ink-900">
          챌린지 활동 알림 <span className="text-base text-ink-500">· 이 기기</span>
        </span>
        {cloud && (
          <button
            type="button"
            role="switch"
            aria-checked={on}
            aria-label="이 기기에서 챌린지 활동 알림 받기"
            onClick={() => void toggle()}
            disabled={!canToggle || working}
            className={`relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
              on ? 'bg-leaf-700' : 'bg-ink-300'
            }`}
          >
            <span
              className={`absolute top-0.5 h-6 w-6 rounded-full bg-paper shadow transition-all ${on ? 'left-[1.375rem]' : 'left-0.5'}`}
              aria-hidden="true"
            />
          </button>
        )}
      </div>
      <p className="mt-2 text-base text-ink-500">
        {!cloud
          ? '로그인하면 친구가 챌린지에 새 기록을 남길 때 알림을 받을 수 있어요.'
          : state === null
            ? '확인하는 중…'
            : working
              ? '설정하는 중…'
              : PUSH_HELP[state]}
      </p>
      {error && <p className="mt-2 text-base text-sun">{error}</p>}
    </li>
  )
}

/** 초대 링크가 잘리거나 안 열릴 때: 방장에게 받은 6자리 코드로 참여 (틀린 입력은 1시간에 5번까지) */
function JoinByCode() {
  const { resolveInviteCode } = useData()
  const [code, setCode] = useState('')
  const [working, setWorking] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const cleaned = code.toUpperCase().replace(/[^A-Z0-9]/g, '')

  const submit = async () => {
    if (working || cleaned.length !== 6) return
    setWorking(true)
    setMessage(null)
    try {
      const result = await resolveInviteCode(cleaned)
      if (result.status === 'ok') {
        // 코드가 맞으면 링크로 들어온 것과 같은 초대 화면으로 (만료·취소·인원은 거기서 확인)
        window.location.hash = hrefFor({ name: 'join', token: result.token })
        return
      }
      setMessage(
        result.status === 'locked'
          ? `코드를 여러 번 틀려서 잠시 막혔어요. ${result.retry_minutes}분 뒤에 다시 시도해 주세요.`
          : result.remaining > 0
            ? `코드가 맞지 않아요. 앞으로 ${result.remaining}번 더 시도할 수 있어요.`
            : '코드가 맞지 않아요. 1시간 뒤에 다시 시도할 수 있어요.',
      )
    } catch (err) {
      setMessage(err instanceof Error ? err.message : '코드를 확인하지 못했어요.')
    }
    setWorking(false)
  }

  return (
    <div className="border-b border-line px-2 py-4">
      <form
        className="flex flex-wrap items-center gap-3 text-lg sm:text-xl"
        onSubmit={(e) => {
          e.preventDefault()
          void submit()
        }}
      >
        <label htmlFor="invite-code-input" className="text-ink-900">
          초대 코드로 참여
        </label>
        <input
          id="invite-code-input"
          type="text"
          inputMode="text"
          autoCapitalize="characters"
          autoComplete="off"
          maxLength={9}
          value={code}
          onChange={(e) => {
            setCode(e.target.value)
            setMessage(null)
          }}
          placeholder="6자리 코드"
          className="w-36 rounded-lg border border-line bg-white/80 px-3 py-2 text-center font-mono text-base uppercase tracking-[0.15em] text-ink-900 placeholder:font-sans placeholder:tracking-normal placeholder:text-ink-300"
        />
        <button
          type="submit"
          disabled={working || cleaned.length !== 6}
          className="rounded-lg border border-line px-4 py-2 text-base text-ink-700 hover:bg-line/50 disabled:opacity-50"
        >
          {working ? '확인 중…' : '확인'}
        </button>
      </form>
      <p className="mt-2 text-base text-ink-500">초대 링크가 열리지 않으면 방장에게 받은 코드를 넣어 주세요.</p>
      {message && (
        <p role="alert" className="mt-2 text-base text-sun">
          {message}
        </p>
      )}
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

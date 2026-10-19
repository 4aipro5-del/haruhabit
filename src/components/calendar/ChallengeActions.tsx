import { useEffect, useState, type ReactNode } from 'react'
import { Copy, LogOut, Pencil, UserPlus } from 'lucide-react'
import type { HabitCalendar } from '../../types'
import { useData } from '../../data/DataProvider'
import type { ActiveInvite } from '../../data/cloud'
import { inviteUrl } from '../../lib/invite'
import { hrefFor } from '../../lib/router'
import { ComingSoonButton } from '../ui/Buttons'

const button =
  'inline-flex items-center gap-1.5 rounded-lg border border-line px-4 py-2 text-[15px] text-ink-700 hover:bg-line/50 disabled:opacity-60'

/**
 * 챌린지 상세 화면 오른쪽 위 버튼
 * - 방장: 친구 초대(링크 복사), 수정하기
 * - 멤버: 챌린지 나가기
 * - 로그인 전(예시 챌린지): 준비 중 표시
 */
export function ChallengeActions({ calendar }: { calendar: HabitCalendar }) {
  const { mode } = useData()
  const [dialog, setDialog] = useState<'invite' | 'leave' | null>(null)

  if (mode !== 'cloud' || !calendar.role) {
    return (
      <ComingSoonButton>
        <UserPlus size={16} />
        로그인 후 친구 초대
      </ComingSoonButton>
    )
  }

  return (
    <>
      {calendar.role === 'owner' ? (
        <>
          <button type="button" onClick={() => setDialog('invite')} className={button}>
            <UserPlus size={16} />
            친구 초대
          </button>
          <a href={hrefFor({ name: 'edit', id: calendar.id })} className={button}>
            <Pencil size={16} />
            수정하기
          </a>
        </>
      ) : (
        <button type="button" onClick={() => setDialog('leave')} className={button}>
          <LogOut size={16} />
          챌린지 나가기
        </button>
      )}
      {dialog === 'invite' && <InviteDialog calendar={calendar} onClose={() => setDialog(null)} />}
      {dialog === 'leave' && <LeaveDialog calendar={calendar} onClose={() => setDialog(null)} />}
    </>
  )
}

function Dialog({ title, children, onClose, busy }: { title: string; children: ReactNode; onClose: () => void; busy?: boolean }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !busy && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, busy])
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink-900/20 p-3 sm:items-center" onMouseDown={() => !busy && onClose()}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="paper-grid w-full max-w-md rounded-2xl border border-line p-6"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg text-ink-900">{title}</h2>
        {children}
      </div>
    </div>
  )
}

function formatExpiry(iso: string) {
  const d = new Date(iso)
  return `${d.getMonth() + 1}월 ${d.getDate()}일 ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}까지`
}

/** 초대 링크: 지금 쓸 수 있는 링크를 보여 주고, 없으면 새로 만듦. 새로 만들면 예전 링크는 서버에서 자동 취소 */
function InviteDialog({ calendar, onClose }: { calendar: HabitCalendar; onClose: () => void }) {
  const { getActiveInvite, createInvite, revokeInvite } = useData()
  const [invite, setInvite] = useState<ActiveInvite | null | undefined>(undefined)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState<'link' | 'code' | null>(null)
  const memberCount = calendar.members?.length ?? 1

  useEffect(() => {
    let alive = true
    getActiveInvite(calendar.id)
      .then((found) => alive && setInvite(found))
      .catch((e) => alive && setError(e instanceof Error ? e.message : '초대 링크를 불러오지 못했어요.'))
    return () => {
      alive = false
    }
    // 창을 열 때 한 번만 확인 (저장 상태가 바뀔 때마다 다시 부르지 않게)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [calendar.id])

  const act = async (fn: () => Promise<void>) => {
    setBusy(true)
    setError(null)
    setCopied(null)
    try {
      await fn()
    } catch (e) {
      setError(e instanceof Error ? e.message : '처리하지 못했어요.')
    } finally {
      setBusy(false)
    }
  }

  const url = invite ? inviteUrl(invite.token) : ''
  const copy = (what: 'link' | 'code') =>
    act(async () => {
      try {
        await navigator.clipboard.writeText(what === 'link' ? url : (invite?.code ?? ''))
      } catch {
        // 클립보드 권한이 없는 브라우저: 칸을 선택해 직접 복사할 수 있게 함
        const input = document.getElementById(what === 'link' ? 'invite-url' : 'invite-code') as HTMLInputElement | null
        input?.select()
        throw new Error('자동 복사가 안 돼요. 길게 눌러 직접 복사해 주세요.')
      }
      setCopied(what)
    })

  return (
    <Dialog title="친구 초대" onClose={onClose} busy={busy}>
      <p className="mt-3 text-sm leading-relaxed text-ink-700">
        링크를 받은 친구가 로그인하면 이 챌린지에 참여할 수 있어요. 링크는 7일 동안 여러 명이 쓸 수 있고, 최대 20명까지
        참여해요. (지금 {memberCount}명)
      </p>

      {invite === undefined && !error && <p className="mt-5 text-sm text-ink-500">불러오는 중…</p>}

      {invite && (
        <div className="mt-5">
          <label htmlFor="invite-url" className="mb-2 block text-sm text-ink-500">
            초대 링크 · {formatExpiry(invite.expiresAt)}
          </label>
          <input
            id="invite-url"
            readOnly
            value={url}
            onFocus={(e) => e.target.select()}
            className="w-full rounded-lg border border-line bg-white/80 px-3 py-2 text-sm text-ink-900"
          />
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={() => void copy('link')} disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg bg-ink-900 px-4 py-2 text-[15px] text-paper disabled:opacity-60">
              <Copy size={16} />
              {copied === 'link' ? '복사했어요' : '링크 복사'}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void act(async () => setInvite(await createInvite(calendar.id)))}
              className="rounded-lg px-3 py-2 text-[15px] text-ink-700 hover:bg-line/60 disabled:opacity-60"
            >
              새 링크 만들기
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                void act(async () => {
                  await revokeInvite(calendar.id)
                  setInvite(null)
                })
              }
              className="rounded-lg px-3 py-2 text-[15px] text-sun hover:bg-line/50 disabled:opacity-60"
            >
              링크 취소
            </button>
          </div>

          {/* 링크가 잘리거나 안 열릴 때: 친구가 로그인 후 설정 › 캘린더 관리에서 코드를 입력 */}
          <div className="mt-5">
            <label htmlFor="invite-code" className="mb-2 block text-sm text-ink-500">
              초대 코드 · 링크가 안 열리면 설정 › 캘린더 관리 › 초대 코드로 참여
            </label>
            {invite.code ? (
              <div className="flex flex-wrap items-center gap-2">
                <input
                  id="invite-code"
                  readOnly
                  value={invite.code}
                  onFocus={(e) => e.target.select()}
                  className="w-32 rounded-lg border border-line bg-white/80 px-3 py-2 text-center font-mono text-lg tracking-[0.2em] text-ink-900"
                />
                <button
                  type="button"
                  onClick={() => void copy('code')}
                  disabled={busy}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-line px-4 py-2 text-[15px] text-ink-700 hover:bg-line/50 disabled:opacity-60"
                >
                  <Copy size={16} />
                  {copied === 'code' ? '복사했어요' : '코드 복사'}
                </button>
              </div>
            ) : (
              <p className="text-sm text-ink-500">코드 기능 전에 만든 링크라 코드가 없어요. '새 링크 만들기'를 누르면 코드도 생겨요.</p>
            )}
          </div>
          <p className="mt-3 text-xs text-ink-500">새 링크를 만들거나 취소하면 예전 링크와 코드로는 더 참여할 수 없어요.</p>
        </div>
      )}

      {invite === null && (
        <div className="mt-5">
          <p className="text-sm text-ink-500">지금 쓸 수 있는 초대 링크가 없어요.</p>
          <button
            type="button"
            disabled={busy}
            onClick={() => void act(async () => setInvite(await createInvite(calendar.id)))}
            className="mt-3 rounded-lg bg-ink-900 px-4 py-2 text-[15px] text-paper disabled:opacity-60"
          >
            {busy ? '만드는 중…' : '초대 링크 만들기'}
          </button>
        </div>
      )}

      {error && (
        <p role="alert" className="mt-4 rounded-lg bg-peach-100 px-3 py-2 text-sm text-peach-700">
          {error}
        </p>
      )}
      <div className="mt-6 flex justify-end">
        <button type="button" onClick={onClose} disabled={busy} className="rounded-lg px-4 py-2 text-[15px] text-ink-700 hover:bg-line/60">
          닫기
        </button>
      </div>
    </Dialog>
  )
}

/** 챌린지 나가기: 활동 원본은 그대로 두고 이 챌린지 연결만 끊음 */
function LeaveDialog({ calendar, onClose }: { calendar: HabitCalendar; onClose: () => void }) {
  const { leaveChallenge, myRecords } = useData()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const mine = myRecords.filter((r) => r.calendarIds.includes(calendar.id))
  const onlyHere = mine.filter((r) => r.calendarIds.length === 1).length

  const leave = async () => {
    setBusy(true)
    setError(null)
    try {
      await leaveChallenge(calendar.id)
      window.location.replace(hrefFor({ name: 'home' }))
    } catch (e) {
      setError(e instanceof Error ? e.message : '나가지 못했어요.')
      setBusy(false)
    }
  }

  return (
    <Dialog title={`'${calendar.name}' 챌린지에서 나갈까요?`} onClose={onClose} busy={busy}>
      <ul className="mt-3 flex list-disc flex-col gap-1.5 pl-5 text-sm leading-relaxed text-ink-700">
        <li>내 활동 기록 {mine.length}개는 지워지지 않고, 이 챌린지와의 연결만 끊어져요.</li>
        <li>개인 캘린더에도 연결된 기록은 그대로 남아요.</li>
        {onlyHere > 0 && <li>이 챌린지에만 있던 {onlyHere}개는 첫 화면 '전체'에서 '연결 없음'으로 보이고, 다른 캘린더에 다시 연결할 수 있어요.</li>}
        <li>챌린지 통계에서는 내 기록이 빠져요. 다시 참여하려면 새 초대 링크가 필요해요.</li>
      </ul>
      {error && (
        <p role="alert" className="mt-4 rounded-lg bg-peach-100 px-3 py-2 text-sm text-peach-700">
          {error}
        </p>
      )}
      <div className="mt-6 flex justify-end gap-2">
        <button type="button" onClick={onClose} disabled={busy} className="rounded-lg px-4 py-2 text-[15px] text-ink-700 hover:bg-line/60" autoFocus>
          취소
        </button>
        <button type="button" onClick={() => void leave()} disabled={busy} className="rounded-lg bg-sun px-5 py-2 text-[15px] text-paper disabled:opacity-60">
          {busy ? '나가는 중…' : '나가기'}
        </button>
      </div>
    </Dialog>
  )
}

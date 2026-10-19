import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Flag, Trophy, Users } from 'lucide-react'
import { useAuth } from '../data/AuthProvider'
import { useData } from '../data/DataProvider'
import * as cloud from '../data/cloud'
import { AccountSection } from '../components/account/AccountSection'
import { CalendarIcon } from '../components/ui/CalendarIcon'
import { Card } from '../components/ui/Card'
import { LinkButton } from '../components/ui/Buttons'
import { clearPendingInvite, setPendingInvite } from '../lib/invite'
import { formatMonthDay } from '../lib/date'
import { hrefFor } from '../lib/router'
import { UNIT_META, formatAmount } from '../lib/units'
import { friendlyError, supabase } from '../lib/supabase'

// 초대받은 챌린지 참여 화면 (#/join/토큰)
// - 로그인 전에도 챌린지 요약은 볼 수 있고, 참여는 로그인한 뒤에만
// - 만료·취소·인원·중복 참여는 서버(preview_invite / accept_invite)가 판단

const STATUS_TEXT: Record<Exclude<cloud.InvitePreview['status'], 'ok' | 'member'>, string> = {
  invalid: '올바르지 않은 초대 링크예요. 주소가 잘리지 않았는지 확인해 주세요.',
  revoked: '방장이 취소한 초대 링크예요. 방장에게 새 링크를 받아 주세요.',
  expired: '기간(7일)이 지난 초대 링크예요. 방장에게 새 링크를 받아 주세요.',
  ended: '이미 끝난 챌린지라 참여할 수 없어요.',
  full: '인원(20명)이 다 찬 챌린지예요.',
}

export function JoinPage({ token }: { token: string }) {
  const { user, initializing } = useAuth()
  const { nickname: savedNickname, acceptInvite, mode } = useData()
  const [preview, setPreview] = useState<cloud.InvitePreview | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [nickname, setNickname] = useState('')
  const [joining, setJoining] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const nicknameTouched = useRef(false)

  // 로그인·가입하러 갔다 와도 이 화면으로 돌아오도록 기억
  useEffect(() => setPendingInvite(token), [token])

  // 로그인 상태가 바뀌면(로그인 직후 등) 다시 확인 → '이미 참여 중'도 알 수 있음
  useEffect(() => {
    if (!supabase || initializing) return
    let alive = true
    setLoadError(null)
    cloud
      .previewInvite(supabase, token)
      .then((p) => {
        if (!alive) return
        setPreview(p)
        // 쓸 수 없는 링크면 더 기억할 필요 없음
        if (p.status !== 'ok') clearPendingInvite()
      })
      .catch((e) => alive && setLoadError(friendlyError(e).replace('저장되지 않았어요.', '초대 정보를 불러오지 못했어요.')))
    return () => {
      alive = false
    }
  }, [token, user?.id, initializing])

  useEffect(() => {
    if (!nicknameTouched.current && savedNickname) setNickname(savedNickname)
  }, [savedNickname])

  if (!supabase) {
    return <Notice>이 사이트에는 클라우드 설정이 없어서 초대 링크를 쓸 수 없어요.</Notice>
  }
  if (loadError) return <Notice>{loadError}</Notice>
  if (!preview || initializing) return <p className="py-20 text-center text-xl text-ink-500">초대 정보를 확인하는 중…</p>

  if (preview.status !== 'ok' && preview.status !== 'member') {
    return (
      <Notice>
        {STATUS_TEXT[preview.status]}
        <div className="mt-6">
          <LinkButton href={hrefFor({ name: 'home' })}>첫 화면으로</LinkButton>
        </div>
      </Notice>
    )
  }

  const isShared = preview.type === 'shared'
  const unit = preview.unit ?? 'check'
  const target = preview.target ? Number(preview.target) : undefined

  const join = async () => {
    if (joining) return
    setJoining(true)
    setError(null)
    try {
      const calendarId = await acceptInvite(token, nickname)
      clearPendingInvite()
      window.location.hash = hrefFor({ name: 'calendar', id: calendarId })
    } catch (e) {
      setError(e instanceof Error ? e.message : '참여하지 못했어요.')
      setJoining(false)
    }
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <h1 className="text-[28px] text-ink-900 sm:text-[34px]">챌린지 초대</h1>

      <Card>
        <div className="flex items-start gap-4">
          {preview.icon && preview.color && <CalendarIcon icon={preview.icon} color={preview.color} size="lg" />}
          <div className="min-w-0">
            <p className="text-base text-ink-500">{preview.owner_nickname}님이 초대했어요</p>
            <h2 className="mt-1 text-2xl text-ink-900">{preview.name}</h2>
          </div>
        </div>
        <dl className="mt-5 flex flex-col gap-3 text-lg">
          <Row icon={isShared ? <Flag size={18} /> : <Trophy size={18} />} label="유형">
            {isShared ? '공동 목표 · 함께 모아서 달성해요' : '개인 경쟁 · 누적량으로 순위를 겨뤄요'}
          </Row>
          <Row icon={<Flag size={18} />} label={isShared ? '함께 달성할 목표' : '1인 목표'}>
            {target ? formatAmount(target, unit) : `목표량 없음 · ${UNIT_META[unit].label} 기록`}
          </Row>
          <Row icon={<Flag size={18} />} label="기간">
            {preview.start_date && formatMonthDay(preview.start_date)} ~ {preview.end_date ? formatMonthDay(preview.end_date) : '계속'}
          </Row>
          <Row icon={<Users size={18} />} label="참여 인원">
            {preview.member_count}명 / 최대 20명
          </Row>
        </dl>
      </Card>

      {preview.status === 'member' ? (
        <Card>
          <p className="text-lg text-ink-900">이미 참여 중인 챌린지예요.</p>
          {preview.calendar_id && (
            <div className="mt-4">
              <LinkButton href={hrefFor({ name: 'calendar', id: preview.calendar_id })}>챌린지 보러 가기</LinkButton>
            </div>
          )}
        </Card>
      ) : !user || mode !== 'cloud' ? (
        <section>
          <p className="mb-3 text-lg text-ink-700">로그인하거나 가입하면 참여할 수 있어요. 로그인 후 이 화면으로 돌아와요.</p>
          <AccountSection />
        </section>
      ) : (
        <Card>
          <label htmlFor="join-nickname" className="text-lg text-ink-900">
            친구에게 보일 닉네임
          </label>
          <p className="mt-1 text-base text-ink-500">이메일 주소는 다른 멤버에게 보이지 않아요. 설정에서 언제든 바꿀 수 있어요.</p>
          <input
            id="join-nickname"
            type="text"
            maxLength={20}
            value={nickname}
            onChange={(e) => {
              nicknameTouched.current = true
              setNickname(e.target.value)
            }}
            placeholder="예: 지선"
            className="mt-3 w-full max-w-sm rounded-2xl border border-cream-300 bg-white px-4 py-3 text-lg text-ink-900 placeholder:text-ink-300 focus:border-ink-500 focus:outline-none"
          />
          {error && (
            <p role="alert" className="mt-3 rounded-lg bg-peach-100 px-3 py-2 text-base text-peach-700">
              {error}
            </p>
          )}
          <div className="mt-5 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void join()}
              disabled={joining || nickname.trim().length === 0}
              className="rounded-lg bg-ink-900 px-6 py-2.5 text-lg text-paper disabled:cursor-not-allowed disabled:bg-ink-300"
            >
              {joining ? '참여하는 중…' : '참여하기'}
            </button>
            <a
              href={hrefFor({ name: 'home' })}
              onClick={clearPendingInvite}
              className="rounded-lg px-4 py-2.5 text-lg text-ink-700 hover:bg-line/60"
            >
              나중에
            </a>
          </div>
        </Card>
      )}
    </div>
  )
}

function Row({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
      <dt className="flex w-36 shrink-0 items-center gap-1.5 text-ink-500">
        {icon}
        {label}
      </dt>
      <dd className="text-ink-900">{children}</dd>
    </div>
  )
}

function Notice({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto max-w-xl py-16 text-center text-xl leading-relaxed text-ink-700" role="alert">
      {children}
    </div>
  )
}

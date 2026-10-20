// 하루한칸: 챌린지 활동 웹 푸시 발송 (Supabase Edge Function, Deno)
//
// 흐름: 친구가 챌린지에 새 기록 → push_outbox 에 1줄 → Database Webhook 이 이 함수를 호출
//   1) 웹훅 비밀값 확인 (x-webhook-secret 헤더)
//   2) 대기열 줄을 '처리 중'으로 가져옴 (웹훅이 두 번 와도 한 번만 처리)
//   3) 기록·챌린지·멤버를 DB 에서 다시 조회해 받는 사람 계산 (본인 제외, 사람마다 1번)
//   4) 같은 친구의 알림을 5분 안에 이미 받았으면 이번 알림은 생략 (기록은 그대로  보존)
//   5) 받는 사람의 모든 기기로 발송, 만료된 기기(404/410)는 정리
//
// 필요한 Secrets (Supabase › Edge Functions › Secrets)
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT, PUSH_WEBHOOK_SECRET, (선택) SITE_URL
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY 는 Supabase 가 자동으로 넣어 줘요.

import { createClient } from 'npm:@supabase/supabase-js@2.49.4'
// @deno-types="npm:@types/web-push@3.6.4"
import webpush from 'npm:web-push@3.6.7'

/** 같은 친구 → 같은 사람 알림 간격 (분). 이 안의 추가 기록은 알림만 생략 */
const THROTTLE_MINUTES = 5
/** '처리 중'에서 멈춘 줄을 다시 처리해도 되는 시간 (분) */
const STALE_PROCESSING_MINUTES = 10

const env = (name: string) => Deno.env.get(name) ?? ''
const SITE_URL = (env('SITE_URL') || 'https://4aipro5-del.github.io/haruhabit/').replace(/\/?$/, '/')


type Unit = 'check' | 'hours' | 'km' | 'count' | 'pages'

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

/** 비밀값 비교 (길이·내용으로 시간 차이가 나지 않게) */
function safeEqual(a: string, b: string) {
  const x = new TextEncoder().encode(a)
  const y = new TextEncoder().encode(b)
  let diff = x.length ^ y.length
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0)
  return diff === 0
}

// ---- 알림 문구 ----

function formatNumber(n: number) {
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 10) / 10)
}

/** 활동량: 30분 / 1시간 30분 / 5km / 3회 / 20쪽 (했는지만이면 null) */
export function formatAmount(amount: number, unit: Unit): string | null {
  if (unit === 'check') return null
  if (unit === 'hours') {
    const total = Math.round(amount * 60)
    const h = Math.floor(total / 60)
    const m = total % 60
    if (h === 0) return `${m}분`
    return m === 0 ? `${h}시간` : `${h}시간 ${m}분`
  }
  const suffix = unit === 'km' ? 'km' : unit === 'count' ? '회' : '쪽'
  return `${formatNumber(amount)}${suffix}`
}

/** 받침 있으면 '을', 없으면 '를' (한글이 아니면 '를') */
function objectParticle(word: string) {
  const last = word.trim().slice(-1)
  const code = last.charCodeAt(0) - 0xac00
  if (code < 0 || code > 11171) return '를'
  return code % 28 === 0 ? '를' : '을'
}

/**
 * 제목: "딩딩님이 30분을 기록했어요!" / 했는지만: "에이님이 오늘의 목표를 완료했어요!"
 * 본문: "운동 60시간 챌린지" / 여러 챌린지: "운동 60시간 챌린지 외 1개"
 * 친구의 개인 캘린더 이름은 넣지 않아요 (공유 챌린지 이름만).
 */
export function buildMessage(opts: { nickname: string; amount: number; unit: Unit; challengeNames: string[] }) {
  const { nickname, amount, unit, challengeNames } = opts
  const amountText = formatAmount(amount, unit)
  const title =
    amountText === null
      ? `${nickname}님이 오늘의 목표를 완료했어요!`
      : `${nickname}님이 ${amountText}${objectParticle(amountText)} 기록했어요!`
  const [first, ...rest] = challengeNames
  // 이름이 이미 '챌린지'로 끝나면 덧붙이지 않음 (예: '운동 60시간 챌린지')
  const name = /챌린지$/.test(first.trim()) ? first.trim() : `${first.trim()} 챌린지`
  const body = `${name}${rest.length ? ` 외 ${rest.length}개` : ''}`
  return { title, body }
}

// ---- 발송 ----

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'POST only' })

  // 1) 웹훅 인증
  const secret = env('PUSH_WEBHOOK_SECRET')
  if (!secret || !safeEqual(req.headers.get('x-webhook-secret') ?? '', secret)) {
    return json(401, { error: 'unauthorized' })
  }

  try {
    webpush.setVapidDetails(env('VAPID_SUBJECT') || SITE_URL, env('VAPID_PUBLIC_KEY'), env('VAPID_PRIVATE_KEY'))
  } catch (err) {
    return json(500, { error: `VAPID 설정 확인 필요: ${(err as Error).message}` })
  }

  const payload = await req.json().catch(() => null)
  const outboxId = payload?.record?.id
  if (payload?.table !== 'push_outbox' || payload?.type !== 'INSERT' || typeof outboxId !== 'number') {
    return json(400, { error: 'unexpected payload' })
  }

  const db = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  // 2) 대기열 줄 가져오기: 대기 중·실패했던 줄, 또는 오래 멈춘 '처리 중' 줄만
  const staleBefore = new Date(Date.now() - STALE_PROCESSING_MINUTES * 60_000).toISOString()
  const { data: claimed, error: claimError } = await db
    .from('push_outbox')
    .update({ status: 'processing', processed_at: new Date().toISOString(), error: null })
    .eq('id', outboxId)
    .or(`status.eq.pending,status.eq.failed,and(status.eq.processing,processed_at.lt.${staleBefore})`)
    .select('id, activity_id, author_id, attempts')
  if (claimError) return json(500, { error: claimError.message })
  if (!claimed || claimed.length === 0) return json(200, { skipped: 'already processed' })
  const job = claimed[0]
  await db.from('push_outbox').update({ attempts: (job.attempts ?? 0) + 1 }).eq('id', job.id)

  const finish = async (status: 'done' | 'failed', extra: Record<string, unknown> = {}) => {
    await db
      .from('push_outbox')
      .update({ status, processed_at: new Date().toISOString(), error: status === 'failed' ? String(extra.error ?? '') : null })
      .eq('id', job.id)
    return json(200, { status, ...extra })
  }

  try {
    // 3) DB 에서 다시 조회해 검증
    const { data: activity } = await db
      .from('activity_records')
      .select('id, owner_id, amount, unit')
      .eq('id', job.activity_id)
      .maybeSingle()
    if (!activity || activity.owner_id !== job.author_id) return finish('done', { recipients: 0, reason: 'activity missing' })

    const { data: links } = await db.from('activity_calendar_links').select('calendar_id').eq('activity_id', activity.id)
    const linkedIds = (links ?? []).map((l) => l.calendar_id)
    if (linkedIds.length === 0) return finish('done', { recipients: 0, reason: 'no links' })

    const { data: calendars } = await db
      .from('calendars')
      .select('id, name, type, sort_order, created_at')
      .in('id', linkedIds)
      .order('sort_order')
      .order('created_at')
    const challenges = (calendars ?? []).filter((c) => c.type !== 'personal')
    if (challenges.length === 0) return finish('done', { recipients: 0, reason: 'personal only' })

    const { data: memberRows } = await db
      .from('calendar_members')
      .select('calendar_id, user_id')
      .in('calendar_id', challenges.map((c) => c.id))
    // 작성자가 지금도 멤버인 챌린지만 (나간 챌린지 이름으로 알림이 가지 않게)
    const authorIn = new Set((memberRows ?? []).filter((m) => m.user_id === activity.owner_id).map((m) => m.calendar_id))
    const shared = challenges.filter((c) => authorIn.has(c.id))
    const challengesByUser = new Map<string, typeof shared>()
    for (const c of shared) {
      for (const m of memberRows ?? []) {
        if (m.calendar_id !== c.id || m.user_id === activity.owner_id) continue
        challengesByUser.set(m.user_id, [...(challengesByUser.get(m.user_id) ?? []), c])
      }
    }
    const recipients = [...challengesByUser.keys()]
    if (recipients.length === 0) return finish('done', { recipients: 0, reason: 'no other members' })

    const { data: author } = await db.from('profiles').select('nickname').eq('id', activity.owner_id).maybeSingle()
    const nickname = author?.nickname?.trim() || '친구'

    // 4) 같은 친구 → 같은 사람에게 최근에 보낸 알림
    const since = new Date(Date.now() - THROTTLE_MINUTES * 60_000).toISOString()
    const { data: recent } = await db
      .from('push_deliveries')
      .select('user_id')
      .eq('author_id', activity.owner_id)
      .eq('status', 'sent')
      .gt('sent_at', since)
      .in('user_id', recipients)
    const throttled = new Set((recent ?? []).map((r) => r.user_id))

    const result = { sent: 0, throttled: 0, noDevices: 0, failed: 0, skipped: 0 }
    for (const userId of recipients) {
      // 받는 사람마다 한 줄 먼저 기록 → 이미 있으면(재시도·중복 호출) 다시 보내지 않음
      const { data: inserted } = await db
        .from('push_deliveries')
        .upsert(
          { outbox_id: job.id, user_id: userId, author_id: activity.owner_id, status: 'sending' },
          { onConflict: 'outbox_id,user_id', ignoreDuplicates: true },
        )
        .select('user_id')
      if (!inserted || inserted.length === 0) {
        result.skipped++
        continue
      }
      const setStatus = (status: string, sentAt?: string) =>
        db.from('push_deliveries').update({ status, sent_at: sentAt ?? null }).eq('outbox_id', job.id).eq('user_id', userId)

      if (throttled.has(userId)) {
        await setStatus('throttled')
        result.throttled++
        continue
      }

      const { data: subs } = await db.from('push_subscriptions').select('id, endpoint, p256dh, auth').eq('user_id', userId)
      if (!subs || subs.length === 0) {
        await setStatus('no_devices')
        result.noDevices++
        continue
      }

      const theirs = challengesByUser.get(userId) ?? []
      const message = buildMessage({
        nickname,
        amount: Number(activity.amount),
        unit: activity.unit as Unit,
        challengeNames: theirs.map((c) => c.name),
      })
      const body = JSON.stringify({
        ...message,
        url: `${SITE_URL}#/calendar/${theirs[0].id}`,
        tag: `activity-${activity.id}`,
      })

      let delivered = 0
      for (const sub of subs) {
        try {
          await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, body, {
            TTL: 60 * 60 * 24,
            urgency: 'normal',
          })
          delivered++
          await db.from('push_subscriptions').update({ last_success_at: new Date().toISOString(), failure_count: 0 }).eq('id', sub.id)
        } catch (err) {
          const code = (err as { statusCode?: number }).statusCode
          if (code === 404 || code === 410) {
            // 구독이 끝난 기기 (알림 해제·브라우저 데이터 삭제 등)
            await db.from('push_subscriptions').delete().eq('id', sub.id)
          } else {
            const { data: row } = await db.from('push_subscriptions').select('failure_count').eq('id', sub.id).maybeSingle()
            await db.from('push_subscriptions').update({ failure_count: (row?.failure_count ?? 0) + 1 }).eq('id', sub.id)
            console.error('push failed', code, (err as Error).message)
          }
        }
      }
      if (delivered > 0) {
        await setStatus('sent', new Date().toISOString())
        result.sent++
      } else {
        await setStatus('failed')
        result.failed++
      }
    }

    return finish('done', { recipients: recipients.length, ...result })
  } catch (err) {
    console.error(err)
    return finish('failed', { error: (err as Error).message })
  }
})

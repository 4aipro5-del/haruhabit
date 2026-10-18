import type { SupabaseClient } from '@supabase/supabase-js'
import type { ActivityRecord, DateKey, HabitCalendar } from '../types'
import type { StoredData } from './storage'
import { sampleCalendars } from './sampleData'
import * as cloud from './cloud'
import { pickPrimaryCalendarId } from '../lib/activity'

// 이 브라우저(localStorage)의 기록을 클라우드로 옮기기
// - 예시 데이터는 올리지 않음
// - 같은 데이터는 한 번만 올라감 (지문 + 원래 id 로 확인)
// - 올린 뒤 개수와 활동-캘린더 연결이 그대로인지 다시 읽어서 검증
// - 성공해도 로컬 데이터는 지우지 않음

const SAMPLE_CALENDAR_IDS = new Set(sampleCalendars.map((c) => c.id))
/** 예시 메모 문장 (날짜는 처음 실행한 날 기준이라 문장으로 구분) */
const SAMPLE_MEMO_TEXTS = new Set([
  '비가 와서 실내 자전거로 대신했다. 그래도 30분 채움.',
  '도서관 창가 자리. 집중이 잘 됐다.',
  '책 한 권 끝! 다음 책 고르기.',
])

const isSampleRecord = (r: ActivityRecord) => r.id.startsWith('sample-')

export interface MigrationPlan {
  fingerprint: string
  calendars: HabitCalendar[]
  records: ActivityRecord[]
  memos: [DateKey, string][]
  linkCount: number
  /** 여러 캘린더에 연결된 활동 수 (이전 후 그대로인지 확인할 대상) */
  multiLinkedCount: number
  excluded: { sampleRecords: number; sampleCalendars: number; sampleMemos: number }
}

export interface MigrationCheck {
  alreadyImported: boolean
  existingCalendars: number
  existingRecords: number
  /** 클라우드에 이미 같은 날짜 메모가 있어 건너뛸 메모 (클라우드 메모를 지킴) */
  memoConflicts: DateKey[]
  /** 이름이 같은 캘린더가 이미 클라우드에 있음 (따로 하나 더 만들어짐) */
  sameNameCalendars: string[]
}

export interface MigrationResult {
  calendars: number
  records: number
  links: number
  memos: number
  skippedMemos: number
}

async function sha256(text: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** 올릴 데이터 고르기: 예시 기록은 빼고, 내 기록이 연결된 캘린더와 내가 만든 캘린더만 */
export async function buildPlan(local: StoredData): Promise<MigrationPlan> {
  const records = local.records.filter((r) => !isSampleRecord(r))
  const usedCalendarIds = new Set(records.flatMap((r) => r.calendarIds))
  const calendars = local.calendars.filter((c) => !SAMPLE_CALENDAR_IDS.has(c.id) || usedCalendarIds.has(c.id))
  const memos = Object.entries(local.memos).filter(([, text]) => !SAMPLE_MEMO_TEXTS.has(text))
  // 기록이 가리키는 캘린더가 로컬에서 이미 지워진 경우 그 연결은 제외
  const calendarIds = new Set(calendars.map((c) => c.id))
  const cleanRecords = records
    .map((r) => ({ ...r, calendarIds: r.calendarIds.filter((id) => calendarIds.has(id)) }))
    .filter((r) => r.calendarIds.length > 0)

  return {
    fingerprint: await sha256(JSON.stringify({ calendars, records: cleanRecords, memos })),
    calendars,
    records: cleanRecords,
    memos,
    linkCount: cleanRecords.reduce((sum, r) => sum + r.calendarIds.length, 0),
    multiLinkedCount: cleanRecords.filter((r) => r.calendarIds.length > 1).length,
    excluded: {
      sampleRecords: local.records.length - records.length,
      sampleCalendars: local.calendars.length - calendars.length,
      sampleMemos: Object.keys(local.memos).length - memos.length,
    },
  }
}

export const isPlanEmpty = (plan: MigrationPlan) =>
  plan.calendars.length === 0 && plan.records.length === 0 && plan.memos.length === 0

function chunk<T>(items: T[], size: number) {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

/** 원래 id(legacy_id) → 클라우드 id 목록 */
async function legacyMap(client: SupabaseClient, table: 'calendars' | 'activity_records', legacyIds: string[]) {
  const map = new Map<string, string>()
  for (const part of chunk(legacyIds, 100)) {
    const { data, error } = await client.from(table).select('id, legacy_id').in('legacy_id', part)
    if (error) throw error
    for (const row of data ?? []) map.set(row.legacy_id as string, row.id as string)
  }
  return map
}

/** 이전 전에 중복·충돌 확인 (아무것도 바꾸지 않음) */
export async function checkPlan(client: SupabaseClient, plan: MigrationPlan): Promise<MigrationCheck> {
  const { data: imports, error } = await client
    .from('data_imports')
    .select('status')
    .eq('source_fingerprint', plan.fingerprint)
  if (error) throw error

  const [calendarMap, recordMap] = await Promise.all([
    legacyMap(client, 'calendars', plan.calendars.map((c) => c.id)),
    legacyMap(client, 'activity_records', plan.records.map((r) => r.id)),
  ])

  const memoConflicts: DateKey[] = []
  for (const part of chunk(plan.memos.map(([d]) => d), 100)) {
    const { data, error: memoError } = await client.from('daily_memos').select('memo_date').in('memo_date', part)
    if (memoError) throw memoError
    memoConflicts.push(...(data ?? []).map((m) => m.memo_date as string))
  }

  const { data: cloudCalendars, error: calError } = await client.from('calendars').select('name, legacy_id')
  if (calError) throw calError
  const cloudNames = new Set((cloudCalendars ?? []).filter((c) => !c.legacy_id).map((c) => c.name as string))

  return {
    alreadyImported: (imports ?? []).some((i) => i.status === 'verified'),
    existingCalendars: calendarMap.size,
    existingRecords: recordMap.size,
    memoConflicts,
    sameNameCalendars: plan.calendars.filter((c) => !calendarMap.has(c.id) && cloudNames.has(c.name)).map((c) => c.name),
  }
}

/** 실제 이전. 중간에 실패해도 다시 실행하면 이미 올라간 것은 건너뛰고 이어서 진행됩니다. */
export async function runMigration(
  client: SupabaseClient,
  plan: MigrationPlan,
  ownerId: string,
  onProgress: (message: string) => void,
): Promise<MigrationResult> {
  const counts = {
    calendar_count: plan.calendars.length,
    activity_count: plan.records.length,
    link_count: plan.linkCount,
    memo_count: plan.memos.length,
  }
  const { error: importError } = await client
    .from('data_imports')
    .upsert({ source_fingerprint: plan.fingerprint, status: 'started', ...counts }, { onConflict: 'owner_id,source_fingerprint' })
  if (importError) throw importError

  const markFailed = () =>
    client.from('data_imports').update({ status: 'failed' }).eq('source_fingerprint', plan.fingerprint)

  try {
    // 1) 캘린더 (이미 올라간 것은 건너뜀)
    onProgress('캘린더를 옮기는 중…')
    const calendarMap = await legacyMap(client, 'calendars', plan.calendars.map((c) => c.id))
    for (const [index, cal] of plan.calendars.entries()) {
      if (calendarMap.has(cal.id)) continue
      const created = await cloud.createCalendar(client, cal, { type: cal.type, sortOrder: index, legacyId: cal.id })
      calendarMap.set(cal.id, created.id)
    }
    const cloudCalendars = plan.calendars.map((c) => ({ ...c, id: calendarMap.get(c.id)! }))

    // 2) 활동 + 연결 (원본 1건 = 서버 함수 1번 → 원본과 연결이 함께 저장)
    const recordMap = await legacyMap(client, 'activity_records', plan.records.map((r) => r.id))
    const todo = plan.records.filter((r) => !recordMap.has(r.id))
    let done = plan.records.length - todo.length
    for (const part of chunk(todo, 8)) {
      onProgress(`활동을 옮기는 중… (${done}/${plan.records.length})`)
      const saved = await Promise.all(
        part.map((r) => {
          const calendarIds = r.calendarIds.map((id) => calendarMap.get(id)!)
          const primary = calendarMap.get(r.primaryCalendarId) ?? pickPrimaryCalendarId(calendarIds, cloudCalendars)
          return cloud.saveActivity(
            client,
            crypto.randomUUID(),
            { date: r.date, amount: r.amount, unit: r.unit, calendarIds },
            primary,
            { note: r.note ?? null, legacyId: r.id },
          )
        }),
      )
      part.forEach((r, i) => recordMap.set(r.id, saved[i].id))
      done += part.length
    }

    // 3) 메모 (클라우드에 같은 날짜 메모가 있으면 클라우드 것을 지킴)
    onProgress('메모를 옮기는 중…')
    let skippedMemos = 0
    if (plan.memos.length) {
      for (const part of chunk(plan.memos.map(([d]) => d), 100)) {
        const { data, error } = await client.from('daily_memos').select('memo_date').in('memo_date', part)
        if (error) throw error
        skippedMemos += data?.length ?? 0
      }
      const { error } = await client
        .from('daily_memos')
        .upsert(
          plan.memos.map(([memo_date, content]) => ({ owner_id: ownerId, memo_date, content })),
          { onConflict: 'owner_id,memo_date', ignoreDuplicates: true },
        )
      if (error) throw error
    }

    // 4) 검증: 다시 읽어서 개수와 연결 관계 비교
    onProgress('옮긴 기록을 확인하는 중…')
    const result = { ...(await verify(client, plan, calendarMap, recordMap)), skippedMemos }
    await client.from('data_imports').update({ status: 'verified' }).eq('source_fingerprint', plan.fingerprint)
    return result
  } catch (error) {
    await markFailed()
    throw error
  }
}

async function verify(
  client: SupabaseClient,
  plan: MigrationPlan,
  calendarMap: Map<string, string>,
  recordMap: Map<string, string>,
): Promise<MigrationResult> {
  const recordIds = plan.records.map((r) => recordMap.get(r.id)).filter((id): id is string => Boolean(id))
  if (recordIds.length !== plan.records.length) throw new Error(`활동 ${plan.records.length}개 중 ${recordIds.length}개만 확인됐어요.`)

  // 클라우드 활동 id → 연결된 캘린더 목록
  const links = new Map<string, Set<string>>()
  for (const part of chunk(recordIds, 100)) {
    const { data, error } = await client.from('activity_calendar_links').select('activity_id, calendar_id').in('activity_id', part)
    if (error) throw error
    for (const l of data ?? []) {
      if (!links.has(l.activity_id)) links.set(l.activity_id, new Set())
      links.get(l.activity_id)!.add(l.calendar_id)
    }
  }

  let linkCount = 0
  for (const r of plan.records) {
    const expected = new Set(r.calendarIds.map((id) => calendarMap.get(id)))
    const actual = links.get(recordMap.get(r.id)!) ?? new Set()
    linkCount += actual.size
    if (expected.size !== actual.size || [...expected].some((id) => !actual.has(id!))) {
      throw new Error(`활동(${r.date})의 캘린더 연결이 맞지 않아요. 다시 시도해 주세요.`)
    }
  }

  let memoCount = 0
  for (const part of chunk(plan.memos.map(([d]) => d), 100)) {
    const { data, error } = await client.from('daily_memos').select('memo_date').in('memo_date', part)
    if (error) throw error
    memoCount += data?.length ?? 0
  }
  if (memoCount !== plan.memos.length) throw new Error(`메모 ${plan.memos.length}개 중 ${memoCount}개만 확인됐어요.`)

  return {
    calendars: calendarMap.size,
    records: recordIds.length,
    links: linkCount,
    memos: memoCount,
    skippedMemos: 0,
  }
}

/** 이 브라우저에서 이미 이전을 끝낸 지문 (다시 묻지 않기 위함, 로컬 데이터는 그대로 둠) */
const doneKey = (userId: string) => `haru-habit:migrated:${userId}`
export function markMigrated(userId: string, fingerprint: string) {
  try {
    localStorage.setItem(doneKey(userId), fingerprint)
  } catch {
    /* 저장 못 해도 서버의 data_imports 로 중복은 막힘 */
  }
}
export function migratedFingerprint(userId: string) {
  try {
    return localStorage.getItem(doneKey(userId))
  } catch {
    return null
  }
}

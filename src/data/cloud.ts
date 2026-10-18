import type { SupabaseClient } from '@supabase/supabase-js'
import type { ActivityRecord, CalendarInput, DateKey, GoalUnit, HabitCalendar, RecordInput } from '../types'
import { ME_ID } from './sampleData'

// Supabase 데이터베이스 읽기·쓰기
// 화면은 지금처럼 HabitCalendar / ActivityRecord 타입을 쓰고, 여기서 표 ↔ 타입을 바꿔 줍니다.
// 모든 함수는 실패하면 예외를 던집니다. (실패를 성공처럼 보이지 않게)

interface CalendarRow {
  id: string
  type: HabitCalendar['type']
  name: string
  description: string
  icon: HabitCalendar['icon']
  color: HabitCalendar['color']
  unit: GoalUnit
  frequency_kind: 'daily' | 'weekly' | null
  frequency_times: number | null
  target: number | string | null
  start_date: string
  end_date: string | null
  sort_order: number
  updated_at: string
  goals?: { title: string; position: number }[]
}

interface ActivityRow {
  id: string
  activity_date: string
  amount: number | string
  unit: GoalUnit
  note: string | null
  primary_calendar_id: string | null
  updated_at: string
  activity_calendar_links?: { calendar_id: string }[]
}

export interface CloudData {
  calendars: HabitCalendar[]
  records: ActivityRecord[]
  memos: Record<DateKey, string>
}

function check<T>(result: { data: T; error: unknown }): T {
  if (result.error) throw result.error
  return result.data
}

/** 결과가 꼭 있어야 하는 요청 (없으면 실패로 처리) */
function must<T>(result: { data: T | null; error: unknown }): T {
  const data = check(result)
  if (data === null || data === undefined) throw new Error('서버 응답이 비어 있어요. 저장되지 않았을 수 있어요.')
  return data
}

export function toCalendar(row: CalendarRow): HabitCalendar {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    type: row.type,
    icon: row.icon,
    color: row.color,
    unit: row.unit,
    goals: [...(row.goals ?? [])].sort((a, b) => a.position - b.position).map((g) => g.title),
    memberIds: [ME_ID],
    frequency:
      row.frequency_kind === 'daily'
        ? { kind: 'daily' }
        : row.frequency_kind === 'weekly'
          ? { kind: 'weekly', times: row.frequency_times ?? 1 }
          : undefined,
    target: row.target === null ? undefined : Number(row.target),
    startDate: row.start_date,
    endDate: row.end_date ?? undefined,
    updatedAt: row.updated_at,
  }
}

function toRecord(row: ActivityRow, calendarIds: string[]): ActivityRecord {
  return {
    id: row.id,
    memberId: ME_ID,
    date: row.activity_date,
    amount: Number(row.amount),
    unit: row.unit,
    calendarIds,
    primaryCalendarId: row.primary_calendar_id ?? calendarIds[0] ?? '',
    note: row.note ?? undefined,
    updatedAt: row.updated_at,
  }
}

function calendarColumns(input: CalendarInput, sortOrder?: number) {
  return {
    name: input.name,
    description: input.description,
    icon: input.icon,
    color: input.color,
    unit: input.unit,
    frequency_kind: input.frequency?.kind ?? null,
    frequency_times: input.frequency?.kind === 'weekly' ? input.frequency.times : null,
    target: input.target ?? null,
    start_date: input.startDate,
    end_date: input.endDate ?? null,
    ...(sortOrder === undefined ? {} : { sort_order: sortOrder }),
  }
}

/** 1000행 제한을 넘는 표도 끝까지 읽기 */
async function fetchAllRows<T>(query: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>) {
  const page = 1000
  const rows: T[] = []
  for (let from = 0; ; from += page) {
    const data = check(await query(from, from + page - 1)) ?? []
    rows.push(...data)
    if (data.length < page) return rows
  }
}

/** 내 캘린더·활동·메모 전체 불러오기 */
export async function fetchCloudData(client: SupabaseClient): Promise<CloudData> {
  const [calendarRows, activityRows, memoRows] = await Promise.all([
    fetchAllRows<CalendarRow>((from, to) =>
      client
        .from('calendars')
        .select('*, goals(title, position)')
        .order('sort_order')
        .order('created_at')
        .range(from, to),
    ),
    fetchAllRows<ActivityRow>((from, to) =>
      client
        .from('activity_records')
        .select('*, activity_calendar_links(calendar_id)')
        .order('activity_date')
        .order('created_at')
        .range(from, to),
    ),
    fetchAllRows<{ memo_date: string; content: string }>((from, to) =>
      client.from('daily_memos').select('memo_date, content').range(from, to),
    ),
  ])

  return {
    calendars: calendarRows.map(toCalendar),
    records: activityRows.map((row) => toRecord(row, (row.activity_calendar_links ?? []).map((l) => l.calendar_id))),
    memos: Object.fromEntries(memoRows.map((m) => [m.memo_date, m.content])),
  }
}

/**
 * 활동 저장 (새로 만들기·수정 공통). 원본과 캘린더 연결을 서버 함수 하나로 함께 저장합니다.
 * id 를 브라우저에서 정해 보내므로 같은 요청이 두 번 가도 활동은 하나만 생깁니다.
 */
export async function saveActivity(
  client: SupabaseClient,
  id: string,
  input: RecordInput,
  primaryCalendarId: string,
  options: { expectedUpdatedAt?: string; note?: string | null; legacyId?: string } = {},
): Promise<ActivityRecord> {
  const row = must(
    await client
      .rpc('save_activity', {
        p_id: id,
        p_activity_date: input.date,
        p_amount: input.amount,
        p_unit: input.unit,
        p_note: options.note ?? null,
        p_calendar_ids: input.calendarIds,
        p_primary_calendar_id: primaryCalendarId,
        p_expected_updated_at: options.expectedUpdatedAt ?? null,
        p_legacy_id: options.legacyId ?? null,
      })
      .single<ActivityRow>(),
  )
  return toRecord(row, input.calendarIds)
}

/** 활동 원본 삭제 → 연결도 함께 삭제(cascade). 실제로 지워졌는지 확인합니다. */
export async function deleteActivity(client: SupabaseClient, id: string) {
  const { error, count } = await client.from('activity_records').delete({ count: 'exact' }).eq('id', id)
  if (error) throw error
  if (!count) throw new Error('이미 삭제됐거나 지울 수 없는 기록이에요. 새로고침해 주세요.')
}

/** 메모 저장 (빈 내용이면 삭제) */
export async function saveMemo(client: SupabaseClient, ownerId: string, date: DateKey, text: string) {
  if (!text.trim()) {
    check(await client.from('daily_memos').delete().eq('memo_date', date))
    return
  }
  check(
    await client
      .from('daily_memos')
      .upsert({ owner_id: ownerId, memo_date: date, content: text }, { onConflict: 'owner_id,memo_date' }),
  )
}

async function insertGoals(client: SupabaseClient, calendarId: string, goals: string[]) {
  if (goals.length === 0) return [] as { id: string }[]
  return must(
    await client
      .from('goals')
      .insert(goals.map((title, position) => ({ calendar_id: calendarId, title, position })))
      .select('id'),
  )
}

/** 캘린더 만들기 (캘린더 + 세부 목표). 목표 저장이 실패하면 만든 캘린더를 지워 반쪽짜리가 남지 않게 합니다. */
export async function createCalendar(
  client: SupabaseClient,
  input: CalendarInput,
  options: { type?: HabitCalendar['type']; sortOrder?: number; legacyId?: string } = {},
): Promise<HabitCalendar> {
  const row = must(
    await client
      .from('calendars')
      .insert({
        ...calendarColumns(input, options.sortOrder ?? 0),
        type: options.type ?? 'personal',
        legacy_id: options.legacyId ?? null,
      })
      .select('*')
      .single<CalendarRow>(),
  )
  try {
    await insertGoals(client, row.id, input.goals)
  } catch (error) {
    await client.from('calendars').delete().eq('id', row.id)
    throw error
  }
  return toCalendar({ ...row, goals: input.goals.map((title, position) => ({ title, position })) })
}

/**
 * 캘린더 수정. 다른 기기에서 먼저 바꿨으면(updated_at 이 다르면) 저장하지 않고 알려 줍니다.
 * 세부 목표는 새 목록을 먼저 넣고 예전 목록을 지워서, 중간에 실패해도 목표가 사라지지 않게 합니다.
 */
export async function updateCalendar(client: SupabaseClient, calendar: HabitCalendar, input: CalendarInput) {
  let query = client.from('calendars').update(calendarColumns(input)).eq('id', calendar.id)
  if (calendar.updatedAt) query = query.eq('updated_at', calendar.updatedAt)
  const rows = must(await query.select('*').returns<CalendarRow[]>())
  if (!rows || rows.length === 0) {
    throw Object.assign(new Error('다른 기기에서 먼저 수정된 캘린더예요.'), { code: '40001' })
  }
  const oldGoals = check(await client.from('goals').select('id').eq('calendar_id', calendar.id))
  const newGoals = await insertGoals(client, calendar.id, input.goals)
  const keep = new Set(newGoals.map((g) => g.id))
  const remove = (oldGoals ?? []).map((g: { id: string }) => g.id).filter((id: string) => !keep.has(id))
  if (remove.length) check(await client.from('goals').delete().in('id', remove))
  return toCalendar({ ...rows[0], goals: input.goals.map((title, position) => ({ title, position })) })
}

/** 캘린더 삭제 (이 캘린더에만 연결된 활동도 함께 삭제 — 서버 함수가 한 번에 처리) */
export async function deleteCalendar(client: SupabaseClient, calendarId: string) {
  check(await client.rpc('delete_calendar', { p_calendar_id: calendarId }))
}

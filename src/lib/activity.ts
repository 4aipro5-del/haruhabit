import type { ActivityRecord, DateKey, HabitCalendar } from '../types'

/**
 * 활동의 대표 캘린더 (= 활동 유형). 전체 보기 점 색깔에 씁니다.
 * 기록에 저장된 primaryCalendarId를 쓰므로 캘린더 목록 순서와 상관없습니다.
 */
export function primaryCalendar(record: ActivityRecord, calendars: HabitCalendar[]): HabitCalendar | undefined {
  return (
    calendars.find((c) => c.id === record.primaryCalendarId) ??
    calendars.find((c) => record.calendarIds.includes(c.id))
  )
}

/**
 * 저장할 때 대표 캘린더 고르기
 * 1) 원래 대표 캘린더가 아직 연결돼 있으면 그대로
 * 2) 아니면 고른 캘린더 중 첫 번째 개인 캘린더 (운동, 공부 등 활동 유형)
 * 3) 개인 캘린더가 없으면 고른 캘린더 중 첫 번째 (챌린지만 고른 경우)
 */
export function pickPrimaryCalendarId(calendarIds: string[], calendars: HabitCalendar[], previous?: string): string {
  if (previous && calendarIds.includes(previous)) return previous
  const personal = calendarIds.find((id) => calendars.find((c) => c.id === id)?.type === 'personal')
  return personal ?? calendarIds[0]
}

/** 선택한 캘린더(또는 전체)에 보이는 기록 */
export function recordsForFilter(records: ActivityRecord[], filter: string): ActivityRecord[] {
  return filter === 'all' ? records : records.filter((r) => r.calendarIds.includes(filter))
}

/** 이 날짜에 이 캘린더로 기록할 수 있는지 (기간 밖이면 불가) */
export function isInPeriod(calendar: HabitCalendar, date: DateKey): boolean {
  // 개인 캘린더는 시작일 전 기록도 허용하고, 종료일을 정했다면 그 뒤로만 막음
  if (calendar.type === 'personal') return !calendar.endDate || date <= calendar.endDate
  return date >= calendar.startDate && (!calendar.endDate || date <= calendar.endDate)
}

/** 목표 기간이 끝난 캘린더인지 (종료일 다음 날부터). 기록과 통계는 그대로 남아요. */
export function isEnded(calendar: HabitCalendar, today: DateKey): boolean {
  return Boolean(calendar.endDate && calendar.endDate < today)
}

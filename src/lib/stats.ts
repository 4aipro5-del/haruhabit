import type { ActivityRecord, DateKey, HabitCalendar, Member } from '../types'
import { addDays, isSameMonth, weekKeys } from './date'

export function sumAmount(records: ActivityRecord[]): number {
  return records.reduce((sum, r) => sum + r.amount, 0)
}

export function recordsOn(records: ActivityRecord[], date: DateKey): ActivityRecord[] {
  return records.filter((r) => r.date === date)
}

/** 날짜별 합계 */
export function totalsByDate(records: ActivityRecord[]): Map<DateKey, number> {
  const map = new Map<DateKey, number>()
  for (const r of records) map.set(r.date, (map.get(r.date) ?? 0) + r.amount)
  return map
}

export function activeDates(records: ActivityRecord[]): Set<DateKey> {
  return new Set(records.map((r) => r.date))
}

/** 오늘(또는 오늘 기록이 없으면 어제)부터 거꾸로 이어진 실천일 수 */
export function currentStreak(dates: Set<DateKey>, today: DateKey): number {
  let cursor = dates.has(today) ? today : addDays(today, -1)
  let count = 0
  while (dates.has(cursor)) {
    count++
    cursor = addDays(cursor, -1)
  }
  return count
}

export function longestStreak(dates: Set<DateKey>): number {
  let best = 0
  for (const date of dates) {
    // 연속 구간의 첫날에서만 세기 시작합니다.
    if (dates.has(addDays(date, -1))) continue
    let length = 1
    let cursor = addDays(date, 1)
    while (dates.has(cursor)) {
      length++
      cursor = addDays(cursor, 1)
    }
    best = Math.max(best, length)
  }
  return best
}

/** 이번 주(월~일) 실천 횟수와 목표 대비 달성률 */
export function weeklyProgress(calendar: HabitCalendar, records: ActivityRecord[], today: DateKey) {
  const week = weekKeys(today).filter((d) => d <= today)
  const dates = activeDates(records)
  const done = week.filter((d) => dates.has(d)).length
  const target = calendar.frequency?.kind === 'weekly' ? calendar.frequency.times : 7
  return { done, target, rate: Math.min(done / target, 1) }
}

export function monthTotal(records: ActivityRecord[], year: number, month: number): number {
  return sumAmount(records.filter((r) => isSameMonth(r.date, year, month)))
}

export function monthActiveDays(records: ActivityRecord[], year: number, month: number): number {
  return activeDates(records.filter((r) => isSameMonth(r.date, year, month))).size
}

export interface MemberTotal {
  member: Member
  total: number
}

/** 멤버별 합계 (많은 순) */
export function memberTotals(members: Member[], records: ActivityRecord[]): MemberTotal[] {
  return members
    .map((member) => ({
      member,
      total: sumAmount(records.filter((r) => r.memberId === member.id)),
    }))
    .sort((a, b) => b.total - a.total)
}

export interface RankingRow extends MemberTotal {
  rank: number
  rate: number
}

/** 개인 경쟁형 순위표. 같은 기록이면 같은 순위입니다. */
export function ranking(members: Member[], records: ActivityRecord[], target: number): RankingRow[] {
  const totals = memberTotals(members, records)
  return totals.map((row, index) => {
    const firstSame = totals.findIndex((t) => t.total === row.total)
    return { ...row, rank: (firstSame === -1 ? index : firstSame) + 1, rate: row.total / target }
  })
}

/** 날짜별 합계를 0~3 단계 색 진하기로 바꿉니다. */
export function intensityLevel(amount: number, steps: [number, number]): 0 | 1 | 2 | 3 {
  if (amount <= 0) return 0
  if (amount < steps[0]) return 1
  if (amount < steps[1]) return 2
  return 3
}

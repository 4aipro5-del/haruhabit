import type { DateKey } from '../types'

// 날짜는 모두 'YYYY-MM-DD' 문자열로 다룹니다.
// 내부 계산은 UTC 기준 Date로 하므로 브라우저 시간대와 상관없이 결과가 같습니다.

const KST_FORMATTER = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Seoul',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

const KO_WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

/** 달력과 주간 요약은 월요일부터 시작합니다. */
export const WEEKDAY_LABELS = ['월', '화', '수', '목', '금', '토', '일']

/** 한국 시간 기준 오늘 날짜 */
export function todayKey(now: Date = new Date()): DateKey {
  return KST_FORMATTER.format(now)
}

function toUTC(key: DateKey): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}

function fromUTC(date: Date): DateKey {
  return date.toISOString().slice(0, 10)
}

/** month는 0(1월) ~ 11(12월) */
export function makeKey(year: number, month: number, day: number): DateKey {
  return fromUTC(new Date(Date.UTC(year, month, day)))
}

export function parseKey(key: DateKey) {
  const [year, month, day] = key.split('-').map(Number)
  return { year, month: month - 1, day }
}

export function addDays(key: DateKey, days: number): DateKey {
  const date = toUTC(key)
  date.setUTCDate(date.getUTCDate() + days)
  return fromUTC(date)
}

/** b - a (일 수) */
export function diffDays(a: DateKey, b: DateKey): number {
  return Math.round((toUTC(b).getTime() - toUTC(a).getTime()) / 86_400_000)
}

/** 0: 일요일 ~ 6: 토요일 */
export function dayOfWeek(key: DateKey): number {
  return toUTC(key).getUTCDay()
}

/** 월요일 시작 기준 요일 번호 (0: 월 ~ 6: 일) */
export function mondayIndex(key: DateKey): number {
  return (dayOfWeek(key) + 6) % 7
}

export function weekKeys(key: DateKey): DateKey[] {
  const monday = addDays(key, -mondayIndex(key))
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i))
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
}

export function shiftMonth(year: number, month: number, delta: number) {
  const date = new Date(Date.UTC(year, month + delta, 1))
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() }
}

export function isSameMonth(key: DateKey, year: number, month: number): boolean {
  const p = parseKey(key)
  return p.year === year && p.month === month
}

/** 일요일 시작 요일 이름 (다이어리 달력) */
export const SUNDAY_FIRST_LABELS = ['일', '월', '화', '수', '목', '금', '토']

/** 일요일 시작 달력. 이번 달이 들어 있는 주만 만들고(4~6주), 앞뒤 달 날짜는 inMonth=false */
export function getSundayMonthCells(year: number, month: number): { date: DateKey; inMonth: boolean }[] {
  const first = makeKey(year, month, 1)
  const leading = dayOfWeek(first)
  const start = addDays(first, -leading)
  const weeks = Math.ceil((leading + daysInMonth(year, month)) / 7)
  return Array.from({ length: weeks * 7 }, (_, i) => {
    const date = addDays(start, i)
    return { date, inMonth: isSameMonth(date, year, month) }
  })
}

/** 월요일 시작 달력 칸 목록. 이번 달이 아닌 칸은 null */
export function getMonthGrid(year: number, month: number): (DateKey | null)[] {
  const first = makeKey(year, month, 1)
  const leading = mondayIndex(first)
  const total = daysInMonth(year, month)
  const cells: (DateKey | null)[] = Array(leading).fill(null)
  for (let d = 1; d <= total; d++) cells.push(makeKey(year, month, d))
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}

/** 2026년 10월 18일 일요일 */
export function formatLongDate(key: DateKey): string {
  const { year, month, day } = parseKey(key)
  return `${year}년 ${month + 1}월 ${day}일 ${KO_WEEKDAYS[dayOfWeek(key)]}요일`
}

/** 10월 18일 (일) */
export function formatShortDate(key: DateKey): string {
  const { month, day } = parseKey(key)
  return `${month + 1}월 ${day}일 (${KO_WEEKDAYS[dayOfWeek(key)]})`
}

/** 10월 18일 */
export function formatMonthDay(key: DateKey): string {
  const { month, day } = parseKey(key)
  return `${month + 1}월 ${day}일`
}

export function formatMonthLabel(year: number, month: number): string {
  return `${year}년 ${month + 1}월`
}

import type { ActivityRecord, DateKey, HabitCalendar } from '../types'
import { ME_ID } from '../data/sampleData'
import { recordsOn, sumAmount, weeklyProgress } from './stats'
import { formatAmount } from './units'

export interface GoalStatus {
  calendar: HabitCalendar
  /** 이 날짜에 내가 기록했는지 */
  done: boolean
  /** 짧은 진행 상황 (예: 이번 주 2/3회, 남은 18시간) */
  detail: string
}

/**
 * 날짜 기준 목표 현황
 * @param calendarRecords 이 캘린더에 연결된 기록 (공동 챌린지는 친구 기록 포함)
 */
export function goalStatus(calendar: HabitCalendar, calendarRecords: ActivityRecord[], date: DateKey): GoalStatus {
  // 남은 양은 그 날짜까지의 기록으로 계산합니다.
  const untilDate = calendarRecords.filter((r) => r.date <= date)
  const mine = untilDate.filter((r) => r.memberId === ME_ID)
  const dayAmount = sumAmount(recordsOn(mine, date))
  const done = dayAmount > 0
  let detail: string

  if (calendar.type === 'personal') {
    if (calendar.frequency?.kind === 'daily') {
      detail = done ? formatAmount(dayAmount, calendar.unit) : '기록 전'
    } else {
      const week = weeklyProgress(calendar, calendarRecords, date)
      detail = week.done >= week.target ? `이번 주 ${week.done}회 · 달성` : `이번 주 ${week.done}/${week.target}회`
    }
  } else if (calendar.type === 'shared') {
    const left = Math.max((calendar.target ?? 0) - sumAmount(untilDate), 0)
    detail = left > 0 ? `남은 ${formatAmount(left, calendar.unit)}` : '공동 목표 달성'
  } else {
    const left = Math.max((calendar.target ?? 0) - sumAmount(mine), 0)
    detail = left > 0 ? `목표까지 ${formatAmount(left, calendar.unit)}` : '내 목표 달성'
  }

  return { calendar, done, detail }
}

import type { ActivityRecord, DateKey, HabitCalendar } from '../types'
import { ME_ID } from '../data/sampleData'
import { diffDays } from './date'
import { ranking, sumAmount, weeklyProgress } from './stats'
import { formatAmount, formatFrequency, formatPercent } from './units'
import { calendarMembers } from '../data/repository'

export interface CalendarSummary {
  /** 카드 상단에 보여줄 짧은 설명 (주 3회, 4명 등) */
  meta: string
  /** 0 ~ 1 이상 */
  rate: number
  progressLabel: string
  progressCaption: string
}

/** 홈 카드와 오늘의 목표에서 쓰는 캘린더 요약 */
export function summarizeCalendar(calendar: HabitCalendar, records: ActivityRecord[], today: DateKey): CalendarSummary {
  if (calendar.type === 'personal') {
    const week = weeklyProgress(calendar, records, today)
    return {
      meta: formatFrequency(calendar.frequency),
      rate: week.rate,
      progressLabel: calendar.frequency?.kind === 'weekly' ? `${week.done}회 / 목표 ${week.target}회` : `${week.done}/${week.target}일`,
      progressCaption: '이번 주',
    }
  }

  const members = calendarMembers(calendar)
  const target = calendar.target ?? 1

  if (calendar.type === 'shared') {
    const total = sumAmount(records)
    return {
      meta: `${members.length}명`,
      rate: total / target,
      progressLabel: `${formatAmount(total, calendar.unit)} / ${formatAmount(target, calendar.unit)}`,
      progressCaption: '전체 달성',
    }
  }

  // 1인 목표량이 없는 경쟁은 1위 대비로 막대를 그리고, 글자는 순위·누적량만
  const leader = Math.max(...ranking(members, records, 1).map((r) => r.total), 0)
  const rows = ranking(members, records, calendar.target ?? (leader || 1))
  const mine = rows.find((r) => r.member.id === ME_ID)
  return {
    meta: `${members.length}명`,
    rate: mine?.rate ?? 0,
    progressLabel: mine
      ? `${mine.rank}위 · ${calendar.target ? formatPercent(mine.rate) : formatAmount(mine.total, calendar.unit)}`
      : '-',
    progressCaption: '나의 순위',
  }
}

export function myTotal(records: ActivityRecord[]): number {
  return sumAmount(records.filter((r) => r.memberId === ME_ID))
}

export function daysLeft(calendar: HabitCalendar, today: DateKey): number | undefined {
  if (!calendar.endDate) return undefined
  return Math.max(diffDays(today, calendar.endDate), 0)
}

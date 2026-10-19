import type { Frequency, GoalUnit, HabitCalendar } from '../types'

export const UNIT_META: Record<GoalUnit, { label: string; suffix: string }> = {
  check: { label: '했는지만', suffix: '회' },
  hours: { label: '시간', suffix: '시간' },
  km: { label: '거리(km)', suffix: 'km' },
  count: { label: '횟수', suffix: '회' },
  pages: { label: '페이지', suffix: '쪽' },
}

export const UNIT_OPTIONS: GoalUnit[] = ['check', 'hours', 'km', 'count', 'pages']

export function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1)
}

/** 양 표시. 시간은 '40분', '1시간 30분'처럼 읽기 쉽게 바꿉니다. */
export function formatAmount(value: number, unit: GoalUnit): string {
  if (unit === 'hours') return formatDuration(value)
  return `${formatNumber(value)}${UNIT_META[unit].suffix}`
}

/** 시간(소수) → '40분', '2시간', '1시간 30분' */
export function formatDuration(hoursValue: number): string {
  const totalMinutes = Math.round(hoursValue * 60)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours === 0) return `${minutes}분`
  return minutes === 0 ? `${hours}시간` : `${hours}시간 ${minutes}분`
}

export function formatFrequency(frequency?: Frequency): string {
  if (!frequency) return ''
  // 예전에 '매일'로 만든 캘린더는 주 7회와 같아서 똑같이 보여 줌
  return `주 ${frequency.kind === 'daily' ? 7 : frequency.times}회`
}

export function formatPercent(rate: number): string {
  return `${Math.round(rate * 100)}%`
}

/** 기록 한 건의 양. 시간은 '30분', '1시간 30분'처럼 읽기 쉽게 바꿉니다. */
export function formatRecordAmount(value: number, unit: GoalUnit): string {
  if (unit === 'check') return '완료'
  return formatAmount(value, unit)
}

/**
 * 개인 캘린더 목표 요약 (세부 목표 문장 대신 설정으로 만듦)
 * 예: '주 3회', '주 3회 · 시간 기록', '주 3회 · 한 번에 30분'
 */
export function goalSummary(calendar: Pick<HabitCalendar, 'frequency' | 'unit' | 'target'>): string {
  const frequency = formatFrequency(calendar.frequency)
  if (calendar.unit === 'check') return frequency
  if (calendar.target && calendar.target > 0) return `${frequency} · 한 번에 ${formatRecordAmount(calendar.target, calendar.unit)}`
  return `${frequency} · ${UNIT_META[calendar.unit].label} 기록`
}

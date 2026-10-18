import type { Frequency, GoalUnit } from '../types'

export const UNIT_META: Record<GoalUnit, { label: string; suffix: string }> = {
  check: { label: '체크', suffix: '회' },
  hours: { label: '시간', suffix: '시간' },
  km: { label: '거리(km)', suffix: 'km' },
  count: { label: '횟수', suffix: '회' },
  pages: { label: '페이지', suffix: '쪽' },
}

export const UNIT_OPTIONS: GoalUnit[] = ['check', 'hours', 'km', 'count', 'pages']

export function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1)
}

export function formatAmount(value: number, unit: GoalUnit): string {
  return `${formatNumber(value)}${UNIT_META[unit].suffix}`
}

export function formatFrequency(frequency?: Frequency): string {
  if (!frequency) return ''
  return frequency.kind === 'daily' ? '매일' : `주 ${frequency.times}회`
}

export function formatPercent(rate: number): string {
  return `${Math.round(rate * 100)}%`
}

/** 기록 한 건의 양. 시간은 '30분', '1시간 30분'처럼 읽기 쉽게 바꿉니다. */
export function formatRecordAmount(value: number, unit: GoalUnit): string {
  if (unit === 'check') return '완료'
  if (unit !== 'hours') return formatAmount(value, unit)
  const totalMinutes = Math.round(value * 60)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours === 0) return `${minutes}분`
  return minutes === 0 ? `${hours}시간` : `${hours}시간 ${minutes}분`
}

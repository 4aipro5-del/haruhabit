import { useState } from 'react'
import type { DateKey } from '../types'
import { parseKey, shiftMonth } from '../lib/date'

/** 상세 화면의 달력: 보고 있는 달과 선택한 날짜 */
export function useMonthNavigator(initialDate: DateKey) {
  const initial = parseKey(initialDate)
  const [view, setView] = useState({ year: initial.year, month: initial.month })
  const [selected, setSelected] = useState<DateKey>(initialDate)

  return {
    year: view.year,
    month: view.month,
    selected,
    select: setSelected,
    prev: () => setView((v) => shiftMonth(v.year, v.month, -1)),
    next: () => setView((v) => shiftMonth(v.year, v.month, 1)),
  }
}

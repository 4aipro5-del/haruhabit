import { CalendarRange, Hourglass } from 'lucide-react'
import type { DateKey, HabitCalendar } from '../../types'
import { formatMonthDay } from '../../lib/date'
import { daysLeft } from '../../lib/summary'
import { Chip } from '../ui/Badges'

export function PeriodChips({ calendar, today }: { calendar: HabitCalendar; today: DateKey }) {
  const left = daysLeft(calendar, today)
  return (
    <>
      <Chip>
        <CalendarRange size={12} />
        {formatMonthDay(calendar.startDate)} ~ {calendar.endDate ? formatMonthDay(calendar.endDate) : '계속'}
      </Chip>
      {left !== undefined && (
        <Chip>
          <Hourglass size={12} />
          {left === 0 ? '오늘 마감' : `D-${left}`}
        </Chip>
      )}
    </>
  )
}

import { useMemo } from 'react'
import type { ActivityRecord, DateKey, HabitCalendar, Member } from '../../types'
import { COLOR_STYLES } from '../../lib/colors'
import { intensityLevel, recordsOn, totalsByDate } from '../../lib/stats'
import { UNIT_META, formatAmount } from '../../lib/units'
import { useMonthNavigator } from '../../hooks/useMonthNavigator'
import { Card } from '../ui/Card'
import { DayRecordPanel } from './DayRecordPanel'
import { LegendSwatch, MonthCalendar } from './MonthCalendar'

interface Props {
  calendar: HabitCalendar
  records: ActivityRecord[]
  members: Member[]
  today: DateKey
}

/** 공동 목표형·개인 경쟁형이 함께 쓰는 '날짜별 활동 기록' 영역 */
export function ChallengeCalendarSection({ calendar, records, members, today }: Props) {
  const nav = useMonthNavigator(today)
  const c = COLOR_STYLES[calendar.color]
  const totals = useMemo(() => totalsByDate(records), [records])
  const suffix = UNIT_META[calendar.unit].suffix

  return (
    <section>
      <h2 className="mb-3 text-lg font-semibold text-ink-900">날짜별 활동 기록</h2>
      <div className="grid gap-4 sm:gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <MonthCalendar
            year={nav.year}
            month={nav.month}
            today={today}
            selected={nav.selected}
            color={calendar.color}
            onSelect={nav.select}
            onPrev={nav.prev}
            onNext={nav.next}
            range={{ start: calendar.startDate, end: calendar.endDate }}
            getLevel={(date) => intensityLevel(totals.get(date) ?? 0, [2, 4])}
            getLabel={(date) => {
              const amount = totals.get(date)
              return amount ? formatAmount(amount, calendar.unit) : undefined
            }}
            legend={
              <>
                <span>모두의 하루 합계</span>
                <LegendSwatch className={c.soft}>2{suffix} 미만</LegendSwatch>
                <LegendSwatch className={c.medium}>4{suffix} 미만</LegendSwatch>
                <LegendSwatch className={c.strong}>4{suffix} 이상</LegendSwatch>
                <span className="text-ink-400">흐린 날짜는 챌린지 기간 밖이에요</span>
              </>
            }
          />
        </Card>
        <Card className="lg:col-span-1">
          <DayRecordPanel
            date={nav.selected}
            today={today}
            records={recordsOn(records, nav.selected)}
            unit={calendar.unit}
            members={members}
          />
        </Card>
      </div>
    </section>
  )
}

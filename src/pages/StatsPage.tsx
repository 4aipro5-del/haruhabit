import { CalendarDays } from 'lucide-react'
import type { ActivityRecord, DateKey, HabitCalendar } from '../types'
import { getMembers } from '../data/repository'
import { useData } from '../data/DataProvider'
import { ME_ID } from '../data/sampleData'
import { COLOR_STYLES } from '../lib/colors'
import { formatLongDate, weekKeys } from '../lib/date'
import { sumAmount } from '../lib/stats'
import { summarizeCalendar } from '../lib/summary'
import { UNIT_OPTIONS, formatAmount } from '../lib/units'
import { CalendarCard } from '../components/calendar/CalendarCard'
import { Card, CardTitle } from '../components/ui/Card'

interface CalendarWithRecords {
  calendar: HabitCalendar
  records: ActivityRecord[]
  myRecords: ActivityRecord[]
}

/** 통계 메뉴: 이번 주 캘린더별 활동 → 내가 참여한 캘린더 (캘린더를 누르면 상세 통계) */
export function StatsPage({ today }: { today: DateKey }) {
  const { calendars, recordsOf, myRecords } = useData()
  const items: CalendarWithRecords[] = calendars.map((calendar) => {
    const records = recordsOf(calendar.id)
    return { calendar, records, myRecords: records.filter((r) => r.memberId === ME_ID) }
  })

  return (
    <div className="flex flex-col gap-6 sm:gap-8">
      <section>
        <h1 className="text-[28px] text-ink-900 sm:text-[34px]">통계</h1>
        <p className="mt-1 text-sm text-ink-500">{formatLongDate(today)}</p>
      </section>

      <WeekByCalendar items={items} today={today} myActivities={myRecords} />

      <section>
        {/* 새 캘린더는 설정 › 캘린더 관리에서만 만들어요 */}
        <div className="mb-5">
          <h2 className="text-2xl font-semibold text-ink-900">내가 참여한 캘린더</h2>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {items.map(({ calendar, records }) => (
            <CalendarCard
              key={calendar.id}
              calendar={calendar}
              summary={summarizeCalendar(calendar, records, today)}
              members={getMembers(calendar.memberIds)}
            />
          ))}
        </div>
      </section>
    </div>
  )
}

/** 이번 주(월~일) 캘린더별 활동량. 오른쪽 위 합계는 같은 활동을 한 번만 셉니다. */
function WeekByCalendar({ items, today, myActivities }: { items: CalendarWithRecords[]; today: DateKey; myActivities: ActivityRecord[] }) {
  const days = weekKeys(today)
  const weekActivities = myActivities.filter((r) => days.includes(r.date))
  const totalsByUnit = UNIT_OPTIONS.map((unit) => ({ unit, total: sumAmount(weekActivities.filter((r) => r.unit === unit)) })).filter(
    (t) => t.total > 0,
  )

  return (
    <Card>
      <CardTitle
        large
        icon={<CalendarDays size={22} />}
        aside={
          totalsByUnit.length > 0 && (
            <span className="text-base text-ink-500">전체 {totalsByUnit.map((t) => formatAmount(t.total, t.unit)).join(' · ')}</span>
          )
        }
      >
        이번 주 캘린더별 활동
      </CardTitle>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {items.map(({ calendar, myRecords }) => {
          const total = sumAmount(myRecords.filter((r) => days.includes(r.date)))
          const c = COLOR_STYLES[calendar.color]
          return (
            <div key={calendar.id} className={`rounded-2xl px-5 py-4 ${c.soft}`}>
              <p className="truncate text-base text-ink-700">{calendar.name}</p>
              <p className="mt-1 text-2xl font-semibold text-ink-900">{formatAmount(total, calendar.unit)}</p>
            </div>
          )
        })}
      </div>
    </Card>
  )
}

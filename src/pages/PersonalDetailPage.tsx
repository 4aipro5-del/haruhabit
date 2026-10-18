import { useMemo } from 'react'
import { Award, CircleCheck, Flame, Target, TrendingUp } from 'lucide-react'
import type { ActivityRecord, DateKey, HabitCalendar } from '../types'
import { COLOR_STYLES } from '../lib/colors'

import {
  activeDates,
  currentStreak,
  longestStreak,
  monthActiveDays,
  monthTotal,
  recordsOn,
  totalsByDate,
  weeklyProgress,
} from '../lib/stats'
import { UNIT_META, formatAmount, formatFrequency, formatNumber, formatPercent } from '../lib/units'
import { useMonthNavigator } from '../hooks/useMonthNavigator'
import { DetailHeader } from '../components/layout/DetailHeader'
import { DayRecordPanel } from '../components/calendar/DayRecordPanel'
import { LegendSwatch, MonthCalendar } from '../components/calendar/MonthCalendar'
import { Card, CardTitle } from '../components/ui/Card'
import { Chip } from '../components/ui/Badges'
import { ProgressBar } from '../components/ui/ProgressBar'
import { StatTile } from '../components/ui/StatTile'

interface Props {
  calendar: HabitCalendar
  records: ActivityRecord[]
  today: DateKey
}

export function PersonalDetailPage({ calendar, records, today }: Props) {
  const nav = useMonthNavigator(today)
  const c = COLOR_STYLES[calendar.color]

  const dates = useMemo(() => activeDates(records), [records])
  const totals = useMemo(() => totalsByDate(records), [records])
  const week = weeklyProgress(calendar, records, today)
  const streak = currentStreak(dates, today)
  const monthSum = monthTotal(records, nav.year, nav.month)
  const monthDays = monthActiveDays(records, nav.year, nav.month)

  return (
    <div>
      <DetailHeader
        calendar={calendar}
        meta={<Chip>{formatFrequency(calendar.frequency)}</Chip>}
      />

      <div className="grid gap-4 sm:gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardTitle size="lg" icon={<Target size={20} />}>
            목표
          </CardTitle>
          <ul className="flex flex-col gap-2.5">
            {calendar.goals.map((goal) => (
              <li key={goal} className="flex items-start gap-2.5 text-base text-ink-700">
                <CircleCheck size={20} className={`mt-0.5 shrink-0 ${c.text}`} />
                {goal}
              </li>
            ))}
          </ul>
          <div className="mt-5 flex flex-wrap gap-2">
            <Chip large color={calendar.color}>기록 단위 · {UNIT_META[calendar.unit].label}</Chip>
            <Chip large color={calendar.color}>빈도 · {formatFrequency(calendar.frequency)}</Chip>
          </div>
        </Card>

        <div className="grid gap-3 sm:grid-cols-2 sm:gap-4 lg:col-span-2">
          <StatTile
            color="leaf"
            icon={<TrendingUp size={17} />}
            label="이번 주 목표 달성률"
            value={formatPercent(week.rate)}
            sub={
              <span className="flex flex-col gap-2">
                {calendar.frequency?.kind === 'weekly' ? `${week.done}회 실천 · 목표 ${week.target}회` : `${week.done}/${week.target}일 실천`}
                <ProgressBar value={week.rate} barClassName="bg-leaf-400" size="sm" label="이번 주 달성률" />
              </span>
            }
          />
          <StatTile
            color="sky"
            icon={<CircleCheck size={17} />}
            label={`${nav.month + 1}월 누적 활동량`}
            value={formatAmount(monthSum, calendar.unit)}
            sub={`${monthDays}일 기록 · 달력에서 보는 달 기준`}
          />
          <StatTile
            color="peach"
            icon={<Flame size={17} />}
            label="현재 연속 실천일"
            value={`${streak}일`}
            sub={dates.has(today) ? '오늘도 이어가는 중' : streak > 0 ? '오늘 기록하면 이어져요' : '오늘 기록하면 새로 시작돼요'}
          />
          <StatTile
            color="lilac"
            icon={<Award size={17} />}
            label="최장 연속 실천일"
            value={`${longestStreak(dates)}일`}
            sub="지금까지의 최고 기록"
          />
        </div>

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
            getLevel={(date) => (dates.has(date) ? 2 : 0)}
            getLabel={(date) => {
              const amount = totals.get(date)
              return amount ? formatNumber(amount) + UNIT_META[calendar.unit].suffix : undefined
            }}
            legend={
              <>
                <LegendSwatch className={c.medium}>실천한 날</LegendSwatch>
                <LegendSwatch className="bg-white ring-2 ring-ink-900">선택한 날짜</LegendSwatch>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-1 w-1 rounded-full bg-ink-900" />
                  오늘
                </span>
              </>
            }
          />
        </Card>

        <Card className="lg:col-span-1">
          <DayRecordPanel date={nav.selected} today={today} records={recordsOn(records, nav.selected)} unit={calendar.unit} />
        </Card>
      </div>
    </div>
  )
}

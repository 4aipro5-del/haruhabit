import type { ReactNode } from 'react'
import { Flag, Hourglass, Target, Users } from 'lucide-react'
import type { ActivityRecord, DateKey, HabitCalendar, Member } from '../types'
import { COLOR_STYLES } from '../lib/colors'
import { memberTotals, sumAmount } from '../lib/stats'
import { daysLeft } from '../lib/summary'
import { formatAmount, formatNumber, formatPercent } from '../lib/units'
import { DetailHeader } from '../components/layout/DetailHeader'
import { PeriodChips } from '../components/layout/PeriodChips'
import { ChallengeActions } from '../components/calendar/ChallengeActions'
import { ChallengeCalendarSection } from '../components/calendar/ChallengeCalendarSection'
import { Card, CardTitle } from '../components/ui/Card'
import { Avatar } from '../components/ui/Badges'
import { ComingSoonNote } from '../components/ui/Buttons'
import { ProgressBar } from '../components/ui/ProgressBar'

interface Props {
  calendar: HabitCalendar
  records: ActivityRecord[]
  members: Member[]
  today: DateKey
}

export function SharedDetailPage({ calendar, records, members, today }: Props) {
  const c = COLOR_STYLES[calendar.color]
  const target = calendar.target ?? 0
  const total = sumAmount(records)
  const remaining = Math.max(target - total, 0)
  const rate = target ? total / target : 0
  const left = daysLeft(calendar, today) ?? 0
  // 오늘을 포함해 남은 날 수로 나눈 하루 평균 필요량
  const perDay = remaining / Math.max(left + 1, 1)
  const contributions = memberTotals(members, records)

  return (
    <div className="flex flex-col gap-6">
      <DetailHeader
        calendar={calendar}
        meta={<PeriodChips calendar={calendar} today={today} />}
        actions={<ChallengeActions />}
      />

      <Card tint={c.tint}>
        <p className="flex items-center gap-1.5 text-sm font-medium text-ink-500">
          <Flag size={15} />
          {calendar.goals[0]}
        </p>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-2">
          <p className="text-ink-900">
            <span className="text-4xl font-bold tracking-tight sm:text-5xl">{formatNumber(total)}</span>
            <span className="ml-1 text-lg font-semibold text-ink-500">/ {formatAmount(target, calendar.unit)}</span>
          </p>
          <p className={`text-3xl font-bold ${c.text}`}>{formatPercent(rate)}</p>
        </div>
        <div className="mt-4">
          <ProgressBar value={rate} barClassName={c.strong} size="lg" label="전체 진행률" />
        </div>

        <div className="mt-5 grid grid-cols-3 gap-2 sm:gap-4">
          <MiniStat icon={<Target size={15} />} label="남은 목표량" value={formatAmount(remaining, calendar.unit)} />
          <MiniStat icon={<Hourglass size={15} />} label="남은 기간" value={`${left}일`} />
          <MiniStat
            icon={<Users size={15} />}
            label="하루 평균 필요"
            value={formatAmount(Math.round(perDay * 10) / 10, calendar.unit)}
          />
        </div>
      </Card>

      <Card>
        <CardTitle icon={<Users size={18} />} aside={<span className="text-xs text-ink-500">참여자 {members.length}명</span>}>
          멤버별 기여도
        </CardTitle>
        <ul className="flex flex-col gap-4">
          {contributions.map(({ member, total: memberTotal }) => {
            const share = total ? memberTotal / total : 0
            const mc = COLOR_STYLES[member.color]
            return (
              <li key={member.id} className="flex items-center gap-3">
                <Avatar member={member} />
                <div className="min-w-0 flex-1">
                  <div className="mb-1.5 flex items-baseline justify-between gap-2 text-sm">
                    <span className="font-medium text-ink-900">{member.name}</span>
                    <span className="text-ink-500">
                      <strong className="font-semibold text-ink-900">{formatAmount(memberTotal, calendar.unit)}</strong>
                      <span className="ml-1.5 text-xs">기여 {formatPercent(share)}</span>
                    </span>
                  </div>
                  <ProgressBar value={share} barClassName={mc.strong} size="sm" label={`${member.name} 기여도`} />
                </div>
              </li>
            )
          })}
        </ul>
        <div className="mt-5 border-t border-cream-200 pt-4">
          <ComingSoonNote>친구 초대는 다음 단계에서 구현 예정이에요.</ComingSoonNote>
        </div>
      </Card>

      <ChallengeCalendarSection calendar={calendar} records={records} members={members} today={today} />
    </div>
  )
}

function MiniStat({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white/80 p-3 sm:p-4">
      <p className="flex items-center gap-1 text-[11px] font-medium text-ink-500 sm:text-xs">
        <span className="hidden sm:inline">{icon}</span>
        {label}
      </p>
      <p className="mt-1 text-base font-bold text-ink-900 sm:text-xl">{value}</p>
    </div>
  )
}

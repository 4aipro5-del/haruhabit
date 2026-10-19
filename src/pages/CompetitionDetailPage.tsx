import { Crown, Flag, Medal, Trophy, Users } from 'lucide-react'
import type { ActivityRecord, DateKey, HabitCalendar, Member } from '../types'
import { COLOR_STYLES } from '../lib/colors'
import { ranking } from '../lib/stats'
import { formatAmount, formatPercent } from '../lib/units'
import { DetailHeader } from '../components/layout/DetailHeader'
import { PeriodChips } from '../components/layout/PeriodChips'
import { ChallengeActions } from '../components/calendar/ChallengeActions'
import { ChallengeCalendarSection } from '../components/calendar/ChallengeCalendarSection'
import { Card, CardTitle } from '../components/ui/Card'
import { Avatar } from '../components/ui/Badges'
import { ProgressBar } from '../components/ui/ProgressBar'

interface Props {
  calendar: HabitCalendar
  records: ActivityRecord[]
  members: Member[]
  today: DateKey
}

const RANK_STYLE: Record<number, string> = {
  1: 'bg-butter-200 text-butter-700',
  2: 'bg-cream-200 text-ink-700',
  3: 'bg-peach-100 text-peach-700',
}

export function CompetitionDetailPage({ calendar, records, members, today }: Props) {
  const c = COLOR_STYLES[calendar.color]
  // 1인 목표량이 없으면 누적량으로만 순위를 매기고, 막대는 1위 대비로 보여 줌
  const hasTarget = Boolean(calendar.target)
  const totals = ranking(members, records, 1)
  const leader = Math.max(...totals.map((r) => r.total), 0)
  const target = calendar.target ?? (leader || 1)
  const rows = ranking(members, records, target)
  const mine = rows.find((r) => r.member.isMe)
  const myLeft = mine ? Math.max(target - mine.total, 0) : target

  return (
    <div className="flex flex-col gap-6">
      <DetailHeader
        calendar={calendar}
        meta={<PeriodChips calendar={calendar} today={today} />}
        actions={<ChallengeActions calendar={calendar} />}
      />

      <div className="grid gap-4 sm:gap-6 md:grid-cols-2">
        <Card>
          <p className="flex items-center gap-1.5 text-sm font-medium text-ink-500">
            <Flag size={15} />
            {hasTarget ? '각자 달성해야 하는 목표' : '겨루는 방식'}
          </p>
          <p className="mt-2 text-3xl font-bold tracking-tight text-ink-900">
            {hasTarget ? `1인당 ${formatAmount(target, calendar.unit)}` : '누적량 순위'}
          </p>
          <p className="mt-1 text-sm text-ink-500">
            {calendar.goals[0] ?? '기간 동안 쌓은 양이 많을수록 높은 순위예요. 같으면 공동 순위예요.'}
          </p>

          <p className="mb-2 mt-5 flex items-center gap-1.5 text-xs font-medium text-ink-500">
            <Users size={14} />
            참여자 {members.length}명
          </p>
          <div className="flex flex-wrap gap-2">
            {members.map((m) => (
              <span key={m.id} className="inline-flex items-center gap-2 rounded-full bg-cream-100 py-1 pl-1 pr-3 text-sm text-ink-700">
                <Avatar member={m} size="sm" />
                {m.name}
              </span>
            ))}
          </div>
        </Card>

        {mine && (
          <Card tint={c.tint}>
            <p className="flex items-center gap-1.5 text-sm font-medium text-ink-500">
              <Trophy size={15} />
              나의 현재 순위
            </p>
            <div className="mt-2 flex items-end gap-3">
              <span className={`text-5xl font-bold tracking-tight ${c.text}`}>{mine.rank}위</span>
              <span className="pb-1.5 text-sm text-ink-500">/ {rows.length}명</span>
            </div>
            <p className="mt-3 text-sm text-ink-700">
              {formatAmount(mine.total, calendar.unit)} {hasTarget ? '달성' : '누적'}
              {hasTarget && (
                <>
                  {' '}
                  · <strong>{formatPercent(mine.rate)}</strong>
                </>
              )}
            </p>
            <div className="mt-3">
              <ProgressBar value={mine.rate} barClassName={c.strong} label={hasTarget ? '나의 달성률' : '1위 대비'} />
            </div>
            <p className="mt-3 text-sm font-medium text-ink-900">
              {!hasTarget
                ? mine.rank === 1
                  ? '지금 1위예요!'
                  : `1위까지 ${formatAmount(leader - mine.total, calendar.unit)} 남았어요`
                : myLeft > 0
                  ? `목표까지 ${formatAmount(myLeft, calendar.unit)} 남았어요`
                  : '목표를 달성했어요! 🎉'}
            </p>
          </Card>
        )}
      </div>

      <Card>
        <CardTitle icon={<Crown size={18} />} aside={<span className="text-xs text-ink-500">누적량 기준 · 같으면 공동 순위</span>}>
          순위표
        </CardTitle>
        <ol className="flex flex-col gap-3">
          {rows.map((row) => {
            const mc = COLOR_STYLES[row.member.color]
            return (
              <li
                key={row.member.id}
                className={`flex items-center gap-3 rounded-2xl p-3 sm:gap-4 sm:p-4 ${
                  row.member.isMe ? `${c.tint} ring-1 ${c.ringSoft}` : 'bg-cream-50'
                }`}
              >
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                    RANK_STYLE[row.rank] ?? 'bg-cream-200 text-ink-700'
                  }`}
                  aria-label={`${row.rank}위`}
                >
                  {row.rank === 1 ? <Medal size={18} /> : row.rank}
                </span>
                <Avatar member={row.member} />
                <div className="min-w-0 flex-1">
                  <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-x-2 text-sm">
                    <span className="font-medium text-ink-900">
                      {row.rank}위 {row.member.name}
                      {hasTarget && row.rate >= 1 && (
                        <span className="ml-2 rounded-full bg-leaf-100 px-2 py-0.5 text-[11px] font-semibold text-leaf-700">
                          목표 달성
                        </span>
                      )}
                    </span>
                    <span className="text-ink-500">
                      <strong className="font-semibold text-ink-900">{formatAmount(row.total, calendar.unit)}</strong>
                      {hasTarget && <span className="ml-1.5">{formatPercent(row.rate)}</span>}
                    </span>
                  </div>
                  <ProgressBar value={row.rate} barClassName={mc.strong} size="sm" label={`${row.member.name} 달성률`} />
                </div>
              </li>
            )
          })}
        </ol>
      </Card>

      <ChallengeCalendarSection calendar={calendar} records={records} members={members} today={today} />
    </div>
  )
}

import { CalendarDays } from 'lucide-react'
import type { ActivityRecord, DateKey, GoalUnit, Member } from '../../types'
import { formatShortDate } from '../../lib/date'
import { sumAmount } from '../../lib/stats'
import { formatAmount } from '../../lib/units'
import { Avatar } from '../ui/Badges'

interface DayRecordPanelProps {
  date: DateKey
  today: DateKey
  records: ActivityRecord[]
  unit: GoalUnit
  /** 함께하는 캘린더라면 멤버 정보를 넘겨 누가 기록했는지 보여줍니다. */
  members?: Member[]
}

export function DayRecordPanel({ date, today, records, unit, members }: DayRecordPanelProps) {
  const isFuture = date > today
  const total = sumAmount(records)
  const findMember = (id: string) => members?.find((m) => m.id === id)

  return (
    <div className="flex h-full flex-col">
      <div className="mb-4 flex items-start justify-between gap-2">
        <div>
          <p className="flex items-center gap-1.5 text-xs font-medium text-ink-500">
            <CalendarDays size={13} />
            선택한 날짜{date === today && ' · 오늘'}
          </p>
          <h3 className="mt-1 text-lg font-semibold text-ink-900">{formatShortDate(date)}</h3>
        </div>
        {records.length > 0 && (
          <span className="rounded-full bg-cream-200 px-3 py-1 text-sm font-semibold text-ink-900">
            합계 {formatAmount(total, unit)}
          </span>
        )}
      </div>

      {records.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center rounded-2xl border border-dashed border-cream-300 px-4 py-8 text-center">
          <p className="text-sm text-ink-500">{isFuture ? '아직 오지 않은 날이에요' : '이 날은 기록이 없어요'}</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {records.map((record) => {
            const member = findMember(record.memberId)
            return (
              <li key={record.id} className="flex items-center gap-3 rounded-2xl bg-cream-50 px-3 py-3 ring-1 ring-cream-200">
                {member && <Avatar member={member} size="sm" />}
                <div className="min-w-0 flex-1">
                  {member && <p className="text-xs font-medium text-ink-500">{member.name}</p>}
                  <p className="truncate text-sm text-ink-900">{record.note ?? '기록'}</p>
                </div>
                <span className="shrink-0 text-sm font-semibold text-ink-900">{formatAmount(record.amount, unit)}</span>
              </li>
            )
          })}
        </ul>
      )}

    </div>
  )
}

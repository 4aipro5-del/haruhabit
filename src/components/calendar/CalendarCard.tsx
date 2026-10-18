import { ChevronRight } from 'lucide-react'
import type { HabitCalendar, Member } from '../../types'
import type { CalendarSummary } from '../../lib/summary'
import { COLOR_STYLES } from '../../lib/colors'
import { hrefFor } from '../../lib/router'
import { AvatarStack, TypeBadge } from '../ui/Badges'
import { CalendarIcon } from '../ui/CalendarIcon'
import { ProgressBar } from '../ui/ProgressBar'

interface CalendarCardProps {
  calendar: HabitCalendar
  summary: CalendarSummary
  members: Member[]
}

export function CalendarCard({ calendar, summary, members }: CalendarCardProps) {
  const c = COLOR_STYLES[calendar.color]
  return (
    <a
      href={hrefFor({ name: 'calendar', id: calendar.id })}
      className={`group flex flex-col rounded-3xl p-6 ring-1 sm:p-7 ring-inset transition-shadow hover:shadow-soft ${c.tint} ${c.ringSoft}`}
    >
      {/* 아이콘 옆에 이름과 유형을 나란히 */}
      <div className="flex items-center gap-4">
        <CalendarIcon icon={calendar.icon} color={calendar.color} size="lg" />
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-xl font-semibold text-ink-900">{calendar.name}</h3>
          <div className="mt-1.5 flex flex-wrap items-center gap-2.5">
            <TypeBadge type={calendar.type} large />
            <span className="text-base font-medium text-ink-500">{summary.meta}</span>
          </div>
        </div>
        <ChevronRight size={22} className="shrink-0 self-start text-ink-300 transition-colors group-hover:text-ink-700" />
      </div>

      <div className="mt-6">
        <div className="mb-2.5 flex items-baseline justify-between text-base">
          <span className="text-ink-500">{summary.progressCaption}</span>
          <span className="font-semibold text-ink-900">{summary.progressLabel}</span>
        </div>
        <ProgressBar value={summary.rate} barClassName={c.strong} size="md" label={`${calendar.name} 진행률`} />
      </div>

      {members.length > 1 && (
        <div className="mt-5">
          <AvatarStack members={members} size="md" />
        </div>
      )}
    </a>
  )
}

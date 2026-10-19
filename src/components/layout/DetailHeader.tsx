import type { ReactNode } from 'react'
import { ArrowLeft } from 'lucide-react'
import type { HabitCalendar } from '../../types'
import { hrefFor } from '../../lib/router'
import { SampleDataNotice, TypeBadge } from '../ui/Badges'
import { useData } from '../../data/DataProvider'
import { CalendarIcon } from '../ui/CalendarIcon'

interface DetailHeaderProps {
  calendar: HabitCalendar
  meta?: ReactNode
  actions?: ReactNode
}

export function DetailHeader({ calendar, meta, actions }: DetailHeaderProps) {
  const { mode } = useData()
  return (
    <div className="mb-6">
      <a
        href={hrefFor({ name: 'stats' })}
        className="mb-5 inline-flex items-center gap-1.5 rounded-full py-1.5 pr-3 text-sm font-medium text-ink-500 hover:text-ink-900"
      >
        <ArrowLeft size={16} />
        통계
      </a>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex items-start gap-4">
          <CalendarIcon icon={calendar.icon} color={calendar.color} size="lg" />
          <div>
            <div className="mb-1.5 flex flex-wrap items-center gap-2">
              <TypeBadge type={calendar.type} />
              {meta}
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-ink-900 sm:text-3xl">{calendar.name}</h1>
            <p className="mt-1 text-sm text-ink-500">{calendar.description}</p>
          </div>
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>

      {/* 로그인 전(이 브라우저의 예시 데이터)일 때만 안내 */}
      {mode === 'local' && <SampleDataNotice className="mt-4" />}
    </div>
  )
}

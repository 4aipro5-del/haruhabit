import type { ReactNode } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { ColorKey, DateKey } from '../../types'
import { COLOR_STYLES } from '../../lib/colors'
import { WEEKDAY_LABELS, formatMonthLabel, getMonthGrid, parseKey } from '../../lib/date'

interface MonthCalendarProps {
  year: number
  month: number
  today: DateKey
  selected: DateKey
  color: ColorKey
  onSelect: (date: DateKey) => void
  onPrev: () => void
  onNext: () => void
  /** 날짜별 색 진하기 0(기록 없음) ~ 3 */
  getLevel: (date: DateKey) => 0 | 1 | 2 | 3
  /** 날짜 아래에 작게 보여줄 글자 (예: 2시간) */
  getLabel?: (date: DateKey) => string | undefined
  /** 챌린지 기간. 기간 밖의 날짜는 흐리게 표시 */
  range?: { start: DateKey; end?: DateKey }
  legend?: ReactNode
}

export function MonthCalendar(props: MonthCalendarProps) {
  const { year, month, today, selected, color, onSelect, onPrev, onNext, getLevel, getLabel, range, legend } = props
  const c = COLOR_STYLES[color]
  const levelClass = ['', c.soft, c.medium, c.strong]
  const cells = getMonthGrid(year, month)

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <button
          type="button"
          onClick={onPrev}
          className="flex h-9 w-9 items-center justify-center rounded-full text-ink-700 hover:bg-cream-200"
          aria-label="이전 달"
        >
          <ChevronLeft size={20} />
        </button>
        <h3 className="text-base font-semibold text-ink-900" aria-live="polite">
          {formatMonthLabel(year, month)}
        </h3>
        <button
          type="button"
          onClick={onNext}
          className="flex h-9 w-9 items-center justify-center rounded-full text-ink-700 hover:bg-cream-200"
          aria-label="다음 달"
        >
          <ChevronRight size={20} />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
        {WEEKDAY_LABELS.map((label, i) => (
          <div
            key={label}
            className={`pb-1 text-center text-xs font-medium ${
              i === 5 ? 'text-sky-700' : i === 6 ? 'text-peach-700' : 'text-ink-500'
            }`}
          >
            {label}
          </div>
        ))}

        {cells.map((date, i) => {
          if (!date) return <div key={`empty-${i}`} />
          const level = getLevel(date)
          const isToday = date === today
          const isSelected = date === selected
          const isFuture = date > today
          const outOfRange = range && (date < range.start || (range.end !== undefined && date > range.end))
          const label = getLabel?.(date)

          return (
            <button
              key={date}
              type="button"
              onClick={() => onSelect(date)}
              aria-pressed={isSelected}
              aria-label={`${parseKey(date).day}일${level > 0 ? ', 기록 있음' : ''}${isToday ? ', 오늘' : ''}`}
              className={`relative flex h-12 flex-col items-center justify-center rounded-2xl text-sm transition-colors sm:h-16 ${
                level > 0 ? levelClass[level] : 'hover:bg-cream-100'
              } ${isSelected ? 'ring-2 ring-ink-900' : ''} ${outOfRange ? 'opacity-35' : ''}`}
            >
              <span
                className={`${isToday ? 'font-bold text-ink-900' : isFuture ? 'text-ink-300' : 'text-ink-700'} leading-none`}
              >
                {parseKey(date).day}
              </span>
              {label && <span className="mt-1 hidden text-[10px] font-medium text-ink-700 sm:block">{label}</span>}
              {isToday && <span className="absolute bottom-1 h-1 w-1 rounded-full bg-ink-900 sm:bottom-1.5" />}
            </button>
          )
        })}
      </div>

      {legend && <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-ink-500">{legend}</div>}
    </div>
  )
}

export function LegendSwatch({ className, children }: { className: string; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`h-3 w-3 rounded ${className}`} />
      {children}
    </span>
  )
}

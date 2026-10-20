import type { DateKey, HabitCalendar } from '../../types'
import { COLOR_STYLES } from '../../lib/colors'
import { SUNDAY_FIRST_LABELS, dayOfWeek, getSundayMonthCells, parseKey } from '../../lib/date'

interface DiaryCalendarProps {
  year: number
  month: number
  today: DateKey
  selected: DateKey
  /** 날짜별로 기록이 있는 캘린더 (이미 필터가 적용된 상태) */
  calendarsOn: (date: DateKey) => HabitCalendar[]
  onSelect: (date: DateKey) => void
}

export function DiaryCalendar({ year, month, today, selected, calendarsOn, onSelect }: DiaryCalendarProps) {
  const cells = getSundayMonthCells(year, month)
  const lastDay = [...cells].reverse().find((c) => c.inMonth)!.date

  return (
    <div className="flex h-full flex-col">
      <div className="grid grid-cols-7 gap-1 pb-2 sm:gap-1.5">
        {SUNDAY_FIRST_LABELS.map((label, i) => (
          <div key={label} className={`text-center text-sm ${i === 0 ? 'text-sun' : i === 6 ? 'text-sat' : 'text-ink-700'}`}>
            {label}
          </div>
        ))}
      </div>

      {/* 주 수(4~6)에 맞춰 칸이 남은 높이를 나눠 채웁니다. */}
      <div
        className="grid flex-1 grid-cols-7 gap-1 sm:gap-1.5"
        style={{ gridTemplateRows: `repeat(${cells.length / 7}, minmax(0, 1fr))` }}
      >
        {cells.map(({ date, inMonth }) => {
          // 말일 뒤 다음 달 날짜는 비워 둡니다.
          if (date > lastDay) return <div key={date} aria-hidden="true" />
          const weekday = dayOfWeek(date)
          const isToday = date === today
          const isSelected = date === selected
          const dots = inMonth ? calendarsOn(date) : []
          const numberColor = !inMonth
            ? 'text-ink-300'
            : weekday === 0
              ? 'text-sun'
              : weekday === 6
                ? 'text-sat'
                : 'text-ink-900'

          return (
            <button
              key={date}
              type="button"
              onClick={() => onSelect(date)}
              aria-pressed={isSelected}
              aria-label={`${parseKey(date).month + 1}월 ${parseKey(date).day}일${isToday ? ' 오늘' : ''}${
                dots.length ? `, ${dots.map((c) => c.name).join(', ')} 기록` : ''
              }`}
              className={`flex min-h-14 flex-col items-start gap-2 rounded-md border p-1.5 text-left sm:min-h-20 sm:p-2.5 lg:min-h-[6.75rem] ${
                isSelected
                  ? 'border-leaf-500 bg-leaf-100/60'
                  : `border-line ${inMonth ? 'bg-paper/60 hover:bg-white/70' : 'bg-transparent'}`
              }`}
            >
              <span
                className={`inline-flex h-6 min-w-6 items-center justify-center rounded-full text-sm leading-none ${
                  isToday ? 'bg-ink-900 px-1.5 text-paper' : numberColor
                }`}
              >
                {parseKey(date).day}
              </span>
              {dots.length > 0 && (
                <span className="flex flex-wrap gap-1 xl:gap-1.5" aria-hidden="true">
                  {dots.map((cal) => (
                    <span key={cal.id} className={`h-[12.8px] w-[12.8px] rounded-full xl:h-[16px] xl:w-[16px] ${COLOR_STYLES[cal.color].dot}`} />
                  ))}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

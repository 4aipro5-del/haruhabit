import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { ActivityRecord, DateKey, HabitCalendar } from '../types'
import type { CalendarFilter } from '../components/layout/Sidebar'
import { useData } from '../data/DataProvider'
import { formatMonthLabel, parseKey, shiftMonth } from '../lib/date'
import { isEnded, primaryCalendar, recordsForFilter } from '../lib/activity'
import { goalStatus } from '../lib/goals'
import { Paper } from '../components/layout/Paper'
import { DiaryCalendar } from '../components/diary/DiaryCalendar'
import { DayDetail } from '../components/diary/DayDetail'
import { RecordDialog } from '../components/diary/RecordDialog'

/**
 * 연결된 캘린더가 하나도 없는 기록 (예: 챌린지에서 나가서 연결만 끊긴 기록)
 * 원본은 보존되므로 전체 보기에서 회색 점으로 보여 주고, 수정해서 다른 캘린더에 다시 연결하거나 지울 수 있어요.
 */
const UNLINKED: HabitCalendar = {
  id: '__unlinked',
  name: '연결 없음',
  description: '',
  type: 'personal',
  icon: 'sprout',
  color: 'slate',
  unit: 'check',
  goals: [],
  memberIds: [],
  startDate: '',
}

interface CalendarPageProps {
  today: DateKey
  filter: CalendarFilter
}

/** 첫 화면: 월간 다이어리 달력 + 날짜 상세 */
export function CalendarPage({ today, filter }: CalendarPageProps) {
  const diary = useData()
  const { calendars } = diary
  const [view, setView] = useState(() => ({ year: parseKey(today).year, month: parseKey(today).month }))
  const [selected, setSelected] = useState<DateKey>(today)
  /** 팝업: 닫힘 / 새 기록 / 수정할 기록 */
  // 새 기록은 팝업을 열 때 id 를 미리 정해 둠 → 저장을 다시 시도해도 같은 활동으로 저장됨
  const [dialog, setDialog] = useState<null | { mode: 'add'; id: string } | { mode: 'edit'; record: ActivityRecord }>(null)

  const filterCalendar = calendars.find((c) => c.id === filter)
  const visibleRecords = recordsForFilter(diary.myRecords, filter).filter((r) => r.amount > 0)

  /** 점 색깔을 정할 캘린더: 개별 보기면 그 캘린더, 전체 보기면 활동의 대표 캘린더 */
  const dotCalendarOf = (record: ActivityRecord) =>
    filterCalendar ?? primaryCalendar(record, calendars) ?? (record.calendarIds.length === 0 ? UNLINKED : undefined)
  // 점·목록 순서: 캘린더 목록 순, '연결 없음'은 맨 뒤
  const orderOf = (cal: HabitCalendar) => (cal === UNLINKED ? calendars.length : calendars.indexOf(cal))

  // 날짜별로 점을 찍을 캘린더 id. 같은 활동이 여러 캘린더에 연결돼도 점은 하나입니다.
  const dotIdsByDate = new Map<DateKey, Set<string>>()
  for (const r of visibleRecords) {
    const cal = dotCalendarOf(r)
    if (!cal) continue
    if (!dotIdsByDate.has(r.date)) dotIdsByDate.set(r.date, new Set())
    dotIdsByDate.get(r.date)!.add(cal.id)
  }

  // 선택한 날짜의 목표 현황 (사이드바에서 캘린더를 고르면 그 캘린더만)
  // 기간이 끝난 캘린더는 목표 목록과 기록 팝업에서 빼고, 기록·점·통계는 그대로 둠
  const activeCalendars = calendars.filter((c) => !isEnded(c, today))
  const goals = (filterCalendar ? [filterCalendar] : activeCalendars).map((cal) => goalStatus(cal, diary.recordsOf(cal.id), selected))

  const dayItems = visibleRecords
    .filter((r) => r.date === selected)
    .map((record) => ({ record, calendar: dotCalendarOf(record)! }))
    .filter((item) => item.calendar)
    .sort((a, b) => orderOf(a.calendar) - orderOf(b.calendar))

  const selectDate = (date: DateKey) => {
    setSelected(date)
    const p = parseKey(date)
    if (p.year !== view.year || p.month !== view.month) setView({ year: p.year, month: p.month })
  }

  const goToday = () => selectDate(today)
  const move = (delta: number) => setView((v) => shiftMonth(v.year, v.month, delta))

  const navButton =
    'flex h-9 w-9 items-center justify-center rounded-lg border border-line bg-paper text-ink-700 hover:bg-white sm:h-11 sm:w-11'

  return (
    <Paper className="flex flex-col xl:min-h-[calc(100vh-3.5rem)]">
      <header className="mx-4 flex flex-wrap items-center gap-2 border-b border-ink-700/40 pb-4 pt-5 sm:mx-8 sm:gap-3 sm:pt-7 lg:ml-11">
        <h1 className="mr-1 text-2xl text-ink-900 sm:mr-6 sm:text-[34px]" aria-live="polite">
          {formatMonthLabel(view.year, view.month)}
        </h1>
        <button type="button" onClick={() => move(-1)} className={navButton} aria-label="이전 달">
          <ChevronLeft size={20} strokeWidth={1.6} />
        </button>
        <button type="button" onClick={() => move(1)} className={navButton} aria-label="다음 달">
          <ChevronRight size={20} strokeWidth={1.6} />
        </button>
        <button
          type="button"
          onClick={goToday}
          className="h-9 rounded-lg border border-line bg-paper px-3.5 text-[15px] text-ink-700 hover:bg-white sm:ml-2 sm:h-11 sm:px-4"
        >
          오늘
        </button>
      </header>

      <div className="flex flex-1 flex-col xl:flex-row">
        <section className="min-w-0 flex-1 px-3 pb-2 pt-5 sm:px-8 sm:pt-6 lg:pl-11 xl:pr-6" aria-label="월간 달력">
          <DiaryCalendar
            year={view.year}
            month={view.month}
            today={today}
            selected={selected}
            onSelect={selectDate}
            calendarsOn={(date) => {
              const ids = dotIdsByDate.get(date)
              return ids ? [...calendars, UNLINKED].filter((c) => ids.has(c.id)) : []
            }}
          />
        </section>

        <aside className="mx-4 border-t border-ink-700/40 py-6 sm:mx-8 lg:ml-11 xl:mx-0 xl:my-6 xl:w-80 xl:shrink-0 xl:border-l xl:border-t-0 xl:px-7 xl:py-2 2xl:w-96">
          <DayDetail
            date={selected}
            items={dayItems}
            goals={goals}
            isToday={selected === today}
            memo={diary.memos[selected] ?? ''}
            onAdd={() => setDialog({ mode: 'add', id: crypto.randomUUID() })}
            onEdit={(record) => setDialog({ mode: 'edit', record })}
            onDelete={(record) => diary.removeRecord(record.id)}
            onSaveMemo={(text) => diary.saveMemo(selected, text)}
          />
        </aside>
      </div>

      {dialog && (
        <RecordDialog
          calendars={
            dialog.mode === 'edit'
              ? calendars.filter((c) => !isEnded(c, today) || dialog.record.calendarIds.includes(c.id))
              : activeCalendars
          }
          initial={
            dialog.mode === 'edit'
              ? dialog.record
              : {
                  date: selected,
                  amount: 0,
                  unit: filterCalendar?.unit ?? 'hours',
                  calendarIds: filterCalendar ? [filterCalendar.id] : [],
                }
          }
          isEdit={dialog.mode === 'edit'}
          onClose={() => setDialog(null)}
          onSave={async (input) => {
            // 저장이 실제로 끝난 뒤에만 팝업을 닫음 (실패하면 팝업에 오류가 보임)
            if (dialog.mode === 'edit') await diary.updateRecord(dialog.record.id, input)
            else await diary.addRecord(input, dialog.id)
            selectDate(input.date)
            setDialog(null)
          }}
        />
      )}
    </Paper>
  )
}

import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { ActivityRecord, DateKey, HabitCalendar } from '../types'
import type { CalendarFilter } from '../components/layout/Sidebar'
import { useData } from '../data/DataProvider'
import { formatMonthLabel, parseKey, shiftMonth } from '../lib/date'
import { isEnded, isInPeriod, primaryCalendar, recordsForFilter } from '../lib/activity'
import { goalStatus } from '../lib/goals'
import { COLOR_STYLES } from '../lib/colors'
import { formatRecordAmount } from '../lib/units'
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
  // calendarIds: 목표 체크박스로 열었을 때 미리 체크해 둘 캘린더
  const [dialog, setDialog] = useState<
    null | { mode: 'add'; id: string; calendarIds?: string[] } | { mode: 'edit'; record: ActivityRecord }
  >(null)
  /** 목표 체크를 다시 눌러 '했는지만' 기록을 지울 때 확인 */
  const [confirmRemove, setConfirmRemove] = useState<null | { record: ActivityRecord; calendar: HabitCalendar }>(null)
  /** 같은 날 같은 캘린더에 기록이 2건 이상일 때: 어느 기록을 고칠지 고르는 창 */
  const [chooser, setChooser] = useState<null | { calendar: HabitCalendar; records: ActivityRecord[] }>(null)

  const filterCalendar = calendars.find((c) => c.id === filter)
  const visibleRecords = recordsForFilter(diary.myRecords, filter).filter((r) => r.amount > 0)

  /** 점 색깔을 정할 캘린더: 개별 보기면 그 캘린더, 전체 보기면 활동의 대표 캘린더 */
  const dotCalendarOf = (record: ActivityRecord) =>
    filterCalendar ?? primaryCalendar(record, calendars) ?? (record.calendarIds.length === 0 ? UNLINKED : undefined)

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

  /**
   * 목표 체크박스 (빠른 기록)
   * - 했는지만: 기록이 없으면 바로 '완료' 기록, 있으면 지울지 물어봄
   *   (그 기록이 다른 캘린더에도 연결돼 있으면 여러 곳에서 빠지므로 지우지 않고 수정 팝업)
   * - 양 기록: 기록이 없으면 그 캘린더가 체크된 기록 팝업, 있으면 마지막 기록 수정 팝업
   */
  const toggleGoal = async (calendar: HabitCalendar) => {
    if (!isInPeriod(calendar, selected)) return
    const mine = diary.myRecords.filter((r) => r.date === selected && r.calendarIds.includes(calendar.id))
    const last = mine[mine.length - 1]
    // 2건 이상이면 바로 하나를 열지 않고 고르게 함 (숨겨진 기록도 고치거나 지울 수 있게)
    if (mine.length >= 2) {
      setChooser({ calendar, records: mine })
      return
    }
    if (calendar.unit === 'check') {
      if (!last) {
        await diary.addRecord({ date: selected, amount: 1, unit: 'check', calendarIds: [calendar.id] }, crypto.randomUUID())
      } else if (mine.length === 1 && last.calendarIds.length === 1) {
        setConfirmRemove({ record: last, calendar })
      } else {
        setDialog({ mode: 'edit', record: last })
      }
      return
    }
    if (last) setDialog({ mode: 'edit', record: last })
    else setDialog({ mode: 'add', id: crypto.randomUUID(), calendarIds: [calendar.id] })
  }

  // 이 날짜의 '연결 없음' 기록 (전체 보기에서만. 특정 캘린더를 골라 보면 그 캘린더 기록만 보여 줌)
  const unlinkedToday =
    filter === 'all' ? diary.myRecords.filter((r) => r.date === selected && r.calendarIds.length === 0) : []

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
            goals={goals}
            isToday={selected === today}
            memo={diary.memos[selected] ?? ''}
            onSaveMemo={(text) => diary.saveMemo(selected, text)}
            onGoalToggle={toggleGoal}
            isGoalDisabled={(calendar) => !isInPeriod(calendar, selected)}
            unlinkedCount={unlinkedToday.length}
            onUnlinked={() =>
              unlinkedToday.length === 1
                ? setDialog({ mode: 'edit', record: unlinkedToday[0] })
                : setChooser({ calendar: UNLINKED, records: unlinkedToday })
            }
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
                  calendarIds: dialog.calendarIds ?? (filterCalendar ? [filterCalendar.id] : []),
                }
          }
          isEdit={dialog.mode === 'edit'}
          onDelete={
            dialog.mode === 'edit'
              ? async () => {
                  await diary.removeRecord(dialog.record.id)
                  setDialog(null)
                }
              : undefined
          }
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

      {chooser && (
        <RecordChooser
          calendar={chooser.calendar}
          records={chooser.records}
          calendars={calendars}
          onPick={(record) => {
            setChooser(null)
            setDialog({ mode: 'edit', record })
          }}
          onAddNew={
            chooser.calendar === UNLINKED
              ? undefined
              : () => {
                  const id = chooser.calendar.id
                  setChooser(null)
                  setDialog({ mode: 'add', id: crypto.randomUUID(), calendarIds: [id] })
                }
          }
          onClose={() => setChooser(null)}
        />
      )}

      {confirmRemove && (
        <ConfirmRemove
          calendarName={confirmRemove.calendar.name}
          onCancel={() => setConfirmRemove(null)}
          onConfirm={async () => {
            await diary.removeRecord(confirmRemove.record.id)
            setConfirmRemove(null)
          }}
        />
      )}
    </Paper>
  )
}

/** 목표 체크를 다시 눌렀을 때: 이날의 '완료' 기록을 지울지 확인 */
function ConfirmRemove({ calendarName, onCancel, onConfirm }: { calendarName: string; onCancel: () => void; onConfirm: () => Promise<void> }) {
  const [working, setWorking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const confirm = async () => {
    setWorking(true)
    setError(null)
    try {
      await onConfirm()
    } catch (err) {
      setError(err instanceof Error ? err.message : '지우지 못했어요.')
      setWorking(false)
    }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink-900/20 p-3 sm:items-center" onMouseDown={() => !working && onCancel()}>
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="remove-check-title"
        className="paper-grid w-full max-w-sm rounded-2xl border border-line p-6"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h2 id="remove-check-title" className="text-lg text-ink-900">
          '{calendarName}' 완료 기록을 지울까요?
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-ink-700">이날 체크한 기록이 지워지고, 통계에서도 빠져요.</p>
        {error && (
          <p role="alert" className="mt-3 rounded-lg bg-peach-100 px-3 py-2 text-sm text-peach-700">
            {error}
          </p>
        )}
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={onCancel} disabled={working} className="rounded-lg px-4 py-2 text-[15px] text-ink-700 hover:bg-line/60" autoFocus>
            취소
          </button>
          <button
            type="button"
            onClick={() => void confirm()}
            disabled={working}
            className="rounded-lg bg-sun px-5 py-2 text-[15px] text-paper disabled:opacity-60"
          >
            {working ? '지우는 중…' : '지우기'}
          </button>
        </div>
      </div>
    </div>
  )
}

/** 같은 날 같은 캘린더에 기록이 여러 건일 때 고칠 기록 고르기 */
function RecordChooser({
  calendar,
  records,
  calendars,
  onPick,
  onAddNew,
  onClose,
}: {
  calendar: HabitCalendar
  records: ActivityRecord[]
  calendars: HabitCalendar[]
  onPick: (record: ActivityRecord) => void
  /** 없으면 '새로 추가' 버튼을 숨김 ('연결 없음'은 새로 만들 수 없음) */
  onAddNew?: () => void
  onClose: () => void
}) {
  // Esc 로 닫기 (다른 팝업과 같게)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  /** 이 기록이 함께 반영된 다른 캘린더 이름 (구분에 도움) */
  const others = (record: ActivityRecord) =>
    record.calendarIds
      .filter((id) => id !== calendar.id)
      .map((id) => calendars.find((c) => c.id === id)?.name)
      .filter(Boolean)
      .join(', ')
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink-900/20 p-3 sm:items-center" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="chooser-title"
        className="paper-grid w-full max-w-sm rounded-2xl border border-line p-6"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h2 id="chooser-title" className="text-lg text-ink-900">
          '{calendar.name}' 기록이 {records.length}건 있어요
        </h2>
        <p className="mt-1 text-sm text-ink-500">
          {calendar === UNLINKED
            ? '고르면 다른 캘린더에 다시 연결하거나 지울 수 있어요.'
            : '고치거나 지울 기록을 골라 주세요.'}
        </p>
        <ul className="mt-4 flex flex-col gap-1.5">
          {records.map((record, index) => (
            <li key={record.id}>
              <button
                type="button"
                onClick={() => onPick(record)}
                className="flex w-full items-center gap-3 rounded-lg border border-line bg-white/70 px-3 py-2.5 text-left hover:bg-white"
              >
                <span className={`h-3.5 w-11 shrink-0 rounded-full ${COLOR_STYLES[calendar.color].dot}`} aria-hidden="true" />
                <span className="flex-1 text-[15px] text-ink-900">
                  {index + 1}. {formatRecordAmount(record.amount, record.unit)}
                  {others(record) && <span className="ml-1.5 text-xs text-ink-500">· {others(record)}에도 반영</span>}
                </span>
                <span className="text-sm text-ink-400">수정</span>
              </button>
            </li>
          ))}
        </ul>
        <div className="mt-5 flex justify-between gap-2">
          {onAddNew ? (
            <button type="button" onClick={onAddNew} className="rounded-lg px-3 py-2 text-[15px] text-leaf-700 hover:bg-line/50">
              + 새로 추가
            </button>
          ) : (
            <span />
          )}
          <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-[15px] text-ink-700 hover:bg-line/60" autoFocus>
            닫기
          </button>
        </div>
      </div>
    </div>
  )
}

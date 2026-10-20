import { useState } from 'react'
import { Check, Plus } from 'lucide-react'
import type { ActivityRecord, DateKey, HabitCalendar } from '../../types'
import { COLOR_STYLES } from '../../lib/colors'
import { formatShortDate } from '../../lib/date'
import { formatRecordAmount } from '../../lib/units'
import type { GoalStatus } from '../../lib/goals'
import { RecordMenu } from './RecordMenu'

/** 날짜 상세의 한 줄 = 활동 1건 (여러 캘린더에 반영돼도 한 줄) */
export interface DayItem {
  record: ActivityRecord
  /** 점 색깔을 정하는 캘린더 */
  calendar: HabitCalendar
}

interface DayDetailProps {
  date: DateKey
  items: DayItem[]
  /** 이 날짜의 목표 현황 (기록하면 자동으로 체크) */
  goals: GoalStatus[]
  isToday: boolean
  memo: string
  onAdd: () => void
  onEdit: (record: ActivityRecord) => void
  onDelete: (record: ActivityRecord) => Promise<void>
  onSaveMemo: (text: string) => Promise<void>
  /**
   * 목표 체크박스를 눌렀을 때 (빠른 기록)
   * - 했는지만: 바로 완료 기록 / 이미 했으면 지우기 확인
   * - 양 기록: 그 캘린더가 미리 체크된 기록 팝업
   */
  onGoalToggle: (calendar: HabitCalendar) => Promise<void>
  /** 이 날짜에는 기록할 수 없는 캘린더 (챌린지 기간 밖 등) */
  isGoalDisabled: (calendar: HabitCalendar) => boolean
}

/** 오른쪽 날짜 상세: 기록 목록 + 메모 */
export function DayDetail({
  date,
  items,
  goals,
  isToday,
  memo,
  onAdd,
  onEdit,
  onDelete,
  onSaveMemo,
  onGoalToggle,
  isGoalDisabled,
}: DayDetailProps) {
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const remove = async (record: ActivityRecord) => {
    setDeleteError(null)
    setDeletingId(record.id)
    try {
      await onDelete(record)
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : '삭제하지 못했어요.')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-2xl text-ink-900 sm:text-[26px]">{formatShortDate(date)}</h2>
        <button
          type="button"
          onClick={onAdd}
          aria-label="기록 추가"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-leaf-500 bg-leaf-100/50 text-leaf-700 hover:bg-leaf-100"
        >
          <Plus size={22} strokeWidth={1.6} />
        </button>
      </div>

      <ul className="mt-6 flex min-h-12 flex-col">
        {items.map(({ record, calendar }) => (
          <li key={record.id} className={`flex items-center gap-4 py-2 ${deletingId === record.id ? 'opacity-40' : ''}`}>
            <span className={`h-3.5 w-3.5 shrink-0 rounded-full ${COLOR_STYLES[calendar.color].dot}`} title={calendar.name} />
            <span className="sr-only">{calendar.name}</span>
            <span className="flex-1 text-[17px] text-ink-900">{formatRecordAmount(record.amount, record.unit)}</span>
            <RecordMenu onEdit={() => onEdit(record)} onDelete={() => void remove(record)} />
          </li>
        ))}
        {items.length === 0 && <li className="py-2 text-sm text-ink-400">기록 없음</li>}
      </ul>
      {deleteError && (
        <p role="alert" className="mt-2 rounded-lg bg-peach-100 px-3 py-2 text-sm text-peach-700">
          {deleteError}
        </p>
      )}

      <div className="my-6 border-t border-line" />

      {/* 날짜가 바뀌면 오류 표시를 지우려고 key 로 새로 그림 (메모 칸과 key 가 겹치지 않게 앞머리를 붙임) */}
      <GoalList
        key={`goals-${date}`}
        goals={goals}
        title={isToday ? '오늘의 목표' : '이날의 목표'}
        onToggle={onGoalToggle}
        isDisabled={isGoalDisabled}
      />

      {/* 날짜가 바뀌면 key로 새로 그려서 입력 중이던 내용을 초기화합니다. */}
      <MemoBox key={date} memo={memo} onSave={onSaveMemo} />
    </div>
  )
}

function MemoBox({ memo, onSave }: { memo: string; onSave: (text: string) => Promise<void> }) {
  const [draft, setDraft] = useState(memo)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const dirty = draft !== memo

  const save = async () => {
    setSaving(true)
    setError(null)
    try {
      await onSave(draft)
    } catch (err) {
      setError(err instanceof Error ? err.message : '저장하지 못했어요.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <label htmlFor="day-memo" className="mb-2 block text-[15px] text-ink-900">
        메모
      </label>
      <textarea
        id="day-memo"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder="오늘의 기록을 남겨보세요."
        rows={6}
        className="h-[190px] w-full resize-none rounded-lg border border-line bg-paper/70 px-3.5 py-3 text-[15px] leading-relaxed text-ink-900 placeholder:text-ink-300 focus:border-ink-400 focus:outline-none"
      />
      <div className="mt-2 flex items-start justify-end gap-3">
        {error && (
          <p role="alert" className="flex-1 text-sm text-peach-700">
            {error}
          </p>
        )}
        <button
          type="button"
          onClick={() => void save()}
          disabled={!dirty || saving}
          className="rounded-lg border border-line px-3.5 py-1.5 text-sm text-ink-700 hover:bg-line/50 disabled:cursor-default disabled:text-ink-300 disabled:hover:bg-transparent"
        >
          {saving ? '저장 중…' : error ? '다시 시도' : dirty || !memo ? '저장' : '저장됨'}
        </button>
      </div>
    </div>
  )
}

/**
 * 메모 위의 작은 목표 목록.
 * 체크는 기록이 있으면 자동으로 표시되고, 체크박스를 누르면 빠르게 기록할 수 있어요.
 */
function GoalList({
  goals,
  title,
  onToggle,
  isDisabled,
}: {
  goals: GoalStatus[]
  title: string
  onToggle: (calendar: HabitCalendar) => Promise<void>
  isDisabled: (calendar: HabitCalendar) => boolean
}) {
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  if (goals.length === 0) return null
  const doneCount = goals.filter((g) => g.done).length

  const toggle = async (calendar: HabitCalendar) => {
    if (busyId) return
    setBusyId(calendar.id)
    setError(null)
    try {
      await onToggle(calendar)
    } catch (err) {
      setError(err instanceof Error ? err.message : '기록하지 못했어요.')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <section className="mb-6" aria-label={title}>
      <div className="mb-2 flex items-baseline justify-between">
        <h3 className="text-[15px] text-ink-900">{title}</h3>
        <span className="text-xs text-ink-400">
          {doneCount}/{goals.length}
        </span>
      </div>
      <ul className="flex flex-col">
        {goals.map(({ calendar, done, detail }) => {
          const disabled = isDisabled(calendar)
          const busy = busyId === calendar.id
          const quick = calendar.unit === 'check'
          return (
            <li key={calendar.id} className="flex items-center gap-2.5 py-1 text-sm">
              <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${COLOR_STYLES[calendar.color].dot}`} aria-hidden="true" />
              <span className={`truncate ${done ? 'text-ink-400' : 'text-ink-900'}`}>{calendar.name}</span>
              <span className="ml-auto shrink-0 text-xs text-ink-400">{detail}</span>
              <button
                type="button"
                onClick={() => void toggle(calendar)}
                disabled={disabled || Boolean(busyId)}
                aria-pressed={done}
                aria-label={
                  disabled
                    ? `${calendar.name}: 이 날짜는 기록할 수 없어요`
                    : done
                      ? `${calendar.name}: 완료됨. ${quick ? '누르면 기록 지우기' : '누르면 기록 수정'}`
                      : `${calendar.name}: ${quick ? '누르면 완료로 기록' : '누르면 기록 추가'}`
                }
                title={disabled ? '이 날짜는 기록할 수 없어요' : undefined}
                className={`-m-1.5 flex shrink-0 items-center justify-center p-1.5 disabled:cursor-not-allowed ${busy ? 'opacity-50' : ''}`}
              >
                <span
                  className={`flex h-4 w-4 items-center justify-center rounded border ${
                    done
                      ? 'border-leaf-700 bg-leaf-700 text-paper'
                      : disabled
                        ? 'border-ink-300/50 bg-line/40'
                        : 'border-ink-300 hover:border-ink-700'
                  }`}
                  aria-hidden="true"
                >
                  {done && <Check size={11} strokeWidth={3} />}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
      {error && (
        <p role="alert" className="mt-2 rounded-lg bg-peach-100 px-3 py-2 text-sm text-peach-700">
          {error}
        </p>
      )}
    </section>
  )
}

import { useEffect, useRef, useState } from 'react'
import { Check } from 'lucide-react'
import type { HabitCalendar, RecordInput } from '../../types'
import { COLOR_STYLES } from '../../lib/colors'
import { isInPeriod } from '../../lib/activity'
import { UNIT_META } from '../../lib/units'

interface RecordDialogProps {
  calendars: HabitCalendar[]
  /** 처음 값 (새 기록이면 선택한 날짜·기본 단위, 수정이면 기존 기록) */
  initial: RecordInput
  isEdit: boolean
  /** 저장이 끝나면(성공) 부모가 팝업을 닫음. 실패하면 예외 → 팝업에 오류 표시 */
  onSave: (input: RecordInput) => Promise<void>
  /** 수정할 때만: 이 활동 원본 삭제 (연결된 모든 캘린더에서 빠짐) */
  onDelete?: () => Promise<void>
  onClose: () => void
}

/**
 * 활동 추가·수정 팝업
 * 활동은 한 번만 입력하고, 반영할 캘린더를 여러 개 고릅니다.
 * 입력 칸(시간·km 등)은 고른 캘린더의 기록 방식을 따릅니다.
 * 기록 방식이 다른 캘린더나 기간 밖의 캘린더는 함께 고를 수 없습니다.
 */
export function RecordDialog({ calendars, initial, isEdit, onSave, onDelete, onClose }: RecordDialogProps) {
  const [date, setDate] = useState(initial.date)
  const [hours, setHours] = useState(initial.amount ? String(Math.floor(initial.amount)) : '')
  const [minutes, setMinutes] = useState(initial.amount ? String(Math.round((initial.amount % 1) * 60)) : '')
  const [value, setValue] = useState(initial.amount ? String(initial.amount) : '')
  const [selected, setSelected] = useState<string[]>(initial.calendarIds)
  const [saving, setSaving] = useState(false)
  // 화면이 다시 그려지기 전에 연달아 눌러도 한 번만 보내도록 즉시 잠그는 장치
  const submitting = useRef(false)
  const [error, setError] = useState<string | null>(null)
  /** 삭제는 한 번 더 눌러야 실행 (실수 방지) */
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  const remove = async () => {
    if (!onDelete || submitting.current) return
    submitting.current = true
    setSaving(true)
    setError(null)
    try {
      await onDelete()
    } catch (err) {
      setError(err instanceof Error ? err.message : '삭제하지 못했어요.')
      setSaving(false)
      submitting.current = false
    }
  }

  // 기록 방식은 처음 고른 캘린더를 따릅니다 (기간 밖 캘린더는 빼고)
  const firstPicked = selected
    .map((id) => calendars.find((c) => c.id === id))
    .find((cal): cal is HabitCalendar => Boolean(cal && isInPeriod(cal, date)))
  const unit = firstPicked?.unit

  /** 고를 수 없는 이유 (고를 수 있으면 undefined) */
  const blockedReason = (cal: HabitCalendar) => {
    if (!isInPeriod(cal, date)) return '기간 밖'
    if (unit && cal.unit !== unit) return UNIT_META[cal.unit].label
    return undefined
  }
  const selectable = (cal: HabitCalendar) => blockedReason(cal) === undefined
  // 날짜가 바뀌어 고를 수 없게 된 캘린더는 선택에서 뺍니다.
  const validSelected = selected.filter((id) => {
    const cal = calendars.find((c) => c.id === id)
    return cal && selectable(cal)
  })

  const amount = !unit
    ? 0
    : unit === 'check'
      ? 1
      : unit === 'hours'
        ? (Number(hours) || 0) + (Number(minutes) || 0) / 60
        : Number(value) || 0
  const canSave = Boolean(unit) && amount > 0 && validSelected.length > 0 && Boolean(date)
  const hasBlocked = calendars.some((c) => !selectable(c))

  const toggle = (id: string) => setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !saving && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, saving])

  const inputClass =
    'w-20 rounded-lg border border-line bg-white/80 px-3 py-2 text-right text-base text-ink-900 focus:border-ink-400 focus:outline-none'
  const labelClass = 'mb-2 block text-sm text-ink-500'

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink-900/20 p-3 sm:items-center"
      onMouseDown={() => !saving && onClose()}
    >
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="record-dialog-title"
        className="paper-grid max-h-[calc(100vh-1.5rem)] w-full max-w-md overflow-y-auto rounded-2xl border border-line p-6"
        onMouseDown={(e) => e.stopPropagation()}
        onSubmit={async (e) => {
          e.preventDefault()
          // 저장 중에는 다시 누를 수 없음 → 같은 활동이 두 번 생기지 않음
          if (!canSave || submitting.current) return
          submitting.current = true
          setSaving(true)
          setError(null)
          try {
            if (unit) await onSave({ date, amount, unit, calendarIds: validSelected })
          } catch (err) {
            setError(err instanceof Error ? err.message : '저장하지 못했어요.')
            setSaving(false)
            submitting.current = false
          }
        }}
      >
        <h2 id="record-dialog-title" className="text-lg text-ink-900">
          {isEdit ? '활동 수정' : '활동 추가'}
        </h2>

        <div className="mt-5">
          <label htmlFor="record-date" className={labelClass}>
            날짜
          </label>
          <input
            id="record-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-lg border border-line bg-white/80 px-3 py-2 text-base text-ink-900 focus:border-ink-400 focus:outline-none"
          />
        </div>

        <fieldset className="mt-5">
          <legend className={labelClass}>반영할 캘린더</legend>
          <div className="flex flex-col gap-0.5">
            {calendars.map((cal) => {
              const reason = blockedReason(cal)
              const checked = validSelected.includes(cal.id)
              return (
                <label
                  key={cal.id}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2 text-[15px] ${
                    reason ? 'cursor-not-allowed text-ink-300' : 'cursor-pointer text-ink-900 hover:bg-line/50'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={Boolean(reason)}
                    onChange={() => toggle(cal.id)}
                    aria-label={reason ? `${cal.name} (${reason})` : cal.name}
                    className="peer sr-only"
                  />
                  <span
                    className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded border peer-focus-visible:outline-2 peer-focus-visible:outline-ink-700 ${
                      checked ? 'border-ink-900 bg-ink-900 text-paper' : 'border-ink-300 bg-white/70'
                    }`}
                    aria-hidden="true"
                  >
                    {checked && <Check size={13} strokeWidth={2.5} />}
                  </span>
                  <span
                    className={`h-3 w-3 shrink-0 rounded-full ${COLOR_STYLES[cal.color].dot} ${reason ? 'opacity-40' : ''}`}
                    aria-hidden="true"
                  />
                  <span className="flex-1 truncate">{cal.name}</span>
                  {reason && <span className="shrink-0 text-xs">{reason}</span>}
                </label>
              )
            })}
          </div>
          {hasBlocked && (
            <p className="mt-2 px-3 text-xs text-ink-500">기록 방식이 다르거나 기간이 지난 캘린더에는 함께 반영할 수 없어요.</p>
          )}
        </fieldset>

        <div className="mt-5">
          <p className={labelClass}>활동량</p>
          {!unit ? (
            <p className="py-2 text-[15px] text-ink-400">캘린더를 고르면 입력 칸이 나와요</p>
          ) : unit === 'check' ? (
            <p className="py-2 text-[15px] text-ink-700">완료로 기록돼요</p>
          ) : unit === 'hours' ? (
            <div className="flex items-center gap-2 text-ink-700">
              <input
                aria-label="시간"
                type="number"
                min={0}
                inputMode="numeric"
                value={hours}
                onChange={(e) => setHours(e.target.value)}
                className={inputClass}
              />
              시간
              <input
                aria-label="분"
                type="number"
                min={0}
                max={59}
                step={5}
                inputMode="numeric"
                value={minutes}
                onChange={(e) => setMinutes(e.target.value)}
                className={`${inputClass} ml-2`}
              />
              분
            </div>
          ) : (
            <div className="flex items-center gap-2 text-ink-700">
              <input
                aria-label={`활동량 (${UNIT_META[unit].suffix})`}
                type="number"
                min={0}
                step="any"
                inputMode="decimal"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                className={inputClass}
              />
              {UNIT_META[unit].suffix}
            </div>
          )}
        </div>

        {error && (
          <p role="alert" className="mt-5 rounded-lg bg-peach-100 px-3 py-2 text-sm text-peach-700">
            {error}
          </p>
        )}

        <div className="mt-6 flex items-center justify-end gap-2">
          {isEdit && onDelete && (
            <button
              type="button"
              onClick={() => (confirmingDelete ? void remove() : setConfirmingDelete(true))}
              disabled={saving}
              className={`mr-auto rounded-lg px-3 py-2 text-[15px] disabled:opacity-60 ${
                confirmingDelete ? 'bg-sun text-paper' : 'text-sun hover:bg-line/50'
              }`}
            >
              {confirmingDelete ? '정말 삭제' : '삭제'}
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-lg px-4 py-2 text-[15px] text-ink-700 hover:bg-line/60 disabled:text-ink-300"
          >
            취소
          </button>
          <button
            type="submit"
            disabled={!canSave || saving}
            className="rounded-lg bg-ink-900 px-5 py-2 text-[15px] text-paper disabled:cursor-not-allowed disabled:bg-ink-300"
          >
            {saving ? '저장 중…' : error ? '다시 시도' : '저장'}
          </button>
        </div>
      </form>
    </div>
  )
}

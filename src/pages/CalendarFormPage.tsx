import { useState, type ReactNode } from 'react'
import { ArrowLeft, Check } from 'lucide-react'
import type { CalendarInput, CalendarType, ColorKey, DateKey, GoalUnit, HabitCalendar, IconKey } from '../types'
import { useData } from '../data/DataProvider'
import { COLOR_OPTIONS, COLOR_STYLES } from '../lib/colors'
import { addDays, formatMonthDay } from '../lib/date'
import { CALENDAR_ICONS, ICON_OPTIONS, TYPE_META } from '../lib/icons'
import { UNIT_META, UNIT_OPTIONS, formatAmount, formatFrequency } from '../lib/units'
import { Card } from '../components/ui/Card'
import { TypeBadge } from '../components/ui/Badges'
import { CalendarIcon } from '../components/ui/CalendarIcon'

// 개인 캘린더 만들기·수정·삭제 화면
// 공동 목표·개인 경쟁 캘린더 만들기는 친구 초대가 필요해서 다음 단계에서 구현 예정입니다.

interface FormState {
  name: string
  icon: IconKey
  color: ColorKey
  unit: GoalUnit
  weeklyTimes: number
  /** 1회 목표량 (체크 단위면 없음) */
  target: number
  goalsText: string
  startDate: DateKey
  endDate: DateKey
  noEndDate: boolean
}

const TYPE_ORDER: CalendarType[] = ['personal', 'shared', 'competition']

interface CalendarFormPageProps {
  today: DateKey
  /** 수정할 캘린더. 없으면 새로 만들기 */
  calendar?: HabitCalendar
  /** 저장·삭제가 끝나면 호출 (달력에서 보여줄 캘린더 id, 삭제했으면 'all') */
  onDone: (filter: string) => void
  onCancel: () => void
}

function toForm(calendar: HabitCalendar | undefined, today: DateKey): FormState {
  if (!calendar) {
    return {
      name: '',
      icon: 'sprout',
      color: 'leaf',
      unit: 'check',
      weeklyTimes: 3,
      target: 1,
      goalsText: '',
      startDate: today,
      endDate: addDays(today, 29),
      noEndDate: true,
    }
  }
  return {
    name: calendar.name,
    icon: calendar.icon,
    color: calendar.color,
    unit: calendar.unit,
    // 예전에 '매일'로 만든 캘린더는 주 7회로 보여 줌
    weeklyTimes: calendar.frequency?.kind === 'weekly' ? calendar.frequency.times : calendar.frequency?.kind === 'daily' ? 7 : 3,
    target: calendar.target ?? 1,
    goalsText: calendar.goals.join('\n'),
    startDate: calendar.startDate,
    endDate: calendar.endDate ?? addDays(today, 29),
    noEndDate: !calendar.endDate,
  }
}

export function CalendarFormPage({ today, calendar, onDone, onCancel }: CalendarFormPageProps) {
  const { createCalendar, updateCalendar, deleteCalendar, myRecords } = useData()
  const isEdit = Boolean(calendar)
  const [form, setForm] = useState<FormState>(() => toForm(calendar, today))
  const [confirmDelete, setConfirmDelete] = useState(false)
  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }))

  const linked = calendar ? myRecords.filter((r) => r.calendarIds.includes(calendar.id)) : []
  // 기록이 있는 캘린더의 단위를 바꾸면 기존 기록과 맞지 않으므로 막습니다.
  const unitLocked = linked.length > 0
  const showTarget = form.unit !== 'check'
  const frequencyLabel = `주 ${form.weeklyTimes}회`
  const defaultGoal = `${frequencyLabel} ${form.name.trim() || '실천'}하기`
  const canSave = form.name.trim().length > 0 && (!showTarget || form.target > 0)

  const toInput = (): CalendarInput => {
    const goals = form.goalsText
      .split('\n')
      .map((g) => g.trim())
      .filter(Boolean)
    return {
      name: form.name.trim(),
      description: calendar?.description ?? '',
      icon: form.icon,
      color: form.color,
      unit: form.unit,
      frequency: { kind: 'weekly', times: form.weeklyTimes },
      target: showTarget ? form.target : undefined,
      goals: goals.length ? goals : [defaultGoal],
      startDate: form.startDate,
      endDate: form.noEndDate ? undefined : form.endDate,
    }
  }

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 저장이 실제로 끝난 뒤에만 화면을 닫음 (실패하면 오류를 보여 주고 그대로 둠)
  const save = async () => {
    if (!canSave || saving) return
    setSaving(true)
    setError(null)
    try {
      if (calendar) {
        await updateCalendar(calendar.id, toInput())
        onDone(calendar.id)
      } else {
        const created = await createCalendar(toInput())
        onDone(created.id)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '저장하지 못했어요.')
      setSaving(false)
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={onCancel}
        className="mb-5 inline-flex items-center gap-1.5 py-1.5 pr-3 text-sm font-medium text-ink-500 hover:text-ink-900"
      >
        <ArrowLeft size={16} />
        돌아가기
      </button>
      <h1 className="text-2xl tracking-tight text-ink-900 sm:text-3xl">{isEdit ? '캘린더 수정' : '새 캘린더 만들기'}</h1>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <form
          className="flex flex-col gap-4 sm:gap-6 lg:col-span-2"
          onSubmit={(e) => {
            e.preventDefault()
            save()
          }}
        >
          {!isEdit && (
            <Section step={1} title="캘린더 유형">
              <div className="grid gap-3 sm:grid-cols-3" role="radiogroup" aria-label="캘린더 유형">
                {TYPE_ORDER.map((type) => {
                  const meta = TYPE_META[type]
                  const active = type === 'personal'
                  return (
                    <button
                      key={type}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      disabled={!active}
                      title={active ? undefined : '다음 단계에서 구현 예정'}
                      className={`flex flex-col items-start gap-2 rounded-2xl p-4 text-left ring-1 ${
                        active ? 'bg-ink-900 text-cream-50 ring-ink-900' : 'cursor-not-allowed bg-cream-50 text-ink-400 ring-cream-300'
                      }`}
                    >
                      <meta.icon size={20} />
                      <span className="text-sm">{meta.label}</span>
                      <span className={`text-xs ${active ? 'text-cream-200' : 'text-ink-400'}`}>
                        {active ? meta.description : '친구 초대와 함께 다음 단계에서 구현 예정'}
                      </span>
                    </button>
                  )
                })}
              </div>
            </Section>
          )}

          <Section step={isEdit ? 1 : 2} title="이름과 모양">
            <Field label="캘린더 이름" htmlFor="cal-name">
              <input
                id="cal-name"
                type="text"
                value={form.name}
                maxLength={20}
                onChange={(e) => update('name', e.target.value)}
                placeholder="예: 아침 스트레칭"
                className="w-full rounded-2xl border border-cream-300 bg-white px-4 py-3 text-sm text-ink-900 placeholder:text-ink-300 focus:border-ink-500 focus:outline-none"
              />
            </Field>

            <Field label="아이콘">
              <div className="flex flex-wrap gap-2">
                {ICON_OPTIONS.map((key) => {
                  const Icon = CALENDAR_ICONS[key].icon
                  const active = form.icon === key
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => update('icon', key)}
                      aria-label={CALENDAR_ICONS[key].label}
                      aria-pressed={active}
                      className={`flex h-11 w-11 items-center justify-center rounded-2xl transition-colors ${
                        active ? `${COLOR_STYLES[form.color].medium} ring-2 ring-ink-900` : 'bg-cream-100 text-ink-500 hover:bg-cream-200'
                      }`}
                    >
                      <Icon size={20} />
                    </button>
                  )
                })}
              </div>
            </Field>

            <Field label="색상">
              <div className="flex flex-wrap gap-3">
                {COLOR_OPTIONS.map((key) => {
                  const active = form.color === key
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => update('color', key)}
                      aria-pressed={active}
                      aria-label={COLOR_STYLES[key].label}
                      className="flex flex-col items-center gap-1.5 text-xs text-ink-500"
                    >
                      <span
                        className={`flex h-10 w-10 items-center justify-center rounded-full ${COLOR_STYLES[key].dot} ${
                          active ? 'ring-2 ring-ink-900 ring-offset-2 ring-offset-white' : ''
                        }`}
                      >
                        {active && <Check size={18} className="text-white" />}
                      </span>
                      {COLOR_STYLES[key].label}
                    </button>
                  )
                })}
              </div>
            </Field>
          </Section>

          <Section step={isEdit ? 2 : 3} title="목표">
            <Field label="기록 단위" help={unitLocked ? `이 캘린더에 연결된 활동이 ${linked.length}개 있어서 단위를 바꿀 수 없어요.` : undefined}>
              <div className="flex flex-wrap gap-2">
                {UNIT_OPTIONS.map((unit) => (
                  <Pill key={unit} active={form.unit === unit} disabled={unitLocked && form.unit !== unit} onClick={() => update('unit', unit)}>
                    {UNIT_META[unit].label}
                  </Pill>
                ))}
              </div>
            </Field>

            {/* '매일'은 주 7회와 같아서 따로 두지 않고 주 1~7회로 고릅니다 */}
            <Field label="실천 빈도">
              <label className="inline-flex items-center gap-2 text-sm text-ink-700">
                주
                <select
                  value={form.weeklyTimes}
                  onChange={(e) => update('weeklyTimes', Number(e.target.value))}
                  className="rounded-xl border border-cream-300 bg-white px-3 py-2 text-sm"
                  aria-label="주당 횟수"
                >
                  {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
                회
              </label>
            </Field>

            {showTarget && (
              <Field label="1회 목표량" htmlFor="cal-target">
                <div className="flex items-center gap-2">
                  <input
                    id="cal-target"
                    type="number"
                    min={0}
                    step="any"
                    inputMode="decimal"
                    value={form.target}
                    onChange={(e) => update('target', Number(e.target.value))}
                    className="w-32 rounded-2xl border border-cream-300 bg-white px-4 py-3 text-sm text-ink-900 focus:border-ink-500 focus:outline-none"
                  />
                  <span className="text-sm text-ink-700">{UNIT_META[form.unit].suffix}</span>
                </div>
              </Field>
            )}

            <Field label="세부 목표 (한 줄에 하나)" htmlFor="cal-goals">
              <textarea
                id="cal-goals"
                rows={3}
                value={form.goalsText}
                onChange={(e) => update('goalsText', e.target.value)}
                placeholder={defaultGoal}
                className="w-full resize-none rounded-2xl border border-cream-300 bg-white px-4 py-3 text-sm leading-relaxed text-ink-900 placeholder:text-ink-300 focus:border-ink-500 focus:outline-none"
              />
            </Field>
          </Section>

          <Section step={isEdit ? 3 : 4} title="목표 기간">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="시작일" htmlFor="cal-start">
                <input
                  id="cal-start"
                  type="date"
                  value={form.startDate}
                  onChange={(e) => update('startDate', e.target.value)}
                  className="w-full rounded-2xl border border-cream-300 bg-white px-4 py-3 text-sm text-ink-900"
                />
              </Field>
              <Field label="종료일" htmlFor="cal-end">
                <input
                  id="cal-end"
                  type="date"
                  value={form.endDate}
                  min={form.startDate}
                  disabled={form.noEndDate}
                  onChange={(e) => update('endDate', e.target.value)}
                  className="w-full rounded-2xl border border-cream-300 bg-white px-4 py-3 text-sm text-ink-900 disabled:bg-cream-100 disabled:text-ink-300"
                />
              </Field>
            </div>
            <label className="inline-flex items-center gap-2 text-sm text-ink-700">
              <input
                type="checkbox"
                checked={form.noEndDate}
                onChange={(e) => update('noEndDate', e.target.checked)}
                className="h-4 w-4 accent-ink-900"
              />
              종료일 없이 계속 기록하기
            </label>
          </Section>

          <div className="flex flex-wrap items-center justify-between gap-3">
            {isEdit ? (
              <button type="button" onClick={() => setConfirmDelete(true)} className="rounded-lg px-3 py-2 text-sm text-sun hover:bg-line/50">
                캘린더 삭제
              </button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <button type="button" onClick={onCancel} className="rounded-lg px-4 py-2 text-[15px] text-ink-700 hover:bg-line/60">
                취소
              </button>
              <button
                type="submit"
                disabled={!canSave || saving}
                className="rounded-lg bg-ink-900 px-5 py-2 text-[15px] text-paper disabled:cursor-not-allowed disabled:bg-ink-300"
              >
                {saving ? '저장 중…' : isEdit ? '저장' : '만들기'}
              </button>
            </div>
          </div>
          {error && (
            <p role="alert" className="rounded-lg bg-peach-100 px-3 py-2 text-sm text-peach-700">
              {error}
            </p>
          )}
        </form>

        <aside className="lg:col-span-1">
          <div className="lg:sticky lg:top-8">
            <p className="mb-2 text-xs text-ink-500">미리보기</p>
            <Preview form={form} />
          </div>
        </aside>
      </div>

      {confirmDelete && calendar && (
        <ConfirmDelete
          calendar={calendar}
          linkedCount={linked.length}
          onlyHereCount={linked.filter((r) => r.calendarIds.length === 1).length}
          onCancel={() => setConfirmDelete(false)}
          onConfirm={async () => {
            await deleteCalendar(calendar.id)
            onDone('all')
          }}
        />
      )}
    </div>
  )
}

function Preview({ form }: { form: FormState }) {
  const c = COLOR_STYLES[form.color]
  const frequency = formatFrequency({ kind: 'weekly', times: form.weeklyTimes })
  const goalText = form.unit === 'check' ? `${frequency} 체크하기` : `${frequency} · 한 번에 ${formatAmount(form.target, form.unit)}`

  return (
    <div className={`rounded-3xl p-5 ring-1 ring-inset ${c.tint} ${c.ringSoft}`}>
      <CalendarIcon icon={form.icon} color={form.color} />
      <h3 className="mt-4 text-base text-ink-900">{form.name.trim() || '이름 없는 캘린더'}</h3>
      <div className="mt-2">
        <TypeBadge type="personal" />
      </div>
      <dl className="mt-4 flex flex-col gap-2 text-sm">
        <div className="flex justify-between gap-3">
          <dt className="text-ink-500">목표</dt>
          <dd className="text-right text-ink-900">{goalText}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-ink-500">단위</dt>
          <dd className="text-ink-900">{UNIT_META[form.unit].label}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-ink-500">기간</dt>
          <dd className="text-ink-900">
            {formatMonthDay(form.startDate)} ~ {form.noEndDate ? '계속' : formatMonthDay(form.endDate)}
          </dd>
        </div>
      </dl>
    </div>
  )
}

function ConfirmDelete({
  calendar,
  linkedCount,
  onlyHereCount,
  onCancel,
  onConfirm,
}: {
  calendar: HabitCalendar
  linkedCount: number
  onlyHereCount: number
  onCancel: () => void
  onConfirm: () => Promise<void>
}) {
  const [working, setWorking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const confirm = async () => {
    setWorking(true)
    setError(null)
    try {
      await onConfirm()
    } catch (err) {
      setError(err instanceof Error ? err.message : '삭제하지 못했어요.')
      setWorking(false)
    }
  }
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink-900/20 p-3 sm:items-center"
      onMouseDown={() => !working && onCancel()}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-title"
        className="paper-grid w-full max-w-sm rounded-2xl border border-line p-6"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h2 id="delete-title" className="text-lg text-ink-900">
          '{calendar.name}' 캘린더를 삭제할까요?
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-ink-700">
          {linkedCount === 0
            ? '연결된 활동이 없어요.'
            : `연결된 활동 ${linkedCount}개 중 이 캘린더에만 있는 ${onlyHereCount}개는 함께 삭제되고, 다른 캘린더에도 반영된 활동은 남아요.`}
        </p>
        {error && (
          <p role="alert" className="mt-3 rounded-lg bg-peach-100 px-3 py-2 text-sm text-peach-700">
            {error}
          </p>
        )}
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="rounded-lg px-4 py-2 text-[15px] text-ink-700 hover:bg-line/60" autoFocus>
            취소
          </button>
          <button
            type="button"
            onClick={() => void confirm()}
            disabled={working}
            className="rounded-lg bg-sun px-5 py-2 text-[15px] text-paper disabled:opacity-60"
          >
            {working ? '삭제 중…' : '삭제'}
          </button>
        </div>
      </div>
    </div>
  )
}

function Section({ step, title, children }: { step: number; title: string; children: ReactNode }) {
  return (
    <Card className="flex flex-col gap-5">
      <h2 className="flex items-center gap-2.5 text-base text-ink-900">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-cream-200 text-xs text-ink-700">{step}</span>
        {title}
      </h2>
      {children}
    </Card>
  )
}

function Field({ label, htmlFor, help, children }: { label: string; htmlFor?: string; help?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={htmlFor} className="text-sm text-ink-700">
        {label}
      </label>
      {children}
      {help && <p className="text-xs text-ink-500">{help}</p>}
    </div>
  )
}

function Pill({
  active,
  disabled,
  onClick,
  children,
}: {
  active: boolean
  disabled?: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={`rounded-full px-4 py-2 text-sm transition-colors ${
        active ? 'bg-ink-900 text-cream-50' : 'bg-cream-100 text-ink-700 hover:bg-cream-200'
      } disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-cream-100`}
    >
      {children}
    </button>
  )
}

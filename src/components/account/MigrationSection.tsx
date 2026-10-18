import { useEffect, useState } from 'react'
import { useAuth } from '../../data/AuthProvider'
import { useData } from '../../data/DataProvider'
import { downloadBackup, loadData } from '../../data/storage'
import {
  buildPlan,
  checkPlan,
  isPlanEmpty,
  markMigrated,
  migratedFingerprint,
  runMigration,
  type MigrationCheck,
  type MigrationPlan,
  type MigrationResult,
} from '../../data/migration'
import { friendlyError, supabase } from '../../lib/supabase'

// 설정 › 이 브라우저 기록 옮기기 (로그인했을 때만 보임)
// 순서: 미리보기 → 백업 → 중복·충돌 확인 → 옮기기 → 검증 결과

type Step = 'preview' | 'checked' | 'running' | 'done' | 'error'

const lineButton =
  'rounded-lg border border-line px-4 py-2 text-base text-ink-700 hover:bg-line/50 disabled:cursor-not-allowed disabled:opacity-50 sm:px-5 sm:py-2.5 sm:text-lg'
const primaryButton =
  'rounded-lg bg-ink-900 px-5 py-2.5 text-base text-paper disabled:cursor-not-allowed disabled:bg-ink-300 sm:text-lg'

export function MigrationSection() {
  const { user } = useAuth()
  const { reload } = useData()
  const [plan, setPlan] = useState<MigrationPlan | null>(null)
  const [check, setCheck] = useState<MigrationCheck | null>(null)
  const [step, setStep] = useState<Step>('preview')
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<MigrationResult | null>(null)
  const [backedUp, setBackedUp] = useState(false)

  useEffect(() => {
    const local = loadData()
    if (local) void buildPlan(local).then(setPlan)
  }, [])

  if (!user || !supabase) return null
  const client = supabase
  const alreadyDoneHere = plan && migratedFingerprint(user.id) === plan.fingerprint

  if (!plan) return <p className="px-2 py-3 text-lg text-ink-500">이 브라우저의 기록을 살펴보는 중…</p>

  if (isPlanEmpty(plan)) {
    return (
      <p className="border-y border-line px-2 py-4 text-lg text-ink-500 sm:text-xl">
        이 브라우저에는 옮길 내 기록이 없어요.
        {plan.excluded.sampleRecords > 0 && (
          <span className="mt-1 block text-base text-ink-400">
            예시 기록 {plan.excluded.sampleRecords}개와 예시 메모는 클라우드에 올리지 않아요.
          </span>
        )}
      </p>
    )
  }

  const runCheck = async () => {
    setBusy(true)
    setError(null)
    try {
      setCheck(await checkPlan(client, plan))
      setStep('checked')
    } catch (err) {
      setError(friendlyError(err))
    } finally {
      setBusy(false)
    }
  }

  const run = async () => {
    setStep('running')
    setError(null)
    try {
      const res = await runMigration(client, plan, user.id, setProgress)
      markMigrated(user.id, plan.fingerprint)
      setResult(res)
      setStep('done')
      await reload()
    } catch (err) {
      setError(friendlyError(err))
      setStep('error')
    }
  }

  return (
    <div className="flex flex-col gap-4 border-y border-line px-2 py-4 text-lg text-ink-700 sm:text-xl">
      <div>
        <p className="text-ink-900">이 브라우저에 아직 클라우드에 없는 기록이 있어요.</p>
        <ul className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 text-base sm:grid-cols-4">
          <li>캘린더 {plan.calendars.length}개</li>
          <li>활동 {plan.records.length}개</li>
          <li>캘린더 연결 {plan.linkCount}개</li>
          <li>메모 {plan.memos.length}개</li>
        </ul>
        <p className="mt-2 text-base text-ink-500">
          여러 캘린더에 반영된 활동 {plan.multiLinkedCount}개도 연결 관계 그대로 옮겨요.
          {plan.excluded.sampleRecords > 0 && ` 예시 기록 ${plan.excluded.sampleRecords}개는 올리지 않아요.`}
        </p>
        {alreadyDoneHere && <p className="mt-2 text-base text-leaf-700">이 브라우저에서 이미 옮긴 적 있는 데이터예요.</p>}
      </div>

      {step !== 'done' && (
        <ol className="flex flex-col gap-3 text-base">
          <li className="flex flex-wrap items-center gap-3">
            <span>1. 먼저 백업</span>
            <button
              type="button"
              className={lineButton}
              onClick={() => setBackedUp(downloadBackup())}
              disabled={step === 'running'}
            >
              {backedUp ? '백업 파일 받음 ✓' : '백업 파일 내려받기'}
            </button>
          </li>
          <li className="flex flex-wrap items-center gap-3">
            <span>2. 중복·충돌 확인</span>
            <button type="button" className={lineButton} onClick={() => void runCheck()} disabled={!backedUp || busy || step === 'running'}>
              {busy ? '확인 중…' : step === 'checked' || step === 'error' ? '다시 확인' : '확인하기'}
            </button>
          </li>
          {check && (
            <li className="rounded-lg bg-cream-100 px-3.5 py-3 text-base text-ink-700">
              {check.alreadyImported ? (
                <>이미 클라우드로 옮긴 데이터예요. 다시 옮겨도 중복으로 생기지 않아요.</>
              ) : (
                <>
                  새로 옮길 캘린더 {plan.calendars.length - check.existingCalendars}개 · 활동 {plan.records.length - check.existingRecords}개
                  {(check.existingCalendars > 0 || check.existingRecords > 0) &&
                    ` (이미 올라간 캘린더 ${check.existingCalendars}개 · 활동 ${check.existingRecords}개는 건너뜀)`}
                </>
              )}
              {check.memoConflicts.length > 0 && (
                <span className="mt-1 block">
                  클라우드에 이미 메모가 있는 날짜 {check.memoConflicts.length}일은 클라우드 메모를 그대로 두고 건너뛰어요.
                </span>
              )}
              {check.sameNameCalendars.length > 0 && (
                <span className="mt-1 block">
                  이름이 같은 캘린더가 이미 있어요: {check.sameNameCalendars.join(', ')} (따로 하나 더 만들어져요)
                </span>
              )}
            </li>
          )}
          <li className="flex flex-wrap items-center gap-3">
            <span>3. 클라우드로 옮기기</span>
            <button
              type="button"
              className={primaryButton}
              onClick={() => void run()}
              disabled={!check || step === 'running'}
            >
              {step === 'running' ? '옮기는 중…' : step === 'error' ? '다시 시도' : '옮기기'}
            </button>
          </li>
        </ol>
      )}

      {step === 'running' && <p className="text-base text-ink-500">{progress}</p>}
      {error && (
        <p role="alert" className="rounded-lg bg-peach-100 px-3.5 py-2.5 text-base text-peach-700">
          {error} 이미 옮겨진 부분은 다시 시도할 때 건너뛰어요.
        </p>
      )}
      {step === 'done' && result && (
        <p role="status" className="rounded-lg bg-leaf-100 px-3.5 py-2.5 text-base text-leaf-700">
          옮기기 완료 · 확인됨: 캘린더 {result.calendars}개, 활동 {result.records}개, 캘린더 연결 {result.links}개, 메모{' '}
          {result.memos}개{result.skippedMemos > 0 && ` (같은 날짜 메모 ${result.skippedMemos}개는 클라우드 것을 유지)`}. 이 브라우저의
          기록은 지우지 않고 그대로 두었어요.
        </p>
      )}
    </div>
  )
}

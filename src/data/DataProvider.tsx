import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { ActivityRecord, CalendarInput, ChallengeInput, DateKey, HabitCalendar, RecordInput } from '../types'
import { ME_ID } from './sampleData'
import { createSampleData, getFriendRecords } from './repository'
import { loadData, saveData, type StoredData } from './storage'
import * as cloud from './cloud'
import { useAuth } from './AuthProvider'
import { pickPrimaryCalendarId } from '../lib/activity'
import { friendlyError, supabase } from '../lib/supabase'

// 앱 전체가 함께 쓰는 데이터(캘린더·활동·메모)와 바꾸는 함수들.
// - 로그인 안 함: 지금처럼 이 브라우저(localStorage)에 저장
// - 로그인 함: Supabase 클라우드에 저장 (서버 저장이 성공한 뒤에만 화면에 반영)
// 두 경우 모두 같은 모양의 데이터를 내보내므로 화면·통계 코드는 그대로입니다.

export type DataMode = 'local' | 'cloud'

export interface SyncStatus {
  state: 'idle' | 'saving' | 'saved' | 'error'
  message?: string
}

interface DataContextValue {
  mode: DataMode
  /** 클라우드에서 처음 불러오는 중 */
  loading: boolean
  /** 클라우드에서 불러오기 실패 (이때는 빈 화면 대신 오류를 보여 줌) */
  loadError: string | null
  reload: () => Promise<void>
  sync: SyncStatus
  calendars: HabitCalendar[]
  /** 내 활동 원본 (중복 없음) — 전체 통계용 */
  myRecords: ActivityRecord[]
  /** 내 활동 + 친구 기록 — 캘린더별 통계용 (클라우드 모드에서는 아직 내 기록만) */
  allRecords: ActivityRecord[]
  memos: Record<DateKey, string>
  getCalendar: (id: string) => HabitCalendar | undefined
  /** 이 캘린더에 연결된 기록 (모든 멤버) */
  recordsOf: (calendarId: string) => ActivityRecord[]
  /** id 는 팝업을 열 때 한 번 만든 값 → 저장 버튼을 여러 번 눌러도 활동은 하나만 생김 */
  addRecord: (input: RecordInput, id: string) => Promise<void>
  /** 체크를 해제한 캘린더에서만 빠지고, 활동 원본은 그대로 유지됩니다. */
  updateRecord: (id: string, input: RecordInput) => Promise<void>
  /** 활동 원본 삭제 → 연결된 모든 캘린더에서 빠집니다. */
  removeRecord: (id: string) => Promise<void>
  saveMemo: (date: DateKey, text: string) => Promise<void>
  createCalendar: (input: CalendarInput) => Promise<HabitCalendar>
  updateCalendar: (id: string, input: CalendarInput) => Promise<void>
  /** 캘린더 삭제. 이 캘린더에만 연결된 활동은 함께 삭제되고, 다른 캘린더에도 연결된 활동은 남습니다. */
  deleteCalendar: (id: string) => Promise<void>
  /** 이 브라우저의 로컬 데이터를 예시로 되돌리기 (로그인 안 했을 때만) */
  resetToSample: () => void

  // ---- 친구와 함께하는 챌린지 (로그인했을 때만) ----
  /** 친구에게 보이는 내 닉네임 (없으면 null) */
  nickname: string | null
  setNickname: (nickname: string) => Promise<void>
  createChallenge: (input: ChallengeInput, nickname: string) => Promise<HabitCalendar>
  /** 챌린지 멤버·친구 기록을 서버에서 다시 받아 옴 (화면에 들어갈 때) */
  refreshChallenge: (id: string) => Promise<void>
  /** 챌린지 나가기: 이 챌린지 연결만 끊고, 내 활동 원본은 그대로 둠 */
  leaveChallenge: (id: string) => Promise<void>
  /** 초대 수락 → 참여한 챌린지 id */
  acceptInvite: (token: string, nickname: string) => Promise<string>
  getActiveInvite: (id: string) => Promise<cloud.ActiveInvite | null>
  createInvite: (id: string) => Promise<cloud.ActiveInvite>
  revokeInvite: (id: string) => Promise<void>
  /** 초대 코드 확인 → 맞으면 초대 화면용 토큰 */
  resolveInviteCode: (code: string) => Promise<cloud.CodeResult>
}

const LOGIN_REQUIRED = '로그인하면 친구와 함께하는 챌린지를 쓸 수 있어요.'

const DataContext = createContext<DataContextValue | null>(null)

/** 캘린더를 지운 뒤의 상태: 그 캘린더에만 연결된 활동은 지우고, 대표 캘린더를 다시 고름 */
function withoutCalendar<T extends { calendars: HabitCalendar[]; records: ActivityRecord[] }>(state: T, id: string): T {
  const calendars = state.calendars.filter((c) => c.id !== id)
  const records = state.records
    .map((r) => {
      if (!r.calendarIds.includes(id)) return r
      const calendarIds = r.calendarIds.filter((x) => x !== id)
      return { ...r, calendarIds, primaryCalendarId: pickPrimaryCalendarId(calendarIds, calendars, r.primaryCalendarId) }
    })
    .filter((r) => r.calendarIds.length > 0)
  return { ...state, calendars, records }
}

/** 챌린지에서 나간 뒤의 상태: 연결만 빼고 활동 원본은 남김 (연결이 0개가 돼도 보존) */
function withoutChallengeLinks<T extends { calendars: HabitCalendar[]; records: ActivityRecord[] }>(state: T, id: string): T {
  const calendars = state.calendars.filter((c) => c.id !== id)
  const records = state.records.map((r) => {
    if (!r.calendarIds.includes(id)) return r
    const calendarIds = r.calendarIds.filter((x) => x !== id)
    const primary = calendarIds.length ? pickPrimaryCalendarId(calendarIds, calendars, r.primaryCalendarId) : ''
    return { ...r, calendarIds, primaryCalendarId: primary }
  })
  return { ...state, calendars, records }
}

/**
 * 한 챌린지의 친구 기록만 새것으로 바꿈.
 * 친구의 같은 활동이 내가 속한 다른 챌린지에도 연결돼 있으면 그 연결은 유지합니다.
 */
function mergeFriendRecords(prev: ActivityRecord[], calendarId: string, fresh: ActivityRecord[]): ActivityRecord[] {
  const kept = new Map<string, ActivityRecord>()
  for (const r of prev) {
    const calendarIds = r.calendarIds.filter((x) => x !== calendarId)
    if (calendarIds.length) kept.set(r.id, { ...r, calendarIds, primaryCalendarId: calendarIds[0] })
  }
  for (const r of fresh) {
    const existing = kept.get(r.id)
    if (existing) kept.set(r.id, { ...existing, calendarIds: [...existing.calendarIds, calendarId] })
    else kept.set(r.id, r)
  }
  return [...kept.values()]
}

/** 개인 캘린더 묶음의 맨 끝(챌린지 앞)에 끼워 넣기 */
function insertCalendar(calendars: HabitCalendar[], calendar: HabitCalendar) {
  const lastPersonal = calendars.map((c) => c.type).lastIndexOf('personal')
  const next = [...calendars]
  next.splice(lastPersonal + 1, 0, calendar)
  return next
}

export function DataProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const mode: DataMode = user && supabase ? 'cloud' : 'local'

  // ---- 로컬(브라우저) 데이터: 로그인과 상관없이 그대로 보관 ----
  const [local, setLocal] = useState<StoredData>(() => loadData() ?? createSampleData())
  useEffect(() => saveData(local), [local])

  // ---- 클라우드 데이터 ----
  const [cloudData, setCloudData] = useState<cloud.CloudData | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [sync, setSync] = useState<SyncStatus>({ state: 'idle' })
  const pending = useRef(0)
  const userId = user?.id ?? null

  const reload = useCallback(async () => {
    if (!supabase || !userId) return
    setLoading(true)
    setLoadError(null)
    try {
      setCloudData(await cloud.fetchCloudData(supabase))
    } catch (error) {
      setLoadError(friendlyError(error).replace('저장되지 않았어요.', '기록을 불러오지 못했어요.'))
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    // 계정이 바뀌면 이전 계정의 데이터를 즉시 지우고 새로 불러옴
    setCloudData(null)
    setSync({ state: 'idle' })
    if (userId) void reload()
  }, [userId, reload])

  /** 클라우드 저장: 진행 중 → 완료/실패 표시. 실패하면 화면 데이터는 바꾸지 않고 오류를 던짐 */
  const track = useCallback(async <T,>(fn: () => Promise<T>): Promise<T> => {
    pending.current++
    setSync({ state: 'saving' })
    try {
      const result = await fn()
      pending.current--
      if (pending.current === 0) setSync({ state: 'saved' })
      return result
    } catch (error) {
      pending.current--
      const message = friendlyError(error)
      setSync({ state: 'error', message })
      throw new Error(message)
    }
  }, [])

  const value = useMemo<DataContextValue>(() => {
    if (mode === 'cloud' && supabase && userId) {
      const client = supabase
      const data = cloudData ?? { calendars: [], records: [], friendRecords: [], memos: {}, nickname: null }
      const { calendars, records, friendRecords, memos } = data
      // 캘린더별 통계용: 내 기록 + 같은 챌린지 친구 기록 (친구 기록은 챌린지에만 연결돼 있음)
      const allRecords = [...records, ...friendRecords]
      const patch = (fn: (prev: cloud.CloudData) => cloud.CloudData) => setCloudData((prev) => (prev ? fn(prev) : prev))
      /** 한 챌린지의 멤버·친구 기록을 새 값으로 바꿈 */
      const applyChallenge = (id: string, result: Awaited<ReturnType<typeof cloud.fetchChallengeData>>) =>
        patch((prev) => ({
          ...prev,
          calendars: prev.calendars.map((c) => (c.id === id ? (result.calendarPatch.get(id)?.(c) ?? c) : c)),
          friendRecords: mergeFriendRecords(prev.friendRecords, id, result.friendRecords),
        }))

      return {
        mode,
        loading: loading || (!cloudData && !loadError),
        loadError,
        reload,
        sync,
        calendars,
        myRecords: records,
        allRecords,
        memos,
        getCalendar: (id) => calendars.find((c) => c.id === id),
        recordsOf: (calendarId) => allRecords.filter((r) => r.calendarIds.includes(calendarId)),

        addRecord: async (input, id) => {
          const primary = pickPrimaryCalendarId(input.calendarIds, calendars)
          const saved = await track(() => cloud.saveActivity(client, id, input, primary))
          patch((prev) => ({ ...prev, records: [...prev.records.filter((r) => r.id !== id), saved] }))
        },

        updateRecord: async (id, input) => {
          const existing = records.find((r) => r.id === id)
          const primary = pickPrimaryCalendarId(input.calendarIds, calendars, existing?.primaryCalendarId)
          const saved = await track(() =>
            cloud.saveActivity(client, id, input, primary, { expectedUpdatedAt: existing?.updatedAt, note: existing?.note }),
          )
          patch((prev) => ({ ...prev, records: prev.records.map((r) => (r.id === id ? saved : r)) }))
        },

        removeRecord: async (id) => {
          await track(() => cloud.deleteActivity(client, id))
          patch((prev) => ({ ...prev, records: prev.records.filter((r) => r.id !== id) }))
        },

        saveMemo: async (date, text) => {
          await track(() => cloud.saveMemo(client, userId, date, text))
          patch((prev) => {
            const next = { ...prev.memos }
            if (text.trim()) next[date] = text
            else delete next[date]
            return { ...prev, memos: next }
          })
        },

        createCalendar: async (input) => {
          const created = await track(() => cloud.createCalendar(client, input, { sortOrder: calendars.length }))
          patch((prev) => ({ ...prev, calendars: insertCalendar(prev.calendars, created) }))
          return created
        },

        updateCalendar: async (id, input) => {
          const current = calendars.find((c) => c.id === id)
          if (!current) throw new Error('캘린더를 찾을 수 없어요.')
          const saved = await track(() => cloud.updateCalendar(client, current, input))
          // 챌린지면 멤버·역할 정보는 그대로 유지
          const merged = { ...saved, members: current.members, memberIds: current.memberIds, role: current.role }
          patch((prev) => ({ ...prev, calendars: prev.calendars.map((c) => (c.id === id ? merged : c)) }))
        },

        deleteCalendar: async (id) => {
          await track(() => cloud.deleteCalendar(client, id))
          patch((prev) => ({
            ...withoutCalendar(prev, id),
            friendRecords: prev.friendRecords.filter((r) => !r.calendarIds.includes(id)),
          }))
        },

        resetToSample: () => {
          /* 로그인 중에는 클라우드 데이터를 건드리지 않음 */
        },

        nickname: data.nickname,
        setNickname: async (nickname) => {
          const saved = await track(() => cloud.setNickname(client, nickname))
          patch((prev) => ({ ...prev, nickname: saved }))
          // 닉네임은 챌린지 멤버 목록에도 보이므로 다시 받아 옴
          const ids = calendars.filter((c) => c.type !== 'personal').map((c) => c.id)
          if (ids.length) {
            const result = await cloud.fetchChallengeData(client, ids)
            patch((prev) => ({ ...prev, calendars: prev.calendars.map((c) => result.calendarPatch.get(c.id)?.(c) ?? c) }))
          }
        },

        createChallenge: async (input, nickname) => {
          const created = await track(() => cloud.createChallenge(client, input, nickname, calendars.length))
          patch((prev) => ({ ...prev, calendars: [...prev.calendars, created], nickname: nickname.trim() }))
          return created
        },

        refreshChallenge: async (id) => {
          applyChallenge(id, await cloud.fetchChallengeData(client, [id]))
        },

        leaveChallenge: async (id) => {
          await track(() => cloud.leaveChallenge(client, id))
          patch((prev) => ({
            ...withoutChallengeLinks(prev, id),
            friendRecords: prev.friendRecords.filter((r) => !r.calendarIds.includes(id)),
          }))
        },

        acceptInvite: async (token, nickname) => {
          const result = await track(() => cloud.acceptInvite(client, token, nickname))
          // 새로 참여한 챌린지와 친구 기록을 받아 오려고 전체를 다시 불러옴
          setCloudData(await cloud.fetchCloudData(client))
          return result.calendar_id
        },

        getActiveInvite: (id) => cloud.getActiveInvite(client, id),
        createInvite: (id) => track(() => cloud.createInvite(client, id)),
        revokeInvite: (id) => track(() => cloud.revokeInvite(client, id)),
        resolveInviteCode: (code) => cloud.resolveInviteCode(client, code),
      }
    }

    // ---- 로컬 모드 (지금까지와 같은 동작) ----
    const { calendars, records, memos } = local
    const allRecords = [...records, ...getFriendRecords()]
    const update = (fn: (prev: StoredData) => StoredData) => setLocal(fn)

    return {
      mode,
      loading: false,
      loadError: null,
      reload: async () => {},
      sync: { state: 'idle' },
      calendars,
      myRecords: records,
      allRecords,
      memos,
      getCalendar: (id) => calendars.find((c) => c.id === id),
      recordsOf: (calendarId) => allRecords.filter((r) => r.calendarIds.includes(calendarId)),

      addRecord: async (input, id) =>
        update((prev) =>
          prev.records.some((r) => r.id === id)
            ? prev
            : {
                ...prev,
                records: [
                  ...prev.records,
                  { id, memberId: ME_ID, ...input, primaryCalendarId: pickPrimaryCalendarId(input.calendarIds, prev.calendars) },
                ],
              },
        ),

      updateRecord: async (id, input) =>
        update((prev) => ({
          ...prev,
          records: prev.records.map((r) =>
            r.id === id
              ? { ...r, ...input, primaryCalendarId: pickPrimaryCalendarId(input.calendarIds, prev.calendars, r.primaryCalendarId) }
              : r,
          ),
        })),

      removeRecord: async (id) => update((prev) => ({ ...prev, records: prev.records.filter((r) => r.id !== id) })),

      saveMemo: async (date, text) =>
        update((prev) => {
          const next = { ...prev.memos }
          if (text.trim()) next[date] = text
          else delete next[date]
          return { ...prev, memos: next }
        }),

      createCalendar: async (input) => {
        const calendar: HabitCalendar = { id: `cal-${crypto.randomUUID()}`, type: 'personal', memberIds: [ME_ID], ...input }
        update((prev) => ({ ...prev, calendars: insertCalendar(prev.calendars, calendar) }))
        return calendar
      },

      updateCalendar: async (id, input) =>
        update((prev) => ({ ...prev, calendars: prev.calendars.map((c) => (c.id === id ? { ...c, ...input } : c)) })),

      deleteCalendar: async (id) => update((prev) => withoutCalendar(prev, id)),

      resetToSample: () => setLocal(createSampleData()),

      // 로그인 전에는 예시 챌린지만 보이고, 친구 기능은 쓸 수 없음
      nickname: null,
      setNickname: async () => {
        throw new Error(LOGIN_REQUIRED)
      },
      createChallenge: async () => {
        throw new Error(LOGIN_REQUIRED)
      },
      refreshChallenge: async () => {},
      leaveChallenge: async () => {
        throw new Error(LOGIN_REQUIRED)
      },
      acceptInvite: async () => {
        throw new Error(LOGIN_REQUIRED)
      },
      getActiveInvite: async () => null,
      createInvite: async () => {
        throw new Error(LOGIN_REQUIRED)
      },
      revokeInvite: async () => {
        throw new Error(LOGIN_REQUIRED)
      },
      resolveInviteCode: async () => {
        throw new Error(LOGIN_REQUIRED)
      },
    }
  }, [mode, userId, local, cloudData, loading, loadError, reload, sync, track])

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

export function useData(): DataContextValue {
  const ctx = useContext(DataContext)
  if (!ctx) throw new Error('useData는 DataProvider 안에서만 쓸 수 있어요.')
  return ctx
}

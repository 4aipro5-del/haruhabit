import type { ActivityRecord, DateKey, HabitCalendar } from '../types'

// 브라우저 localStorage에 내 데이터를 저장합니다.
// 다음 단계에서 Supabase로 옮길 때 이 파일의 load/save만 바꾸면 됩니다.

export const STORAGE_KEY = 'haru-habit:v1'

/** 저장하는 내 데이터 (친구 기록은 아직 연동 전이라 저장하지 않음) */
export interface StoredData {
  version: 1
  calendars: HabitCalendar[]
  /** 내 활동 원본. 여러 캘린더에 반영돼도 한 건만 저장 */
  records: ActivityRecord[]
  /** 날짜별 메모 (하루에 하나) */
  memos: Record<DateKey, string>
}

export function loadData(): StoredData | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const data = JSON.parse(raw) as StoredData
    if (data?.version !== 1 || !Array.isArray(data.calendars) || !Array.isArray(data.records)) return null
    return { ...data, memos: data.memos ?? {} }
  } catch {
    // 저장 공간을 쓸 수 없거나 내용이 깨진 경우: 예시 데이터로 시작
    return null
  }
}

export function saveData(data: StoredData) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch {
    // 시크릿 모드 등으로 저장할 수 없으면 화면 안에서만 유지됩니다.
  }
}

/**
 * 이 브라우저에 저장된 원본 그대로를 백업 파일로 내려받습니다.
 * (클라우드 이전 전에 안전하게 보관하기 위한 용도. 저장된 값을 바꾸지 않습니다.)
 */
export function downloadBackup(): boolean {
  let raw: string | null = null
  try {
    raw = localStorage.getItem(STORAGE_KEY)
  } catch {
    return false
  }
  if (!raw) return false
  const today = new Date().toISOString().slice(0, 10)
  const blob = new Blob([raw], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `haru-habit-backup-${today}.json`
  a.click()
  URL.revokeObjectURL(url)
  return true
}

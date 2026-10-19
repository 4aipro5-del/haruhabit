import type { ActivityRecord, HabitCalendar, Member } from '../types'
import type { StoredData } from './storage'
import { ME_ID, sampleCalendars, sampleFriendRecords, sampleMembers, sampleMemos, sampleMyRecords } from './sampleData'

// 예시 데이터를 꺼내 주는 곳입니다.
// 내 캘린더·기록·메모는 처음 실행할 때 이 값으로 시작하고, 이후에는 localStorage 값을 씁니다.

/** 처음 실행할 때(또는 '예시 데이터로 되돌리기') 쓰는 내 데이터 */
export function createSampleData(): StoredData {
  return structuredClone({
    version: 1 as const,
    calendars: sampleCalendars,
    records: sampleMyRecords,
    memos: sampleMemos,
  })
}

/** 친구 기록: 친구 계정 연동 전까지 예시 데이터 */
export function getFriendRecords(): ActivityRecord[] {
  return sampleFriendRecords
}

export function getMembers(ids: string[]): Member[] {
  return ids.map((id) => sampleMembers.find((m) => m.id === id)).filter((m): m is Member => Boolean(m))
}

/** 캘린더 멤버: 클라우드 챌린지는 실제 멤버, 그 밖에는 예시 멤버 */
export function calendarMembers(calendar: HabitCalendar): Member[] {
  return calendar.members ?? getMembers(calendar.memberIds)
}

export function getMe(): Member {
  return sampleMembers.find((m) => m.id === ME_ID)!
}

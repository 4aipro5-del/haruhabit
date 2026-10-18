import type { ActivityRecord, DateKey, GoalUnit, HabitCalendar, Member } from '../types'
import { addDays, daysInMonth, dayOfWeek, diffDays, makeKey, parseKey, todayKey } from '../lib/date'

// ⚠️ 화면 확인용 예시 데이터입니다.
// 오늘 날짜(한국 시간)를 기준으로 기록을 만들어서, 언제 열어도 최근 기록이 보이게 했습니다.
// 같은 날에는 항상 같은 데이터가 나오도록 고정된 난수를 사용합니다.

export const ME_ID = 'me'

export const sampleMembers: Member[] = [
  { id: ME_ID, name: '나', color: 'leaf', isMe: true },
  { id: 'friend-a', name: '친구 A', color: 'sky' },
  { id: 'friend-b', name: '친구 B', color: 'butter' },
  { id: 'friend-c', name: '친구 C', color: 'lilac' },
]

const today = todayKey()
const { year, month } = parseKey(today)
const challengeStart = makeKey(year, month, 1)
const challengeEnd = makeKey(year, month, daysInMonth(year, month))

export const sampleCalendars: HabitCalendar[] = [
  {
    id: 'exercise',
    name: '운동',
    description: '몸이 가벼워지는 습관 만들기',
    type: 'personal',
    icon: 'dumbbell',
    color: 'leaf',
    unit: 'hours',
    frequency: { kind: 'weekly', times: 3 },
    goals: ['주 3회 운동하기', '한 번에 30분 이상 움직이기', '운동 후 스트레칭 5분'],
    memberIds: [ME_ID],
    startDate: addDays(today, -120),
  },
  {
    id: 'study',
    name: '공부',
    description: '꾸준히 쌓이는 공부 시간',
    type: 'personal',
    icon: 'pencil',
    color: 'sky',
    unit: 'hours',
    frequency: { kind: 'weekly', times: 3 },
    goals: ['주 3회 공부하기', '한 번에 1시간 이상 집중하기', '공부한 내용 세 줄로 정리하기'],
    memberIds: [ME_ID],
    startDate: addDays(today, -120),
  },
  {
    id: 'reading',
    name: '독서',
    description: '잠들기 전 책 한 챕터',
    type: 'personal',
    icon: 'book',
    color: 'butter',
    unit: 'pages',
    frequency: { kind: 'daily' },
    goals: ['매일 책 읽기', '하루 20쪽 이상 읽기'],
    memberIds: [ME_ID],
    startDate: addDays(today, -120),
  },
  {
    id: 'exercise-60',
    name: '운동 60시간 챌린지',
    description: '넷이서 한 달 동안 운동 60시간 채우기',
    type: 'shared',
    icon: 'running',
    color: 'peach',
    unit: 'hours',
    target: 60,
    goals: ['한 달 동안 다 함께 운동 60시간 채우기'],
    memberIds: [ME_ID, 'friend-a', 'friend-b', 'friend-c'],
    startDate: challengeStart,
    endDate: challengeEnd,
  },
  {
    id: 'study-20',
    name: '공부 챌린지',
    description: '한 달 동안 각자 20시간 공부하기',
    type: 'competition',
    icon: 'brain',
    color: 'lilac',
    unit: 'hours',
    target: 20,
    goals: ['한 달 동안 각자 공부 20시간 채우기'],
    memberIds: [ME_ID, 'friend-b', 'friend-c'],
    startDate: challengeStart,
    endDate: challengeEnd,
  },
]

/** 날짜별 메모 (하루에 하나) */
export const sampleMemos: Record<DateKey, string> = {
  [addDays(today, -1)]: '비가 와서 실내 자전거로 대신했다. 그래도 30분 채움.',
  [addDays(today, -3)]: '도서관 창가 자리. 집중이 잘 됐다.',
  [addDays(today, -6)]: '책 한 권 끝! 다음 책 고르기.',
}

// ---- 기록 생성 ----

/** 고정 시드 난수 (mulberry32) */
function createRandom(seed: number) {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function pick<T>(items: T[], random: () => number): T {
  return items[Math.floor(random() * items.length)]
}

let recordSeq = 0
function makeRecord(
  calendarIds: string[],
  memberId: string,
  date: DateKey,
  amount: number,
  unit: GoalUnit,
  note?: string,
): ActivityRecord {
  recordSeq++
  return { id: `sample-${recordSeq}`, memberId, date, amount, unit, calendarIds, primaryCalendarId: calendarIds[0], note }
}

/** 총량(0.5 단위)을 기록들에 고르게 나눠 담습니다. 나머지는 앞쪽 기록에 0.5씩 더합니다. */
function spreadTotal(records: ActivityRecord[], total: number) {
  if (records.length === 0) return
  const halves = Math.round(total * 2)
  const base = Math.floor(halves / records.length)
  const extra = halves - base * records.length
  records.forEach((r, i) => {
    r.amount = (base + (i < extra ? 1 : 0)) / 2
  })
}

interface MyHabitOptions {
  personalId: string
  /** 이번 달 기록을 함께 반영할 챌린지 */
  challenge?: { id: string; total: number }
  unit: GoalUnit
  seed: number
  chance: (weekday: number, daysAgo: number) => number
  amounts: number[]
  notes: string[]
}

/**
 * 내 활동: 지난 120일. 이번 달 기록은 챌린지에도 함께 반영합니다.
 * (같은 활동을 두 번 만들지 않고 calendarIds에 챌린지를 추가)
 */
function myHabit({ personalId, challenge, unit, seed, chance, amounts, notes }: MyHabitOptions): ActivityRecord[] {
  const random = createRandom(seed)
  const result: ActivityRecord[] = []
  for (let daysAgo = 120; daysAgo >= 0; daysAgo--) {
    const date = addDays(today, -daysAgo)
    if (random() < chance(dayOfWeek(date), daysAgo)) {
      result.push(makeRecord([personalId], ME_ID, date, pick(amounts, random), unit, pick(notes, random)))
    }
  }
  if (challenge) {
    const thisMonth = result.filter((r) => r.date >= challengeStart)
    thisMonth.forEach((r) => r.calendarIds.push(challenge.id))
    spreadTotal(thisMonth, challenge.total)
  }
  return result
}

/** 친구 기록: 정해진 총량을 이번 달 1일 ~ 오늘 사이에 나눠서 챌린지에만 기록 */
function friendRecords(calendarId: string, memberId: string, total: number, seed: number, notes: string[]) {
  const random = createRandom(seed)
  const span = diffDays(challengeStart, today) + 1
  const byDate = new Map<DateKey, number>()
  let remaining = total
  while (remaining > 0) {
    const amount = Math.min(pick([1, 1.5, 2], random), remaining)
    const date = addDays(challengeStart, Math.floor(random() * span))
    byDate.set(date, (byDate.get(date) ?? 0) + amount)
    remaining -= amount
  }
  return [...byDate.entries()].map(([date, amount]) =>
    makeRecord([calendarId], memberId, date, amount, 'hours', pick(notes, random)),
  )
}

const exerciseNotes = ['헬스장 하체 운동', '동네 한 바퀴 러닝', '홈트 + 스트레칭', '필라테스', '수영 자유형 연습']
const studyNotes = ['영어 단어 복습', '자격증 기출 풀이', '강의 2개 수강', '코딩 연습', '오답 노트 정리']
const readingNotes = ['『아몬드』 읽는 중', '『불편한 편의점』', '에세이 두 편', '『사피엔스』 3장', '잡지 칼럼']

/** 내 활동 (처음 실행할 때 localStorage에 복사되어 이후로는 저장된 값을 씁니다) */
export const sampleMyRecords: ActivityRecord[] = [
  // 운동: 월·수·금 위주, 가끔 토요일. 이번 달 기록은 '운동 60시간 챌린지'에도 반영 (내 기여 18시간)
  ...myHabit({
    personalId: 'exercise',
    challenge: { id: 'exercise-60', total: 18 },
    unit: 'hours',
    seed: 11,
    chance: (weekday, daysAgo) => (daysAgo === 0 ? 0 : [1, 3, 5].includes(weekday) ? 0.8 : weekday === 6 ? 0.35 : 0.05),
    amounts: [0.5, 1, 1, 1.5],
    notes: exerciseNotes,
  }),
  // 공부: 화·목·토 위주. 이번 달 기록은 '공부 챌린지'에도 반영 (내 기록 18시간)
  ...myHabit({
    personalId: 'study',
    challenge: { id: 'study-20', total: 18 },
    unit: 'hours',
    seed: 23,
    chance: (weekday) => ([2, 4, 6].includes(weekday) ? 0.8 : 0.06),
    amounts: [1, 1.5, 2, 2.5],
    notes: studyNotes,
  }),
  // 독서: 이틀에 한 번꼴, 최근 3일은 연속 기록
  ...myHabit({
    personalId: 'reading',
    unit: 'pages',
    seed: 37,
    chance: (_, daysAgo) => (daysAgo <= 2 ? 1 : 0.5),
    amounts: [12, 18, 20, 24, 30, 35],
    notes: readingNotes,
  }),
]

/** 친구 기록 (친구 계정 연동 전까지 읽기 전용 예시) */
export const sampleFriendRecords: ActivityRecord[] = [
  // 운동 60시간 챌린지 친구 기록: A 12 / B 8 / C 4 (+ 나 18 = 42시간)
  ...friendRecords('exercise-60', 'friend-a', 12, 102, exerciseNotes),
  ...friendRecords('exercise-60', 'friend-b', 8, 103, exerciseNotes),
  ...friendRecords('exercise-60', 'friend-c', 4, 104, exerciseNotes),

  // 공부 챌린지 친구 기록: B 22 / C 15 (+ 나 18)
  ...friendRecords('study-20', 'friend-b', 22, 201, studyNotes),
  ...friendRecords('study-20', 'friend-c', 15, 203, studyNotes),
]

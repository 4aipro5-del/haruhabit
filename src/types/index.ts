// 앱 전체에서 쓰는 데이터 타입입니다.
// 나중에 Supabase 테이블을 만들 때도 이 구조를 기준으로 삼으면 됩니다.

/** 'YYYY-MM-DD' 형식의 날짜 문자열 (한국 시간 기준) */
export type DateKey = string

/** personal: 개인 / shared: 공동 목표 / competition: 개인 경쟁 */
export type CalendarType = 'personal' | 'shared' | 'competition'

/** check: 체크 / hours: 시간 / km: 거리 / count: 횟수 / pages: 페이지 */
export type GoalUnit = 'check' | 'hours' | 'km' | 'count' | 'pages'

export type ColorKey = 'leaf' | 'sky' | 'butter' | 'lilac' | 'peach' | 'mint' | 'rose' | 'sand' | 'olive' | 'slate'

export type IconKey =
  | 'dumbbell'
  | 'running'
  | 'pencil'
  | 'book'
  | 'brain'
  | 'heart'
  | 'sprout'
  | 'music'
  | 'coffee'
  | 'bike'

/** 개인 캘린더의 실천 빈도 */
export type Frequency = { kind: 'daily' } | { kind: 'weekly'; times: number }

export interface Member {
  id: string
  name: string
  color: ColorKey
  isMe?: boolean
}

export interface HabitCalendar {
  id: string
  name: string
  description: string
  type: CalendarType
  icon: IconKey
  color: ColorKey
  unit: GoalUnit
  /** 화면에 보여줄 목표 목록 */
  goals: string[]
  memberIds: string[]
  /** 개인 캘린더: 매일 / 주 N회 */
  frequency?: Frequency
  /** 공동 목표: 전체 합산 목표량 / 개인 경쟁: 1인당 목표량 */
  target?: number
  startDate: DateKey
  endDate?: DateKey
  /** 클라우드에 마지막으로 저장된 시각 (다른 기기와의 수정 충돌 감지용, 로컬 모드에서는 없음) */
  updatedAt?: string
}

/**
 * 활동 기록 1건 (원본은 하나만 존재)
 * 한 번 기록한 활동을 여러 캘린더에 동시에 반영할 수 있습니다.
 * 예) 10월 18일 운동 30분 → calendarIds: ['exercise', 'exercise-60']
 * DB로 옮길 때는 activity_records 테이블 + record_calendars(record_id, calendar_id) 연결 테이블로 나누면 됩니다.
 */
export interface ActivityRecord {
  id: string
  /** 기록한 사람. 공동 챌린지에서는 이 값으로 멤버별 기여도를 계산합니다. */
  memberId: string
  date: DateKey
  amount: number
  unit: GoalUnit
  /** 이 활동을 반영한 캘린더들 (모두 같은 단위여야 함) */
  calendarIds: string[]
  /**
   * 활동 유형을 나타내는 대표 캘린더 (예: 운동). 전체 보기의 점 색깔에 씁니다.
   * 저장해 두므로 캘린더 목록 순서가 바뀌어도 색이 변하지 않습니다.
   */
  primaryCalendarId: string
  note?: string
  /** 클라우드에 마지막으로 저장된 시각 (다른 기기와의 수정 충돌 감지용, 로컬 모드에서는 없음) */
  updatedAt?: string
}

/** 팝업에서 입력하는 활동 1건. 여러 캘린더에 반영해도 기록은 하나입니다. */
export interface RecordInput {
  date: DateKey
  amount: number
  unit: GoalUnit
  calendarIds: string[]
}

/** 캘린더 만들기·수정 화면에서 입력하는 값 */
export type CalendarInput = Pick<
  HabitCalendar,
  'name' | 'description' | 'icon' | 'color' | 'unit' | 'goals' | 'frequency' | 'target' | 'startDate' | 'endDate'
>

import { useEffect } from 'react'
import type { DateKey } from '../types'
import { calendarMembers } from '../data/repository'
import { useData } from '../data/DataProvider'
import { hrefFor } from '../lib/router'
import { LinkButton } from '../components/ui/Buttons'
import { CompetitionDetailPage } from './CompetitionDetailPage'
import { PersonalDetailPage } from './PersonalDetailPage'
import { SharedDetailPage } from './SharedDetailPage'

/** 캘린더 유형에 맞는 상세 화면을 골라 보여줍니다. */
export function CalendarDetailPage({ id, today }: { id: string; today: DateKey }) {
  const { getCalendar, recordsOf, refreshChallenge } = useData()
  const calendar = getCalendar(id)
  const isChallenge = Boolean(calendar && calendar.type !== 'personal')

  // 챌린지 화면에 들어올 때마다 친구들의 최신 기록·멤버를 받아 옴 (실시간 동기화는 아님)
  useEffect(() => {
    if (isChallenge) void refreshChallenge(id).catch(() => {})
    // 화면에 들어올 때 한 번만
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, isChallenge])

  if (!calendar) {
    return (
      <div className="flex flex-col items-center gap-4 py-20 text-center">
        <p className="text-lg font-semibold text-ink-900">캘린더를 찾을 수 없어요</p>
        <LinkButton href={hrefFor({ name: 'home' })}>홈으로 돌아가기</LinkButton>
      </div>
    )
  }

  const records = recordsOf(calendar.id)
  const members = calendarMembers(calendar)

  switch (calendar.type) {
    case 'personal':
      return <PersonalDetailPage key={calendar.id} calendar={calendar} records={records} today={today} />
    case 'shared':
      return <SharedDetailPage key={calendar.id} calendar={calendar} records={records} members={members} today={today} />
    case 'competition':
      return <CompetitionDetailPage key={calendar.id} calendar={calendar} records={records} members={members} today={today} />
  }
}

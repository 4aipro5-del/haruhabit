import type { DateKey } from '../types'
import { getMembers } from '../data/repository'
import { useData } from '../data/DataProvider'
import { hrefFor } from '../lib/router'
import { LinkButton } from '../components/ui/Buttons'
import { CompetitionDetailPage } from './CompetitionDetailPage'
import { PersonalDetailPage } from './PersonalDetailPage'
import { SharedDetailPage } from './SharedDetailPage'

/** 캘린더 유형에 맞는 상세 화면을 골라 보여줍니다. */
export function CalendarDetailPage({ id, today }: { id: string; today: DateKey }) {
  const { getCalendar, recordsOf } = useData()
  const calendar = getCalendar(id)

  if (!calendar) {
    return (
      <div className="flex flex-col items-center gap-4 py-20 text-center">
        <p className="text-lg font-semibold text-ink-900">캘린더를 찾을 수 없어요</p>
        <LinkButton href={hrefFor({ name: 'home' })}>홈으로 돌아가기</LinkButton>
      </div>
    )
  }

  const records = recordsOf(calendar.id)
  const members = getMembers(calendar.memberIds)

  switch (calendar.type) {
    case 'personal':
      return <PersonalDetailPage key={calendar.id} calendar={calendar} records={records} today={today} />
    case 'shared':
      return <SharedDetailPage key={calendar.id} calendar={calendar} records={records} members={members} today={today} />
    case 'competition':
      return <CompetitionDetailPage key={calendar.id} calendar={calendar} records={records} members={members} today={today} />
  }
}

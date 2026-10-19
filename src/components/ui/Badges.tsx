import type { ReactNode } from 'react'
import { Sparkles } from 'lucide-react'
import type { CalendarType, ColorKey, Member } from '../../types'
import { COLOR_STYLES, TYPE_COLOR } from '../../lib/colors'
import { TYPE_META } from '../../lib/icons'

export function TypeBadge({ type, large }: { type: CalendarType; large?: boolean }) {
  const color = COLOR_STYLES[TYPE_COLOR[type]]
  const { icon: Icon, label } = TYPE_META[type]
  const sizeClass = large ? 'gap-1.5 px-3.5 py-1.5 text-base' : 'gap-1 px-2.5 py-1 text-xs'
  return (
    <span className={`inline-flex items-center rounded-full font-medium ${sizeClass} ${color.soft} ${color.text}`}>
      <Icon size={large ? 16 : 12} strokeWidth={2.4} />
      {label}
    </span>
  )
}

export function Chip({ children, color, large }: { children: ReactNode; color?: ColorKey; large?: boolean }) {
  const style = color ? `${COLOR_STYLES[color].soft} ${COLOR_STYLES[color].text}` : 'bg-cream-200 text-ink-700'
  const size = large ? 'px-3 py-1.5 text-sm' : 'px-2.5 py-1 text-xs'
  return <span className={`inline-flex items-center gap-1 rounded-full font-medium ${size} ${style}`}>{children}</span>
}

export function SampleDataNotice({ className = '' }: { className?: string }) {
  return (
    <p
      className={`inline-flex items-center gap-1.5 rounded-full bg-butter-100 px-3 py-1.5 text-xs font-medium text-butter-700 ${className}`}
    >
      <Sparkles size={13} />
      지금 보이는 기록은 화면 확인용 예시 데이터예요
    </p>
  )
}

export function Avatar({ member, size = 'md' }: { member: Member; size?: 'sm' | 'md' }) {
  const color = COLOR_STYLES[member.color]
  const sizeClass = size === 'sm' ? 'h-7 w-7 text-[11px]' : 'h-9 w-9 text-sm'
  // 예시 친구는 'A', 실제 친구는 닉네임 첫 글자
  const initial = member.isMe ? '나' : Array.from(member.name.replace('친구 ', ''))[0]
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-semibold ring-2 ring-white ${color.medium} ${color.text} ${sizeClass}`}
      title={member.name}
    >
      {initial}
    </span>
  )
}

export function AvatarStack({ members, size = 'sm' }: { members: Member[]; size?: 'sm' | 'md' }) {
  return (
    <div className="flex -space-x-2">
      {members.map((m) => (
        <Avatar key={m.id} member={m} size={size} />
      ))}
    </div>
  )
}

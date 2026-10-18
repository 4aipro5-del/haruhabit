import type { ColorKey, IconKey } from '../../types'
import { COLOR_STYLES } from '../../lib/colors'
import { CALENDAR_ICONS } from '../../lib/icons'

interface CalendarIconProps {
  icon: IconKey
  color: ColorKey
  size?: 'sm' | 'md' | 'lg'
}

export function CalendarIcon({ icon, color, size = 'md' }: CalendarIconProps) {
  const Icon = CALENDAR_ICONS[icon].icon
  const c = COLOR_STYLES[color]
  const box = { sm: 'h-8 w-8 rounded-xl', md: 'h-11 w-11 rounded-2xl', lg: 'h-14 w-14 rounded-2xl' }[size]
  const iconSize = { sm: 16, md: 21, lg: 26 }[size]
  return (
    <span className={`inline-flex shrink-0 items-center justify-center ${box} ${c.medium} ${c.text}`}>
      <Icon size={iconSize} strokeWidth={2} />
    </span>
  )
}

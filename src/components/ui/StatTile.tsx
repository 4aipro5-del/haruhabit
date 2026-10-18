import type { ReactNode } from 'react'
import type { ColorKey } from '../../types'
import { COLOR_STYLES } from '../../lib/colors'

interface StatTileProps {
  label: string
  value: ReactNode
  sub?: ReactNode
  icon: ReactNode
  color: ColorKey
}

export function StatTile({ label, value, sub, icon, color }: StatTileProps) {
  const c = COLOR_STYLES[color]
  return (
    <div className={`rounded-3xl p-4 sm:p-5 ${c.tint} ring-1 ring-inset ${c.ringSoft}`}>
      {/* 아이콘·제목은 왼쪽, 큰 숫자는 오른쪽에 한 줄로 */}
      <div className="flex items-center gap-3">
        <div className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${c.soft} ${c.text}`}>{icon}</div>
        <p className="min-w-0 flex-1 text-base font-medium text-ink-500">{label}</p>
        <p className="shrink-0 text-2xl font-bold tracking-tight text-ink-900">{value}</p>
      </div>
      {sub && <div className="mt-2 text-base text-ink-500">{sub}</div>}
    </div>
  )
}

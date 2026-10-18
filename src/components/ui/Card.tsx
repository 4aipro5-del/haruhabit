import type { ReactNode } from 'react'

interface CardProps {
  children: ReactNode
  className?: string
  as?: 'section' | 'div' | 'article'
  /** 흰 배경 대신 쓸 연한 배경색 클래스 (예: COLOR_STYLES.leaf.tint) */
  tint?: string
}

export function Card({ children, className = '', as: Tag = 'section', tint }: CardProps) {
  const surface = tint ?? 'bg-white/80 ring-1 ring-cream-200'
  return <Tag className={`rounded-3xl p-5 shadow-soft sm:p-6 ${surface} ${className}`}>{children}</Tag>
}

interface CardTitleProps {
  children: ReactNode
  icon?: ReactNode
  aside?: ReactNode
  /** 제목 크기: 기본 16px, lg 18px, xl 20px */
  size?: 'base' | 'lg' | 'xl'
  /** size="xl"과 같음 */
  large?: boolean
}

const TITLE_SIZE = { base: 'text-base', lg: 'text-lg', xl: 'text-xl' }

export function CardTitle({ children, icon, aside, size = 'base', large }: CardTitleProps) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <h2 className={`flex items-center gap-2 font-semibold text-ink-900 ${TITLE_SIZE[large ? 'xl' : size]}`}>
        {icon && <span className="text-ink-500">{icon}</span>}
        {children}
      </h2>
      {aside}
    </div>
  )
}

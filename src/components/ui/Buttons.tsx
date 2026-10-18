import type { ReactNode } from 'react'

const BASE =
  'inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-semibold transition-colors'

interface LinkButtonProps {
  href: string
  children: ReactNode
  variant?: 'primary' | 'soft' | 'ghost'
  className?: string
  onClick?: () => void
}

const VARIANTS = {
  primary: 'bg-ink-900 text-cream-50 hover:bg-ink-700',
  soft: 'bg-white text-ink-900 ring-1 ring-cream-300 hover:bg-cream-50',
  ghost: 'text-ink-700 hover:bg-cream-200',
}

export function LinkButton({ href, children, variant = 'primary', className = '', onClick }: LinkButtonProps) {
  return (
    <a href={href} onClick={onClick} className={`${BASE} ${VARIANTS[variant]} ${className}`}>
      {children}
    </a>
  )
}

/** 아직 구현하지 않은 기능 버튼. 누를 수 없고 '준비 중' 표시가 붙습니다. */
export function ComingSoonButton({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <button
      type="button"
      disabled
      title="다음 단계에서 구현 예정"
      className={`${BASE} cursor-not-allowed bg-cream-200 text-ink-400 ${className}`}
    >
      {children}
      <span className="rounded-full bg-white/70 px-2 py-0.5 text-[11px] font-medium text-ink-500">준비 중</span>
    </button>
  )
}

export function ComingSoonNote({ children }: { children: ReactNode }) {
  return <p className="text-xs text-ink-500">{children}</p>
}

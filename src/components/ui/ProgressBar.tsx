interface ProgressBarProps {
  /** 0 ~ 1 (1을 넘어도 막대는 가득 찬 상태로 표시) */
  value: number
  barClassName: string
  size?: 'sm' | 'md' | 'lg'
  label?: string
}

const HEIGHT = { sm: 'h-2', md: 'h-3', lg: 'h-6 sm:h-7' }

export function ProgressBar({ value, barClassName, size = 'md', label }: ProgressBarProps) {
  const percent = Math.max(0, Math.min(value, 1)) * 100
  return (
    <div
      className={`w-full overflow-hidden rounded-full bg-cream-200 ${HEIGHT[size]}`}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(value * 100)}
      aria-label={label}
    >
      <div className={`h-full rounded-full ${barClassName}`} style={{ width: `${percent}%` }} />
    </div>
  )
}

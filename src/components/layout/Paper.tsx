import type { ReactNode } from 'react'

/** 다이어리 한 장. 아이보리 모눈종이 + 왼쪽 스프링(PC에서만) */
export function Paper({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`paper-grid relative min-h-full rounded-2xl border border-line ${className}`}>
      <div className="pointer-events-none absolute -left-2.5 bottom-10 top-10 hidden flex-col justify-between lg:flex" aria-hidden="true">
        {Array.from({ length: 16 }, (_, i) => (
          <span key={i} className="block h-[7px] w-6 rounded-full border border-[#cfc8ba] bg-[#ece7dd]" />
        ))}
      </div>
      {children}
    </div>
  )
}

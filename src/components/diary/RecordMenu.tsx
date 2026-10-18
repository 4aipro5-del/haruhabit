import { useEffect, useRef, useState } from 'react'
import { MoreHorizontal } from 'lucide-react'

/** 기록 오른쪽의 작은 ··· 메뉴 (수정 / 삭제) */
export function RecordMenu({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const choose = (action: () => void) => {
    setOpen(false)
    action()
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="기록 메뉴"
        aria-expanded={open}
        className="flex h-8 w-8 items-center justify-center rounded-full text-ink-500 hover:bg-line/60 hover:text-ink-900"
      >
        <MoreHorizontal size={18} strokeWidth={1.6} />
      </button>
      {open && (
        <div className="absolute right-0 top-9 z-10 w-24 overflow-hidden rounded-xl border border-line bg-paper py-1 text-sm" role="menu">
          <button type="button" role="menuitem" onClick={() => choose(onEdit)} className="block w-full px-4 py-2 text-left hover:bg-line/50">
            수정
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => choose(onDelete)}
            className="block w-full px-4 py-2 text-left text-sun hover:bg-line/50"
          >
            삭제
          </button>
        </div>
      )}
    </div>
  )
}

import type { CalendarType, ColorKey } from '../types'

// Tailwind는 완성된 클래스 이름만 인식하므로 문자열을 그대로 적어 둡니다.
export const COLOR_STYLES: Record<
  ColorKey,
  {
    label: string
    tint: string
    soft: string
    medium: string
    strong: string
    /** 달력 점, 사이드바 점 */
    dot: string
    text: string
    border: string
    ringSoft: string
    ring: string
  }
> = {
  leaf: {
    label: '연초록',
    tint: 'bg-leaf-50',
    soft: 'bg-leaf-100',
    medium: 'bg-leaf-200',
    strong: 'bg-leaf-400',
    dot: 'bg-leaf-500',
    text: 'text-leaf-700',
    border: 'border-leaf-200',
    ringSoft: 'ring-leaf-200',
    ring: 'ring-leaf-400',
  },
  sky: {
    label: '연하늘',
    tint: 'bg-sky-50',
    soft: 'bg-sky-100',
    medium: 'bg-sky-200',
    strong: 'bg-sky-400',
    dot: 'bg-sky-500',
    text: 'text-sky-700',
    border: 'border-sky-200',
    ringSoft: 'ring-sky-200',
    ring: 'ring-sky-400',
  },
  butter: {
    label: '연노랑',
    tint: 'bg-butter-50',
    soft: 'bg-butter-100',
    medium: 'bg-butter-200',
    strong: 'bg-butter-400',
    dot: 'bg-butter-500',
    text: 'text-butter-700',
    border: 'border-butter-200',
    ringSoft: 'ring-butter-200',
    ring: 'ring-butter-400',
  },
  lilac: {
    label: '연보라',
    tint: 'bg-lilac-50',
    soft: 'bg-lilac-100',
    medium: 'bg-lilac-200',
    strong: 'bg-lilac-400',
    dot: 'bg-lilac-500',
    text: 'text-lilac-700',
    border: 'border-lilac-200',
    ringSoft: 'ring-lilac-200',
    ring: 'ring-lilac-400',
  },
  peach: {
    label: '연살구',
    tint: 'bg-peach-50',
    soft: 'bg-peach-100',
    medium: 'bg-peach-200',
    strong: 'bg-peach-400',
    dot: 'bg-peach-500',
    text: 'text-peach-700',
    border: 'border-peach-200',
    ringSoft: 'ring-peach-200',
    ring: 'ring-peach-400',
  },
  mint: {
    label: '민트',
    tint: 'bg-mint-50',
    soft: 'bg-mint-100',
    medium: 'bg-mint-200',
    strong: 'bg-mint-400',
    dot: 'bg-mint-500',
    text: 'text-mint-700',
    border: 'border-mint-200',
    ringSoft: 'ring-mint-200',
    ring: 'ring-mint-400',
  },
  rose: {
    label: '분홍',
    tint: 'bg-rose-50',
    soft: 'bg-rose-100',
    medium: 'bg-rose-200',
    strong: 'bg-rose-400',
    dot: 'bg-rose-500',
    text: 'text-rose-700',
    border: 'border-rose-200',
    ringSoft: 'ring-rose-200',
    ring: 'ring-rose-400',
  },
  sand: {
    label: '모래',
    tint: 'bg-sand-50',
    soft: 'bg-sand-100',
    medium: 'bg-sand-200',
    strong: 'bg-sand-400',
    dot: 'bg-sand-500',
    text: 'text-sand-700',
    border: 'border-sand-200',
    ringSoft: 'ring-sand-200',
    ring: 'ring-sand-400',
  },
  olive: {
    label: '올리브',
    tint: 'bg-olive-50',
    soft: 'bg-olive-100',
    medium: 'bg-olive-200',
    strong: 'bg-olive-400',
    dot: 'bg-olive-500',
    text: 'text-olive-700',
    border: 'border-olive-200',
    ringSoft: 'ring-olive-200',
    ring: 'ring-olive-400',
  },
  slate: {
    label: '회색',
    tint: 'bg-slate-50',
    soft: 'bg-slate-100',
    medium: 'bg-slate-200',
    strong: 'bg-slate-400',
    dot: 'bg-slate-500',
    text: 'text-slate-700',
    border: 'border-slate-200',
    ringSoft: 'ring-slate-200',
    ring: 'ring-slate-400',
  },
}

export const COLOR_OPTIONS: ColorKey[] = ['leaf', 'mint', 'olive', 'sky', 'slate', 'butter', 'sand', 'peach', 'rose', 'lilac']

export const TYPE_COLOR: Record<CalendarType, ColorKey> = {
  personal: 'leaf',
  shared: 'sky',
  competition: 'lilac',
}

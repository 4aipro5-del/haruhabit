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
}

export const COLOR_OPTIONS: ColorKey[] = ['leaf', 'sky', 'butter', 'lilac', 'peach']

export const TYPE_COLOR: Record<CalendarType, ColorKey> = {
  personal: 'leaf',
  shared: 'sky',
  competition: 'lilac',
}

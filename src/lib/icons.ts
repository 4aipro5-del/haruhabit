import {
  Bike,
  BookOpen,
  Brain,
  Coffee,
  Dumbbell,
  Footprints,
  Heart,
  Music,
  PencilLine,
  Sprout,
  Trophy,
  User,
  Users,
  type LucideIcon,
} from 'lucide-react'
import type { CalendarType, IconKey } from '../types'

export const CALENDAR_ICONS: Record<IconKey, { icon: LucideIcon; label: string }> = {
  dumbbell: { icon: Dumbbell, label: '운동' },
  running: { icon: Footprints, label: '걷기·달리기' },
  pencil: { icon: PencilLine, label: '공부' },
  book: { icon: BookOpen, label: '독서' },
  brain: { icon: Brain, label: '집중' },
  heart: { icon: Heart, label: '건강' },
  sprout: { icon: Sprout, label: '성장' },
  music: { icon: Music, label: '음악' },
  coffee: { icon: Coffee, label: '생활' },
  bike: { icon: Bike, label: '자전거' },
}

export const ICON_OPTIONS = Object.keys(CALENDAR_ICONS) as IconKey[]

export const TYPE_META: Record<
  CalendarType,
  { label: string; short: string; description: string; icon: LucideIcon }
> = {
  personal: {
    label: '개인',
    short: '개인',
    description: '나 혼자 기록하고 통계를 확인해요',
    icon: User,
  },
  shared: {
    label: '공동 목표',
    short: '공동 목표',
    description: '친구들과 기록을 합쳐 하나의 목표를 채워요',
    icon: Users,
  },
  competition: {
    label: '개인 경쟁',
    short: '개인 경쟁',
    description: '각자 같은 목표에 도전하고 순위를 겨뤄요',
    icon: Trophy,
  },
}

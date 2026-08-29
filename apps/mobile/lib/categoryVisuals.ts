import { Sparkle, Lightning, Drop, Snowflake, Palette, Laptop, Wrench, Icon } from 'phosphor-react-native'

export interface CategoryVisual {
  id: string
  icon: Icon
  lottie?: string
  gradient: [string, string]
}

export const CATEGORY_VISUALS: CategoryVisual[] = [
  {
    id: 'cleaning',
    icon: Sparkle,
    lottie: 'https://assets5.lottiefiles.com/packages/lf20_4kx2q32n.json',
    gradient: ['#0EA5E9', '#1D4ED8'],
  },
  {
    id: 'electrical',
    icon: Lightning,
    gradient: ['#F59E0B', '#EA580C'],
  },
  {
    id: 'plumbing',
    icon: Drop,
    lottie: 'https://assets2.lottiefiles.com/packages/lf20_jcikwtux.json',
    gradient: ['#06B6D4', '#0E7490'],
  },
  {
    id: 'ac',
    icon: Snowflake,
    gradient: ['#6366F1', '#4338CA'],
  },
  {
    id: 'painting',
    icon: Palette,
    lottie: 'https://assets4.lottiefiles.com/packages/lf20_ystsffqy.json',
    gradient: ['#EC4899', '#A21CAF'],
  },
  {
    id: 'general',
    icon: Wrench,
    lottie: 'https://assets6.lottiefiles.com/packages/lf20_myejiggj.json',
    gradient: ['#10B981', '#047857'],
  },
]

export const CATEGORY_ICON_FALLBACK: Record<string, Icon> = {
  cleaning: Sparkle,
  electrical: Lightning,
  plumbing: Drop,
  ac: Snowflake,
  painting: Palette,
  digital: Laptop,
  general: Wrench,
}

export function categoryIcon(id?: string | null): Icon {
  return (id ? CATEGORY_ICON_FALLBACK[id] : undefined) || Wrench
}
export interface SeasonalOfferJob {
  templateJob: {
    id: string
    name: string
    description: string | null
    priceMin: number | null
    priceMax: number | null
    currency: string
  }
}

export interface SeasonalOffer {
  id: string
  title: string
  description: string | null
  slug: string
  season: string
  country: string
  image: string | null
  badgeText: string | null
  bgColor: string | null
  textColor: string | null
  displayOrder: number
  isActive: boolean
  jobs: SeasonalOfferJob[]
}

export const SEASON_EMOJI: Record<string, string> = {
  winter: '❄️',
  spring: '🌸',
  summer: '☀️',
  fall: '🍂',
  general: '🏠',
}

export function getCurrentSeason(): string {
  const month = new Date().getMonth()
  if (month >= 2 && month <= 4) return 'spring'
  if (month >= 5 && month <= 7) return 'summer'
  if (month >= 8 && month <= 10) return 'fall'
  return 'winter'
}

export function getSeasonEmoji(season: string): string {
  return SEASON_EMOJI[season] || '📅'
}

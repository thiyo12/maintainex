export interface SeasonalOffer {
  id: string
  title: string
  description?: string | null
  season?: string | null
  country?: string | null
  image?: string | null
  badge?: string | null
  price?: number | null
  priceMin?: number | null
  priceMax?: number | null
  currency?: string | null
  serviceId?: string | null
  categoryId?: string | null
  isActive?: boolean
  [key: string]: unknown
}

export function getCurrentSeason(): string {
  const month = new Date().getMonth()
  if (month >= 2 && month <= 4) return 'spring'
  if (month >= 5 && month <= 7) return 'summer'
  if (month >= 8 && month <= 10) return 'fall'
  return 'winter'
}

export const SEASON_EMOJI: Record<string, string> = {
  winter: '❄️', spring: '🌸', summer: '☀️', fall: '🍂', general: '🏠',
}

export function getSeasonEmoji(season: string): string {
  return SEASON_EMOJI[season] || '📅'
}

const SEASON_COLORS: Record<string, { bg: string; text: string }> = {
  winter: { bg: '#3B82F6', text: '#FFFFFF' },
  spring: { bg: '#F59E0B', text: '#FFFFFF' },
  summer: { bg: '#EF4444', text: '#FFFFFF' },
  fall: { bg: '#D97706', text: '#FFFFFF' },
  general: { bg: '#8B5CF6', text: '#FFFFFF' },
}

export function getSeasonColors(season: string) {
  return SEASON_COLORS[season] || SEASON_COLORS.general
}

const SEASONAL_SERVICE_NAMES: Record<string, Record<string, string[]>> = {
  CA: {
    summer: ['AC Repair', 'AC Installation', 'Landscaping', 'Lawn Mowing', 'Pool Cleaning', 'Deck Building', 'Fence Installation', 'Car AC Service'],
    winter: ['Snow Removal', 'Ice Removal', 'Furnace Repair', 'Heating Service', 'Frozen Pipe Repair', 'Winter Tire Change', 'Battery Boost'],
    spring: ['Spring Cleaning', 'Lawn Cleanup', 'Gutter Cleaning', 'Window Cleaning', 'Pressure Washing', 'Garden Preparation', 'Landscaping'],
    fall: ['Leaf Removal', 'Gutter Cleaning', 'Furnace Tune-Up', 'Chimney Cleaning', 'Roof Repair', 'Winter Preparation'],
  },
  LK: {
    summer: ['AC Service', 'AC Repair', 'Deep Cleaning', 'Water Tank Cleaning', 'Mosquito Control', 'Garden Maintenance', 'Plumbing Repair'],
    winter: ['AC Service', 'Heating Service', 'Plumbing Repair', 'Electrical Repair'],
    spring: ['Deep Cleaning', 'Garden Maintenance', 'Painting Service', 'Pressure Washing', 'Window Cleaning'],
    fall: ['Roof Leak Repair', 'Gutter Cleaning', 'Water Tank Cleaning', 'Painting Service'],
    general: ['Deep Cleaning', 'AC Service', 'Roof Leak Repair', 'Water Tank Cleaning', 'Mosquito Control', 'Garden Maintenance', 'Plumbing Repair', 'Electrical Repair', 'Painting Service'],
  },
}

export function getSeasonalServiceNames(country: string, season: string): string[] {
  const countryData = SEASONAL_SERVICE_NAMES[country]
  if (!countryData) return SEASONAL_SERVICE_NAMES.LK.general
  return countryData[season] || countryData.general || []
}

export function getSeasonalTitle(country: string, season: string): string {
  const titles: Record<string, Record<string, string>> = {
    CA: {
      summer: 'Summer Cooling & Care',
      winter: 'Winter Services',
      spring: 'Spring Clean & Repair',
      fall: 'Fall Preparation',
    },
    LK: {
      general: 'Special Offers',
    },
  }
  return titles[country]?.[season] || titles.LK.general
}

export function getSeasonalDescription(country: string, season: string): string {
  const descs: Record<string, Record<string, string>> = {
    CA: {
      summer: 'Stay cool with professional summer services',
      winter: 'Beat the cold with our winter maintenance services',
      spring: 'Refresh your home for spring',
      fall: 'Get your home ready for colder months',
    },
    LK: {
      general: 'Popular home services at great prices',
    },
  }
  return descs[country]?.[season] || descs.LK.general
}

export function getSeasonBadge(season: string): string {
  const badges: Record<string, string> = {
    summer: 'HOT',
    winter: 'COLD',
    spring: 'FRESH',
    fall: 'COZY',
    general: 'OFFER',
  }
  return badges[season] || 'OFFER'
}

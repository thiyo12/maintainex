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

export function getCurrentSeason(countryCode = 'LK', date = new Date()): string {
  const month = date.getMonth() + 1
  const country = countryCode.toUpperCase()

  if (country === 'LK') {
    if (month >= 5 && month <= 9) return 'southwest_monsoon'
    if (month >= 10 && month <= 11) return 'second_intermonsoon'
    if (month === 12 || month <= 2) return 'northeast_monsoon'
    return 'first_intermonsoon'
  }

  if (month >= 3 && month <= 5) return 'spring'
  if (month >= 6 && month <= 8) return 'summer'
  if (month >= 9 && month <= 11) return 'fall'
  return 'winter'
}

export const SEASON_EMOJI: Record<string, string> = {
  winter: '❄️',
  spring: '🌸',
  summer: '☀️',
  fall: '🍂',
  southwest_monsoon: '🌧️',
  second_intermonsoon: '⛈️',
  northeast_monsoon: '🌦️',
  first_intermonsoon: '🌤️',
  general: '🏠',
}

export function getSeasonEmoji(season: string): string {
  return SEASON_EMOJI[season] || '📅'
}

const SEASON_COLORS: Record<string, { bg: string; text: string }> = {
  winter: { bg: '#3B82F6', text: '#FFFFFF' },
  spring: { bg: '#16A34A', text: '#FFFFFF' },
  summer: { bg: '#F59E0B', text: '#111827' },
  fall: { bg: '#D97706', text: '#FFFFFF' },
  southwest_monsoon: { bg: '#2563EB', text: '#FFFFFF' },
  second_intermonsoon: { bg: '#4F46E5', text: '#FFFFFF' },
  northeast_monsoon: { bg: '#0F766E', text: '#FFFFFF' },
  first_intermonsoon: { bg: '#0891B2', text: '#FFFFFF' },
  general: { bg: '#8B5CF6', text: '#FFFFFF' },
}

export function getSeasonColors(season: string) {
  return SEASON_COLORS[season] || SEASON_COLORS.general
}

const SEASONAL_SERVICE_NAMES: Record<string, Record<string, string[]>> = {
  CA: {
    summer: [
      'AC installation',
      'AC servicing and cleaning',
      'Garden maintenance',
      'Lawn mowing and care',
      'Deck and porch building',
      'Window cleaning',
    ],
    winter: [
      'Snow removal',
      'Sidewalk salting and de-icing',
      'Pipe insulation and winterization',
      'Frozen pipe repair',
      'Ice dam removal',
      'Winter roof and gutter preparation',
      'Window and door winterization',
      'AC winterization',
    ],
    spring: [
      'Home deep cleaning',
      'Garden maintenance',
      'Gutter cleaning and repair',
      'Window cleaning',
      'Exterior house painting',
    ],
    fall: [
      'Gutter cleaning and repair',
      'Roof inspection and maintenance',
      'Window and door winterization',
      'Pipe insulation and winterization',
      'AC winterization',
    ],
  },
  LK: {
    southwest_monsoon: [
      'Roof leak repair',
      'Gutter cleaning and repair',
      'Drain unblocking',
      'Waterproof coating application',
      'Bathroom waterproofing',
      'Water pump repair',
      'Mosquito control',
    ],
    second_intermonsoon: [
      'Roof leak repair',
      'Gutter cleaning and repair',
      'Drain unblocking',
      'Waterproof coating application',
      'General pest control treatment',
      'Home deep cleaning',
    ],
    northeast_monsoon: [
      'Roof leak repair',
      'Drain unblocking',
      'Water pump repair',
      'Gutter cleaning and repair',
      'Electrical repair',
      'Home deep cleaning',
    ],
    first_intermonsoon: [
      'AC servicing and cleaning',
      'AC not cooling repair',
      'Mosquito control',
      'Garden maintenance',
      'Water tank installation',
      'Solar maintenance and cleaning',
    ],
    general: [
      'Home deep cleaning',
      'AC servicing and cleaning',
      'Roof leak repair',
      'Mosquito control',
      'Garden maintenance',
      'Drain unblocking',
    ],
  },
}

export function getSeasonalServiceNames(country: string, season: string): string[] {
  const countryData = SEASONAL_SERVICE_NAMES[country.toUpperCase()]
  if (!countryData) return SEASONAL_SERVICE_NAMES.LK.general
  return countryData[season] || countryData.general || []
}

export function getSeasonalTitle(country: string, season: string): string {
  const titles: Record<string, Record<string, string>> = {
    CA: {
      summer: 'Summer Home Care',
      winter: 'Winter Services',
      spring: 'Spring Clean & Repair',
      fall: 'Fall Winter-Prep',
    },
    LK: {
      southwest_monsoon: 'Southwest Monsoon Care',
      second_intermonsoon: 'Inter-Monsoon Home Care',
      northeast_monsoon: 'Northeast Monsoon Care',
      first_intermonsoon: 'Hot-Season Home Care',
      general: 'Popular Home Services',
    },
  }
  return titles[country.toUpperCase()]?.[season] || titles.LK.general
}

export function getSeasonalDescription(country: string, season: string): string {
  const descriptions: Record<string, Record<string, string>> = {
    CA: {
      summer: 'Cooling, yard and outdoor services for warmer months',
      winter: 'Snow, ice, pipe and winterization services',
      spring: 'Refresh and repair after winter',
      fall: 'Prepare your home before colder weather',
    },
    LK: {
      southwest_monsoon: 'Leak, drainage, waterproofing and mosquito-prevention services',
      second_intermonsoon: 'Storm, drainage and home-protection services',
      northeast_monsoon: 'Rain-ready repairs and home maintenance',
      first_intermonsoon: 'Cooling, garden and mosquito-control services',
      general: 'Popular services selected for Sri Lankan homes',
    },
  }
  return descriptions[country.toUpperCase()]?.[season] || descriptions.LK.general
}

export function getSeasonBadge(season: string): string {
  const badges: Record<string, string> = {
    summer: 'SUMMER',
    winter: 'WINTER',
    spring: 'SPRING',
    fall: 'FALL',
    southwest_monsoon: 'MONSOON',
    second_intermonsoon: 'RAIN READY',
    northeast_monsoon: 'MONSOON',
    first_intermonsoon: 'SEASONAL',
    general: 'POPULAR',
  }
  return badges[season] || 'SEASONAL'
}

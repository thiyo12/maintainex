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

export function getCurrentSeason(country = 'CA'): string {
  const month = new Date().getMonth() + 1
  const code = country.toUpperCase()

  if (code === 'LK') {
    if (month >= 3 && month <= 4) return 'hot_dry'
    if (month >= 5 && month <= 9) return 'southwest_monsoon'
    if (month >= 10 && month <= 11) return 'inter_monsoon'
    return 'northeast_monsoon'
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
  hot_dry: '☀️',
  southwest_monsoon: '🌧️',
  inter_monsoon: '⛈️',
  northeast_monsoon: '🌦️',
  general: '🏠',
}

export function getSeasonEmoji(season: string): string {
  return SEASON_EMOJI[season] || '📅'
}

const SEASON_COLORS: Record<string, { bg: string; text: string }> = {
  winter: { bg: '#3B82F6', text: '#FFFFFF' },
  spring: { bg: '#F59E0B', text: '#FFFFFF' },
  summer: { bg: '#EF4444', text: '#FFFFFF' },
  fall: { bg: '#D97706', text: '#FFFFFF' },
  hot_dry: { bg: '#F59E0B', text: '#FFFFFF' },
  southwest_monsoon: { bg: '#2563EB', text: '#FFFFFF' },
  inter_monsoon: { bg: '#4F46E5', text: '#FFFFFF' },
  northeast_monsoon: { bg: '#0EA5E9', text: '#FFFFFF' },
  general: { bg: '#8B5CF6', text: '#FFFFFF' },
  southwest_monsoon: { bg: '#2563EB', text: '#FFFFFF' },
  northeast_monsoon: { bg: '#1D4ED8', text: '#FFFFFF' },
  inter_monsoon: { bg: '#475569', text: '#FFFFFF' },
  dry: { bg: '#F59E0B', text: '#111111' },
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
    hot_dry: ['AC Service', 'AC Repair', 'Water Tank Cleaning', 'Garden Maintenance', 'Roof Heat Proofing', 'Electrical Repair'],
    southwest_monsoon: ['Roof Leak Repair', 'Waterproofing', 'Drain Cleaning', 'Gutter Cleaning', 'Plumbing Repair', 'Mould Cleaning'],
    inter_monsoon: ['Roof Leak Repair', 'Drain Cleaning', 'Waterproofing', 'Tree Trimming', 'Electrical Repair', 'Pest Control'],
    northeast_monsoon: ['Roof Leak Repair', 'Drain Cleaning', 'Waterproofing', 'Water Pump Repair', 'Electrical Repair', 'Deep Cleaning'],
    general: ['Deep Cleaning', 'AC Service', 'Roof Leak Repair', 'Water Tank Cleaning', 'Mosquito Control', 'Garden Maintenance', 'Plumbing Repair', 'Electrical Repair', 'Painting Service'],
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
      summer: 'Summer Cooling & Care',
      winter: 'Winter Services',
      spring: 'Spring Clean & Repair',
      fall: 'Fall Preparation',
    },
    LK: {
      hot_dry: 'Hot Weather Home Care',
      southwest_monsoon: 'Monsoon Protection',
      inter_monsoon: 'Heavy Rain Readiness',
      northeast_monsoon: 'Rain & Home Protection',
      general: 'Popular Services',
    },
  }
  const code = country.toUpperCase()
  return titles[code]?.[season] || titles[code]?.general || titles.LK.general
}

export function getSeasonalDescription(country: string, season: string): string {
  const descriptions: Record<string, Record<string, string>> = {
    CA: {
      summer: 'Stay cool with professional summer services',
      winter: 'Snow, heating and cold-weather maintenance',
      spring: 'Refresh your home after winter',
      fall: 'Prepare your property for colder months',
    },
    LK: {
      hot_dry: 'Cooling, water and outdoor maintenance for hotter months',
      southwest_monsoon: 'Leak, drainage and waterproofing services for monsoon rain',
      inter_monsoon: 'Prepare drainage, roofs and outdoor areas for heavy showers',
      northeast_monsoon: 'Rain protection and essential home maintenance',
      general: 'Popular services matched to your region',
    },
  }
  const code = country.toUpperCase()
  return descriptions[code]?.[season] || descriptions[code]?.general || descriptions.LK.general
}

export function getSeasonBadge(season: string): string {
  const badges: Record<string, string> = {
    summer: 'SUMMER',
    winter: 'WINTER',
    spring: 'SPRING',
    fall: 'FALL',
    hot_dry: 'HOT',
    southwest_monsoon: 'MONSOON',
    inter_monsoon: 'RAIN',
    northeast_monsoon: 'MONSOON',
    general: 'POPULAR',
  }
  return badges[season] || 'OFFER'
}

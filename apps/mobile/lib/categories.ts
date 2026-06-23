export interface Category {
  id: string
  name: string
  i18nKey: string
  icon: string
  synonyms: string[]
  isRemote: boolean
  color: string
}

export const categories: Category[] = [
  {
    id: 'plumbing',
    name: 'Plumbing',
    i18nKey: 'categories.plumbing',
    icon: 'water',
    synonyms: ['plumber', 'pipe', 'faucet', 'leak', 'drain', 'toilet', 'water heater', 'sink', 'tap'],
    isRemote: false,
    color: '#2563EB',
  },
  {
    id: 'electrical',
    name: 'Electrical',
    i18nKey: 'categories.electrical',
    icon: 'flash',
    synonyms: ['electrician', 'wiring', 'switch', 'outlet', 'circuit', 'breaker', 'fan', 'light', 'power'],
    isRemote: false,
    color: '#D97706',
  },
  {
    id: 'cleaning',
    name: 'Cleaning',
    i18nKey: 'categories.cleaning',
    icon: 'sparkles',
    synonyms: ['cleaner', 'housekeeping', 'maid', 'janitor', 'sanitize', 'disinfect', 'scrub', 'wash'],
    isRemote: false,
    color: '#059669',
  },
  {
    id: 'carpentry',
    name: 'Carpentry',
    i18nKey: 'categories.carpentry',
    icon: 'hammer',
    synonyms: ['carpenter', 'wood', 'furniture', 'cabinet', 'shelf', 'door', 'flooring', 'deck', 'trim'],
    isRemote: false,
    color: '#92400E',
  },
  {
    id: 'painting',
    name: 'Painting',
    i18nKey: 'categories.painting',
    icon: 'color-palette',
    synonyms: ['painter', 'paint', 'wall', 'color', 'coating', 'spray', 'brush', 'roller', 'finish'],
    isRemote: false,
    color: '#7C3AED',
  },
  {
    id: 'hvac',
    name: 'HVAC',
    i18nKey: 'categories.hvac',
    icon: 'thermometer',
    synonyms: ['ac', 'air conditioner', 'heating', 'ventilation', 'cooling', 'furnace', 'duct', 'thermostat'],
    isRemote: false,
    color: '#0891B2',
  },
  {
    id: 'gardening',
    name: 'Gardening',
    i18nKey: 'categories.gardening',
    icon: 'leaf',
    synonyms: ['gardener', 'lawn', 'landscaping', 'yard', 'plant', 'tree', 'garden', 'mowing', 'pruning'],
    isRemote: false,
    color: '#16A34A',
  },
  {
    id: 'moving',
    name: 'Moving & Delivery',
    i18nKey: 'categories.moving',
    icon: 'car',
    synonyms: ['mover', 'delivery', 'transport', 'shifting', 'relocation', 'truck', 'haul', 'pickup'],
    isRemote: false,
    color: '#DC2626',
  },
  {
    id: 'tutoring',
    name: 'Tutoring',
    i18nKey: 'categories.tutoring',
    icon: 'school',
    synonyms: ['tutor', 'teacher', 'lesson', 'coaching', 'class', 'education', 'math', 'english', 'science'],
    isRemote: true,
    color: '#6D28D9',
  },
  {
    id: 'it-support',
    name: 'IT Support',
    i18nKey: 'categories.itSupport',
    icon: 'desktop',
    synonyms: ['computer', 'tech support', 'software', 'hardware', 'network', 'printer', 'virus', 'repair'],
    isRemote: true,
    color: '#0F766E',
  },
  {
    id: 'photography',
    name: 'Photography',
    i18nKey: 'categories.photography',
    icon: 'camera',
    synonyms: ['photographer', 'photo', 'videography', 'video', 'shoot', 'event', 'wedding', 'portrait'],
    isRemote: true,
    color: '#A21CAF',
  },
  {
    id: 'event',
    name: 'Event Services',
    i18nKey: 'categories.event',
    icon: 'musical-notes',
    synonyms: ['event planner', 'catering', 'decoration', 'dj', 'party', 'wedding', 'venue', 'entertainment'],
    isRemote: false,
    color: '#E11D48',
  },
  {
    id: 'realestate',
    name: 'Real Estate',
    i18nKey: 'categories.realestate',
    icon: 'home',
    synonyms: ['real estate', 'property', 'apartment', 'house', 'land', 'commercial', 'rent', 'sale', 'buy'],
    isRemote: false,
    color: '#10B981',
  },
  {
    id: 'other',
    name: 'Other',
    i18nKey: 'categories.other',
    icon: 'construct',
    synonyms: ['handyman', 'general', 'misc', 'odd jobs', 'repair', 'fix', 'service', 'help'],
    isRemote: false,
    color: '#6B7280',
  },
]

export function getCategoryById(id: string): Category | undefined {
  return categories.find(c => c.id === id)
}

export function getCategoryByName(name: string): Category | undefined {
  const lower = name.toLowerCase()
  return categories.find(c => c.name.toLowerCase() === lower || c.synonyms.some(s => s.toLowerCase() === lower))
}

export const CATEGORY_IMAGE_URLS: Record<string, string> = {
  plumbing: 'https://maintainex.lk/images/categories/plumbing.jpg',
  electrical: 'https://maintainex.lk/images/categories/electrical.jpg',
  cleaning: 'https://maintainex.lk/images/categories/cleaning.jpg',
  carpentry: 'https://maintainex.lk/images/categories/carpentry.jpg',
  painting: 'https://maintainex.lk/images/categories/painting.jpg',
  hvac: 'https://maintainex.lk/images/categories/hvac.jpg',
  gardening: 'https://maintainex.lk/images/categories/gardening.jpg',
  moving: 'https://maintainex.lk/images/categories/moving.jpg',
  tutoring: 'https://maintainex.lk/images/categories/tutoring.jpg',
  'it-support': 'https://maintainex.lk/images/categories/it-support.jpg',
  photography: 'https://maintainex.lk/images/categories/photography.jpg',
  event: 'https://maintainex.lk/images/categories/event.jpg',
  realestate: 'https://maintainex.lk/images/categories/realestate.jpg',
  other: 'https://maintainex.lk/images/categories/other.jpg',
}

export function getCategoryImageUrl(categoryId?: string): string {
  if (categoryId && CATEGORY_IMAGE_URLS[categoryId]) return CATEGORY_IMAGE_URLS[categoryId]
  return CATEGORY_IMAGE_URLS.other
}

export function getCategoryI18nKey(category: { id?: string; i18nKey?: string }): string {
  if (category?.i18nKey) return category.i18nKey
  if (category?.id) return `categories.${category.id}`
  return 'categories.general'
}

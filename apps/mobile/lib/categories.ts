export interface Category {
  id: string
  name: string
  icon: string
  synonyms: string[]
  isRemote: boolean
  color: string
}

export const categories: Category[] = [
  {
    id: 'plumbing',
    name: 'Plumbing',
    icon: 'water',
    synonyms: ['plumber', 'pipe', 'faucet', 'leak', 'drain', 'toilet', 'water heater', 'sink', 'tap'],
    isRemote: false,
    color: '#2563EB',
  },
  {
    id: 'electrical',
    name: 'Electrical',
    icon: 'flash',
    synonyms: ['electrician', 'wiring', 'switch', 'outlet', 'circuit', 'breaker', 'fan', 'light', 'power'],
    isRemote: false,
    color: '#D97706',
  },
  {
    id: 'cleaning',
    name: 'Cleaning',
    icon: 'sparkles',
    synonyms: ['cleaner', 'housekeeping', 'maid', 'janitor', 'sanitize', 'disinfect', 'scrub', 'wash'],
    isRemote: false,
    color: '#059669',
  },
  {
    id: 'carpentry',
    name: 'Carpentry',
    icon: 'hammer',
    synonyms: ['carpenter', 'wood', 'furniture', 'cabinet', 'shelf', 'door', 'flooring', 'deck', 'trim'],
    isRemote: false,
    color: '#92400E',
  },
  {
    id: 'painting',
    name: 'Painting',
    icon: 'color-palette',
    synonyms: ['painter', 'paint', 'wall', 'color', 'coating', 'spray', 'brush', 'roller', 'finish'],
    isRemote: false,
    color: '#7C3AED',
  },
  {
    id: 'hvac',
    name: 'HVAC',
    icon: 'thermometer',
    synonyms: ['ac', 'air conditioner', 'heating', 'ventilation', 'cooling', 'furnace', 'duct', 'thermostat'],
    isRemote: false,
    color: '#0891B2',
  },
  {
    id: 'gardening',
    name: 'Gardening',
    icon: 'leaf',
    synonyms: ['gardener', 'lawn', 'landscaping', 'yard', 'plant', 'tree', 'garden', 'mowing', 'pruning'],
    isRemote: false,
    color: '#16A34A',
  },
  {
    id: 'moving',
    name: 'Moving & Delivery',
    icon: 'car',
    synonyms: ['mover', 'delivery', 'transport', 'shifting', 'relocation', 'truck', 'haul', 'pickup'],
    isRemote: false,
    color: '#DC2626',
  },
  {
    id: 'tutoring',
    name: 'Tutoring',
    icon: 'school',
    synonyms: ['tutor', 'teacher', 'lesson', 'coaching', 'class', 'education', 'math', 'english', 'science'],
    isRemote: true,
    color: '#6D28D9',
  },
  {
    id: 'it-support',
    name: 'IT Support',
    icon: 'desktop',
    synonyms: ['computer', 'tech support', 'software', 'hardware', 'network', 'printer', 'virus', 'repair'],
    isRemote: true,
    color: '#0F766E',
  },
  {
    id: 'photography',
    name: 'Photography',
    icon: 'camera',
    synonyms: ['photographer', 'photo', 'videography', 'video', 'shoot', 'event', 'wedding', 'portrait'],
    isRemote: true,
    color: '#A21CAF',
  },
  {
    id: 'event',
    name: 'Event Services',
    icon: 'musical-notes',
    synonyms: ['event planner', 'catering', 'decoration', 'dj', 'party', 'wedding', 'venue', 'entertainment'],
    isRemote: false,
    color: '#E11D48',
  },
  {
    id: 'other',
    name: 'Other',
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

import { Sparkle, Star, Crown, Trophy, Icon } from 'phosphor-react-native'

export type TierId = 'EXPLORER' | 'REGULAR' | 'PREMIUM' | 'ELITE'

export interface Tier {
  id: TierId
  label: string
  minJobs: number
  minSpent: number
  icon: Icon
  color: string
}

export const TIERS: Tier[] = [
  { id: 'EXPLORER', label: 'Explorer', minJobs: 0, minSpent: 0, icon: Sparkle, color: '#6B7280' },
  { id: 'REGULAR', label: 'Regular', minJobs: 3, minSpent: 0, icon: Star, color: '#10B981' },
  { id: 'PREMIUM', label: 'Premium', minJobs: 10, minSpent: 50000, icon: Crown, color: '#F59E0B' },
  { id: 'ELITE', label: 'Elite', minJobs: 25, minSpent: 150000, icon: Trophy, color: '#8B5CF6' },
]

export function getTier(completedJobs: number, totalSpent: number): TierId {
  if (completedJobs >= 25 || totalSpent >= 150000) return 'ELITE'
  if (completedJobs >= 10 || totalSpent >= 50000) return 'PREMIUM'
  if (completedJobs >= 3) return 'REGULAR'
  return 'EXPLORER'
}

export function tierById(id?: string | null): Tier {
  return TIERS.find((t) => t.id === id) || TIERS[0]
}

export function nextTier(id: TierId): Tier | null {
  const idx = TIERS.findIndex((t) => t.id === id)
  return idx >= 0 && idx < TIERS.length - 1 ? TIERS[idx + 1] : null
}

import { REGIONS, getDistricts } from './regions'
import type { Region } from './regions'

export const DISTRICTS = REGIONS.LK.districts
export const DISTRICT_LABELS: Record<string, string> = DISTRICTS.reduce((acc, district) => {
  acc[district] = district
  return acc
}, {} as Record<string, string>)

export { getDistricts }
export type { Region }

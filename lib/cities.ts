import { REGIONS, type Region } from './regions'

export function slugifyCity(name: string): string {
  return name
    .toLowerCase()
    .replace(/[()]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function getCityBySlug(slug: string, region: Region): string | null {
  const cities = REGIONS[region]?.districts || []
  return cities.find(c => slugifyCity(c) === slug) || null
}

export function getAllCitySlugs(region: Region): { slug: string; displayName: string }[] {
  return (REGIONS[region]?.districts || []).map(name => ({
    displayName: name,
    slug: slugifyCity(name),
  }))
}

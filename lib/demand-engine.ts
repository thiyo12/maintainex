import { prisma } from './prisma'

export interface DemandResult {
  categoryId: string
  countryCode: string
  areaId?: string
  cityId?: string
  demandScore: number
  supplyScore: number
  ratio: number
  level: 'low' | 'normal' | 'high' | 'surge'
  jobCount: number
  searchCount: number
  providerCount: number
}

export interface SeasonalDemandFactor {
  season: string
  categories: Record<string, number>
}

const SEASONAL_FACTORS: Record<string, Record<string, number>> = {
  winter: { gardening: 0.3, ac: 0.2, cleaning: 1.2, moving: 0.7, repairs: 1.4, renovation: 0.8 },
  spring: { gardening: 1.5, cleaning: 1.3, painting: 1.4, moving: 1.1, ac: 0.6 },
  summer: { ac: 2.0, gardening: 1.2, cleaning: 1.1, moving: 1.3, pest: 1.5, painting: 1.2 },
  fall: { repairs: 1.3, cleaning: 1.2, moving: 1.4, renovation: 1.2, gardening: 0.7, ac: 0.4 },
}

function getSeason(date: Date, countryCode: string): string {
  const month = date.getMonth()
  if (countryCode === 'LK') {
    if (month >= 2 && month <= 4) return 'spring'
    if (month >= 5 && month <= 7) return 'summer'
    if (month >= 8 && month <= 10) return 'fall'
    return 'winter'
  }
  if (month >= 2 && month <= 4) return 'spring'
  if (month >= 5 && month <= 7) return 'summer'
  if (month >= 8 && month <= 10) return 'fall'
  return 'winter'
}

function getSeasonalFactor(categoryId: string, date: Date, countryCode: string): number {
  const season = getSeason(date, countryCode)
  const factors = SEASONAL_FACTORS[season]
  if (factors && factors[categoryId]) return factors[categoryId]
  return 1.0
}

function calculateDemandLevel(ratio: number): 'low' | 'normal' | 'high' | 'surge' {
  if (ratio > 2.0) return 'surge'
  if (ratio > 1.3) return 'high'
  if (ratio < 0.5) return 'low'
  return 'normal'
}

export async function calculateDemand(
  categoryId: string,
  countryCode: string,
  areaId?: string,
  cityId?: string,
  date?: Date
): Promise<DemandResult> {
  const now = date || new Date()
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

  const jobWhere: any = { categoryId, status: { in: ['OPEN', 'IN_PROGRESS'] } }
  if (areaId) jobWhere.areaId = areaId
  else if (cityId) jobWhere.areaId = undefined

  const [recentJobs, allOpenJobs, recentCompleted, providers] = await Promise.all([
    prisma.marketplaceJob.findMany({
      where: { ...jobWhere, createdAt: { gte: sevenDaysAgo } },
      select: { id: true },
    }),
    prisma.marketplaceJob.findMany({
      where: { ...jobWhere, status: 'OPEN', isActive: true },
      select: { id: true },
    }),
    prisma.marketplaceJob.findMany({
      where: { categoryId, status: 'COMPLETED', createdAt: { gte: thirtyDaysAgo } },
      select: { id: true },
    }),
    prisma.taskerProfile.findMany({
      where: { isOnline: true, skills: { contains: categoryId } },
      select: { id: true },
    }),
  ])

  const jobCount = recentJobs.length
  const openCount = allOpenJobs.length
  const completedCount = recentCompleted.length
  const providerCount = providers.length

  const demandScore = Math.min(100, (openCount * 10) + (completedCount * 2) + (jobCount * 5))
  const supplyScore = Math.min(100, providerCount * 20)
  const ratio = supplyScore > 0 ? demandScore / supplyScore : demandScore > 0 ? 100 : 1

  const seasonalFactor = getSeasonalFactor(categoryId, now, countryCode)
  const adjustedRatio = ratio * seasonalFactor

  const level = calculateDemandLevel(adjustedRatio)

  const result: DemandResult = {
    categoryId,
    countryCode,
    areaId,
    cityId,
    demandScore: Math.round(demandScore),
    supplyScore: Math.round(supplyScore),
    ratio: Math.round(adjustedRatio * 100) / 100,
    level,
    jobCount: openCount,
    searchCount: jobCount,
    providerCount,
  }

  try {
    await prisma.demandForecast.create({
      data: {
        categoryId,
        countryCode,
        areaId: areaId || null,
        cityId: cityId || null,
        forecastDate: now,
        demandScore: result.demandScore,
        supplyScore: result.supplyScore,
        ratio: result.ratio,
        demandLevel: level,
        jobCount: openCount,
        searchCount: jobCount,
        providerCount,
      },
    })
  } catch {}

  return result
}

export async function getCategoryDemandSummary(countryCode: string): Promise<DemandResult[]> {
  const categories = ['cleaning', 'electrical', 'plumbing', 'painting', 'ac', 'moving', 'gardening', 'carpentry', 'digital', 'pest', 'renovation', 'automotive', 'repairs', 'other']
  const results: DemandResult[] = []
  for (const cat of categories) {
    results.push(await calculateDemand(cat, countryCode))
  }
  return results.sort((a, b) => b.ratio - a.ratio)
}

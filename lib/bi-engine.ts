import { prisma } from './prisma'

export interface BIOverview {
  totalRevenue: number
  monthlyRevenue: number
  totalJobs: number
  activeJobs: number
  completedJobs: number
  totalProviders: number
  activeProviders: number
  totalCustomers: number
  avgJobValue: number
  jobCompletionRate: number
  avgProviderRating: number
}

export interface CategoryAnalytics {
  categoryId: string
  jobCount: number
  avgBudget: number
  completionRate: number
  avgRating: number
  demandLevel: string
  growthPct: number
}

export interface RegionAnalytics {
  areaId: string
  jobCount: number
  avgBudget: number
  providerCount: number
  demandLevel: string
}

export interface TrendData {
  period: string
  jobs: number
  revenue: number
  newProviders: number
  newCustomers: number
}

export async function getBIOverview(): Promise<BIOverview> {
  const now = new Date()
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

  const [allJobs, recentJobs, completedJobs, providers, customers] = await Promise.all([
    prisma.marketplaceJob.findMany({ select: { status: true, budgetAmount: true, createdAt: true } }),
    prisma.marketplaceJob.findMany({ where: { createdAt: { gte: thirtyDaysAgo } }, select: { status: true, budgetAmount: true } }),
    prisma.marketplaceJob.findMany({ where: { status: 'COMPLETED' }, select: { budgetAmount: true } }),
    prisma.taskerProfile.findMany({ select: { userId: true, isOnline: true } }),
    prisma.marketplaceJob.findMany({ select: { customerId: true }, distinct: ['customerId'] }),
  ])

  const totalRevenue = completedJobs.reduce((s, j) => s + Number(j.budgetAmount ?? 0n), 0) / 100
  const monthlyRevenue = recentJobs.filter(j => j.status === 'COMPLETED').reduce((s, j) => s + Number(j.budgetAmount ?? 0n), 0) / 100
  const activeJobs = allJobs.filter(j => j.status === 'OPEN' || j.status === 'IN_PROGRESS').length
  const completedCount = completedJobs.length
  const totalJobs = allJobs.length
  const jobCompletionRate = totalJobs > 0 ? (completedCount / totalJobs) * 100 : 0
  const avgJobValue = completedCount > 0 ? totalRevenue / completedCount : 0

  const reviews = await prisma.jobReview.findMany({ select: { quality: true, communication: true, timeliness: true } })
  const avgProviderRating = reviews.length > 0
    ? reviews.reduce((s, r) => s + (r.quality + r.communication + r.timeliness) / 3, 0) / reviews.length
    : 0

  return {
    totalRevenue: Math.round(totalRevenue),
    monthlyRevenue: Math.round(monthlyRevenue),
    totalJobs,
    activeJobs,
    completedJobs: completedCount,
    totalProviders: providers.length,
    activeProviders: providers.filter(p => p.isOnline).length,
    totalCustomers: customers.length,
    avgJobValue: Math.round(avgJobValue),
    jobCompletionRate: Math.round(jobCompletionRate * 10) / 10,
    avgProviderRating: Math.round(avgProviderRating * 10) / 10,
  }
}

export async function getCategoryAnalytics(): Promise<CategoryAnalytics[]> {
  const categories = ['cleaning', 'electrical', 'plumbing', 'painting', 'ac', 'moving', 'gardening', 'carpentry', 'digital', 'pest', 'renovation', 'automotive', 'repairs', 'other']
  const now = new Date()
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000)

  const results: CategoryAnalytics[] = []

  for (const cat of categories) {
    const [recentCount, prevCount, allJobs, completedCount, avgBudgetResult] = await Promise.all([
      prisma.marketplaceJob.count({ where: { categoryId: cat, createdAt: { gte: thirtyDaysAgo } } }),
      prisma.marketplaceJob.count({ where: { categoryId: cat, createdAt: { gte: sixtyDaysAgo, lt: thirtyDaysAgo } } }),
      prisma.marketplaceJob.findMany({ where: { categoryId: cat }, select: { budgetAmount: true, status: true } }),
      prisma.marketplaceJob.count({ where: { categoryId: cat, status: 'COMPLETED' } }),
      prisma.marketplaceJob.aggregate({ where: { categoryId: cat, status: 'COMPLETED' }, _avg: { budgetAmount: true } }),
    ])

    const totalCatJobs = allJobs.length
    const completionRate = totalCatJobs > 0 ? (completedCount / totalCatJobs) * 100 : 0
    const avgBudget = avgBudgetResult._avg.budgetAmount ? Number(avgBudgetResult._avg.budgetAmount) / 100 : 0
    const growthPct = prevCount > 0 ? ((recentCount - prevCount) / prevCount) * 100 : recentCount > 0 ? 100 : 0

    results.push({
      categoryId: cat,
      jobCount: totalCatJobs,
      avgBudget: Math.round(avgBudget),
      completionRate: Math.round(completionRate * 10) / 10,
      avgRating: 0,
      demandLevel: 'normal',
      growthPct: Math.round(growthPct * 10) / 10,
    })
  }

  return results.sort((a, b) => b.jobCount - a.jobCount)
}

export async function getRegionAnalytics(): Promise<RegionAnalytics[]> {
  const jobs = await prisma.marketplaceJob.findMany({
    select: { areaId: true, budgetAmount: true },
    where: { areaId: { not: null } },
  })

  const byArea: Record<string, { budgets: number[]; count: number }> = {}
  for (const j of jobs) {
    if (!j.areaId) continue
    if (!byArea[j.areaId]) byArea[j.areaId] = { budgets: [], count: 0 }
    byArea[j.areaId].budgets.push(Number(j.budgetAmount ?? 0n) / 100)
    byArea[j.areaId].count++
  }

  return Object.entries(byArea).map(([areaId, data]) => ({
    areaId,
    jobCount: data.count,
    avgBudget: Math.round(data.budgets.reduce((a, b) => a + b, 0) / data.budgets.length),
    providerCount: 0,
    demandLevel: 'normal',
  })).sort((a, b) => b.jobCount - a.jobCount)
}

export async function getTrendData(months: number = 6): Promise<TrendData[]> {
  const now = new Date()
  const results: TrendData[] = []

  for (let i = months - 1; i >= 0; i--) {
    const start = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59)

    const [jobs, completedJobs] = await Promise.all([
      prisma.marketplaceJob.findMany({
        where: { createdAt: { gte: start, lte: end } },
        select: { status: true, budgetAmount: true },
      }),
      prisma.marketplaceJob.findMany({
        where: { status: 'COMPLETED', createdAt: { gte: start, lte: end } },
        select: { budgetAmount: true },
      }),
    ])

    const period = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}`
    results.push({
      period,
      jobs: jobs.length,
      revenue: Math.round(completedJobs.reduce((s, j) => s + Number(j.budgetAmount ?? 0n), 0) / 100),
      newProviders: 0,
      newCustomers: 0,
    })
  }

  return results
}

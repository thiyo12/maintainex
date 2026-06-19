import { prisma } from './prisma'
import { getLocationName } from './locations'
import { jsonArrayContains, safeParseJsonArr } from './db-utils'

export interface MatchedProvider {
  id: string
  name: string
  type: 'INDIVIDUAL' | 'COMPANY'
  rating: number
  completedJobs: number
  responseSpeed: number
  areaMatch: boolean
  overallScore: number
  profile: {
    bio?: string | null
    image?: string | null
    isVerified: boolean
    isOnline?: boolean
  }
}

export async function matchProvidersForJob(jobId: string): Promise<MatchedProvider[]> {
  const job = await prisma.marketplaceJob.findUnique({ where: { id: jobId } })
  if (!job) return []
  if (job.status !== 'OPEN') return []

  const category = await prisma.category.findUnique({ where: { id: job.categoryId } })
  if (!category) return []

  const categorySlug = category.slug

  const areaId = job.areaId

  const [individuals, companies] = await Promise.all([
    prisma.taskerProfile.findMany({
      where: {
        isOnline: true,
      },
      include: {
        user: { select: { id: true, name: true } },
      },
    }),
    prisma.companyProfile.findMany({
      where: {
        isVerified: true,
      },
      include: {
        user: { select: { id: true, name: true } },
      },
    }),
  ])

  const filteredIndividuals = individuals.filter(ind => jsonArrayContains(ind.skills, categorySlug))
  const filteredCompanies = companies.filter(comp => jsonArrayContains(comp.services, categorySlug))

  const providers: MatchedProvider[] = []

  for (const ind of filteredIndividuals) {
    const completedJobs = ind.completedJobs
    const maxCompleted = 500

    const areaMatch = areaId ? matchesArea(areaId, ind.serviceAreas) : true

    const responseSpeed = 0.5

    const ratingScore = ind.rating / 5.0
    const completedScore = Math.min(completedJobs / maxCompleted, 1.0)
    const areaScore = areaMatch ? 1.0 : 0.25

    const overallScore =
      ratingScore * 0.40 +
      completedScore * 0.30 +
      responseSpeed * 0.20 +
      areaScore * 0.10

    providers.push({
      id: ind.userId,
      name: ind.user.name || 'Unknown',
      type: 'INDIVIDUAL',
      rating: ind.rating,
      completedJobs,
      responseSpeed,
      areaMatch,
      overallScore: Math.round(overallScore * 100) / 100,
      profile: {
        bio: ind.bio,
        image: ind.profileImage,
        isVerified: ind.isVerified,
        isOnline: ind.isOnline,
      },
    })
  }

  for (const comp of filteredCompanies) {
    const completedJobs = comp.completedProjects
    const maxCompleted = 500

    const areaMatch = areaId ? matchesArea(areaId, comp.serviceAreas) : true

    const responseSpeed = 0.5

    const ratingScore = comp.rating / 5.0
    const completedScore = Math.min(completedJobs / maxCompleted, 1.0)
    const areaScore = areaMatch ? 1.0 : 0.25

    const overallScore =
      ratingScore * 0.40 +
      completedScore * 0.30 +
      responseSpeed * 0.20 +
      areaScore * 0.10

    providers.push({
      id: comp.userId,
      name: comp.user.name || 'Unknown',
      type: 'COMPANY',
      rating: comp.rating,
      completedJobs,
      responseSpeed,
      areaMatch,
      overallScore: Math.round(overallScore * 100) / 100,
      profile: {
        bio: comp.description,
        image: comp.logo,
        isVerified: comp.isVerified,
        isOnline: undefined,
      },
    })
  }

  providers.sort((a, b) => b.overallScore - a.overallScore)

  return providers.slice(0, 20)
}

function matchesArea(areaId: string, serviceAreas: string | null | undefined): boolean {
  const locationName = getLocationName(areaId).toLowerCase()
  const arr = safeParseJsonArr(serviceAreas)
  return arr.some((area) => locationName.includes(area.toLowerCase()))
}

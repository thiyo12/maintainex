import { prisma } from './prisma'

const EARTH_RADIUS_KM = 6371

function toRad(deg: number): number { return deg * Math.PI / 180 }

export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export interface JobCluster {
  jobs: { id: string; lat: number; lng: number; title: string; estimatedDuration: number }[]
  centerLat: number
  centerLng: number
  totalDuration: number
  estimatedTravelTime: number
}

export interface ScheduleSlot {
  jobId: string
  title: string
  startTime: Date
  endTime: Date
  travelFrom?: string
  travelMinutes: number
  distanceKm: number
}

export function clusterJobsByProximity(
  jobs: { id: string; lat: number; lng: number; title: string; estimatedDuration?: number }[],
  maxDistanceKm: number = 10,
): JobCluster[] {
  const clusters: JobCluster[] = []
  const used = new Set<string>()

  for (const job of jobs) {
    if (used.has(job.id)) continue
    const cluster: typeof jobs = [job]
    used.add(job.id)

    for (const other of jobs) {
      if (used.has(other.id)) continue
      const dist = haversineKm(job.lat, job.lng, other.lat, other.lng)
      if (dist <= maxDistanceKm) {
        cluster.push(other)
        used.add(other.id)
      }
    }

    const centerLat = cluster.reduce((s, j) => s + j.lat, 0) / cluster.length
    const centerLng = cluster.reduce((s, j) => s + j.lng, 0) / cluster.length
    const totalDuration = cluster.reduce((s, j) => s + (j.estimatedDuration || 2), 0)
    const avgDist = cluster.reduce((s, j) => s + haversineKm(centerLat, centerLng, j.lat, j.lng), 0) / cluster.length
    const estimatedTravelTime = avgDist * 3

    clusters.push({
      jobs: cluster.map(j => ({ ...j, estimatedDuration: j.estimatedDuration || 2 })),
      centerLat,
      centerLng,
      totalDuration,
      estimatedTravelTime,
    })
  }

  return clusters.sort((a, b) => b.jobs.length - a.jobs.length)
}

export function optimizeRoute(
  jobs: { id: string; lat: number; lng: number; title: string; estimatedDuration: number }[],
  startLat: number,
  startLng: number,
): ScheduleSlot[] {
  if (jobs.length === 0) return []

  const sorted = [...jobs]
  const route: ScheduleSlot[] = []
  let currentLat = startLat
  let currentLng = startLng
  let currentTime = new Date()

  while (sorted.length > 0) {
    let nearestIdx = 0
    let nearestDist = Infinity

    for (let i = 0; i < sorted.length; i++) {
      const dist = haversineKm(currentLat, currentLng, sorted[i].lat, sorted[i].lng)
      if (dist < nearestDist) {
        nearestDist = dist
        nearestIdx = i
      }
    }

    const nearest = sorted.splice(nearestIdx, 1)[0]
    const travelMinutes = Math.round(nearestDist * 3)
    const distanceKm = Math.round(nearestDist * 10) / 10

    const startTime = new Date(currentTime.getTime() + travelMinutes * 60 * 1000)
    const endTime = new Date(startTime.getTime() + (nearest.estimatedDuration || 2) * 60 * 60 * 1000)

    route.push({
      jobId: nearest.id,
      title: nearest.title,
      startTime,
      endTime,
      travelMinutes,
      distanceKm,
    })

    currentLat = nearest.lat
    currentLng = nearest.lng
    currentTime = endTime
  }

  return route
}

export async function getProviderScheduleRecommendations(providerId: string): Promise<{
  suggestedJobs: { jobId: string; title: string; distance: number; estimatedEarning: number }[]
  totalEstimatedEarning: number
  totalTravelKm: number
}> {
  const [provider, openJobs] = await Promise.all([
    prisma.taskerProfile.findUnique({ where: { userId: providerId }, select: { latitude: true, longitude: true, serviceAreas: true } }),
    prisma.marketplaceJob.findMany({
      where: { status: 'OPEN', isActive: true },
      select: { id: true, title: true, categoryId: true, budgetAmount: true, areaId: true, latitude: true, longitude: true },
      take: 50,
    }),
  ])

  if (!provider?.latitude || !provider?.longitude) {
    return { suggestedJobs: [], totalEstimatedEarning: 0, totalTravelKm: 0 }
  }

  const jobsWithDist = openJobs
    .filter(j => j.latitude && j.longitude)
    .map(j => ({
      jobId: j.id,
      title: j.title,
      distance: haversineKm(provider.latitude!, provider.longitude!, j.latitude!, j.longitude!),
      estimatedEarning: Number(j.budgetAmount) / 100,
    }))
    .filter(j => j.distance <= 30)
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 10)

  return {
    suggestedJobs: jobsWithDist,
    totalEstimatedEarning: jobsWithDist.reduce((s, j) => s + j.estimatedEarning, 0),
    totalTravelKm: jobsWithDist.reduce((s, j) => s + j.distance, 0),
  }
}

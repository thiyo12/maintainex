import { prisma } from './prisma'

export interface AvailabilityResult {
  isAvailable: boolean
  reason: string
  workHours: { start: string; end: string }
  workDays: string[]
  nextAvailable?: Date
}

export function isWithinWorkHours(availability: any, checkTime: Date): boolean {
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
  const dayName = dayNames[checkTime.getDay()]
  if (!availability[dayName]) return false
  const hours = checkTime.getHours()
  const minutes = checkTime.getMinutes()
  const timeNum = hours * 60 + minutes
  const [startH, startM] = availability.startTime.split(':').map(Number)
  const [endH, endM] = availability.endTime.split(':').map(Number)
  return timeNum >= startH * 60 + startM && timeNum <= endH * 60 + endM
}

export async function checkProviderAvailability(providerId: string, preferredDate?: Date): Promise<AvailabilityResult> {
  const availability = await prisma.providerAvailability.findUnique({
    where: { providerId },
  })

  if (!availability) {
    return {
      isAvailable: true,
      reason: 'No schedule set — assumed available',
      workHours: { start: '08:00', end: '18:00' },
      workDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'],
    }
  }

  if (!availability.isAvailable) {
    return {
      isAvailable: false,
      reason: 'Provider marked as unavailable',
      workHours: { start: availability.startTime, end: availability.endTime },
      workDays: [],
    }
  }

  if (availability.vacationStart && availability.vacationEnd) {
    const now = new Date()
    if (now >= availability.vacationStart && now <= availability.vacationEnd) {
      return {
        isAvailable: false,
        reason: `On vacation until ${availability.vacationEnd.toLocaleDateString()}`,
        workHours: { start: availability.startTime, end: availability.endTime },
        workDays: [],
        nextAvailable: availability.vacationEnd,
      }
    }
  }

  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
  const activeDays = dayNames.filter(d => availability[d as keyof typeof availability])

  return {
    isAvailable: true,
    reason: 'Available',
    workHours: { start: availability.startTime, end: availability.endTime },
    workDays: activeDays,
  }
}

export async function calculateAcceptanceProbability(
  providerId: string,
  jobCategoryId: string,
  jobAreaId?: string,
): Promise<number> {
  const [availability, performance, recentResponses] = await Promise.all([
    prisma.providerAvailability.findUnique({ where: { providerId } }),
    prisma.providerPerformance.findFirst({ where: { providerId, categoryId: jobCategoryId } }),
    prisma.providerJobResponse.findMany({
      where: { providerId, createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    }),
  ])

  let probability = 0.5

  if (performance) {
    probability += (performance.acceptanceRate / 100) * 0.3
  }

  if (recentResponses.length > 0) {
    const acceptedCount = recentResponses.filter(r => r.acceptedAt).length
    const recentRate = acceptedCount / recentResponses.length
    probability += recentRate * 0.25
  } else {
    probability += 0.15
  }

  if (availability) {
    if (availability.isAvailable && !availability.vacationStart) {
      probability += 0.1
    } else {
      probability -= 0.3
    }
  }

  if (performance?.avgRating && performance.avgRating > 4) {
    probability += 0.05
  }

  return Math.max(0.05, Math.min(0.99, Math.round(probability * 100) / 100))
}

const AVAILABILITY_DAY_KEYS = [
  'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
] as const
const AVAILABILITY_STRING_KEYS = ['startTime', 'endTime'] as const
const AVAILABILITY_DATE_KEYS = ['vacationStart', 'vacationEnd'] as const

export async function setProviderAvailability(
  providerId: string,
  data: Record<string, unknown>
): Promise<void> {
  const clean: Record<string, unknown> = {}

  for (const key of AVAILABILITY_DAY_KEYS) {
    if (key in data) {
      if (typeof data[key] !== 'boolean') throw new Error(`Invalid availability field: ${key} must be a boolean`)
      clean[key] = data[key]
    }
  }
  if ('isAvailable' in data) {
    if (typeof data.isAvailable !== 'boolean') throw new Error('Invalid availability field: isAvailable must be a boolean')
    clean.isAvailable = data.isAvailable
  }
  for (const key of AVAILABILITY_STRING_KEYS) {
    if (key in data) {
      if (typeof data[key] !== 'string') throw new Error(`Invalid availability field: ${key} must be a string`)
      clean[key] = data[key]
    }
  }
  for (const key of AVAILABILITY_DATE_KEYS) {
    if (key in data && data[key] != null) {
      const date = data[key] instanceof Date ? (data[key] as Date) : new Date(String(data[key]))
      if (Number.isNaN(date.getTime())) throw new Error(`Invalid availability field: ${key} must be a valid date`)
      clean[key] = date
    }
  }

  if (Object.keys(clean).length === 0) {
    throw new Error('No valid availability fields provided')
  }

  await prisma.providerAvailability.upsert({
    where: { providerId },
    create: {
      providerId,
      providerType: 'INDIVIDUAL',
      ...clean,
    },
    update: clean,
  })
}

import { prisma } from '@/lib/prisma'

/**
 * Generate unique MX ID for users, taskers, and companies
 * Format: MXU-XXXXX, MXT-XXXXX, MXC-XXXXX
 */
export async function generateMxId(type: 'USER' | 'TASKER' | 'COMPANY'): Promise<string> {
  const prefix = type === 'USER' ? 'MXU' : type === 'TASKER' ? 'MXT' : 'MXC'
  
  // Get the latest MX ID for this type
  const model = type === 'USER' ? prisma.user : 
                type === 'TASKER' ? prisma.taskerProfile : 
                prisma.companyProfile
  
  const latest = await (model as any).findFirst({
    where: { mxId: { startsWith: prefix } },
    orderBy: { mxId: 'desc' },
    select: { mxId: true }
  })
  
  let nextNumber = 1
  if (latest?.mxId) {
    const numPart = latest.mxId.replace(`${prefix}-`, '')
    nextNumber = parseInt(numPart, 10) + 1
  }
  
  return `${prefix}-${nextNumber.toString().padStart(5, '0')}`
}

/**
 * Get commission rate from platform settings
 */
export async function getCommissionRate(): Promise<number> {
  const settings = await prisma.platformSettings.findFirst()
  return settings?.commissionRate ?? 10.0
}

/**
 * Calculate commission amount
 */
export function calculateCommission(amount: number, rate: number): number {
  return Math.round(amount * rate) / 100
}

/**
 * Get weekly settlement for a provider
 */
export async function getWeeklySettlement(providerId: string, weekStart: Date) {
  return prisma.weeklySettlement.findUnique({
    where: {
      providerId_weekStart: {
        providerId,
        weekStart
      }
    }
  })
}

/**
 * Get or create weekly settlement for current week
 */
export async function getOrCreateWeeklySettlement(
  providerId: string, 
  providerType: string,
  weekStart: Date
) {
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekEnd.getDate() + 6)
  weekEnd.setHours(23, 59, 59, 999)
  
  const dueAt = new Date(weekEnd)
  dueAt.setDate(dueAt.getDate() + 7) // Due next Monday
  
  const commissionRate = await getCommissionRate()
  
  return prisma.weeklySettlement.upsert({
    where: {
      providerId_weekStart: {
        providerId,
        weekStart
      }
    },
    create: {
      providerId,
      providerType,
      weekStart,
      weekEnd,
      totalEarnings: 0,
      commissionRate,
      commissionOwed: 0,
      dueAt,
      status: 'PENDING'
    },
    update: {}
  })
}

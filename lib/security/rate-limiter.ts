import { prisma } from '@/lib/prisma'

const blockedIPsCache = new Map<string, Date>()

export async function blockIP(ip: string, reason: string, durationMinutes?: number): Promise<void> {
  const expiresAt = durationMinutes
    ? new Date(Date.now() + durationMinutes * 60 * 1000)
    : new Date('2099-12-31T23:59:59.999Z')

  await prisma.ipBlock.upsert({
    where: { ip },
    update: { reason, expiresAt },
    create: { ip, reason, expiresAt },
  })

  blockedIPsCache.set(ip, expiresAt)
}

export async function unblockIP(ip: string): Promise<void> {
  await prisma.ipBlock.deleteMany({ where: { ip } })
  blockedIPsCache.delete(ip)
}

export async function isIPBlocked(ip: string): Promise<boolean> {
  const cached = blockedIPsCache.get(ip)
  if (cached) {
    if (cached > new Date()) return true
    blockedIPsCache.delete(ip)
  }

  const block = await prisma.ipBlock.findFirst({
    where: {
      ip,
      expiresAt: { gt: new Date() },
    },
  })

  if (block) {
    blockedIPsCache.set(ip, block.expiresAt!)
    return true
  }

  return false
}

export async function getBlockedIPs() {
  return prisma.ipBlock.findMany({
    where: { expiresAt: { gt: new Date() } },
    orderBy: { createdAt: 'desc' },
  })
}

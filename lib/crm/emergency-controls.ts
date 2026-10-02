import { prisma } from '@/lib/prisma'

export type CrmEmergencyControlKey = 'PAYOUTS_FROZEN'

export interface ActiveEmergencyControl {
  id: string
  controlKey: CrmEmergencyControlKey
  market: string
  reason: string
  activatedBy: string
  activatedAt: Date
  expiresAt: Date | null
}

function normalizeMarket(market?: string | null): string {
  const value = (market || 'GLOBAL').trim().toUpperCase()
  return /^[A-Z]{2}$/.test(value) ? value : 'GLOBAL'
}

export async function getActiveEmergencyControl(
  controlKey: CrmEmergencyControlKey,
  market?: string | null,
  now = new Date()
): Promise<ActiveEmergencyControl | null> {
  const normalizedMarket = normalizeMarket(market)
  const controls = await prisma.crmEmergencyControl.findMany({
    where: {
      controlKey,
      active: true,
      market: { in: normalizedMarket === 'GLOBAL' ? ['GLOBAL'] : ['GLOBAL', normalizedMarket] },
    },
    select: {
      id: true,
      controlKey: true,
      market: true,
      reason: true,
      activatedBy: true,
      activatedAt: true,
      expiresAt: true,
    },
  })

  const active = controls
    .filter(control => !control.expiresAt || control.expiresAt > now)
    .sort((a, b) => {
      if (a.market === normalizedMarket && b.market !== normalizedMarket) return -1
      if (b.market === normalizedMarket && a.market !== normalizedMarket) return 1
      return b.activatedAt.getTime() - a.activatedAt.getTime()
    })[0]

  return active
    ? {
        ...active,
        controlKey: active.controlKey as CrmEmergencyControlKey,
      }
    : null
}

export async function isPayoutExecutionFrozen(
  market?: string | null,
  now = new Date()
): Promise<boolean> {
  return Boolean(await getActiveEmergencyControl('PAYOUTS_FROZEN', market, now))
}

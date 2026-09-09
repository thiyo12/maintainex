import { PrismaClient } from '@prisma/client'
import { PriceSnapshotData } from './types'

export async function createPriceSnapshot(
  client: PrismaClient,
  data: PriceSnapshotData,
): Promise<string> {
  const snapshot = await (client as any).priceSnapshot.create({
    data: {
      jobId: data.jobId,
      pricingVersion: data.pricingVersion,
      currency: data.currency,
      baseAmount: data.baseAmount,
      urgencyAmount: data.urgencyAmount,
      serviceModifiers: data.serviceModifiers,
      platformFeeBps: data.platformFeeBps,
      platformFeeAmount: data.platformFeeAmount,
      providerGross: data.providerGross,
      customerTotal: data.customerTotal,
      ruleIds: JSON.stringify(data.ruleIds),
    },
  })
  return snapshot.id
}

export async function getPriceSnapshot(
  client: PrismaClient,
  jobId: string,
): Promise<PriceSnapshotData | null> {
  const snapshot = await (client as any).priceSnapshot.findFirst({
    where: { jobId },
    orderBy: { createdAt: 'desc' },
  })
  if (!snapshot) return null

  return {
    jobId: snapshot.jobId,
    pricingVersion: snapshot.pricingVersion,
    currency: snapshot.currency,
    baseAmount: BigInt(snapshot.baseAmount),
    urgencyAmount: BigInt(snapshot.urgencyAmount),
    serviceModifiers: BigInt(snapshot.serviceModifiers),
    platformFeeBps: snapshot.platformFeeBps,
    platformFeeAmount: BigInt(snapshot.platformFeeAmount),
    providerGross: BigInt(snapshot.providerGross),
    customerTotal: BigInt(snapshot.customerTotal),
    ruleIds: JSON.parse(snapshot.ruleIds || '[]'),
  }
}

export function isSnapshotStillValid(
  snapshot: PriceSnapshotData,
  currentPricingVersion: string,
): boolean {
  return snapshot.pricingVersion === currentPricingVersion
}

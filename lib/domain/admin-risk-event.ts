import { PrismaClient } from '@prisma/client'
import type { AdminSession, AuditAction } from '../admin-types'

export type RiskEventResolution = 'CONFIRMED' | 'DISMISSED' | 'ESCALATED' | 'NO_ACTION'

export interface ReviewRiskEventInput {
  eventId: string
  resolution: RiskEventResolution
  reason?: string
  session: AdminSession
  ipAddress: string
}

export async function reviewRiskEvent(
  tx: PrismaClient,
  input: ReviewRiskEventInput
) {
  const { eventId, resolution, reason, session, ipAddress } = input

  const validResolutions: RiskEventResolution[] = ['CONFIRMED', 'DISMISSED', 'ESCALATED', 'NO_ACTION']
  if (!validResolutions.includes(resolution)) {
    throw new Error(`Invalid resolution: ${resolution}`)
  }

  if ((resolution === 'CONFIRMED' || resolution === 'ESCALATED') && (!reason || reason.trim().length < 3)) {
    throw new Error('Reason is required for CONFIRMED/ESCALATED resolution')
  }

  const event = await tx.marketplaceRiskEvent.findUnique({
    where: { id: eventId },
    select: {
      id: true, eventType: true, severity: true,
      resolution: true, reviewedAt: true, actorUserId: true,
    },
  })

  if (!event) throw new Error('Risk event not found')

  if (event.reviewedAt) {
    throw new Error(`Risk event already reviewed: ${event.resolution}`)
  }

  const oldValue = { resolution: event.resolution, reviewedAt: null }
  const newValue = { resolution, reviewedAt: new Date(), reason }

  const updateResult = await tx.marketplaceRiskEvent.updateMany({
    where: { id: eventId, reviewedAt: null },
    data: {
      resolution,
      reviewedAt: new Date(),
      reviewedBy: session.id,
    },
  })

  if (updateResult.count === 0) {
    throw new Error('Concurrent risk event decision detected — another admin already reviewed this event.')
  }

  const actionMap: Record<string, AuditAction> = {
    CONFIRMED: 'RISK_EVENT_RESOLVE',
    DISMISSED: 'RISK_EVENT_DISMISS',
    ESCALATED: 'RISK_EVENT_ESCALATE',
    NO_ACTION: 'RISK_EVENT_RESOLVE',
  }

  await tx.auditLog.create({
    data: {
      adminUserId: session.id,
      adminEmail: session.email,
      adminRole: session.role,
      action: actionMap[resolution] || 'UPDATE',
      targetTable: 'MarketplaceRiskEvent',
      targetId: eventId,
      targetLabel: `${event.eventType} (${event.severity})`,
      oldValue: JSON.stringify(oldValue),
      newValue: JSON.stringify(newValue),
      ipAddress,
    },
  })

  return { success: true, eventId, resolution, event }
}

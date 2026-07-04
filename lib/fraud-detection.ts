import { prisma } from './prisma'
import { getSetting } from './settings'
import { createNotification } from './notifications'

const PHONE_PATTERNS = [
  /0[0-9]{9}/g,                    // Sri Lanka: 07X XXXXXXX
  /\+94[0-9]{9}/g,                 // Sri Lanka international
  /\+1[0-9]{10}/g,                 // Canada/USA
  /(\d[\s\-.]?){10,}/g,            // Generic number sequences
  /whatsapp|telegram|signal/gi,    // Messaging apps
  /(?:gmail|yahoo|hotmail)\.com/gi,// Email addresses
]

export async function scanChatMessage(
  messageText: string,
  senderId: string,
  conversationId: string
): Promise<{ allowed: boolean; reason?: string }> {
  // Check if any booking in this conversation is confirmed (assigned/in_progress/completed)
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: { participants: { select: { userId: true } } },
  })
  if (!conversation) return { allowed: true }

  // Check if there's an active assignment between these users
  const participantIds = conversation.participants.map(p => p.userId)
  if (participantIds.length < 2) return { allowed: true }

  const hasActiveBooking = await prisma.assignment.findFirst({
    where: {
      taskerId: { in: participantIds },
      status: { in: ['ASSIGNED', 'EN_ROUTE', 'IN_PROGRESS', 'COMPLETED'] },
    },
  })

  // Only block if no active booking
  if (hasActiveBooking) return { allowed: true }

  for (const pattern of PHONE_PATTERNS) {
    pattern.lastIndex = 0 // reset regex state
    if (pattern.test(messageText)) {
      await prisma.fraudEvent.create({
        data: {
          userId: senderId,
          type: 'contact_share_attempt',
          detail: messageText.substring(0, 200),
        },
      })

      await checkFraudThreshold(senderId)
      return { allowed: false, reason: 'contact_sharing' }
    }
  }
  return { allowed: true }
}

export async function checkNewAccount(userId: string, deviceId: string): Promise<{ flagged: boolean; reason?: string }> {
  const maxAccounts = await getSetting('fraud.max_accounts_per_device', 3)

  const deviceCount = await prisma.userDevice.groupBy({
    by: ['userId'],
    where: { deviceId },
    _count: true,
  })

  if (deviceCount.length >= maxAccounts) {
    await prisma.user.update({
      where: { id: userId },
      data: { isActive: false },
    })
    await prisma.fraudEvent.create({
      data: {
        userId,
        type: 'device_limit_exceeded',
        detail: `Device ${deviceId} has ${deviceCount.length} accounts`,
      },
    })
    return { flagged: true, reason: 'too_many_accounts_on_device' }
  }
  return { flagged: false }
}

export async function checkDisputeAbuse(customerId: string): Promise<void> {
  const maxRate = await getSetting('fraud.max_disputes_percent', 30)
  const totalBookings = await prisma.marketplaceJob.count({
    where: { customerId, status: 'COMPLETED' },
  })

  if (totalBookings < 5) return

  const disputedCount = await prisma.dispute.count({
    where: { raisedById: customerId },
  })

  const rate = (disputedCount / totalBookings) * 100
  if (rate >= maxRate) {
    await prisma.fraudEvent.create({
      data: {
        userId: customerId,
        type: 'dispute_abuse',
        detail: `Dispute rate: ${rate.toFixed(1)}%`,
      },
    })
    await flagForAdminReview(customerId, `High dispute rate: ${rate.toFixed(1)}%`)
  }
}

export async function checkChargebackAbuse(userId: string): Promise<void> {
  const maxCB = await getSetting('fraud.max_chargebacks_90d', 2)
  const cbCount = await prisma.walletTransaction.count({
    where: {
      userId,
      referenceType: 'CHARGEBACK',
      createdAt: { gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) },
    },
  })

  if (cbCount >= maxCB) {
    await prisma.providerWallet.updateMany({
      where: { userId },
      data: { isFrozen: true },
    })
    await flagForAdminReview(userId, `${cbCount} chargebacks in 90 days — wallet frozen`)
  }
}

export async function flagForAdminReview(userId: string, reason: string): Promise<void> {
  const existing = await prisma.adminFlag.findFirst({
    where: { userId, status: 'pending' },
  })
  if (existing) {
    await prisma.adminFlag.update({
      where: { id: existing.id },
      data: { reason },
    })
  } else {
    await prisma.adminFlag.create({
      data: { userId, reason },
    })
  }
}

async function checkFraudThreshold(userId: string): Promise<void> {
  const recentEvents = await prisma.fraudEvent.count({
    where: {
      userId,
      createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
    },
  })
  if (recentEvents >= 5) {
    await flagForAdminReview(userId, `${recentEvents} fraud events in 7 days`)
  }
}

export async function registerDevice(userId: string, deviceId: string, platform: string, pushToken?: string): Promise<void> {
  await prisma.userDevice.upsert({
    where: { userId_deviceId: { userId, deviceId } },
    update: { pushToken: pushToken || undefined },
    create: { userId, deviceId, platform, pushToken },
  })
}

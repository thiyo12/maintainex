import { prisma } from './prisma'
import { getSetting } from './settings'
import { createNotification } from './notifications'

export const CONTACT_REPLACEMENT = '[Contact details removed]'
export const PAYMENT_WARNING = 'Reminder: all payments must go through Maintainex'

const CONTACT_PATTERNS = [
  /\+?\d[\d\s\-.]{6,}\d/g, // phone numbers (7+ digits with optional separators)
  /\b(?:whatsapp|telegram|signal|viber|wechat)\s*(?:me|number|id)?\b/gi,
  /[\w.+-]+@[\w-]+\.[\w.-]{2,}/g, // email addresses
]

const PAYMENT_PATTERNS = [
  /\bpaypal\b/gi,
  /\bbank\s*(?:transfer|deposit|payment|details)\b/gi,
  /\bwire\s*transfer\b/gi,
  /\bcash\s*app\b|\bcashapp\b/gi,
  /\bpay\s*me\s*directly\b/gi,
  /\boutside\s*(?:the\s*)?app\b/gi,
  /\bmy\s*(?:number|phone|whatsapp)\s*is\b/gi,
  /\b(?:whatsapp|telegram|signal)\s*me\b/gi,
  /\b(?:venmo|payoneer|zelle|upi|gcash|paytm)\b/gi,
]

export type ChatScanResult = {
  allowed: boolean
  sanitizedText: string
  flagged: boolean
  warnings: string[]
  hasContactShare: boolean
  hasPaymentKeyword: boolean
}

export async function scanChatMessage(
  messageText: string,
  senderId: string,
  conversationId: string
): Promise<ChatScanResult> {
  let sanitizedText = messageText
  const warnings: string[] = []
  let hasContactShare = false
  let hasPaymentKeyword = false

  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: {
      participants: {
        select: { userId: true, user: { select: { id: true, email: true } } },
      },
    },
  })
  if (!conversation) {
    return { allowed: true, sanitizedText, flagged: false, warnings: [], hasContactShare: false, hasPaymentKeyword: false }
  }

  // 1) Contact details → replace with placeholder
  for (const pattern of CONTACT_PATTERNS) {
    pattern.lastIndex = 0
    if (pattern.test(messageText)) {
      hasContactShare = true
      sanitizedText = sanitizedText.replace(pattern, CONTACT_REPLACEMENT)
      warnings.push('Please keep all communications on Maintainex.')
      await logChatFlag(conversation, senderId, conversationId, 'contact_share_attempt', messageText, sanitizedText)
    }
  }

  // 2) Payment keywords → replace with placeholder
  for (const pattern of PAYMENT_PATTERNS) {
    pattern.lastIndex = 0
    if (pattern.test(messageText)) {
      hasPaymentKeyword = true
      sanitizedText = sanitizedText.replace(pattern, CONTACT_REPLACEMENT)
      warnings.push(PAYMENT_WARNING)
      await logChatFlag(conversation, senderId, conversationId, 'payment_keyword', messageText, sanitizedText)
    }
  }

  const flagged = hasContactShare || hasPaymentKeyword
  return {
    allowed: true,
    sanitizedText,
    flagged,
    warnings,
    hasContactShare,
    hasPaymentKeyword,
  }
}

async function logChatFlag(
  conversation: { participants: { userId: string; user: { id: string; email: string } }[] },
  senderId: string,
  conversationId: string,
  type: string,
  originalText: string,
  sanitizedText: string
): Promise<void> {
  const sender = conversation.participants.find(p => p.userId === senderId)
  try {
    await prisma.securityAudit.create({
      data: {
        action: 'MESSAGE_FLAGGED',
        category: 'CHAT',
        userId: senderId,
        userEmail: sender?.user.email,
        description: type === 'payment_keyword' ? 'Off-platform payment keyword detected' : 'Phone/contact details detected',
        details: JSON.stringify({
          conversationId,
          type,
          original: originalText.substring(0, 200),
          sanitized: sanitizedText.substring(0, 200),
        }),
        riskLevel: 'MEDIUM',
        isSuspicious: true,
      },
    })
  } catch (error) {
    console.error('SecurityAudit log error:', error)
  }
  try {
    await prisma.fraudEvent.create({
      data: {
        userId: senderId,
        type,
        detail: originalText.substring(0, 200),
      },
    })
  } catch (error) {
    console.error('FraudEvent log error:', error)
  }
  await checkFraudThreshold(senderId)
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

import { logger } from '@/lib/shared/observability/logger'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateRequest, assertNotSuspended } from '@/lib/auth/compatibility/mobile-auth'
import { hasCompanyPermission, type CompanyRole } from '@/lib/phase6/rbac'
import { scanChatMessage } from '@/lib/fraud-detection'
import { createNotification } from '@/lib/notifications'

async function companyIdsForMessaging(userId: string): Promise<string[]> {
  const [ownedCompany, memberships] = await Promise.all([
    prisma.companyProfile.findUnique({ where: { userId }, select: { id: true } }),
    prisma.teamMember.findMany({
      where: { userId, status: 'ACTIVE' },
      select: { companyId: true, role: true },
    }),
  ])

  const ids = memberships
    .filter(member =>
      hasCompanyPermission(member.role as CompanyRole, 'quotes:read') ||
      hasCompanyPermission(member.role as CompanyRole, 'quotes:submit')
    )
    .map(member => member.companyId)

  if (ownedCompany?.id) ids.push(ownedCompany.id)
  return Array.from(new Set(ids))
}

async function canStartConversationForJob(userId: string, participantId: string, jobId: string): Promise<boolean> {
  if (userId === participantId) return false

  const [job, participant] = await Promise.all([
    prisma.marketplaceJob.findUnique({
      where: { id: jobId },
      select: { customerId: true, status: true },
    }),
    prisma.user.findUnique({ where: { id: participantId }, select: { id: true } }),
  ])
  if (!job || !participant) return false
  if (['COMPLETED', 'CANCELLED'].includes(job.status)) return false

  if (userId === job.customerId) {
    const individualQuote = await prisma.jobQuote.findFirst({
      where: { jobId, providerId: participantId, providerType: 'INDIVIDUAL' },
      select: { id: true },
    })
    if (individualQuote) return true

    const participantCompanyIds = await companyIdsForMessaging(participantId)
    if (participantCompanyIds.length === 0) return false
    const companyQuote = await prisma.jobQuote.findFirst({
      where: { jobId, providerType: 'COMPANY', providerId: { in: participantCompanyIds } },
      select: { id: true },
    })
    return !!companyQuote
  }

  if (participantId !== job.customerId) return false

  const individualQuote = await prisma.jobQuote.findFirst({
    where: { jobId, providerId: userId, providerType: 'INDIVIDUAL' },
    select: { id: true },
  })
  if (individualQuote) return true

  const companyIds = await companyIdsForMessaging(userId)
  if (companyIds.length === 0) return false
  const companyQuote = await prisma.jobQuote.findFirst({
    where: { jobId, providerType: 'COMPANY', providerId: { in: companyIds } },
    select: { id: true },
  })
  return !!companyQuote
}

export async function GET(request: NextRequest) {
  try {
    const user = await authenticateRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const conversations = await prisma.conversation.findMany({
      where: {
        participants: { some: { userId: user.id } },
      },
      include: {
        participants: {
          include: {
            user: {
              select: { id: true, name: true, taskerProfile: { select: { profileImage: true } } },
            },
          },
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { updatedAt: 'desc' },
    })

    const ids = conversations.map(c => c.id)
    const unreadRows = ids.length > 0
      ? await prisma.message.groupBy({
          by: ['conversationId'],
          where: {
            conversationId: { in: ids },
            senderId: { not: user.id },
            read: false,
          },
          _count: true,
        })
      : []
    const unreadMap = new Map(unreadRows.map(r => [r.conversationId, r._count]))

    return NextResponse.json(
      conversations.map(c => {
        const otherParticipant = c.participants.find(p => p.userId !== user.id)
        const lastMsg = c.messages[0]
        return {
          id: c.id,
          jobId: c.jobId,
          otherUser: otherParticipant
            ? { id: otherParticipant.user.id, name: otherParticipant.user.name, profileImage: otherParticipant.user.taskerProfile?.profileImage }
            : null,
          lastMessage: lastMsg ? { text: lastMsg.text, createdAt: lastMsg.createdAt.toISOString(), senderId: lastMsg.senderId } : null,
          unreadCount: unreadMap.get(c.id) || 0,
          updatedAt: c.updatedAt.toISOString(),
        }
      })
    )
  } catch (error) {
    logger.error('Conversation list failed unexpectedly', { err: error, route: '/api/mobile/conversations', method: 'GET' })
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await authenticateRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const blocked = assertNotSuspended(user)
    if (blocked) return blocked

    const { participantId, jobId, initialMessage } = await request.json()
    if (initialMessage != null && typeof initialMessage !== 'string') {
      return NextResponse.json({ error: 'initialMessage must be text' }, { status: 400 })
    }
    const rawInitialMessage =
      typeof initialMessage === 'string' ? initialMessage.trim().slice(0, 4000) : ''
    if (initialMessage != null && !rawInitialMessage) {
      return NextResponse.json({ error: 'initialMessage cannot be empty' }, { status: 400 })
    }

    if (!participantId) {
      return NextResponse.json({ error: 'participantId required' }, { status: 400 })
    }
    if (!jobId || typeof jobId !== 'string') {
      return NextResponse.json({ error: 'jobId required' }, { status: 400 })
    }

    const authorized = await canStartConversationForJob(user.id, participantId, jobId)
    if (!authorized) {
      return NextResponse.json(
        { error: 'You can only message a customer/provider connected to this job' },
        { status: 403 }
      )
    }

    const scannedInitialMessage = rawInitialMessage
      ? await scanChatMessage(rawInitialMessage, user.id, `new:${jobId}:${participantId}`)
      : null
    const safeInitialMessage = scannedInitialMessage
      ? (scannedInitialMessage.sanitizedText || rawInitialMessage)
      : ''

    // Dedup scoped to job + the same two participants. If the chat already
    // exists, preserve the user's typed opener instead of silently dropping it.
    const existingConversation = await prisma.conversation.findFirst({
      where: {
        AND: [
          { participants: { some: { userId: user.id } } },
          { participants: { some: { userId: participantId } } },
          { jobId },
        ],
      },
      include: { participants: true },
    })

    if (existingConversation) {
      if (safeInitialMessage) {
        const since = new Date(Date.now() - 24 * 60 * 60 * 1000)
        const sentToday = await prisma.message.count({
          where: {
            conversationId: existingConversation.id,
            senderId: user.id,
            createdAt: { gte: since },
          },
        })
        if (sentToday >= 50) {
          return NextResponse.json(
            { error: 'Daily message limit reached. Please continue using Maintainex for safe communication.' },
            { status: 429 }
          )
        }

        await prisma.$transaction(async tx => {
          await tx.message.create({
            data: {
              conversationId: existingConversation.id,
              senderId: user.id,
              text: safeInitialMessage,
            },
          })
          await tx.conversation.update({
            where: { id: existingConversation.id },
            data: { updatedAt: new Date() },
          })
        })

        await createNotification({
          userId: participantId,
          title: user.name || 'New message',
          body: safeInitialMessage.slice(0, 120),
          referenceType: 'CHAT',
          referenceId: existingConversation.id,
        })
      }

      return NextResponse.json({
        id: existingConversation.id,
        existing: true,
        messageSent: Boolean(safeInitialMessage),
      })
    }

    const conversation = await prisma.conversation.create({
      data: {
        jobId,
        participants: {
          create: [
            { userId: user.id },
            { userId: participantId },
          ],
        },
        ...(safeInitialMessage ? {
          messages: {
            create: {
              senderId: user.id,
              text: safeInitialMessage,
            },
          },
        } : {}),
      },
      include: {
        participants: {
          include: {
            user: { select: { id: true, name: true, taskerProfile: { select: { profileImage: true } } } },
          },
        },
        messages: { take: 1, orderBy: { createdAt: 'desc' } },
      },
    })

    if (safeInitialMessage) {
      await createNotification({
        userId: participantId,
        title: user.name || 'New message',
        body: safeInitialMessage.slice(0, 120),
        referenceType: 'CHAT',
        referenceId: conversation.id,
      })
    }

    return NextResponse.json({
      id: conversation.id,
      jobId: conversation.jobId,
      participants: conversation.participants.map(p => ({ id: p.user.id, name: p.user.name, profileImage: p.user.taskerProfile?.profileImage })),
      messageSent: Boolean(safeInitialMessage),
    })
  } catch (error) {
    logger.error('Conversation create failed unexpectedly', { err: error, route: '/api/mobile/conversations', method: 'POST' })
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateRequest, assertNotSuspended } from '@/lib/mobile-auth'
import { scanChatMessage } from '@/lib/fraud-detection'
import { sendExpoPush } from '@/lib/push'

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
    console.error('Conversations list error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await authenticateRequest(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const blocked = assertNotSuspended(user)
    if (blocked) return blocked

    const body = await request.json()
    const participantId = typeof body.participantId === 'string' ? body.participantId.trim() : ''
    const jobId = typeof body.jobId === 'string' ? body.jobId.trim() : ''
    const initialMessage = typeof body.initialMessage === 'string' ? body.initialMessage.trim() : ''

    if (!participantId || !jobId) {
      return NextResponse.json({ error: 'participantId and jobId are required for marketplace chat' }, { status: 400 })
    }
    if (participantId === user.id) return NextResponse.json({ error: 'Cannot start a conversation with yourself' }, { status: 400 })
    if (initialMessage.length > 2000) return NextResponse.json({ error: 'Initial message is too long' }, { status: 400 })

    const [participant, job] = await Promise.all([
      prisma.user.findUnique({ where: { id: participantId }, select: { id: true, pushToken: true } }),
      prisma.marketplaceJob.findUnique({ where: { id: jobId } }),
    ])
    if (!participant || !job) return NextResponse.json({ error: 'Participant or job not found' }, { status: 404 })

    const quotes = await prisma.jobQuote.findMany({
      where: { jobId },
      select: { providerId: true, providerType: true, actorUserId: true },
    })

    const companyIds = quotes.filter(q => q.providerType === 'COMPANY').map(q => q.providerId)
    const companies = companyIds.length
      ? await prisma.companyProfile.findMany({
          where: { id: { in: companyIds } },
          select: { id: true, userId: true },
        })
      : []
    const companyOwnerById = new Map(companies.map(company => [company.id, company.userId]))

    let targetTaskerUserId: string | null = null
    if (job.targetTaskerId) {
      const target = await prisma.taskerProfile.findFirst({
        where: { OR: [{ id: job.targetTaskerId }, { userId: job.targetTaskerId }] },
        select: { userId: true },
      })
      targetTaskerUserId = target?.userId || null
    }

    const providerUserIds = new Set<string>()
    if (targetTaskerUserId) providerUserIds.add(targetTaskerUserId)
    for (const quote of quotes) {
      if (quote.providerType === 'INDIVIDUAL') providerUserIds.add(quote.providerId)
      else {
        if (quote.actorUserId) providerUserIds.add(quote.actorUserId)
        const ownerId = companyOwnerById.get(quote.providerId)
        if (ownerId) providerUserIds.add(ownerId)
      }
    }

    const callerIsCustomer = job.customerId === user.id
    const participantIsCustomer = job.customerId === participantId
    const authorizedPair =
      (callerIsCustomer && providerUserIds.has(participantId)) ||
      (participantIsCustomer && providerUserIds.has(user.id))

    if (!authorizedPair) {
      return NextResponse.json({ error: 'Chat is available only between this job customer and an involved provider' }, { status: 403 })
    }

    const existingConversation = await prisma.conversation.findFirst({
      where: {
        jobId,
        AND: [
          { participants: { some: { userId: user.id } } },
          { participants: { some: { userId: participantId } } },
        ],
      },
      include: { participants: true },
    })
    if (existingConversation) return NextResponse.json({ id: existingConversation.id, existing: true })

    let safeInitialMessage = ''
    let scanWarnings: string[] = []
    if (initialMessage) {
      // Use a temporary placeholder conversation only after creation for audit linkage.
      safeInitialMessage = initialMessage
    }

    const conversation = await prisma.conversation.create({
      data: {
        jobId,
        participants: { create: [{ userId: user.id }, { userId: participantId }] },
      },
      include: {
        participants: {
          include: { user: { select: { id: true, name: true, taskerProfile: { select: { profileImage: true } } } } },
        },
      },
    })

    if (safeInitialMessage) {
      const scan = await scanChatMessage(safeInitialMessage, user.id, conversation.id)
      safeInitialMessage = scan.sanitizedText || safeInitialMessage
      scanWarnings = scan.warnings
      await prisma.message.create({
        data: { conversationId: conversation.id, senderId: user.id, text: safeInitialMessage },
      })
      await prisma.conversation.update({ where: { id: conversation.id }, data: { updatedAt: new Date() } })

      if (participant.pushToken) {
        void sendExpoPush(
          participant.pushToken,
          user.name || 'New message',
          safeInitialMessage.substring(0, 120),
          { type: 'CHAT_MESSAGE', conversationId: conversation.id, jobId, screen: '/(chat)/[id]', id: conversation.id },
          { priority: 'high', channelId: 'messages' },
        )
      }
    }

    return NextResponse.json({
      id: conversation.id,
      jobId: conversation.jobId,
      existing: false,
      warnings: scanWarnings,
      participants: conversation.participants.map(p => ({
        id: p.user.id,
        name: p.user.name,
        profileImage: p.user.taskerProfile?.profileImage,
      })),
    }, { status: 201 })
  } catch (error) {
    console.error('Conversation create error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

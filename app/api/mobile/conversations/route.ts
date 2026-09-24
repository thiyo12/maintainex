import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateRequest, assertNotSuspended } from '@/lib/mobile-auth'
import { scanChatMessage } from '@/lib/fraud-detection'
import { sendExpoPush } from '@/lib/push'

async function canOpenJobConversation(userId: string, participantId: string, jobId: string): Promise<boolean> {
  if (userId === participantId) return false

  const job = await prisma.marketplaceJob.findUnique({
    where: { id: jobId },
    select: { customerId: true },
  })
  if (!job) return false

  const quotes = await prisma.jobQuote.findMany({
    where: {
      jobId,
      status: { in: ['PENDING', 'ACCEPTED', 'SUPERSEDED'] },
    },
    select: {
      providerId: true,
      providerType: true,
      actorUserId: true,
    },
  })

  const providerUserIds = new Set<string>()
  const companyIds = quotes
    .filter(quote => quote.providerType === 'COMPANY')
    .map(quote => quote.providerId)

  for (const quote of quotes) {
    if (quote.providerType === 'INDIVIDUAL') providerUserIds.add(quote.providerId)
    if (quote.actorUserId) providerUserIds.add(quote.actorUserId)
  }

  if (companyIds.length > 0) {
    const companies = await prisma.companyProfile.findMany({
      where: { id: { in: companyIds } },
      select: { userId: true },
    })
    companies.forEach(company => providerUserIds.add(company.userId))
  }

  const userIsCustomer = userId === job.customerId
  const participantIsCustomer = participantId === job.customerId

  if (userIsCustomer) return providerUserIds.has(participantId)
  if (participantIsCustomer) return providerUserIds.has(userId)
  return false
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
    console.error('Conversations list error:', error)
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
    if (!participantId) {
      return NextResponse.json({ error: 'participantId required' }, { status: 400 })
    }

    const participant = await prisma.user.findUnique({
      where: { id: participantId },
      select: { id: true, pushToken: true },
    })
    if (!participant) {
      return NextResponse.json({ error: 'Participant not found' }, { status: 404 })
    }

    if (jobId && !(await canOpenJobConversation(user.id, participantId, jobId))) {
      return NextResponse.json({ error: 'Messaging is available after a provider has quoted on this job.' }, { status: 403 })
    }

    const existingConversation = await prisma.conversation.findFirst({
      where: {
        AND: [
          { participants: { some: { userId: user.id } } },
          { participants: { some: { userId: participantId } } },
          ...(jobId ? [{ jobId }] : []),
        ],
      },
      include: { participants: true },
    })

    if (existingConversation) {
      return NextResponse.json({ id: existingConversation.id, existing: true })
    }

    let safeInitialMessage: string | undefined
    if (typeof initialMessage === 'string' && initialMessage.trim()) {
      const raw = initialMessage.trim().slice(0, 2000)
      const scan = await scanChatMessage(raw, user.id, `new:${jobId || 'general'}`)
      safeInitialMessage = scan.sanitizedText || raw
    }

    const conversation = await prisma.conversation.create({
      data: {
        jobId: jobId || null,
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

    if (safeInitialMessage && participant.pushToken) {
      void sendExpoPush(
        participant.pushToken,
        user.name || 'New message',
        safeInitialMessage.substring(0, 120),
        { screen: '/(chat)/[id]', id: conversation.id, type: 'CHAT_MESSAGE' },
        { channelId: 'default', priority: 'high' },
      )
    }

    return NextResponse.json({
      id: conversation.id,
      jobId: conversation.jobId,
      participants: conversation.participants.map(p => ({ id: p.user.id, name: p.user.name, profileImage: p.user.taskerProfile?.profileImage })),
    })
  } catch (error) {
    console.error('Conversation create error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

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
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const blocked = assertNotSuspended(user)
    if (blocked) return blocked

    const { participantId, jobId, initialMessage } = await request.json()
    if (!participantId) {
      return NextResponse.json({ error: 'participantId required' }, { status: 400 })
    }
    if (participantId === user.id) {
      return NextResponse.json({ error: 'Cannot start a conversation with yourself' }, { status: 400 })
    }
    if (!jobId) {
      return NextResponse.json({ error: 'jobId is required to start a new conversation' }, { status: 400 })
    }

    const job = await prisma.marketplaceJob.findUnique({
      where: { id: jobId },
      select: { customerId: true, targetTaskerId: true },
    })
    if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 })

    const quotes = await prisma.jobQuote.findMany({
      where: { jobId },
      select: { providerId: true, providerType: true },
    })
    const companyIds = quotes.filter(q => q.providerType === 'COMPANY').map(q => q.providerId)
    const companies = companyIds.length
      ? await prisma.companyProfile.findMany({ where: { id: { in: companyIds } }, select: { id: true, userId: true } })
      : []
    const companyOwnerIds = new Set(companies.map(company => company.userId))
    const individualProviderIds = new Set(quotes.filter(q => q.providerType === 'INDIVIDUAL').map(q => q.providerId))

    const targetProfile = job.targetTaskerId
      ? await prisma.taskerProfile.findFirst({
          where: { OR: [{ id: job.targetTaskerId }, { userId: job.targetTaskerId }] },
          select: { userId: true },
        })
      : null

    const actorCompanyMembership = companyIds.length
      ? await prisma.teamMember.findFirst({
          where: { companyId: { in: companyIds }, userId: user.id, status: 'ACTIVE' },
          select: { companyId: true },
        })
      : null

    const actorIsProvider = individualProviderIds.has(user.id)
      || targetProfile?.userId === user.id
      || companyOwnerIds.has(user.id)
      || Boolean(actorCompanyMembership)

    const participantIsProvider = individualProviderIds.has(participantId)
      || targetProfile?.userId === participantId
      || companyOwnerIds.has(participantId)

    const authorizedPair =
      (user.id === job.customerId && participantIsProvider)
      || (participantId === job.customerId && actorIsProvider)

    if (!authorizedPair) {
      return NextResponse.json({ error: 'Messaging is only available between this job customer and an eligible/quoting provider' }, { status: 403 })
    }

    // Dedup scoped to job + the same two participants
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

    const conversation = await prisma.conversation.create({
      data: {
        jobId: jobId || null,
        participants: {
          create: [
            { userId: user.id },
            { userId: participantId },
          ],
        },
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

    if (initialMessage?.trim()) {
      const raw = String(initialMessage).trim().slice(0, 2000)
      const scan = await scanChatMessage(raw, user.id, conversation.id)
      const messageText = scan.sanitizedText || raw
      await prisma.message.create({
        data: { conversationId: conversation.id, senderId: user.id, text: messageText },
      })
      const recipient = await prisma.user.findUnique({
        where: { id: participantId },
        select: { pushToken: true },
      })
      if (recipient?.pushToken) {
        void sendExpoPush(
          recipient.pushToken,
          user.name || 'New message',
          messageText.slice(0, 120),
          { screen: '/(chat)/[id]', id: conversation.id, type: 'CHAT_MESSAGE', jobId },
          { channelId: 'messages', priority: 'high' },
        )
      }
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
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateRequest, assertNotSuspended } from '@/lib/mobile-auth'
import { scanChatMessage } from '@/lib/fraud-detection'
import { sendExpoPush } from '@/lib/push'
import { checkRateLimit } from '@/lib/rate-limit/middleware'

const MAX_MESSAGE_LENGTH = 1000
const DAILY_MESSAGE_LIMIT = 100
const BURST_MESSAGE_LIMIT = 20
const BURST_WINDOW_MS = 5 * 60 * 1000

async function authorizeJobChat(userId: string, participantId: string, jobId: string): Promise<boolean> {
  const job = await prisma.marketplaceJob.findUnique({
    where: { id: jobId },
    select: { customerId: true },
  })
  if (!job) return false

  if (job.customerId === userId) {
    const participantCompany = await prisma.companyProfile.findUnique({
      where: { userId: participantId },
      select: { id: true },
    })
    const quote = await prisma.jobQuote.findFirst({
      where: {
        jobId,
        OR: [
          { providerType: 'INDIVIDUAL', providerId: participantId },
          ...(participantCompany ? [{ providerType: 'COMPANY', providerId: participantCompany.id }] : []),
        ],
      },
      select: { id: true },
    })
    return !!quote
  }

  if (participantId !== job.customerId) return false

  const memberships = await prisma.teamMember.findMany({
    where: { userId, status: 'ACTIVE' },
    select: { companyId: true },
  })
  const companyIds = memberships.map((membership) => membership.companyId)
  const quote = await prisma.jobQuote.findFirst({
    where: {
      jobId,
      OR: [
        { providerType: 'INDIVIDUAL', providerId: userId },
        ...(companyIds.length
          ? [{ providerType: 'COMPANY', providerId: { in: companyIds } }]
          : []),
      ],
    },
    select: { id: true },
  })
  return !!quote
}

async function appendMessage(
  conversationId: string,
  senderId: string,
  senderName: string | null,
  rawText: unknown,
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  if (typeof rawText !== 'string' || !rawText.trim()) return { ok: true }

  const text = rawText.trim()
  if (text.length > MAX_MESSAGE_LENGTH) {
    return { ok: false, status: 400, error: `Message is too long. Maximum ${MAX_MESSAGE_LENGTH} characters.` }
  }

  const now = Date.now()
  const [sentToday, sentInBurst] = await Promise.all([
    prisma.message.count({
      where: {
        conversationId,
        senderId,
        createdAt: { gte: new Date(now - 24 * 60 * 60 * 1000) },
      },
    }),
    prisma.message.count({
      where: {
        conversationId,
        senderId,
        createdAt: { gte: new Date(now - BURST_WINDOW_MS) },
      },
    }),
  ])

  if (sentInBurst >= BURST_MESSAGE_LIMIT) {
    return { ok: false, status: 429, error: 'You are sending messages too quickly. Please wait a moment.' }
  }
  if (sentToday >= DAILY_MESSAGE_LIMIT) {
    return { ok: false, status: 429, error: 'Daily message limit reached for this job conversation.' }
  }

  const scan = await scanChatMessage(text, senderId, conversationId)
  const messageText = scan.sanitizedText || text
  await prisma.message.create({
    data: { conversationId, senderId, text: messageText },
  })
  await prisma.conversation.update({
    where: { id: conversationId },
    data: { updatedAt: new Date() },
  })

  const recipient = await prisma.conversationParticipant.findFirst({
    where: { conversationId, userId: { not: senderId } },
    select: { user: { select: { pushToken: true } } },
  })
  if (recipient?.user.pushToken) {
    await sendExpoPush(
      recipient.user.pushToken,
      senderName || 'New message',
      messageText.substring(0, 120),
      { screen: '/(chat)/[id]', id: conversationId, conversationId, type: 'CHAT_MESSAGE' },
      { channelId: 'messages', priority: 'high' },
    )
  }

  return { ok: true }
}

export async function GET(request: NextRequest) {
  try {
    const user = await authenticateRequest(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const conversations = await prisma.conversation.findMany({
      where: { participants: { some: { userId: user.id } } },
      include: {
        participants: {
          include: {
            user: {
              select: { id: true, name: true, taskerProfile: { select: { profileImage: true } } },
            },
          },
        },
        messages: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
      orderBy: { updatedAt: 'desc' },
    })

    const ids = conversations.map((conversation) => conversation.id)
    const unreadRows = ids.length
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
    const unreadMap = new Map(unreadRows.map((row) => [row.conversationId, row._count]))

    return NextResponse.json(
      conversations.map((conversation) => {
        const otherParticipant = conversation.participants.find((participant) => participant.userId !== user.id)
        const lastMessage = conversation.messages[0]
        return {
          id: conversation.id,
          jobId: conversation.jobId,
          otherUser: otherParticipant
            ? {
                id: otherParticipant.user.id,
                name: otherParticipant.user.name,
                profileImage: otherParticipant.user.taskerProfile?.profileImage,
              }
            : null,
          lastMessage: lastMessage
            ? {
                text: lastMessage.text,
                createdAt: lastMessage.createdAt.toISOString(),
                senderId: lastMessage.senderId,
              }
            : null,
          unreadCount: unreadMap.get(conversation.id) || 0,
          updatedAt: conversation.updatedAt.toISOString(),
        }
      }),
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

    const { participantId, jobId, initialMessage } = await request.json()
    if (typeof participantId !== 'string' || !participantId) {
      return NextResponse.json({ error: 'participantId required' }, { status: 400 })
    }
    if (participantId === user.id) {
      return NextResponse.json({ error: 'Cannot start a conversation with yourself' }, { status: 400 })
    }
    if (typeof initialMessage === 'string' && initialMessage.trim().length > MAX_MESSAGE_LENGTH) {
      return NextResponse.json({ error: `Message is too long. Maximum ${MAX_MESSAGE_LENGTH} characters.` }, { status: 400 })
    }

    const participant = await prisma.user.findUnique({
      where: { id: participantId },
      select: { id: true },
    })
    if (!participant) return NextResponse.json({ error: 'Participant not found' }, { status: 404 })

    if (jobId && !(await authorizeJobChat(user.id, participantId, jobId))) {
      return NextResponse.json({ error: 'You can only message participants connected to this job' }, { status: 403 })
    }

    const existingConversation = await prisma.conversation.findFirst({
      where: {
        AND: [
          { participants: { some: { userId: user.id } } },
          { participants: { some: { userId: participantId } } },
          ...(jobId ? [{ jobId }] : [{ jobId: null }]),
        ],
      },
      include: { participants: true },
    })

    if (existingConversation) {
      const appended = await appendMessage(existingConversation.id, user.id, user.name, initialMessage)
      if (!appended.ok) return NextResponse.json({ error: appended.error }, { status: appended.status })
      return NextResponse.json({ id: existingConversation.id, existing: true })
    }

    const startLimit = await checkRateLimit(request, {
      policy: {
        name: 'chat_start',
        limit: 20,
        windowMs: 60 * 60 * 1000,
        failureMode: 'fail-open',
        riskLevel: 'medium',
      },
      keyPrefix: 'chat_start',
      identifier: user.id,
    })
    if (!startLimit.allowed && startLimit.response) return startLimit.response

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
            user: {
              select: { id: true, name: true, taskerProfile: { select: { profileImage: true } } },
            },
          },
        },
      },
    })

    const appended = await appendMessage(conversation.id, user.id, user.name, initialMessage)
    if (!appended.ok) return NextResponse.json({ error: appended.error }, { status: appended.status })

    return NextResponse.json({
      id: conversation.id,
      existing: false,
      jobId: conversation.jobId,
      participants: conversation.participants.map((participantRow) => ({
        id: participantRow.user.id,
        name: participantRow.user.name,
        profileImage: participantRow.user.taskerProfile?.profileImage,
      })),
    })
  } catch (error) {
    console.error('Conversation create error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

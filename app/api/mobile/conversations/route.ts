import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateRequest, assertNotSuspended } from '@/lib/mobile-auth'
import { scanChatMessage } from '@/lib/fraud-detection'
import { sendExpoPush } from '@/lib/push'

const MAX_MESSAGE_LENGTH = 2000

async function canStartJobConversation(userId: string, participantId: string, jobId: string): Promise<boolean> {
  const job = await prisma.marketplaceJob.findUnique({
    where: { id: jobId },
    select: { customerId: true, targetTaskerId: true },
  })
  if (!job) return false

  const requesterIsCustomer = job.customerId === userId
  const participantIsCustomer = job.customerId === participantId
  if (!requesterIsCustomer && !participantIsCustomer) return false

  const providerUserId = requesterIsCustomer ? participantId : userId

  const individualQuote = await prisma.jobQuote.findFirst({
    where: {
      jobId,
      providerType: 'INDIVIDUAL',
      providerId: providerUserId,
    },
    select: { id: true },
  })
  if (individualQuote) return true

  const companyQuote = await prisma.jobQuote.findFirst({
    where: { jobId, providerType: 'COMPANY' },
    select: { providerId: true },
  })
  if (companyQuote) {
    const companyMember = await prisma.teamMember.findFirst({
      where: {
        companyId: companyQuote.providerId,
        userId: providerUserId,
        status: 'ACTIVE',
      },
      select: { id: true },
    })
    if (companyMember) return true
  }

  if (job.targetTaskerId) {
    if (job.targetTaskerId === providerUserId) return true
    const target = await prisma.taskerProfile.findFirst({
      where: {
        id: job.targetTaskerId,
        userId: providerUserId,
      },
      select: { id: true },
    })
    if (target) return true
  }

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
      take: 100,
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

    const body = await request.json()
    const participantId = typeof body?.participantId === 'string' ? body.participantId.trim() : ''
    const jobId = typeof body?.jobId === 'string' ? body.jobId.trim() : ''
    const initialRaw = typeof body?.initialMessage === 'string' ? body.initialMessage.trim() : ''

    if (!participantId) {
      return NextResponse.json({ error: 'participantId required' }, { status: 400 })
    }
    if (participantId === user.id) {
      return NextResponse.json({ error: 'Cannot start a conversation with yourself' }, { status: 400 })
    }
    if (initialRaw.length > MAX_MESSAGE_LENGTH) {
      return NextResponse.json({ error: `Message is too long. Maximum ${MAX_MESSAGE_LENGTH} characters.` }, { status: 400 })
    }

    const participant = await prisma.user.findUnique({
      where: { id: participantId },
      select: { id: true, isActive: true, isSuspended: true, pushToken: true },
    })
    if (!participant || !participant.isActive || participant.isSuspended) {
      return NextResponse.json({ error: 'Recipient is not available' }, { status: 404 })
    }

    if (jobId && !(await canStartJobConversation(user.id, participantId, jobId))) {
      return NextResponse.json({ error: 'Messaging is only available between participants in this job' }, { status: 403 })
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
      return NextResponse.json({ id: existingConversation.id, existing: true })
    }

    let initialMessage = initialRaw
    let flagged = false
    let warnings: string[] = []
    if (initialRaw) {
      const scan = await scanChatMessage(initialRaw, user.id, `new:${jobId || participantId}`)
      initialMessage = scan.sanitizedText || initialRaw
      flagged = scan.flagged
      warnings = scan.warnings
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
        ...(initialMessage ? {
          messages: {
            create: {
              senderId: user.id,
              text: initialMessage,
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
      },
    })

    if (initialMessage && participant.pushToken) {
      await sendExpoPush(
        participant.pushToken,
        user.name || 'New message',
        initialMessage.slice(0, 120),
        {
          type: 'CHAT_MESSAGE',
          screen: '/(chat)/[id]',
          id: conversation.id,
          conversationId: conversation.id,
          ...(jobId ? { jobId } : {}),
        },
        {
          channelId: 'messages',
          priority: 'high',
          interruptionLevel: 'active',
        },
      )
    }

    return NextResponse.json({
      id: conversation.id,
      jobId: conversation.jobId,
      existing: false,
      flagged,
      warnings,
      participants: conversation.participants.map(p => ({
        id: p.user.id,
        name: p.user.name,
        profileImage: p.user.taskerProfile?.profileImage,
      })),
    })
  } catch (error) {
    console.error('Conversation create error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

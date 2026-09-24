import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateRequest, assertNotSuspended } from '@/lib/mobile-auth'

async function getJobChatParticipantUserIds(jobId: string): Promise<Set<string> | null> {
  const job = await prisma.marketplaceJob.findUnique({
    where: { id: jobId },
    select: { customerId: true },
  })
  if (!job) return null

  const [quotes, assignments] = await Promise.all([
    prisma.jobQuote.findMany({
      where: {
        jobId,
        status: { in: ['PENDING', 'ACCEPTED', 'SUPERSEDED'] },
      },
      select: { providerId: true, providerType: true },
    }),
    prisma.companyJobAssignment.findMany({
      where: {
        jobId,
        status: { in: ['ASSIGNED', 'ACCEPTED', 'IN_PROGRESS', 'COMPLETED'] },
      },
      select: { workerUserId: true },
    }),
  ])

  const ids = new Set<string>([job.customerId])
  const companyIds = quotes
    .filter(quote => quote.providerType === 'COMPANY')
    .map(quote => quote.providerId)

  for (const quote of quotes) {
    if (quote.providerType === 'INDIVIDUAL') ids.add(quote.providerId)
  }

  if (companyIds.length > 0) {
    const companies = await prisma.companyProfile.findMany({
      where: { id: { in: companyIds } },
      select: { userId: true },
    })
    companies.forEach(company => ids.add(company.userId))
  }

  assignments.forEach(assignment => ids.add(assignment.workerUserId))
  return ids
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
    if (!participantId || typeof participantId !== 'string') {
      return NextResponse.json({ error: 'participantId required' }, { status: 400 })
    }
    if (participantId === user.id) {
      return NextResponse.json({ error: 'Cannot create a conversation with yourself' }, { status: 400 })
    }
    if (initialMessage && (typeof initialMessage !== 'string' || initialMessage.trim().length > 1000)) {
      return NextResponse.json({ error: 'Initial message must be 1000 characters or fewer' }, { status: 400 })
    }

    const participant = await prisma.user.findUnique({
      where: { id: participantId },
      select: { id: true, isActive: true, isSuspended: true, isBanned: true },
    })
    if (!participant || !participant.isActive || participant.isSuspended || participant.isBanned) {
      return NextResponse.json({ error: 'Participant unavailable' }, { status: 404 })
    }

    if (jobId) {
      const allowed = await getJobChatParticipantUserIds(jobId)
      if (!allowed) {
        return NextResponse.json({ error: 'Job not found' }, { status: 404 })
      }
      if (!allowed.has(user.id) || !allowed.has(participantId)) {
        return NextResponse.json({ error: 'Job conversation is limited to job participants' }, { status: 403 })
      }
    }

    const dayStart = new Date(Date.now() - 24 * 60 * 60 * 1000)
    const conversationsCreatedToday = await prisma.conversation.count({
      where: {
        createdAt: { gte: dayStart },
        participants: { some: { userId: user.id } },
      },
    })
    if (conversationsCreatedToday >= 20) {
      return NextResponse.json({ error: 'Conversation limit reached. Please try again later.' }, { status: 429 })
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
        messages: { take: 1, orderBy: { createdAt: 'desc' } },
      },
    })

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
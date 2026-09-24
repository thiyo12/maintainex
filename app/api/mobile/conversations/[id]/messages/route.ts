import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateRequest, assertNotSuspended } from '@/lib/mobile-auth'
import { scanChatMessage } from '@/lib/fraud-detection'
import { sendExpoPush } from '@/lib/push'

const MAX_MESSAGE_LENGTH = 2000
const DAILY_CONVERSATION_LIMIT = 200
const DAILY_USER_LIMIT = 500
const BURST_LIMIT = 20
const BURST_WINDOW_MS = 60 * 1000

async function findMemberConversation(conversationId: string, userId: string) {
  return prisma.conversation.findFirst({
    where: {
      id: conversationId,
      participants: { some: { userId } },
    },
    include: {
      participants: {
        include: {
          user: { select: { id: true, name: true, pushToken: true, email: true } },
        },
      },
    },
  })
}

async function enforceMessageLimits(conversationId: string, userId: string) {
  const now = Date.now()
  const sinceDay = new Date(now - 24 * 60 * 60 * 1000)
  const sinceBurst = new Date(now - BURST_WINDOW_MS)

  const [conversationDaily, userDaily, burst] = await Promise.all([
    prisma.message.count({
      where: {
        conversationId,
        senderId: userId,
        createdAt: { gte: sinceDay },
      },
    }),
    prisma.message.count({
      where: {
        senderId: userId,
        createdAt: { gte: sinceDay },
      },
    }),
    prisma.message.count({
      where: {
        senderId: userId,
        createdAt: { gte: sinceBurst },
      },
    }),
  ])

  if (burst >= BURST_LIMIT) {
    return NextResponse.json(
      { error: 'You are sending messages too quickly. Please wait a moment.' },
      { status: 429, headers: { 'Retry-After': '60' } },
    )
  }

  if (conversationDaily >= DAILY_CONVERSATION_LIMIT) {
    return NextResponse.json(
      { error: 'Daily message limit reached for this job conversation. Try again tomorrow.' },
      { status: 429 },
    )
  }

  if (userDaily >= DAILY_USER_LIMIT) {
    return NextResponse.json(
      { error: 'Daily account message limit reached. Try again tomorrow.' },
      { status: 429 },
    )
  }

  return null
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const user = await authenticateRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const blocked = assertNotSuspended(user)
    if (blocked) return blocked

    const body = await request.json()
    const rawText = typeof body?.text === 'string' ? body.text.trim() : ''
    if (!rawText) {
      return NextResponse.json({ error: 'Message text required' }, { status: 400 })
    }
    if (rawText.length > MAX_MESSAGE_LENGTH) {
      return NextResponse.json(
        { error: `Message is too long. Maximum ${MAX_MESSAGE_LENGTH} characters.` },
        { status: 400 },
      )
    }

    const conversation = await findMemberConversation(id, user.id)
    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
    }

    const rateLimited = await enforceMessageLimits(id, user.id)
    if (rateLimited) return rateLimited

    const scan = await scanChatMessage(rawText, user.id, id)
    const messageText = scan.sanitizedText || rawText

    const message = await prisma.message.create({
      data: {
        conversationId: id,
        senderId: user.id,
        text: messageText,
      },
    })

    await prisma.conversation.update({
      where: { id },
      data: { updatedAt: new Date() },
    })

    const recipients = conversation.participants.filter(p => p.userId !== user.id)
    await Promise.all(recipients.map(async recipient => {
      if (!recipient.user.pushToken) return
      await sendExpoPush(
        recipient.user.pushToken,
        user.name || 'New message',
        messageText.substring(0, 120),
        { type: 'CHAT_MESSAGE', screen: '/(chat)/[id]', id, conversationId: id },
        {
          channelId: 'messages',
          priority: 'high',
          interruptionLevel: 'active',
        },
      )
    }))

    return NextResponse.json({
      id: message.id,
      senderId: message.senderId,
      text: message.text,
      read: message.read,
      flagged: scan.flagged,
      warnings: scan.warnings,
      createdAt: message.createdAt.toISOString(),
    })
  } catch (error) {
    console.error('Message create error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const user = await authenticateRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const conversation = await prisma.conversation.findFirst({
      where: {
        id,
        participants: { some: { userId: user.id } },
      },
      select: { id: true },
    })

    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
    }

    const { searchParams } = new URL(request.url)
    const after = searchParams.get('after')

    const where: any = { conversationId: id }
    if (after) {
      const afterDate = new Date(after)
      if (Number.isNaN(afterDate.getTime())) {
        return NextResponse.json({ error: 'Invalid after timestamp' }, { status: 400 })
      }
      where.createdAt = { gt: afterDate }
    }

    const messages = await prisma.message.findMany({
      where,
      orderBy: { createdAt: 'asc' },
      take: 500,
    })

    const unreadIds = messages.filter(m => m.senderId !== user.id && !m.read).map(m => m.id)
    if (unreadIds.length > 0) {
      await prisma.$transaction([
        prisma.message.updateMany({
          where: { id: { in: unreadIds } },
          data: { read: true },
        }),
        prisma.conversationParticipant.updateMany({
          where: { conversationId: id, userId: user.id },
          data: { lastReadAt: new Date() },
        }),
      ])
    }

    return NextResponse.json(
      messages.map(m => ({
        id: m.id,
        senderId: m.senderId,
        text: m.text,
        read: m.senderId === user.id ? m.read : true,
        createdAt: m.createdAt.toISOString(),
      }))
    )
  } catch (error) {
    console.error('Messages list error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

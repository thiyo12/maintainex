import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateRequest, assertNotSuspended } from '@/lib/mobile-auth'
import { scanChatMessage } from '@/lib/fraud-detection'
import { sendExpoPush } from '@/lib/push'

const DAILY_MESSAGE_LIMIT = 100
const PER_MINUTE_MESSAGE_LIMIT = 15
const MAX_MESSAGE_LENGTH = 1000

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const user = await authenticateRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const blocked = assertNotSuspended(user)
    if (blocked) return blocked

    const { text } = await request.json()
    if (!text?.trim()) {
      return NextResponse.json({ error: 'Message text required' }, { status: 400 })
    }
    if (typeof text !== 'string' || text.trim().length > MAX_MESSAGE_LENGTH) {
      return NextResponse.json({ error: `Message must be ${MAX_MESSAGE_LENGTH} characters or fewer` }, { status: 400 })
    }

    const conversation = await prisma.conversation.findFirst({
      where: {
        id,
        participants: { some: { userId: user.id } },
      },
      include: {
        participants: {
          include: { user: { select: { id: true, name: true, pushToken: true, email: true } } },
        },
      },
    })

    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
    }

    // Anti-spam limits: burst + rolling daily cap per conversation/user.
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000)
    const oneMinuteAgo = new Date(Date.now() - 60 * 1000)
    const [sentToday, sentLastMinute] = await Promise.all([
      prisma.message.count({
        where: {
          conversationId: id,
          senderId: user.id,
          createdAt: { gte: since },
        },
      }),
      prisma.message.count({
        where: {
          conversationId: id,
          senderId: user.id,
          createdAt: { gte: oneMinuteAgo },
        },
      }),
    ])
    if (sentLastMinute >= PER_MINUTE_MESSAGE_LIMIT) {
      return NextResponse.json({
        error: 'You are sending messages too quickly. Please wait a moment.',
      }, { status: 429 })
    }
    if (sentToday >= DAILY_MESSAGE_LIMIT) {
      return NextResponse.json({
        error: 'Daily message limit reached. Please continue using Maintainex for safe communication.',
      }, { status: 429 })
    }

    // Fraud scan: always runs, never blocks — sanitizes + flags
    const scan = await scanChatMessage(text.trim(), user.id, id)
    const messageText = scan.sanitizedText || text.trim()

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

    // Push notification to the other participant
    const recipient = conversation.participants.find(p => p.userId !== user.id)
    if (recipient?.user.pushToken) {
      void sendExpoPush(
        recipient.user.pushToken,
        user.name || 'New message',
        messageText.substring(0, 120),
        { screen: '/(chat)/[id]', id }
      )
    }

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

    const participant = await prisma.conversationParticipant.findUnique({
      where: {
        conversationId_userId: {
          conversationId: id,
          userId: user.id,
        },
      },
      select: { id: true },
    })
    if (!participant) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
    }

    const { searchParams } = new URL(request.url)
    const after = searchParams.get('after')

    const where: any = { conversationId: id }
    if (after) {
      where.createdAt = { gt: new Date(after) }
    }

    const messages = await prisma.message.findMany({
      where,
      orderBy: { createdAt: 'asc' },
    })

    // Mark received messages as read
    const unreadIds = messages.filter(m => m.senderId !== user.id && !m.read).map(m => m.id)
    if (unreadIds.length > 0) {
      await prisma.message.updateMany({
        where: { id: { in: unreadIds } },
        data: { read: true },
      })
      await prisma.conversationParticipant.updateMany({
        where: { conversationId: id, userId: user.id },
        data: { lastReadAt: new Date() },
      })
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
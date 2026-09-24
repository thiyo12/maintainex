import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateRequest, assertNotSuspended } from '@/lib/mobile-auth'
import { scanChatMessage } from '@/lib/fraud-detection'
import { sendExpoPush } from '@/lib/push'

const MAX_MESSAGE_LENGTH = 2000
const BURST_MESSAGE_LIMIT = 15
const DAILY_MESSAGE_LIMIT = 120

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const user = await authenticateRequest(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const blocked = assertNotSuspended(user)
    if (blocked) return blocked

    const body = await request.json()
    const rawText = typeof body?.text === 'string' ? body.text.trim() : ''
    if (!rawText) return NextResponse.json({ error: 'Message text required' }, { status: 400 })
    if (rawText.length > MAX_MESSAGE_LENGTH) {
      return NextResponse.json({ error: `Message is too long. Maximum ${MAX_MESSAGE_LENGTH} characters.` }, { status: 400 })
    }

    const conversation = await prisma.conversation.findFirst({
      where: { id, participants: { some: { userId: user.id } } },
      include: {
        participants: {
          include: { user: { select: { id: true, name: true, pushToken: true, email: true } } },
        },
      },
    })
    if (!conversation) return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })

    const now = Date.now()
    const [sentRecently, sentToday] = await Promise.all([
      prisma.message.count({
        where: {
          conversationId: id,
          senderId: user.id,
          createdAt: { gte: new Date(now - 60 * 1000) },
        },
      }),
      prisma.message.count({
        where: {
          conversationId: id,
          senderId: user.id,
          createdAt: { gte: new Date(now - 24 * 60 * 60 * 1000) },
        },
      }),
    ])

    if (sentRecently >= BURST_MESSAGE_LIMIT) {
      return NextResponse.json({ error: 'Too many messages. Please wait a minute before sending more.' }, { status: 429 })
    }
    if (sentToday >= DAILY_MESSAGE_LIMIT) {
      return NextResponse.json({ error: 'Daily message limit reached for this job conversation.' }, { status: 429 })
    }

    const scan = await scanChatMessage(rawText, user.id, id)
    const messageText = scan.sanitizedText || rawText

    const message = await prisma.message.create({
      data: { conversationId: id, senderId: user.id, text: messageText },
    })
    await prisma.conversation.update({ where: { id }, data: { updatedAt: new Date() } })

    const recipient = conversation.participants.find(p => p.userId !== user.id)
    if (recipient?.user.pushToken) {
      void sendExpoPush(
        recipient.user.pushToken,
        user.name || 'New message',
        messageText.substring(0, 120),
        { type: 'CHAT_MESSAGE', conversationId: id, jobId: conversation.jobId, screen: '/(chat)/[id]', id },
        { priority: 'high', channelId: 'messages' },
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
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const membership = await prisma.conversationParticipant.findUnique({
      where: { conversationId_userId: { conversationId: id, userId: user.id } },
      select: { id: true },
    })
    if (!membership) return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })

    const { searchParams } = new URL(request.url)
    const after = searchParams.get('after')
    const where: any = { conversationId: id }
    if (after) {
      const parsed = new Date(after)
      if (Number.isNaN(parsed.getTime())) return NextResponse.json({ error: 'Invalid after timestamp' }, { status: 400 })
      where.createdAt = { gt: parsed }
    }

    const messages = await prisma.message.findMany({ where, orderBy: { createdAt: 'asc' }, take: 250 })

    const unreadIds = messages.filter(m => m.senderId !== user.id && !m.read).map(m => m.id)
    if (unreadIds.length > 0) {
      await prisma.$transaction([
        prisma.message.updateMany({ where: { id: { in: unreadIds } }, data: { read: true } }),
        prisma.conversationParticipant.updateMany({
          where: { conversationId: id, userId: user.id },
          data: { lastReadAt: new Date() },
        }),
      ])
    }

    return NextResponse.json(messages.map(m => ({
      id: m.id,
      senderId: m.senderId,
      text: m.text,
      read: m.senderId === user.id ? m.read : true,
      createdAt: m.createdAt.toISOString(),
    })))
  } catch (error) {
    console.error('Messages list error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

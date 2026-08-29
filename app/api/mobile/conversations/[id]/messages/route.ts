import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateRequest, assertNotSuspended } from '@/lib/mobile-auth'
import { scanChatMessage } from '@/lib/fraud-detection'

const DAILY_MESSAGE_LIMIT = 50
const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send'

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
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

    const conversation = await prisma.conversation.findFirst({
      where: {
        id: params.id,
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

    // Rate limit: max 50 messages per conversation per day per user
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000)
    const sentToday = await prisma.message.count({
      where: {
        conversationId: params.id,
        senderId: user.id,
        createdAt: { gte: since },
      },
    })
    if (sentToday >= DAILY_MESSAGE_LIMIT) {
      return NextResponse.json({
        error: 'Daily message limit reached. Please continue using Maintainex for safe communication.',
      }, { status: 429 })
    }

    // Fraud scan: always runs, never blocks — sanitizes + flags
    const scan = await scanChatMessage(text.trim(), user.id, params.id)
    const messageText = scan.sanitizedText || text.trim()

    const message = await prisma.message.create({
      data: {
        conversationId: params.id,
        senderId: user.id,
        text: messageText,
      },
    })

    await prisma.conversation.update({
      where: { id: params.id },
      data: { updatedAt: new Date() },
    })

    // Push notification to the other participant
    const recipient = conversation.participants.find(p => p.userId !== user.id)
    if (recipient?.user.pushToken) {
      void sendExpoPush(
        recipient.user.pushToken,
        user.name || 'New message',
        messageText.substring(0, 120),
        { screen: '/(chat)/[id]', id: params.id }
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

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await authenticateRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const after = searchParams.get('after')

    const where: any = { conversationId: params.id }
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
        where: { conversationId: params.id, userId: user.id },
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

async function sendExpoPush(to: string, title: string, body: string, data: Record<string, unknown>): Promise<void> {
  try {
    const res = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([{ to, title, body, data, sound: 'default' }]),
    })
    if (!res.ok) return
    const result = await res.json()
    const ticket = result?.data?.[0]
    if (ticket?.status === 'error') {
      // Expired / invalid token — drop it so we stop attempting
      if (/DeviceNotRegistered|InvalidTokens|MessageTooBig/.test(ticket.details?.error || '')) {
        await prisma.user.updateMany({
          where: { pushToken: to },
          data: { pushToken: null },
        })
      }
    }
  } catch (error) {
    console.error('Expo push send error:', error)
  }
}
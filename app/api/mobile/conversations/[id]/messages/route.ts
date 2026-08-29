import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateRequest, assertNotSuspended } from '@/lib/mobile-auth'
import { scanChatMessage } from '@/lib/fraud-detection'

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
    })

    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
    }

    // Fraud detection: scan for contact sharing
    const scanResult = await scanChatMessage(text.trim(), user.id, params.id)
    if (!scanResult.allowed) {
      return NextResponse.json({
        error: 'Message blocked',
        reason: scanResult.reason,
        note: 'Sharing contact details before a booking is confirmed is against Maintainex policy.',
      }, { status: 403 })
    }

    const message = await prisma.message.create({
      data: {
        conversationId: params.id,
        senderId: user.id,
        text: text.trim(),
      },
    })

    await prisma.conversation.update({
      where: { id: params.id },
      data: { updatedAt: new Date() },
    })

    return NextResponse.json({
      id: message.id,
      senderId: message.senderId,
      text: message.text,
      read: message.read,
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

    return NextResponse.json(
      messages.map(m => ({
        id: m.id,
        senderId: m.senderId,
        text: m.text,
        read: m.read,
        createdAt: m.createdAt.toISOString(),
      }))
    )
  } catch (error) {
    console.error('Messages list error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

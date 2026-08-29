import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateRequest } from '@/lib/mobile-auth'

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await authenticateRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const conversation = await prisma.conversation.findFirst({
      where: {
        id: params.id,
        participants: { some: { userId: user.id } },
      },
      include: {
        participants: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                taskerProfile: { select: { profileImage: true } },
              },
            },
          },
        },
        messages: {
          orderBy: { createdAt: 'asc' },
        },
      },
    })

    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
    }

    // Mark received messages as read
    const unreadIds = conversation.messages.filter(m => m.senderId !== user.id && !m.read).map(m => m.id)
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

    // Job context for the chat header
    let jobContext: { id: string; title: string; ref: string; status?: string } | null = null
    if (conversation.jobId) {
      const job = await prisma.marketplaceJob.findUnique({
        where: { id: conversation.jobId },
        select: { id: true, title: true, status: true },
      })
      if (job) {
        jobContext = {
          id: job.id,
          title: job.title,
          ref: `#MX-${job.id.slice(-6).toUpperCase()}`,
          status: job.status,
        }
      }
    }

    const messages = conversation.messages.map((m: any) => ({
      id: m.id,
      senderId: m.senderId,
      text: m.text,
      read: m.read,
      createdAt: m.createdAt.toISOString(),
    }))
    if (unreadIds.length > 0) {
      for (const m of messages) if (unreadIds.includes(m.id)) m.read = true
    }

    return NextResponse.json({
      id: conversation.id,
      jobId: conversation.jobId,
      job: jobContext,
      participants: conversation.participants.map(p => ({
        id: p.user.id,
        name: p.user.name,
        email: p.user.email,
        profileImage: p.user.taskerProfile?.profileImage,
      })),
      messages,
    })
  } catch (error) {
    console.error('Conversation get error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
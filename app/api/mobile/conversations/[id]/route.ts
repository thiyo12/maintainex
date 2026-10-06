import { logger } from '@/lib/shared/observability/logger'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateRequest } from '@/lib/auth/compatibility/mobile-auth'

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
      include: {
        participants: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
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
        where: { conversationId: id, userId: user.id },
        data: { lastReadAt: new Date() },
      })
    }

    // Job context for the chat header
    let jobContext: {
      id: string; title: string; ref: string; status?: string;
      categoryName?: string | null; photos: string[]; budgetAmount?: number;
      aiEstimate?: any; responseState?: string | null;
    } | null = null
    if (conversation.jobId) {
      const job = await prisma.marketplaceJob.findUnique({
        where: { id: conversation.jobId },
      })
      if (job) {
        let photos: string[] = []
        try { const parsed = JSON.parse(job.photos); if (Array.isArray(parsed)) photos = parsed.filter((p) => typeof p === 'string') } catch { photos = [] }
        let aiEstimate: any = null
        try { if (job.aiEstimateJson) aiEstimate = JSON.parse(job.aiEstimateJson) } catch { aiEstimate = null }
        const cat = job.categoryId ? await prisma.jobCategory.findUnique({ where: { id: job.categoryId }, select: { name: true } }) : null
        jobContext = {
          id: job.id,
          title: job.title,
          ref: `#MX-${job.id.slice(-6).toUpperCase()}`,
          status: job.status,
          categoryName: cat?.name || null,
          photos,
          budgetAmount: Number(job.budgetAmount),
          aiEstimate,
          responseState: job.responseState,
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
        profileImage: p.user.taskerProfile?.profileImage,
      })),
      messages,
    })
  } catch (error) {
    logger.error('Conversation read failed unexpectedly', { err: error, route: '/api/mobile/conversations/[id]', method: 'GET' })
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
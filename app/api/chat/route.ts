import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth-utils'
import { chatMessageSchema } from '@/lib/validations'

export async function GET(request: NextRequest) {
  try {
    const session = await getSession(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const assignmentId = searchParams.get('assignmentId')
    const taskId = searchParams.get('taskId')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')

    const where: Record<string, unknown> = {
      OR: [
        { senderId: session.id },
        { receiverId: session.id },
      ]
    }

    if (assignmentId) where.assignmentId = assignmentId
    if (taskId) where.taskId = taskId

    const skip = (page - 1) * limit

    const messages = await prisma.chatMessage.findMany({
      where,
      include: {
        sender: { select: { id: true, name: true, avatarUrl: true, role: true } },
        receiver: { select: { id: true, name: true, avatarUrl: true, role: true } },
      },
      orderBy: { createdAt: 'asc' },
      skip,
      take: limit,
    })

    return NextResponse.json({
      success: true,
      data: messages,
    })
  } catch (error) {
    console.error('Chat fetch error:', error)
    return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const validation = chatMessageSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0]?.message || 'Invalid input' },
        { status: 400 }
      )
    }

    const { content, messageType, imageUrl, fileUrl } = validation.data

    if (!body.receiverId) {
      return NextResponse.json({ error: 'Receiver ID is required' }, { status: 400 })
    }

    const message = await prisma.chatMessage.create({
      data: {
        senderId: session.id,
        receiverId: body.receiverId,
        content,
        messageType,
        assignmentId: body.assignmentId || null,
        taskId: body.taskId || null,
        imageUrl: imageUrl || null,
        fileUrl: fileUrl || null,
      },
      include: {
        sender: { select: { id: true, name: true, avatarUrl: true } },
      }
    })

    return NextResponse.json({
      success: true,
      data: message,
    }, { status: 201 })
  } catch (error) {
    console.error('Chat send error:', error)
    return NextResponse.json({ error: 'Failed to send message' }, { status: 500 })
  }
}

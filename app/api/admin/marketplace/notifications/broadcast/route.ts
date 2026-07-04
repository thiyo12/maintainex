import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth-utils'
import { prisma } from '@/lib/prisma'
import { createNotification } from '@/lib/notifications'

export async function POST(request: NextRequest) {
  const session = await getSession(request)
  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  if (session.role !== 'ADMIN' && session.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  }

  try {
    const { title, body, target } = await request.json()

    if (!title || !body || !target) {
      return NextResponse.json(
        { success: false, error: 'title, body, and target are required' },
        { status: 400 }
      )
    }

    if (title.length > 50) {
      return NextResponse.json(
        { success: false, error: 'title must be 50 characters or less' },
        { status: 400 }
      )
    }

    if (body.length > 200) {
      return NextResponse.json(
        { success: false, error: 'body must be 200 characters or less' },
        { status: 400 }
      )
    }

    if (!['all', 'taskers', 'customers', 'companies'].includes(target)) {
      return NextResponse.json(
        { success: false, error: 'target must be all, taskers, customers, or companies' },
        { status: 400 }
      )
    }

    const where: Record<string, any> = { isActive: true }

    switch (target) {
      case 'taskers':
        where.taskerProfile = { isNot: null }
        break
      case 'customers':
        where.role = 'CUSTOMER'
        where.customerProfile = { isNot: null }
        break
      case 'companies':
        where.companyProfile = { isNot: null }
        break
    }

    const users = await prisma.user.findMany({
      where,
      select: { id: true },
    })

    if (users.length === 0) {
      return NextResponse.json({ success: true, count: 0 })
    }

    await Promise.all(
      users.map((user) =>
        createNotification({
          userId: user.id,
          title,
          body,
        })
      )
    )

    return NextResponse.json({ success: true, count: users.length })
  } catch (e) {
    console.error('Broadcast notifications error:', e)
    return NextResponse.json(
      { success: false, error: 'Failed to send broadcast notifications' },
      { status: 500 }
    )
  }
}

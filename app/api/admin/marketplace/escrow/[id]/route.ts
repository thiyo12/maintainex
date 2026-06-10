import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdminSession } from '@/lib/admin-auth'

const ALLOWED_ROLES = ['SUPER_ADMIN', 'ADMIN']

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await getAdminSession(request)
  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const escrow = await prisma.jobEscrow.findUnique({ where: { id: params.id } })
    if (!escrow) {
      return NextResponse.json({ success: false, error: 'Escrow not found' }, { status: 404 })
    }
    return NextResponse.json({ success: true, data: escrow })
  } catch (error) {
    console.error('Escrow detail error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch escrow' },
      { status: 500 },
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await getAdminSession(request)
  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  if (!ALLOWED_ROLES.includes(session.role)) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  }

  try {
    const body = await request.json()
    const { action, reason } = body

    if (!['release', 'refund'].includes(action)) {
      return NextResponse.json(
        { success: false, error: 'Invalid action' },
        { status: 400 },
      )
    }

    const escrow = await prisma.jobEscrow.findUnique({ where: { id: params.id } })
    if (!escrow) {
      return NextResponse.json({ success: false, error: 'Escrow not found' }, { status: 404 })
    }

    if (escrow.status !== 'ON_HOLD' && escrow.status !== 'PROTECTED') {
      return NextResponse.json(
        {
          success: false,
          error: `Cannot ${action} escrow in "${escrow.status}" status`,
        },
        { status: 400 },
      )
    }

    const updates: any = {
      status: action === 'release' ? 'RELEASED' : 'REFUNDED',
    }
    if (action === 'release') updates.releasedAt = new Date()
    else updates.refundedAt = new Date()

    await prisma.jobEscrow.update({
      where: { id: params.id },
      data: updates,
    })

    await prisma.auditLog.create({
      data: {
        adminUserId: session.id,
        adminEmail: session.email,
        adminRole: session.role,
        action: action === 'release' ? 'ESCROW_RELEASE' : 'ESCROW_REFUND',
        targetTable: 'JobEscrow',
        targetId: params.id,
        targetLabel: `Escrow for job ${escrow.jobId}`,
        oldValue: { status: escrow.status },
        newValue: { status: updates.status, reason: reason || null },
        ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
        userAgent: request.headers.get('user-agent') || null,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Escrow action error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to process escrow' },
      { status: 500 },
    )
  }
}

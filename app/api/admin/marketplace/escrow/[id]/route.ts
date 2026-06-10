import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromCookie, adminAuthorize, createAuditLog, getIp } from '@/lib/admin-rbac'
import { z } from 'zod'

const escrowActionSchema = z.object({
  action: z.enum(['release', 'refund']),
  reason: z.string().max(500).optional(),
})

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const rawSession = getSessionFromCookie(request)
  const auth = adminAuthorize(['SUPER_ADMIN', 'ADMIN'])(rawSession)
  if (!auth.authorized) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status })
  }
  const session = rawSession!
  try {
    const escrow = await prisma.jobEscrow.findUnique({ where: { id: params.id } })
    if (!escrow) {
      return NextResponse.json({ success: false, error: 'Escrow not found' }, { status: 404 })
    }
    return NextResponse.json({
      success: true,
      data: {
        ...escrow,
        amount: Number(escrow.amount),
        serviceFee: Number(escrow.serviceFee),
        totalAmount: Number(escrow.totalAmount),
        heldAt: escrow.heldAt?.toISOString() || null,
        releasedAt: escrow.releasedAt?.toISOString() || null,
        refundedAt: escrow.refundedAt?.toISOString() || null,
        createdAt: escrow.createdAt.toISOString(),
        updatedAt: escrow.updatedAt.toISOString(),
      },
    })
  } catch (e) {
    console.error('Escrow detail error:', e)
    return NextResponse.json({ success: false, error: 'Failed to fetch escrow' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const rawSession = getSessionFromCookie(request)
  const auth = adminAuthorize(['SUPER_ADMIN', 'ADMIN'])(rawSession)
  if (!auth.authorized) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status })
  }
  const session = rawSession!
  try {
    const body = await request.json()
    const { action, reason } = escrowActionSchema.parse(body)

    const escrow = await prisma.jobEscrow.findUnique({ where: { id: params.id } })
    if (!escrow) {
      return NextResponse.json({ success: false, error: 'Escrow not found' }, { status: 404 })
    }

    if (escrow.status !== 'ON_HOLD' && escrow.status !== 'PROTECTED') {
      return NextResponse.json(
        { success: false, error: `Cannot ${action} escrow in "${escrow.status}" status` },
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

    await createAuditLog({
      session,
      action: action === 'release' ? 'ESCROW_RELEASE' : 'ESCROW_REFUND',
      targetTable: 'JobEscrow',
      targetId: params.id,
      targetLabel: `Escrow for job ${escrow.jobId}`,
      oldValue: JSON.parse(JSON.stringify({ status: escrow.status })),
      newValue: JSON.parse(JSON.stringify({ status: updates.status, reason: reason || null })),
      ipAddress: getIp(request),
      userAgent: request.headers.get('user-agent'),
    })

    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('Escrow action error:', e)
    return NextResponse.json({ success: false, error: 'Failed to process escrow' }, { status: 500 })
  }
}

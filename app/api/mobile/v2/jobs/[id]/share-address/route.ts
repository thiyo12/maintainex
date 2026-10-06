import { secureConsole } from '@/lib/shared/observability/secure-console'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateRequest, assertNotSuspended } from '@/lib/auth/compatibility/mobile-auth'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const user = await authenticateRequest(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const blocked = assertNotSuspended(user)
    if (blocked) return blocked

    const body = await request.json().catch(() => ({}))
    const street = typeof body?.street === 'string' ? body.street.trim().slice(0, 300) : ''
    const building = typeof body?.building === 'string' ? body.building.trim().slice(0, 200) : ''
    const apartment = typeof body?.apartment === 'string' ? body.apartment.trim().slice(0, 100) : ''
    const landmark = typeof body?.landmark === 'string' ? body.landmark.trim().slice(0, 300) : ''

    if (!street && !building && !apartment && !landmark) {
      return NextResponse.json({ error: 'At least one address field is required' }, { status: 400 })
    }

    const updated = await prisma.$transaction(async (tx) => {
      const lockedRows = await tx.$queryRaw<{
        id: string
        customerId: string
        status: string
        addressSharedAt: Date | null
      }[]>`
        SELECT id, "customerId", status, "addressSharedAt"
        FROM "MarketplaceJob"
        WHERE id = ${id}
        FOR UPDATE
      `
      const job = lockedRows[0]
      if (!job) throw new Error('SHARE_ADDRESS_JOB_NOT_FOUND')
      if (job.customerId !== user.id) throw new Error('SHARE_ADDRESS_FORBIDDEN')
      if (!['QUOTE_ACCEPTED', 'IN_PROGRESS'].includes(job.status)) {
        throw new Error('SHARE_ADDRESS_BOOKING_INACTIVE')
      }
      if (job.addressSharedAt) throw new Error('SHARE_ADDRESS_ALREADY_SHARED')

      const paymentReady = await tx.jobEscrow.findFirst({
        where: { jobId: id, status: { in: ['PROTECTED', 'CASH_CONFIRMED'] } },
        select: { id: true, paymentMethod: true },
      })
      if (!paymentReady) throw new Error('SHARE_ADDRESS_PAYMENT_NOT_CONFIRMED')

      const claimed = await tx.marketplaceJob.updateMany({
        where: {
          id,
          customerId: user.id,
          status: { in: ['QUOTE_ACCEPTED', 'IN_PROGRESS'] },
          addressSharedAt: null,
        },
        data: {
          addressStreet: street || null,
          addressBuilding: building || null,
          addressApartment: apartment || null,
          addressLandmark: landmark || null,
          addressSharedAt: new Date(),
        },
      })
      if (claimed.count !== 1) throw new Error('SHARE_ADDRESS_STATE_CHANGED')

      return tx.marketplaceJob.findUniqueOrThrow({ where: { id } })
    })

    return NextResponse.json({ job: { ...updated, budgetAmount: Number(updated.budgetAmount) } })
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'SHARE_ADDRESS_JOB_NOT_FOUND') {
        return NextResponse.json({ error: 'Job not found' }, { status: 404 })
      }
      if (error.message === 'SHARE_ADDRESS_FORBIDDEN') {
        return NextResponse.json({ error: 'Only the customer can share address' }, { status: 403 })
      }
      if (error.message === 'SHARE_ADDRESS_ALREADY_SHARED') {
        return NextResponse.json({ error: 'Address already shared' }, { status: 409 })
      }
      if (
        error.message === 'SHARE_ADDRESS_BOOKING_INACTIVE' ||
        error.message === 'SHARE_ADDRESS_PAYMENT_NOT_CONFIRMED' ||
        error.message === 'SHARE_ADDRESS_STATE_CHANGED'
      ) {
        return NextResponse.json(
          { error: 'Address can only be shared once for an active booking with a confirmed payment method' },
          { status: 409 }
        )
      }
    }
    secureConsole.error('Share address error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

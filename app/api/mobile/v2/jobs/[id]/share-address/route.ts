import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateRequest, assertNotSuspended } from '@/lib/mobile-auth'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await authenticateRequest(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const blocked = assertNotSuspended(user)
    if (blocked) return blocked

    const body = await request.json()
    const { street, building, apartment, landmark } = body

    const job = await prisma.marketplaceJob.findUnique({ where: { id: params.id } })
    if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    if (job.customerId !== user.id) return NextResponse.json({ error: 'Only the customer can share address' }, { status: 403 })
    if (job.addressSharedAt) return NextResponse.json({ error: 'Address already shared' }, { status: 409 })

    const escrow = await prisma.jobEscrow.findFirst({ where: { jobId: job.id, status: 'PROTECTED' } })
    if (!escrow) return NextResponse.json({ error: 'Escrow must be deposited first' }, { status: 400 })

    const updated = await prisma.marketplaceJob.update({
      where: { id: job.id },
      data: {
        addressStreet: street || null,
        addressBuilding: building || null,
        addressApartment: apartment || null,
        addressLandmark: landmark || null,
        addressSharedAt: new Date(),
      },
    })

    return NextResponse.json({ job: { ...updated, budgetAmount: Number(updated.budgetAmount) } })
  } catch (error) {
    console.error('Share address error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

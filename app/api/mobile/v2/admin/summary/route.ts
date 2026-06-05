import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateRequest } from '@/lib/mobile-auth'

export async function GET(_request: NextRequest) {
  try {
    const user = await authenticateRequest(_request)
    if (!user || user.role !== 'ADMIN') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })


    const [
      totalJobs,
      openJobs,
      inProgressJobs,
      completedJobs,
      cancelledJobs,
      totalEscrows,
      heldEscrows,
      releasedEscrows,
      refundedEscrows,
      totalQuotes,
      totalCustomers,
      totalProviders,
    ] = await Promise.all([
      prisma.marketplaceJob.count(),
      prisma.marketplaceJob.count({ where: { status: 'OPEN' } }),
      prisma.marketplaceJob.count({ where: { status: 'IN_PROGRESS' } }),
      prisma.marketplaceJob.count({ where: { status: 'COMPLETED' } }),
      prisma.marketplaceJob.count({ where: { status: 'CANCELLED' } }),
      prisma.jobEscrow.count(),
      prisma.jobEscrow.count({ where: { status: 'PROTECTED' } }),
      prisma.jobEscrow.count({ where: { status: 'RELEASED' } }),
      prisma.jobEscrow.count({ where: { status: 'REFUNDED' } }),
      prisma.jobQuote.count(),
      prisma.customerWallet.count(),
      prisma.providerWallet.count(),
    ])

    return NextResponse.json({
      summary: {
        jobs: { total: totalJobs, open: openJobs, inProgress: inProgressJobs, completed: completedJobs, cancelled: cancelledJobs },
        escrows: { total: totalEscrows, held: heldEscrows, released: releasedEscrows, refunded: refundedEscrows },
        quotes: totalQuotes,
        customers: totalCustomers,
        providers: totalProviders,
      },
    })
  } catch (error) {
    console.error('Admin summary error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

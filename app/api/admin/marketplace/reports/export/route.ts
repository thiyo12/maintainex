import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdminSession } from '@/lib/admin-auth'

export async function GET(request: NextRequest) {
  const session = await getAdminSession(request)
  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = request.nextUrl
  const type = searchParams.get('type') || 'users'

  try {
    let csv = ''
    let filename = ''

    if (type === 'users') {
      const users = await prisma.user.findMany({ orderBy: { createdAt: 'desc' } })
      csv = 'ID,Name,Email,Role,Identity Status,Active,Created\n'
      csv += users
        .map(
          (u) =>
            `"${u.id}","${u.name}","${u.email}","${u.role}","${u.identityStatus}","${u.isActive}","${u.createdAt.toISOString()}"`,
        )
        .join('\n')
      filename = 'users-export.csv'
    } else if (type === 'jobs') {
      const jobs = await prisma.marketplaceJob.findMany({
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          title: true,
          status: true,
          budgetAmount: true,
          budgetType: true,
          createdAt: true,
        },
      })
      csv = 'ID,Title,Status,Budget,Type,Created\n'
      csv += jobs
        .map(
          (j) =>
            `"${j.id}","${j.title}","${j.status}","${j.budgetAmount || ''}","${j.budgetType}","${j.createdAt.toISOString()}"`,
        )
        .join('\n')
      filename = 'jobs-export.csv'
    } else if (type === 'transactions') {
      const escrows = await prisma.jobEscrow.findMany({
        orderBy: { createdAt: 'desc' },
      })
      csv =
        'ID,Job ID,Amount,Total Amount,Service Fee,Status,Held At,Released At,Refunded At\n'
      csv += escrows
        .map(
          (e) =>
            `"${e.id}","${e.jobId}","${e.amount}","${e.totalAmount}","${e.serviceFee}","${e.status}","${e.heldAt?.toISOString() || ''}","${e.releasedAt?.toISOString() || ''}","${e.refundedAt?.toISOString() || ''}"`,
        )
        .join('\n')
      filename = 'transactions-export.csv'
    } else {
      return NextResponse.json(
        { success: false, error: 'Invalid export type' },
        { status: 400 },
      )
    }

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (error) {
    console.error('CSV export error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to export data' },
      { status: 500 },
    )
  }
}

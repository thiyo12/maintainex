import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromCookie, adminAuthorize, getIp } from '@/lib/admin-rbac'
import { z } from 'zod'

const exportQuerySchema = z.object({
  type: z.enum(['users', 'jobs']).default('users'),
})

export async function GET(request: NextRequest) {
  const rawSession = getSessionFromCookie(request)
  const auth = adminAuthorize(['SUPER_ADMIN', 'ADMIN'])(rawSession)
  if (!auth.authorized) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status })
  }
  const session = rawSession!
  try {
    const { searchParams } = request.nextUrl
    const query = exportQuerySchema.parse({
      type: searchParams.get('type') || 'users',
    })

    let csv = ''
    let filename = ''

    if (query.type === 'users') {
      const users = await prisma.user.findMany({ orderBy: { createdAt: 'desc' } })
      csv = 'ID,Name,Email,Role,Identity Status,Active,Created\n'
      csv += users
        .map(
          (u) =>
            `"${u.id}","${u.name}","${u.email}","${u.role}","${u.identityStatus}","${u.isActive}","${u.createdAt.toISOString()}"`,
        )
        .join('\n')
      filename = 'users-export.csv'
    } else {
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
      csv = 'ID,Title,Status,Budget Amount (cents),Type,Created\n'
      csv += jobs
        .map(
          (j) =>
            `"${j.id}","${j.title}","${j.status}","${j.budgetAmount}","${j.budgetType}","${j.createdAt.toISOString()}"`,
        )
        .join('\n')
      filename = 'jobs-export.csv'
    }

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (e) {
    console.error('CSV export error:', e)
    return NextResponse.json({ success: false, error: 'Failed to export data' }, { status: 500 })
  }
}

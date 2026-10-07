import { secureConsole } from '@/lib/shared/observability/secure-console'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { guardCrmRequest } from '@/lib/crm/security'

export async function GET(request: NextRequest) {
  try {
    const guard = await guardCrmRequest(request, {
      permission: 'catalog:view',
      level: 'read',
      requireCountryScope: true,
    })
    if (!guard.ok) return guard.response
    const security = guard.context

    let submitterIds: string[] | undefined
    if (!security.isSuperAdmin) {
      submitterIds = (await prisma.user.findMany({
        where: { countryCode: { in: security.assignedCountries } },
        select: { id: true },
      })).map(user => user.id)
    }

    const submissions = await prisma.professionSubmission.findMany({
      where: {
        status: { in: ['SUBMITTED', 'UNDER_REVIEW'] },
        ...(submitterIds ? { submittedById: { in: submitterIds } } : {}),
      },
      orderBy: { createdAt: 'asc' },
      take: 500,
    })

    return NextResponse.json(
      { submissions },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (error) {
    secureConsole.error('CRM profession submissions GET error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

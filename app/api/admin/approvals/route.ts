import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { guardCrmRequest } from '@/lib/crm/security'

export async function GET(request: NextRequest) {
  try {
    const guard = await guardCrmRequest(request, {
      level: 'read',
      requireCountryScope: true,
    })
    if (!guard.ok) return guard.response
    const security = guard.context

    if (!security.isSuperAdmin && security.assignedCountries.length === 0) {
      return NextResponse.json(
        { approvals: [], total: 0 },
        { headers: { 'Cache-Control': 'no-store' } }
      )
    }

    const approvals = await prisma.crmApprovalRequest.findMany({
      where: {
        status: { in: ['PENDING_APPROVAL', 'ON_HOLD'] },
        ...(security.isSuperAdmin
          ? {}
          : { market: { in: security.assignedCountries } }),
      },
      include: {
        decisions: {
          orderBy: { decidedAt: 'asc' },
        },
      },
      orderBy: { createdAt: 'asc' },
      take: 100,
    })

    return NextResponse.json(
      { approvals, total: approvals.length },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (error) {
    console.error('CRM approvals GET error:', error)
    return NextResponse.json(
      { error: 'Failed to load approval queue' },
      { status: 500 }
    )
  }
}

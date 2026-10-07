import { secureConsole } from '@/lib/shared/observability/secure-console'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { assertCrmCountryAllowed, guardCrmRequest } from '@/lib/crm/security'
import { serializeBigInts } from '@/lib/crm/benchmark-utils'
import { createAuditLog } from '@/lib/crm/audit'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const guard = await guardCrmRequest(request, {
      allowedRoles: ['SUPER_ADMIN'],
      level: 'sensitive',
      requireCountryScope: true,
    })
    if (!guard.ok) return guard.response
    const security = guard.context

    const { id } = await params
    const existing = await prisma.priceBenchmark.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'Benchmark not found' }, { status: 404 })
    if (!assertCrmCountryAllowed(security, existing.countryCode)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    if (existing.status !== 'SUBMITTED') {
      return NextResponse.json({ error: `Cannot approve a benchmark with status ${existing.status}. Only SUBMITTED benchmarks can be approved.` }, { status: 409 })
    }

    const benchmark = await prisma.priceBenchmark.update({
      where: { id },
      data: { status: 'APPROVED', approvedBy: security.adminId, approvedAt: new Date() },
    })

    await createAuditLog({
      action: 'UPDATE', category: 'FINANCE', userId: security.adminId, userEmail: security.email, userRole: security.role,
      entityType: 'PriceBenchmark', entityId: id, entityName: existing.serviceTemplateId,
      description: 'CRM price benchmark approved',
      oldValue: { status: existing.status }, newValue: { status: benchmark.status },
      ipAddress: security.ipAddress, userAgent: security.userAgent || undefined, riskLevel: 'HIGH',
    })
    return NextResponse.json({ benchmark: serializeBigInts(benchmark) })
  } catch (error) {
    secureConsole.error('CRM benchmark approve error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

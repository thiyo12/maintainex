import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { assertCrmCountryAllowed, guardCrmRequest } from '@/lib/crm/security'
import { serializeBigInts } from '@/lib/crm/benchmark-utils'
import { createAuditLog } from '@/lib/crm/audit'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const guard = await guardCrmRequest(request, {
      allowedRoles: ['SUPER_ADMIN', 'FINANCE', 'MANAGER'],
      level: 'sensitive',
      requireCountryScope: true,
    })
    if (!guard.ok) return guard.response
    const security = guard.context

    const { id } = await params
    const existing = await prisma.priceBenchmark.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'Benchmark not found' }, { status: 404 })
    if (!assertCrmCountryAllowed(security, existing.countryCode)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    if (existing.status !== 'DRAFT') {
      return NextResponse.json({ error: `Cannot submit a benchmark with status ${existing.status}. Only DRAFT benchmarks can be submitted.` }, { status: 409 })
    }
    if (existing.sampleSize < 1) {
      return NextResponse.json({ error: 'Cannot submit a benchmark with sample size < 1' }, { status: 400 })
    }

    const benchmark = await prisma.priceBenchmark.update({
      where: { id },
      data: { status: 'SUBMITTED', submittedBy: security.adminId, submittedAt: new Date() },
    })

    await createAuditLog({
      action: 'UPDATE', category: 'FINANCE', userId: security.adminId, userEmail: security.email, userRole: security.role,
      entityType: 'PriceBenchmark', entityId: id, entityName: existing.serviceTemplateId,
      description: 'CRM price benchmark submitted for approval',
      oldValue: { status: existing.status }, newValue: { status: benchmark.status },
      ipAddress: security.ipAddress, userAgent: security.userAgent || undefined, riskLevel: 'MEDIUM',
    })
    return NextResponse.json({ benchmark: serializeBigInts(benchmark) })
  } catch (error) {
    console.error('CRM benchmark submit error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

import { secureConsole } from '@/lib/shared/observability/secure-console'
import { NextRequest, NextResponse } from 'next/server'
import { authenticateMarketplaceUser, assertNotSuspended } from '@/lib/auth/marketplace-auth'
import { resolveCompanyContext } from '@/lib/phase6/company-context'
import { listCompanyAssignments } from '@/lib/domain/company-job-assignment'

export async function GET(request: NextRequest) {
  try {
    const user = await authenticateMarketplaceUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const blocked = assertNotSuspended(user)
    if (blocked) return blocked

    const { searchParams } = new URL(request.url)
    const companyId = searchParams.get('companyId')
    const status = searchParams.get('status') as string | null
    const jobId = searchParams.get('jobId')
    const workerUserId = searchParams.get('workerUserId')
    const limitInput = searchParams.get('limit') ?? '50'
    const offsetInput = searchParams.get('offset') ?? '0'
    // parseInt('20garbage') and negative/NaN offsets must not reach Prisma.
    if (!/^\d+$/.test(limitInput) || !/^\d+$/.test(offsetInput)) {
      return NextResponse.json({ error: 'Invalid pagination parameters' }, { status: 400 })
    }
    const limit = Number(limitInput)
    const offset = Number(offsetInput)
    if (!Number.isSafeInteger(limit) || limit < 1 ||
        !Number.isSafeInteger(offset) || offset < 0 || offset > 100000) {
      return NextResponse.json({ error: 'Invalid pagination parameters' }, { status: 400 })
    }

    const { context, error } = await resolveCompanyContext(user.id, companyId, 'workers:read')
    if (error) return error

    const validStatuses = ['ASSIGNED', 'ACCEPTED', 'IN_PROGRESS', 'COMPLETED', 'REJECTED', 'REVOKED']
    const result = await listCompanyAssignments(context!.companyId, {
      status: status && validStatuses.includes(status) ? status as any : undefined,
      jobId: jobId || undefined,
      workerUserId: workerUserId || undefined,
      limit: Math.min(limit, 100),
      offset,
    })

    return NextResponse.json({
      assignments: result.assignments.map((a: any) => ({
        id: a.id,
        jobId: a.jobId,
        workerUserId: a.workerUserId,
        assignedBy: a.assignedBy,
        status: a.status,
        assignedAt: a.assignedAt.toISOString(),
        acceptedAt: a.acceptedAt?.toISOString() || null,
        startedAt: a.startedAt?.toISOString() || null,
        completedAt: a.completedAt?.toISOString() || null,
        revokedAt: a.revokedAt?.toISOString() || null,
        revokedReason: a.revokedReason,
        job: a.job,
        worker: a.worker,
      })),
      total: result.total,
    })
  } catch (error) {
    secureConsole.error('List assignments error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

import { secureConsole } from '@/lib/shared/observability/secure-console'
import { NextRequest, NextResponse } from 'next/server'
import { authenticateMarketplaceUser } from '@/lib/auth/marketplace-auth'
import { resolveCompanyContext } from '@/lib/phase6/company-context'
import { listCompanyAssignments } from '@/lib/domain/company-job-assignment'

export async function GET(request: NextRequest) {
  try {
    const user = await authenticateMarketplaceUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const companyId = searchParams.get('companyId')
    const status = searchParams.get('status') as string | null
    const jobId = searchParams.get('jobId')
    const workerUserId = searchParams.get('workerUserId')
    const limit = parseInt(searchParams.get('limit') || '50', 10)
    const offset = parseInt(searchParams.get('offset') || '0', 10)

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

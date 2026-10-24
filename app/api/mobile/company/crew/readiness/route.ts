import { secureConsole } from '@/lib/shared/observability/secure-console'
import { NextRequest, NextResponse } from 'next/server'
import { authenticateMarketplaceUser, assertNotSuspended } from '@/lib/auth/marketplace-auth'
import { resolveCompanyContext } from '@/lib/phase6/company-context'
import {
  CrewReadinessError,
  previewCompanyCrewReadiness,
} from '@/lib/domain/company-crew-readiness'

/**
 * Company crews: eligibility preview ONLY.
 * Does not create assignments, change bookings, generate PINs or reserve
 * capacity. Real multi-worker dispatch is intentionally disabled.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await authenticateMarketplaceUser(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const blocked = assertNotSuspended(user)
    if (blocked) return blocked

    const body: unknown = await request.json().catch(() => null)
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    }
    const input = body as Record<string, unknown>
    if (typeof input.companyId !== 'string' || !input.companyId.trim() ||
        input.companyId.length > 128 ||
        typeof input.jobId !== 'string' || !input.jobId.trim() ||
        input.jobId.length > 128 ||
        !Array.isArray(input.workerUserIds)) {
      return NextResponse.json({ error: 'Invalid company, job or crew list' }, { status: 400 })
    }

    const { context, error } = await resolveCompanyContext(
      user.id, input.companyId, 'workers:assign',
    )
    if (error) return error
    if (!context) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const report = await previewCompanyCrewReadiness({
      companyId: context.companyId,
      jobId: input.jobId,
      workerUserIds: input.workerUserIds,
    })
    return NextResponse.json(report, {
      headers: { 'Cache-Control': 'private, no-store' },
    })
  } catch (error) {
    if (error instanceof CrewReadinessError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    secureConsole.error('Crew-readiness preview failed:', error)
    return NextResponse.json({ error: 'Unable to review crew readiness' }, { status: 500 })
  }
}

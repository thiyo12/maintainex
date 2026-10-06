import { secureConsole } from '@/lib/shared/observability/secure-console'
import { NextRequest, NextResponse } from 'next/server'
import { authenticateMarketplaceUser } from '@/lib/auth/marketplace-auth'
import { getCompanyMembers } from '@/lib/phase6/company-ownership'
import { resolveCompanyContext } from '@/lib/phase6/company-context'

export async function GET(request: NextRequest) {
  try {
    const user = await authenticateMarketplaceUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const companyId = searchParams.get('companyId')

    const { context, error } = await resolveCompanyContext(user.id, companyId, 'members:read')
    if (error) return error

    const members = await getCompanyMembers(context!.companyId)

    return NextResponse.json({
      members: members.map(m => ({
        id: m.id,
        userId: m.userId,
        name: m.name,
        role: m.role,
        status: m.status,
        isOnline: m.isOnline,
        rating: m.rating,
        completedJobs: m.completedJobs,
        joinedAt: m.joinedAt.toISOString(),
        user: m.user ? {
          id: m.user.id,
          name: m.user.name,
          email: m.user.email,
          phone: m.user.phone,
          identityStatus: m.user.identityStatus,
          isSuspended: m.user.isSuspended,
          isBanned: m.user.isBanned,
        } : null,
      })),
    })
  } catch (error) {
    secureConsole.error('Get company members error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

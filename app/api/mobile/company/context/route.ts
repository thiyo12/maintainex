import { NextRequest, NextResponse } from 'next/server'
import { authenticateMarketplaceUser } from '@/lib/auth/marketplace-auth'
import { resolveCompanyContext } from '@/lib/phase6/company-context'

export async function GET(request: NextRequest) {
  try {
    const user = await authenticateMarketplaceUser(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const companyId = searchParams.get('companyId')
    const { context, error } = await resolveCompanyContext(user.id, companyId)
    if (error) return error

    return NextResponse.json({
      companyId: context!.companyId,
      role: context!.role,
      membershipId: context!.membershipId,
    })
  } catch (error) {
    console.error('Company context error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

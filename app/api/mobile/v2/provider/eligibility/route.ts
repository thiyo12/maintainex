import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateRequest } from '@/lib/mobile-auth'
import { checkIndividualProviderEligibility, checkCompanyEligibility } from '@/lib/phase6/provider-eligibility'

export async function GET(request: NextRequest) {
  try {
    const user = await authenticateRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const results: Record<string, unknown> = {}

    const taskerProfile = await prisma.taskerProfile.findUnique({
      where: { userId: user.id },
      select: { id: true },
    })
    if (taskerProfile) {
      results.individual = await checkIndividualProviderEligibility(user.id)
    }

    const companyProfile = await prisma.companyProfile.findUnique({
      where: { userId: user.id },
      select: { id: true },
    })
    if (companyProfile) {
      results.company = await checkCompanyEligibility(companyProfile.id)
    }

    return NextResponse.json(results)
  } catch (error) {
    console.error('Provider eligibility error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

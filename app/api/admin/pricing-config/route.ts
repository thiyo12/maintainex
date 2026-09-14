import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdminSession } from '@/lib/admin-auth'

export async function GET(request: NextRequest) {
  try {
    const session = await getAdminSession(request)
    if (!session || !['SUPER_ADMIN', 'FINANCE'].includes(session.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const countryCode = searchParams.get('countryCode')

    const config = await prisma.marketConfig.findUnique({
      where: { countryCode: countryCode ?? 'GLOBAL' },
    })

    return NextResponse.json({ config })
  } catch (error) {
    console.error('Pricing config GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await getAdminSession(request)
    if (!session || !['SUPER_ADMIN', 'FINANCE'].includes(session.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { countryCode, ...updates } = body

    if (!countryCode) {
      return NextResponse.json({ error: 'countryCode is required' }, { status: 400 })
    }

    const config = await prisma.marketConfig.upsert({
      where: { countryCode },
      create: {
        countryCode,
        minBenchmarkSample: updates.minBenchmarkSample ?? 5,
        benchmarkPercentileLow: updates.benchmarkPercentileLow ?? 25,
        benchmarkPercentileHigh: updates.benchmarkPercentileHigh ?? 75,
        benchmarkOutlierIqrMult: updates.benchmarkOutlierIqrMult ?? 1.5,
        benchmarkFallbackEnabled: updates.benchmarkFallbackEnabled ?? true,
        benchmarkResearchIntervalMonths: updates.benchmarkResearchIntervalMonths ?? 3,
      },
      update: {
        ...(updates.minBenchmarkSample !== undefined && { minBenchmarkSample: updates.minBenchmarkSample }),
        ...(updates.benchmarkPercentileLow !== undefined && { benchmarkPercentileLow: updates.benchmarkPercentileLow }),
        ...(updates.benchmarkPercentileHigh !== undefined && { benchmarkPercentileHigh: updates.benchmarkPercentileHigh }),
        ...(updates.benchmarkOutlierIqrMult !== undefined && { benchmarkOutlierIqrMult: updates.benchmarkOutlierIqrMult }),
        ...(updates.benchmarkFallbackEnabled !== undefined && { benchmarkFallbackEnabled: updates.benchmarkFallbackEnabled }),
        ...(updates.benchmarkResearchIntervalMonths !== undefined && { benchmarkResearchIntervalMonths: updates.benchmarkResearchIntervalMonths }),
      },
    })

    return NextResponse.json({ config })
  } catch (error) {
    console.error('Pricing config PATCH error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

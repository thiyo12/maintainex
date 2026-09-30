import { NextRequest, NextResponse } from 'next/server'
import { clusterJobsByProximity, optimizeRoute, getProviderScheduleRecommendations } from '@/lib/schedule-engine'
import { authenticateRequest } from '@/lib/auth/compatibility/mobile-auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const user = await authenticateRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')

    if (action === 'recommend') {
      const recs = await getProviderScheduleRecommendations(user.id)
      return NextResponse.json(recs)
    }

    if (action === 'cluster') {
      const openJobs = await prisma.marketplaceJob.findMany({
        where: { status: 'OPEN', isActive: true },
        select: { id: true, latitude: true, longitude: true, title: true, estimatedDuration: true },
        take: 100,
      })

      const jobs = openJobs
        .filter(j => j.latitude && j.longitude)
        .map(j => ({
          id: j.id,
          lat: j.latitude!,
          lng: j.longitude!,
          title: j.title,
          estimatedDuration: j.estimatedDuration || 2,
        }))

      const clusters = clusterJobsByProximity(jobs)
      return NextResponse.json({ clusters })
    }

    return NextResponse.json({ error: 'action param required (recommend|cluster)' }, { status: 400 })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed' }, { status: 500 })
  }
}

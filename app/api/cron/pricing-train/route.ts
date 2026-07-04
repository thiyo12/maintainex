import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const maxDuration = 300

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const completedJobs = await prisma.marketplaceJob.findMany({
      where: { status: 'COMPLETED' },
      select: { categoryId: true, budgetAmount: true, areaId: true, createdAt: true, id: true },
    })

    const byCategory: Record<string, { prices: number[]; sum: number }> = {}
    for (const job of completedJobs) {
      const cat = job.categoryId || 'other'
      if (!byCategory[cat]) byCategory[cat] = { prices: [], sum: 0 }
      const amt = Number(job.budgetAmount)
      byCategory[cat].prices.push(amt)
      byCategory[cat].sum += amt
    }

    for (const [catId, data] of Object.entries(byCategory)) {
      const count = data.prices.length
      if (count === 0) continue
      const avg = data.sum / count
      const sorted = [...data.prices].sort((a, b) => a - b)
      const median = sorted[Math.floor(sorted.length / 2)]
      const min = sorted[0]
      const max = sorted[sorted.length - 1]

      for (const country of ['LK', 'CA']) {
        const existing = await prisma.pricingModel.findUnique({
          where: { categoryId_countryCode: { categoryId: catId, countryCode: country } },
        })
        if (existing) {
          const demandRatio = count > 100 ? 1.15 : count > 50 ? 1.1 : count > 20 ? 1.05 : 1.0
          await prisma.pricingModel.update({
            where: { id: existing.id },
            data: {
              baseRate: Math.round(avg * 0.85),
              demandMultiplier: demandRatio,
              confidence: Math.min(1, count / 200),
              modelVersion: existing.modelVersion + 1,
              trainedAt: new Date(),
            },
          })
        }
      }
    }

    await prisma.$executeRawUnsafe(`DELETE FROM PricingCache WHERE expiresAt < datetime('now')`)

    return NextResponse.json({
      success: true,
      trained: Object.keys(byCategory).length,
      totalJobs: completedJobs.length,
    })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message }, { status: 500 })
  }
}

export const dynamic = 'force-dynamic'

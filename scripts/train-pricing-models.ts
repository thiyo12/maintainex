import { prisma } from '../lib/prisma'

async function trainPricingModels() {
  console.log('Starting pricing model training...')

  const completedJobs = await prisma.marketplaceJob.findMany({
    where: { status: 'COMPLETED' },
    select: { categoryId: true, budgetAmount: true, areaId: true, createdAt: true, id: true },
  })

  console.log(`Found ${completedJobs.length} completed jobs`)

  const byCategory: Record<string, { prices: number[]; sum: number }> = {}
  for (const job of completedJobs) {
    const cat = job.categoryId || 'other'
    if (!byCategory[cat]) byCategory[cat] = { prices: [], sum: 0 }
    const amt = Number(job.budgetAmount ?? 0n)
    if (amt === 0) continue
    byCategory[cat].prices.push(amt)
    byCategory[cat].sum += amt
  }

  let trainedCount = 0
  for (const [catId, data] of Object.entries(byCategory)) {
    const count = data.prices.length
    if (count < 3) continue
    const avg = data.sum / count
    const sorted = [...data.prices].sort((a, b) => a - b)
    const median = sorted[Math.floor(sorted.length / 2)]

    for (const country of ['LK', 'CA'] as const) {
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
        trainedCount++
        console.log(`  Trained: ${catId}/${country} → baseRate=${Math.round(avg * 0.85)}, demand=${demandRatio}, samples=${count}`)
      } else {
        await prisma.pricingModel.create({
          data: {
            categoryId: catId,
            countryCode: country,
            baseRate: Math.round(avg * 0.85),
            demandMultiplier: 1.0,
            confidence: Math.min(1, count / 200),
            modelVersion: 1,
            trainedAt: new Date(),
          },
        })
        trainedCount++
        console.log(`  Created: ${catId}/${country}`)
      }
    }
  }

  const cleared = await prisma.pricingCache.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  })

  console.log(`\nTraining complete: ${trainedCount} models updated, ${cleared.count} cache entries cleared`)
  await prisma.$disconnect()
  process.exit(0)
}

trainPricingModels().catch((err) => {
  console.error('Training failed:', err)
  process.exit(1)
})

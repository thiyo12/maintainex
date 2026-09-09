import { prisma } from '@/lib/prisma'
import { blastJobToTaskers } from '@/lib/job-blast'

export interface BookNowInput {
  customerId: string
  templateJobId: string
  providerId: string
  scheduledDate: Date
  timeSlot: string
  address: string
  district: string
  notes?: string
  latitude?: number
  longitude?: number
}

export async function createBookNowJob(input: BookNowInput) {
  const templateJob = await prisma.templateJob.findUnique({ where: { id: input.templateJobId } })
  if (!templateJob) throw new Error('Template job not found')

  const provider = await prisma.taskerProfile.findUnique({ where: { id: input.providerId } })
  if (!provider) throw new Error('Provider not found')

  const price = templateJob.priceMax || templateJob.priceMin || 0

  const job = await prisma.marketplaceJob.create({
    data: {
      customerId: input.customerId,
      title: templateJob.name,
      description: templateJob.description || `Quick booking: ${templateJob.name}`,
      categoryId: templateJob.categoryId,
      templateJobId: input.templateJobId,
      photos: '[]',
      budgetType: 'FIXED',
      budgetAmount: BigInt(Math.round(price * 100)),
      preferredDate: input.scheduledDate,
      preferredTimeSlot: input.timeSlot,
      addressStreet: input.address,
      status: 'OPEN',
      urgency: 'normal',
      workersCount: 1,
      materialHandling: 'tasker_brings',
      countryCode: 'LK',
    },
  })

  const quote = await prisma.jobQuote.create({
    data: {
      jobId: job.id,
      providerId: input.providerId,
      providerType: 'INDIVIDUAL',
      price: BigInt(Math.round(price * 100)),
      estimatedCompletionTime: '1-2 hours',
      message: input.notes || 'BOOK_NOW instant booking',
      attachments: '[]',
      status: 'PENDING',
    },
  })

  let notifiedCount = 0
  try {
    const blast = await blastJobToTaskers(job.id)
    notifiedCount = blast.matched
  } catch (err) {
    console.error('BOOK_NOW blast error:', err)
  }

  return {
    job: { ...job, budgetAmount: Number(job.budgetAmount) },
    quote: { ...quote, price: Number(quote.price) },
    notifiedCount,
  }
}

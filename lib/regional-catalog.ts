import { prisma } from './prisma'

type RegionalJob = {
  categoryNames: string[]
  name: string
  description: string
  included: string[]
  duration: number
  min: number
  max: number
  currency: string
  popular?: boolean
}

const CANADA_WINTER_JOBS: RegionalJob[] = [
  {
    categoryNames: ['Gardening and Landscaping', 'Outdoor and Garden'],
    name: 'Snow removal',
    description: 'Clear snow from driveways, sidewalks, entrances and accessible outdoor areas.',
    included: ['Assess snow depth', 'Shovel or snow-blow accessible areas', 'Clear entrances and walkways', 'Pile snow safely', 'Final slip-hazard check'],
    duration: 90, min: 45, max: 180, currency: 'CAD', popular: true,
  },
  {
    categoryNames: ['Gardening and Landscaping', 'Outdoor and Garden'],
    name: 'Sidewalk salting and de-icing',
    description: 'Apply de-icing material to slippery sidewalks, steps, driveways and entrances.',
    included: ['Inspect icy areas', 'Clear loose snow', 'Apply de-icer', 'Treat high-risk steps and entrances', 'Safety check'],
    duration: 60, min: 35, max: 120, currency: 'CAD', popular: true,
  },
  {
    categoryNames: ['Plumbing'],
    name: 'Pipe insulation and winterization',
    description: 'Protect exposed water pipes from freezing with insulation and winter preparation.',
    included: ['Inspect exposed pipes', 'Identify freeze-risk sections', 'Install pipe insulation', 'Seal gaps', 'Winter-readiness check'],
    duration: 120, min: 80, max: 280, currency: 'CAD', popular: true,
  },
  {
    categoryNames: ['Plumbing'],
    name: 'Frozen pipe repair',
    description: 'Diagnose and safely restore frozen or partially frozen household water lines.',
    included: ['Locate frozen section', 'Check for pipe damage', 'Safely thaw accessible piping', 'Repair leaks if needed', 'Prevention guidance'],
    duration: 120, min: 120, max: 450, currency: 'CAD', popular: true,
  },
  {
    categoryNames: ['Roofing and Gutters'],
    name: 'Ice dam removal',
    description: 'Remove accessible roof-edge ice dams and reduce immediate water intrusion risk.',
    included: ['Inspect affected roof edge', 'Assess safe access', 'Remove accessible ice buildup', 'Clear drainage path', 'Report roof damage risks'],
    duration: 180, min: 180, max: 650, currency: 'CAD',
  },
  {
    categoryNames: ['Roofing and Gutters'],
    name: 'Winter roof and gutter preparation',
    description: 'Prepare gutters and accessible roof drainage for snow, freeze and thaw cycles.',
    included: ['Clean gutters', 'Clear downspouts', 'Inspect visible roof edges', 'Check drainage', 'Winter risk report'],
    duration: 150, min: 120, max: 420, currency: 'CAD',
  },
  {
    categoryNames: ['AC and Refrigeration'],
    name: 'AC winterization',
    description: 'Prepare outdoor air-conditioning equipment for Canadian winter conditions.',
    included: ['Inspect outdoor condenser', 'Clean accessible debris', 'Protect exposed lines', 'Check disconnect and cover needs', 'Document condition'],
    duration: 75, min: 70, max: 180, currency: 'CAD',
  },
  {
    categoryNames: ['Door and Window Services', 'Windows and Glass', 'Carpentry and Furniture'],
    name: 'Window and door winterization',
    description: 'Reduce cold drafts around windows and doors using weather sealing and basic winter preparation.',
    included: ['Identify drafts', 'Inspect seals', 'Apply weather stripping or caulk where appropriate', 'Adjust accessible hardware', 'Final draft check'],
    duration: 120, min: 90, max: 300, currency: 'CAD', popular: true,
  },
]

export async function ensureRegionalCatalog(countryCode: string): Promise<void> {
  if (countryCode.toUpperCase() !== 'CA') return

  for (const job of CANADA_WINTER_JOBS) {
    const category = await prisma.jobCategory.findFirst({
      where: {
        isActive: true,
        name: { in: job.categoryNames },
      },
      select: { id: true },
    })
    if (!category) continue

    const existing = await prisma.templateJob.findFirst({
      where: { categoryId: category.id, name: job.name },
      select: { id: true },
    })

    const data = {
      description: job.description,
      whatIsIncluded: JSON.stringify(job.included),
      typicalDurationMinutes: job.duration,
      priceMin: job.min,
      priceMax: job.max,
      currency: job.currency,
      isPopular: Boolean(job.popular),
      isCompanyOnly: false,
      countries: JSON.stringify(['CA']),
      isActive: true,
    }

    if (existing) {
      await prisma.templateJob.update({ where: { id: existing.id }, data })
    } else {
      await prisma.templateJob.create({
        data: { categoryId: category.id, name: job.name, ...data },
      })
    }
  }
}

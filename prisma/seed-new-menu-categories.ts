import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const SUB_CATEGORIES: Record<string, string[]> = {
  'Home Repairs': ['Plumbing', 'Electrician', 'Carpenter', 'Mason', 'Handyman', 'Roof Repair', 'Painting', 'Flooring', 'Waterproofing'],
  'Cleaning': ['House Cleaning', 'Deep Cleaning', 'Office Cleaning', 'Carpet Cleaning', 'Sofa Cleaning', 'Window Cleaning', 'Move In Cleaning', 'Move Out Cleaning'],
  'HVAC': ['AC Repair', 'AC Installation', 'Heating Service', 'Furnace Repair', 'Ventilation', 'Duct Cleaning'],
  'Gardening': ['Lawn Mowing', 'Tree Trimming', 'Landscaping', 'Garden Maintenance', 'Planting'],
  'Moving & Delivery': ['House Moving', 'Office Moving', 'Packing', 'Furniture Moving', 'Lorry Hire'],
  'Security': ['CCTV Installation', 'Smart Locks', 'Alarm Systems', 'Security Camera Repair'],
  'Automotive': ['Mobile Mechanic', 'Car Wash', 'Battery Change', 'Tire Change', 'Car AC Service'],
  'IT Services': ['Computer Repair', 'WiFi Setup', 'Website Development', 'App Development', 'Printer Repair'],
}

const SEASONAL_OFFERS = {
  CA: {
    winter: {
      title: '❄️ Winter Services',
      description: 'Beat the cold with our winter maintenance services',
      services: ['Snow Removal', 'Ice Removal', 'Roof Snow Cleaning', 'Ice Dam Removal', 'Furnace Repair', 'Heating Service', 'Frozen Pipe Repair', 'Winter Tire Change', 'Battery Boost', 'Christmas Light Installation'],
    },
    spring: {
      title: '🌸 Spring Clean & Repair',
      description: 'Refresh your home for spring',
      services: ['Spring Cleaning', 'Lawn Cleanup', 'Gutter Cleaning', 'Window Cleaning', 'Pressure Washing', 'Garden Preparation'],
    },
    summer: {
      title: '☀️ Summer Cooling & Care',
      description: 'Stay cool with professional summer services',
      services: ['AC Repair', 'AC Installation', 'Landscaping', 'Lawn Mowing', 'Pool Cleaning', 'Deck Building', 'Fence Installation'],
    },
    fall: {
      title: '🍂 Fall Preparation',
      description: 'Get your home ready for colder months',
      services: ['Leaf Removal', 'Gutter Cleaning', 'Furnace Tune-Up', 'Chimney Cleaning', 'Winter Preparation'],
    },
  },
  LK: {
    general: {
      title: '🏠 Special Offers',
      description: 'Popular home services at great prices',
      services: ['Deep Cleaning', 'AC Service', 'Roof Leak Repair', 'Water Tank Cleaning', 'Mosquito Control', 'Garden Maintenance', 'Plumbing Repair', 'Electrical Repair', 'Painting Service', 'Pressure Washing'],
    },
  },
}

async function main() {
  console.log('Seeding menu categories and seasonal offers...')
  const usedSlugs = new Set<string>()

  for (const [catName, subNames] of Object.entries(SUB_CATEGORIES)) {
    const catSlug = catName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    const existingCat = await prisma.jobCategory.findFirst({ where: { name: catName } })
    let categoryId: string
    if (existingCat) {
      categoryId = existingCat.id
      console.log(`  Category "${catName}" already exists, reusing`)
    } else {
      const cat = await prisma.jobCategory.create({
        data: { name: catName, iconName: getIcon(catSlug), colorHex: getColor(catSlug), sortOrder: 50, countries: '["LK","CA"]', isActive: true },
      })
      categoryId = cat.id
      console.log(`  Created category: ${catName}`)
    }

    for (const subName of subNames) {
      const slug = subName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
      if (usedSlugs.has(slug)) continue
      usedSlugs.add(slug)
      const existing = await prisma.templateJob.findFirst({ where: { name: subName, categoryId } })
      if (!existing) {
        await prisma.templateJob.create({
          data: {
            categoryId,
            name: subName,
            description: `Professional ${subName.toLowerCase()} service. Quality work by experienced professionals.`,
            whatIsIncluded: JSON.stringify(['Site assessment', 'Professional service', 'Quality check', 'Clean up']),
            typicalDurationMinutes: 120,
            priceMin: 2000,
            priceMax: 10000,
            currency: 'LKR',
            countries: '["LK","CA"]',
            isPopular: false,
            isActive: true,
          },
        })
        console.log(`    Created template job: ${subName}`)
      } else {
        console.log(`    Template job "${subName}" already exists under this category`)
      }
    }
  }

  for (const [country, seasons] of Object.entries(SEASONAL_OFFERS)) {
    for (const [season, data] of Object.entries(seasons)) {
      const existingOffer = await prisma.seasonalOffer.findFirst({ where: { season, country, title: data.title } })
      if (existingOffer) {
        console.log(`  Seasonal offer "${data.title}" already exists, skipping`)
        continue
      }

      const offer = await prisma.seasonalOffer.create({
        data: {
          title: data.title,
          description: data.description,
          slug: `${country.toLowerCase()}-${season}`,
          season,
          country,
          badgeText: season === 'winter' ? '❄️ SEASONAL' : season === 'summer' ? '☀️ SEASONAL' : season === 'spring' ? '🌸 SEASONAL' : season === 'fall' ? '🍂 SEASONAL' : '🔥 OFFER',
          bgColor: season === 'winter' ? '#DBEAFE' : season === 'summer' ? '#FEF3C7' : season === 'spring' ? '#ECFDF5' : season === 'fall' ? '#FFF7ED' : '#FEF3C7',
          textColor: '#1a1a1a',
          displayOrder: 0,
          isActive: true,
        },
      })
      console.log(`  Created seasonal offer: ${data.title}`)

      for (const svcName of data.services) {
        const slug = svcName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
        let templateJob = await prisma.templateJob.findFirst({ where: { name: svcName } })
        if (!templateJob) {
          templateJob = await prisma.templateJob.create({
            data: {
              categoryId: (await prisma.jobCategory.findFirst({ where: { name: 'Home Repairs' } }))?.id || (await prisma.jobCategory.findFirst({ orderBy: { sortOrder: 'asc' } }))!.id,
              name: svcName,
              description: `Professional ${svcName.toLowerCase()} service. Experienced and reliable.`,
              whatIsIncluded: JSON.stringify(['Site assessment', 'Professional service', 'Quality check', 'Clean up']),
              typicalDurationMinutes: 120,
              priceMin: 2000,
              priceMax: 10000,
              currency: country === 'CA' ? 'CAD' : 'LKR',
              countries: JSON.stringify([country]),
              isPopular: false,
              isActive: true,
            },
          })
        }

        const existingLink = await prisma.seasonalOfferJob.findFirst({ where: { seasonalOfferId: offer.id, templateJobId: templateJob.id } })
        if (!existingLink) {
          await prisma.seasonalOfferJob.create({ data: { seasonalOfferId: offer.id, templateJobId: templateJob.id } })
          console.log(`    Linked: ${svcName}`)
        }
      }
    }
  }

  console.log('Done!')
}

function getIcon(slug: string): string {
  const map: Record<string, string> = {
    'home-repairs': 'construct',
    'cleaning': 'sparkles',
    'hvac': 'snowflake',
    'gardening': 'leaf',
    'moving-delivery': 'car',
    'security': 'lock-closed',
    'automotive': 'car-sport',
    'it-services': 'desktop',
  }
  return map[slug] || 'construct'
}

function getColor(slug: string): string {
  const map: Record<string, string> = {
    'home-repairs': '#92400E',
    'cleaning': '#10B981',
    'hvac': '#06B6D4',
    'gardening': '#22C55E',
    'moving-delivery': '#F59E0B',
    'security': '#6366F1',
    'automotive': '#EF4444',
    'it-services': '#3B82F6',
  }
  return map[slug] || '#92400E'
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())

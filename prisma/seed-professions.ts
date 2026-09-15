import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

type MappingConfidence = 'DETERMINISTIC' | 'MANUAL_REVIEW'

interface ProfessionSeed {
  slug: string
  i18nKey: string
  description: string
  sortOrder: number
  categorySlug: string
  confidence: MappingConfidence
  skills: { slug: string; i18nKey: string; description: string; sortOrder: number }[]
}

const PROFESSIONS: ProfessionSeed[] = [
  {
    slug: 'electrician',
    i18nKey: 'professions.electrician',
    description: 'Electrical installation, repair, and maintenance',
    sortOrder: 1,
    categorySlug: 'electrical-works',
    confidence: 'DETERMINISTIC',
    skills: [
      { slug: 'wiring-and-rewiring', i18nKey: 'skills.electrician.wiring-and-rewiring', description: 'New wiring, rewiring, and cable management', sortOrder: 1 },
      { slug: 'switch-and-outlet-installation', i18nKey: 'skills.electrician.switch-and-outlet-installation', description: 'Switch and socket installation and repair', sortOrder: 2 },
      { slug: 'light-fixture-installation', i18nKey: 'skills.electrician.light-fixture-installation', description: 'Light fitting and chandelier installation', sortOrder: 3 },
      { slug: 'ceiling-fan-installation', i18nKey: 'skills.electrician.ceiling-fan-installation', description: 'Ceiling fan installation and balancing', sortOrder: 4 },
      { slug: 'generator-installation', i18nKey: 'skills.electrician.generator-installation', description: 'Generator setup and backup power systems', sortOrder: 5 },
      { slug: 'solar-wiring', i18nKey: 'skills.electrician.solar-wiring', description: 'Solar panel wiring and inverter connection', sortOrder: 6 },
      { slug: 'power-surge-protection', i18nKey: 'skills.electrician.power-surge-protection', description: 'Surge protector installation and grounding', sortOrder: 7 },
      { slug: 'electrical-panel-upgrade', i18nKey: 'skills.electrician.electrical-panel-upgrade', description: 'Distribution board upgrade and circuit breaker replacement', sortOrder: 8 },
      { slug: 'ev-charger-installation', i18nKey: 'skills.electrician.ev-charger-installation', description: 'Electric vehicle charging point installation', sortOrder: 9 },
      { slug: 'emergency-electrical-repair', i18nKey: 'skills.electrician.emergency-electrical-repair', description: 'Urgent electrical fault diagnosis and repair', sortOrder: 10 },
      { slug: 'commercial-electrical-works', i18nKey: 'skills.electrician.commercial-electrical-works', description: 'Commercial and industrial electrical systems', sortOrder: 11 },
      { slug: 'home-automation-wiring', i18nKey: 'skills.electrician.home-automation-wiring', description: 'Smart home system wiring and control panel setup', sortOrder: 12 },
    ],
  },
  {
    slug: 'plumber',
    i18nKey: 'professions.plumber',
    description: 'Plumbing installation, repair, and maintenance',
    sortOrder: 2,
    categorySlug: 'plumbing',
    confidence: 'DETERMINISTIC',
    skills: [
      { slug: 'pipe-installation-repair', i18nKey: 'skills.plumber.pipe-installation-repair', description: 'Pipe fitting, installation, and leak repair', sortOrder: 1 },
      { slug: 'water-heater-installation', i18nKey: 'skills.plumber.water-heater-installation', description: 'Geysers and water heater setup', sortOrder: 2 },
      { slug: 'drain-cleaning', i18nKey: 'skills.plumber.drain-cleaning', description: 'Blocked drain clearing and jetting', sortOrder: 3 },
      { slug: 'leak-detection-repair', i18nKey: 'skills.plumber.leak-detection-repair', description: 'Hidden leak detection and pipe repair', sortOrder: 4 },
      { slug: 'bathroom-plumbing', i18nKey: 'skills.plumber.bathroom-plumbing', description: 'Toilet, basin, and shower plumbing', sortOrder: 5 },
      { slug: 'kitchen-plumbing', i18nKey: 'skills.plumber.kitchen-plumbing', description: 'Kitchen sink and dishwasher plumbing', sortOrder: 6 },
      { slug: 'sewer-line-repair', i18nKey: 'skills.plumber.sewer-line-repair', description: 'Sewer line inspection and repair', sortOrder: 7 },
      { slug: 'water-pressure-issues', i18nKey: 'skills.plumber.water-pressure-issues', description: 'Water pressure testing and adjustment', sortOrder: 8 },
      { slug: 'emergency-plumbing', i18nKey: 'skills.plumber.emergency-plumbing', description: 'Urgent plumbing repair and flood response', sortOrder: 9 },
      { slug: 'commercial-plumbing', i18nKey: 'skills.plumber.commercial-plumbing', description: 'Commercial building plumbing systems', sortOrder: 10 },
      { slug: 'water-treatment-filtration', i18nKey: 'skills.plumber.water-treatment-filtration', description: 'Water purifier and filtration system installation', sortOrder: 11 },
    ],
  },
  {
    slug: 'ac-technician',
    i18nKey: 'professions.acTechnician',
    description: 'Air conditioning and refrigeration services',
    sortOrder: 3,
    categorySlug: 'ac-and-refrigeration',
    confidence: 'DETERMINISTIC',
    skills: [
      { slug: 'ac-installation', i18nKey: 'skills.ac-technician.ac-installation', description: 'Split, window, and ducted AC installation', sortOrder: 1 },
      { slug: 'ac-repair', i18nKey: 'skills.ac-technician.ac-repair', description: 'AC fault diagnosis and component repair', sortOrder: 2 },
      { slug: 'ac-gas-refill', i18nKey: 'skills.ac-technician.ac-gas-refill', description: 'Refrigerant gas charging and leak repair', sortOrder: 3 },
      { slug: 'ac-maintenance', i18nKey: 'skills.ac-technician.ac-maintenance', description: 'Scheduled AC servicing and filter cleaning', sortOrder: 4 },
      { slug: 'split-ac-service', i18nKey: 'skills.ac-technician.split-ac-service', description: 'Split AC deep cleaning and servicing', sortOrder: 5 },
      { slug: 'window-ac-service', i18nKey: 'skills.ac-technician.window-ac-service', description: 'Window AC servicing and repair', sortOrder: 6 },
      { slug: 'central-ac-repair', i18nKey: 'skills.ac-technician.central-ac-repair', description: 'Centralized AC system repair', sortOrder: 7 },
      { slug: 'refrigeration-repair', i18nKey: 'skills.ac-technician.refrigeration-repair', description: 'Refrigerator and freezer repair', sortOrder: 8 },
      { slug: 'inverter-ac-service', i18nKey: 'skills.ac-technician.inverter-ac-service', description: 'Inverter AC specialized servicing', sortOrder: 9 },
      { slug: 'emergency-ac-repair', i18nKey: 'skills.ac-technician.emergency-ac-repair', description: 'Urgent AC breakdown repair', sortOrder: 10 },
    ],
  },
  {
    slug: 'painter',
    i18nKey: 'professions.painter',
    description: 'Interior and exterior painting services',
    sortOrder: 4,
    categorySlug: 'painting-and-decorating',
    confidence: 'DETERMINISTIC',
    skills: [
      { slug: 'interior-painting', i18nKey: 'skills.painter.interior-painting', description: 'Indoor wall and ceiling painting', sortOrder: 1 },
      { slug: 'exterior-painting', i18nKey: 'skills.painter.exterior-painting', description: 'Outdoor facade and wall painting', sortOrder: 2 },
      { slug: 'wallpaper-installation', i18nKey: 'skills.painter.wallpaper-installation', description: 'Wallpaper hanging and removal', sortOrder: 3 },
      { slug: 'texture-painting', i18nKey: 'skills.painter.texture-painting', description: 'Textured paint finishes and effects', sortOrder: 4 },
      { slug: 'wood-painting-varnishing', i18nKey: 'skills.painter.wood-painting-varnishing', description: 'Wood surface painting and varnishing', sortOrder: 5 },
      { slug: 'metal-painting', i18nKey: 'skills.painter.metal-painting', description: 'Metal surface painting with anti-rust coating', sortOrder: 6 },
      { slug: 'paint-consultation', i18nKey: 'skills.painter.paint-consultation', description: 'Color consultation and paint selection', sortOrder: 7 },
      { slug: 'surface-preparation', i18nKey: 'skills.painter.surface-preparation', description: 'Wall filling, sanding, and priming', sortOrder: 8 },
      { slug: 'decorative-finishing', i18nKey: 'skills.painter.decorative-finishing', description: 'Faux finishes, stenciling, and decorative painting', sortOrder: 9 },
    ],
  },
  {
    slug: 'carpenter',
    i18nKey: 'professions.carpenter',
    description: 'Carpentry and furniture services',
    sortOrder: 5,
    categorySlug: 'carpentry-and-furniture',
    confidence: 'DETERMINISTIC',
    skills: [
      { slug: 'furniture-repair', i18nKey: 'skills.carpenter.furniture-repair', description: 'Furniture fixing and restoration', sortOrder: 1 },
      { slug: 'door-window-installation', i18nKey: 'skills.carpenter.door-window-installation', description: 'Door and window frame installation', sortOrder: 2 },
      { slug: 'custom-furniture', i18nKey: 'skills.carpenter.custom-furniture', description: 'Custom furniture making and design', sortOrder: 3 },
      { slug: 'wooden-flooring', i18nKey: 'skills.carpenter.wooden-flooring', description: 'Hardwood and laminate floor installation', sortOrder: 4 },
      { slug: 'cabinet-installation', i18nKey: 'skills.carpenter.cabinet-installation', description: 'Kitchen and bathroom cabinet fitting', sortOrder: 5 },
      { slug: 'deck-patio-building', i18nKey: 'skills.carpenter.deck-patio-building', description: 'Outdoor deck and patio construction', sortOrder: 6 },
      { slug: 'wooden-fencing', i18nKey: 'skills.carpenter.wooden-fencing', description: 'Wooden fence installation and repair', sortOrder: 7 },
      { slug: 'skirting-boards', i18nKey: 'skills.carpenter.skirting-boards', description: 'Skirting boards and trim installation', sortOrder: 8 },
      { slug: 'emergency-carpentry', i18nKey: 'skills.carpenter.emergency-carpentry', description: 'Urgent woodwork and structural repair', sortOrder: 9 },
    ],
  },
  {
    slug: 'mason',
    i18nKey: 'professions.mason',
    description: 'Masonry and concrete works',
    sortOrder: 6,
    categorySlug: 'masonry-and-concrete',
    confidence: 'DETERMINISTIC',
    skills: [
      { slug: 'bricklaying', i18nKey: 'skills.mason.bricklaying', description: 'Brick wall construction and repair', sortOrder: 1 },
      { slug: 'concrete-works', i18nKey: 'skills.mason.concrete-works', description: 'Concrete pouring, finishing, and repair', sortOrder: 2 },
      { slug: 'stone-masonry', i18nKey: 'skills.mason.stone-masonry', description: 'Natural stone wall and cladding work', sortOrder: 3 },
      { slug: 'plastering', i18nKey: 'skills.mason.plastering', description: 'Wall plastering and rendering', sortOrder: 4 },
      { slug: 'tiling', i18nKey: 'skills.mason.tiling', description: 'Wall and floor tile installation', sortOrder: 5 },
      { slug: 'foundation-repair', i18nKey: 'skills.mason.foundation-repair', description: 'Foundation crack repair and reinforcement', sortOrder: 6 },
      { slug: 'retaining-walls', i18nKey: 'skills.mason.retaining-walls', description: 'Retaining wall construction', sortOrder: 7 },
      { slug: 'driveway-paving', i18nKey: 'skills.mason.driveway-paving', description: 'Driveway and pathway paving', sortOrder: 8 },
    ],
  },
  {
    slug: 'roofer',
    i18nKey: 'professions.roofer',
    description: 'Roofing and gutter services',
    sortOrder: 7,
    categorySlug: 'roofing-and-gutters',
    confidence: 'DETERMINISTIC',
    skills: [
      { slug: 'roof-installation', i18nKey: 'skills.roofer.roof-installation', description: 'New roof installation and replacement', sortOrder: 1 },
      { slug: 'roof-repair', i18nKey: 'skills.roofer.roof-repair', description: 'Roof leak repair and tile replacement', sortOrder: 2 },
      { slug: 'roof-inspection', i18nKey: 'skills.roofer.roof-inspection', description: 'Roof condition assessment and report', sortOrder: 3 },
      { slug: 'gutter-installation', i18nKey: 'skills.roofer.gutter-installation', description: 'Gutter and downpipe installation', sortOrder: 4 },
      { slug: 'gutter-cleaning', i18nKey: 'skills.roofer.gutter-cleaning', description: 'Gutter clearing and maintenance', sortOrder: 5 },
      { slug: 'roof-waterproofing', i18nKey: 'skills.roofer.roof-waterproofing', description: 'Roof waterproofing and membrane application', sortOrder: 6 },
      { slug: 'roof-insulation', i18nKey: 'skills.roofer.roof-insulation', description: 'Roof heat insulation installation', sortOrder: 7 },
      { slug: 'emergency-roof-repair', i18nKey: 'skills.roofer.emergency-roof-repair', description: 'Urgent roof damage repair', sortOrder: 8 },
    ],
  },
  {
    slug: 'pest-control-technician',
    i18nKey: 'professions.pestControlTechnician',
    description: 'Pest control and fumigation services',
    sortOrder: 8,
    categorySlug: 'pest-control',
    confidence: 'DETERMINISTIC',
    skills: [
      { slug: 'general-pest-control', i18nKey: 'skills.pest-control-technician.general-pest-control', description: 'General insect and pest treatment', sortOrder: 1 },
      { slug: 'termite-treatment', i18nKey: 'skills.pest-control-technician.termite-treatment', description: 'Termite barrier and colony elimination', sortOrder: 2 },
      { slug: 'cockroach-treatment', i18nKey: 'skills.pest-control-technician.cockroach-treatment', description: 'Cockroach gel and spray treatment', sortOrder: 3 },
      { slug: 'rodent-control', i18nKey: 'skills.pest-control-technician.rodent-control', description: 'Rat and mouse control and proofing', sortOrder: 4 },
      { slug: 'mosquito-control', i18nKey: 'skills.pest-control-technician.mosquito-control', description: 'Mosquito fogging and larvicide treatment', sortOrder: 5 },
      { slug: 'bed-bug-treatment', i18nKey: 'skills.pest-control-technician.bed-bug-treatment', description: 'Bed bug heat and chemical treatment', sortOrder: 6 },
      { slug: 'fumigation-services', i18nKey: 'skills.pest-control-technician.fumigation-services', description: 'Full premises fumigation', sortOrder: 7 },
      { slug: 'pre-purchase-pest-inspection', i18nKey: 'skills.pest-control-technician.pre-purchase-pest-inspection', description: 'Pre-purchase pest and termite inspection', sortOrder: 8 },
    ],
  },
  {
    slug: 'cleaner',
    i18nKey: 'professions.cleaner',
    description: 'Professional cleaning services',
    sortOrder: 9,
    categorySlug: 'cleaning-services',
    confidence: 'DETERMINISTIC',
    skills: [
      { slug: 'deep-cleaning', i18nKey: 'skills.cleaner.deep-cleaning', description: 'Thorough top-to-bottom cleaning', sortOrder: 1 },
      { slug: 'regular-cleaning', i18nKey: 'skills.cleaner.regular-cleaning', description: 'Routine home and office cleaning', sortOrder: 2 },
      { slug: 'move-in-move-out', i18nKey: 'skills.cleaner.move-in-move-out', description: 'Moving day cleaning service', sortOrder: 3 },
      { slug: 'office-cleaning', i18nKey: 'skills.cleaner.office-cleaning', description: 'Office and commercial space cleaning', sortOrder: 4 },
      { slug: 'window-cleaning', i18nKey: 'skills.cleaner.window-cleaning', description: 'Interior and exterior window cleaning', sortOrder: 5 },
      { slug: 'carpet-cleaning', i18nKey: 'skills.cleaner.carpet-cleaning', description: 'Carpet shampooing and stain removal', sortOrder: 6 },
      { slug: 'post-construction', i18nKey: 'skills.cleaner.post-construction', description: 'Post-renovation debris removal and cleaning', sortOrder: 7 },
      { slug: 'pressure-washing', i18nKey: 'skills.cleaner.pressure-washing', description: 'High-pressure exterior cleaning', sortOrder: 8 },
      { slug: 'eco-friendly-cleaning', i18nKey: 'skills.cleaner.eco-friendly-cleaning', description: 'Green and non-toxic cleaning service', sortOrder: 9 },
    ],
  },
  {
    slug: 'locksmith',
    i18nKey: 'professions.locksmith',
    description: 'Locksmith and security services',
    sortOrder: 10,
    categorySlug: 'locksmith-services',
    confidence: 'DETERMINISTIC',
    skills: [
      { slug: 'lock-installation', i18nKey: 'skills.locksmith.lock-installation', description: 'New lock fitting and deadbolt installation', sortOrder: 1 },
      { slug: 'lock-repair', i18nKey: 'skills.locksmith.lock-repair', description: 'Lock mechanism repair and adjustment', sortOrder: 2 },
      { slug: 'key-duplication', i18nKey: 'skills.locksmith.key-duplication', description: 'Key cutting and duplication', sortOrder: 3 },
      { slug: 'emergency-lockout', i18nKey: 'skills.locksmith.emergency-lockout', description: 'Emergency lockout and door opening', sortOrder: 4 },
      { slug: 'safe-cracking', i18nKey: 'skills.locksmith.safe-cracking', description: 'Safe opening and combination reset', sortOrder: 5 },
      { slug: 'access-control-systems', i18nKey: 'skills.locksmith.access-control-systems', description: 'Electronic access and intercom systems', sortOrder: 6 },
      { slug: 'car-locksmith', i18nKey: 'skills.locksmith.car-locksmith', description: 'Vehicle lock and key services', sortOrder: 7 },
      { slug: 'commercial-locksmith', i18nKey: 'skills.locksmith.commercial-locksmith', description: 'Commercial master key and security systems', sortOrder: 8 },
      { slug: 'smart-lock-installation', i18nKey: 'skills.locksmith.smart-lock-installation', description: 'Smart lock and biometric system installation', sortOrder: 9 },
    ],
  },
]

const MANUAL_REVIEW_CATEGORIES = [
  { slug: 'tiling-and-flooring', reason: 'May be 1 profession (Tiler) or 2 (Tiler + Flooring Specialist)' },
  { slug: 'gardening-and-landscaping', reason: 'May be 1 (Gardener) or 2 (Gardener + Landscaper)' },
  { slug: 'home-security-and-automation', reason: 'Broad category — security or automation technician?' },
  { slug: 'moving-and-packing', reason: 'Mover? Logistics worker?' },
  { slug: 'vehicle-care-and-maintenance', reason: 'Automotive technician? Mechanic?' },
  { slug: 'it-and-electronics-repair', reason: 'IT technician? Electronics technician?' },
  { slug: 'event-and-party-services', reason: 'Event technician? Multiple sub-roles?' },
  { slug: 'personal-care-and-wellness', reason: 'Personal care worker? Multiple wellness professions?' },
  { slug: 'home-renovation-and-interiors', reason: 'Renovation specialist? Interior designer?' },
  { slug: 'solar-and-energy-solutions', reason: 'Solar technician? Electrician sub-specialty?' },
  { slug: 'handyman-and-general-repairs', reason: 'Handyman? Multiple trade skills?' },
  { slug: 'glass-and-aluminium', reason: 'Glass technician? Aluminium fabricator?' },
  { slug: 'appliance-installation-and-repair', reason: 'Appliance technician? Refrigeration overlap?' },
  { slug: 'curtains-blinds-and-upholstery', reason: 'Upholsterer? Curtain installer?' },
]

async function seed() {
  console.log('=== PHASE 10.1 PROFESSION SEED ===\n')

  const existingCount = await prisma.profession.count()
  if (existingCount > 0) {
    console.log(`WARNING: ${existingCount} professions already exist. Skipping seed.`)
    console.log('Run with --force to re-seed.')
    if (!process.argv.includes('--force')) {
      await prisma.$disconnect()
      return
    }
  }

  let professionsCreated = 0
  let skillsCreated = 0
  let requirementsCreated = 0
  let skillReqsCreated = 0
  let unresolvedMappings: { category: string; reason: string }[] = []

  for (const prof of PROFESSIONS) {
    const existing = await prisma.profession.findUnique({ where: { slug: prof.slug } })
    if (existing) {
      console.log(`Profession "${prof.slug}" already exists, skipping.`)
      continue
    }

    const profession = await prisma.profession.create({
      data: {
        slug: prof.slug,
        i18nKey: prof.i18nKey,
        description: prof.description,
        sortOrder: prof.sortOrder,
      },
    })
    professionsCreated++
    console.log(`Created profession: ${prof.slug} (${prof.categorySlug})`)

    for (const skill of prof.skills) {
      const existingSkill = await prisma.professionSkill.findFirst({
        where: { professionId: profession.id, slug: skill.slug },
      })
      if (existingSkill) continue

      await prisma.professionSkill.create({
        data: {
          professionId: profession.id,
          slug: skill.slug,
          i18nKey: skill.i18nKey,
          description: skill.description,
          sortOrder: skill.sortOrder,
        },
      })
      skillsCreated++
    }
    console.log(`  → ${prof.skills.length} skills created`)
  }

  const categorySlugToProfession = new Map<string, string>()
  for (const prof of PROFESSIONS) {
    categorySlugToProfession.set(prof.categorySlug, prof.slug)
  }

  const serviceTemplates = await prisma.serviceTemplate.findMany({
    where: { isActive: true },
    include: { jobCategory: { select: { slug: true } } },
  })

  for (const st of serviceTemplates) {
    const profSlug = st.jobCategory?.slug ? categorySlugToProfession.get(st.jobCategory.slug) : undefined
    if (!profSlug) {
      if (st.jobCategory?.slug) {
        const isManualReview = MANUAL_REVIEW_CATEGORIES.some(c => c.slug === st.jobCategory!.slug)
        if (isManualReview) {
          const mr = MANUAL_REVIEW_CATEGORIES.find(c => c.slug === st.jobCategory!.slug)
          unresolvedMappings.push({ category: st.jobCategory!.slug, reason: mr?.reason || 'Manual review required' })
        }
      }
      continue
    }

    const profession = await prisma.profession.findUnique({ where: { slug: profSlug } })
    if (!profession) continue

    const existingReq = await prisma.serviceProfessionRequirement.findUnique({
      where: { serviceTemplateId_professionId: { serviceTemplateId: st.id, professionId: profession.id } },
    })
    if (existingReq) continue

    const req = await prisma.serviceProfessionRequirement.create({
      data: {
        serviceTemplateId: st.id,
        professionId: profession.id,
      },
    })
    requirementsCreated++

    const profSkills = await prisma.professionSkill.findMany({
      where: { professionId: profession.id, isActive: true },
    })

    for (const skill of profSkills) {
      const existingSkillReq = await prisma.serviceSkillRequirement.findUnique({
        where: { serviceProfessionReqId_professionSkillId: { serviceProfessionReqId: req.id, professionSkillId: skill.id } },
      })
      if (existingSkillReq) continue

      await prisma.serviceSkillRequirement.create({
        data: {
          serviceProfessionReqId: req.id,
          professionSkillId: skill.id,
          requirementMode: 'REQUIRED_ALL',
        },
      })
      skillReqsCreated++
    }
  }

  const uniqueUnresolved = [...new Map(unresolvedMappings.map(u => [u.category, u])).values()]

  console.log('\n=== SEED REPORT ===')
  console.log(`Professions created: ${professionsCreated}`)
  console.log(`ProfessionSkills created: ${skillsCreated}`)
  console.log(`ServiceProfessionRequirements created: ${requirementsCreated}`)
  console.log(`ServiceSkillRequirements created: ${skillReqsCreated}`)

  console.log('\n=== UNRESOLVED MAPPINGS (MANUAL_REVIEW) ===')
  for (const u of uniqueUnresolved) {
    console.log(`  Category: "${u.category}" → ${u.reason}`)
  }

  const totalTemplateJobs = await prisma.templateJob.count()
  const mappedSkills = skillsCreated
  console.log(`\n=== TEMPLATEJOB COVERAGE ===`)
  console.log(`Total TemplateJobs: ${totalTemplateJobs}`)
  console.log(`Mapped to ProfessionSkills: ${mappedSkills}`)
  console.log(`Unresolved categories: ${uniqueUnresolved.length}`)

  await prisma.$disconnect()
}

seed().catch((e) => {
  console.error('Seed failed:', e)
  prisma.$disconnect()
  process.exit(1)
})

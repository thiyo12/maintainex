import { describe, expect, it } from 'vitest'

import {
  PROPOSED_DEPARTMENTS,
  PROPOSED_SERVICES,
  PROPOSED_SKILLS,
  PROPOSED_CATALOGUE_STATUS,
  buildProposedImportRows,
  getSafeProposedImportPricing,
} from '@/lib/catalog/proposed-expansion'
import {
  summariseProposedCoverage,
  validateProposedExpansion,
  type ExistingCatalogue,
} from '@/lib/catalog/proposed-validation'

/**
 * The live baseline recovered from lib/v2-job-categories.ts. Kept as a fixture so
 * the proposal can never silently duplicate a shipped service.
 */
const EXISTING: ExistingCatalogue = {
  departments: [
    { slug: 'electrical-works', name: 'Electrical Works', jobs: ['Wiring and rewiring', 'Switch and socket installation', 'Circuit breaker repair', 'Light and fan installation', 'Doorbell installation', 'Extension board and cabling', 'Generator connection', 'Inverter and solar wiring', 'Water heater installation', 'Power outage repair', 'Garden lighting installation', 'Emergency electrical repair'] },
    { slug: 'plumbing', name: 'Plumbing', jobs: ['Leaking pipe repair', 'Tap and faucet repair', 'Toilet flush repair', 'Water tank installation', 'Water pump repair', 'Drain unblocking', 'Shower fitting installation', 'Hot water system repair', 'Kitchen sink installation', 'Sewage pipe repair', 'Emergency plumbing repair'] },
    { slug: 'ac-and-refrigeration', name: 'AC and Refrigeration', jobs: ['AC installation', 'AC servicing and cleaning', 'AC gas refilling', 'AC not cooling repair', 'AC water leak repair', 'AC remote repair', 'Refrigerator repair', 'Freezer repair', 'Cold room maintenance', 'Ventilation fan installation'] },
    { slug: 'painting-and-decorating', name: 'Painting and Decorating', jobs: ['Interior wall painting', 'Exterior house painting', 'Ceiling painting', 'Wallpaper installation', 'Furniture painting and refinishing', 'Texture wall finish', 'Door and trim painting', 'Waterproof coating application', 'Metal railing painting'] },
    { slug: 'carpentry-and-furniture', name: 'Carpentry and Furniture', jobs: ['Custom shelf installation', 'Cabinet repair and refacing', 'Door repair and hanging', 'Furniture assembly', 'Wooden floor installation', 'Deck and porch building', 'Window and door frame repair', 'Custom wardrobe build', 'Staircase railing installation'] },
    { slug: 'tiling-and-flooring', name: 'Tiling and Flooring', jobs: ['Floor tile installation', 'Wall tile installation', 'Tile repair and replacement', 'Bathroom waterproofing', 'Vinyl flooring installation', 'Mosaic tile work', 'Carpet installation', 'Skirting board installation', 'Outdoor patio tiling'] },
    { slug: 'masonry-and-concrete', name: 'Masonry and Concrete', jobs: ['Brick and block wall construction', 'Concrete slab pour', 'Plastering and rendering', 'Concrete crack repair', 'Pillar and column construction', 'Driveway paving', 'Garden wall building', 'Steps and stair construction'] },
    { slug: 'roofing-and-gutters', name: 'Roofing and Gutters', jobs: ['Roof leak repair', 'Roof tile replacement', 'Gutter cleaning and repair', 'Gutter installation', 'Ceiling leak repair', 'Roof inspection and maintenance', 'Skylight installation', 'Fascia and soffit repair'] },
    { slug: 'pest-control', name: 'Pest Control', jobs: ['General pest control treatment', 'Termite inspection and treatment', 'Mosquito control', 'Rodent control and removal', 'Bed bug treatment', 'Lizard and gecko control', 'Flea and tick treatment', 'Wood borer treatment'] },
    { slug: 'cleaning-services', name: 'Cleaning Services', jobs: ['Home deep cleaning', 'Office cleaning', 'Kitchen deep cleaning', 'Bathroom deep cleaning', 'Sofa and upholstery cleaning', 'Window cleaning', 'Move-in/move-out cleaning', 'Carpet steam cleaning', 'Post-construction cleaning'] },
    { slug: 'gardening-and-landscaping', name: 'Gardening and Landscaping', jobs: ['Garden maintenance', 'Lawn mowing and care', 'Tree trimming and pruning', 'Hedge trimming', 'Planting and garden design', 'Lawn renovation and turf installation', 'Irrigation system installation', 'Compost and soil preparation', 'Pond and water feature maintenance'] },
    { slug: 'home-security-and-automation', name: 'Home Security and Automation', jobs: ['CCTV camera installation', 'Smart lock installation', 'Alarm system installation', 'Video doorbell installation', 'Smart home hub setup', 'Electric fence installation', 'Gate automation', 'Intercom system installation', 'Smoke and gas detector installation'] },
    { slug: 'moving-and-packing', name: 'Moving and Packing', jobs: ['Local moving service', 'Packing service', 'Furniture disassembly and assembly', 'Piano moving', 'Vehicle transport', 'Storage solutions', 'Office relocation', 'Waste removal after move'] },
    { slug: 'vehicle-care-and-maintenance', name: 'Vehicle Care and Maintenance', jobs: ['Car washing and detailing', 'Car waxing and polishing', 'Interior deep cleaning', 'Oil change service', 'Tire change and rotation', 'AC service for vehicles', 'Battery replacement', 'Motorcycle servicing', 'Paint protection film application'] },
    { slug: 'it-and-electronics-repair', name: 'IT and Electronics Repair', jobs: ['Computer repair and troubleshooting', 'Smartphone screen replacement', 'Laptop battery replacement', 'Wi-Fi network setup', 'Data backup and recovery', 'Printer setup and repair', 'TV mounting and setup', 'Smart home device setup', 'CCTV and security system setup', 'Software installation and updates'] },
    { slug: 'event-and-party-services', name: 'Event and Party Services', jobs: ['Event decoration setup', 'Sound system setup', 'Lighting setup for events', 'Tent and canopy rental setup', 'Photography and videography', 'Catering setup service', 'DJ and entertainment service', 'Bouncy castle and inflatable setup', 'Balloon decoration service'] },
    { slug: 'personal-care-and-wellness', name: 'Personal Care and Wellness', jobs: ['Massage therapy at home', 'Haircut and styling at home', 'Makeup and grooming service', 'Manicure and pedicure', 'Facial and skincare treatment', 'Personal training session', 'Yoga and meditation instruction', 'Elderly care assistance', 'Child care and babysitting'] },
    { slug: 'home-renovation-and-interiors', name: 'Home Renovation and Interiors', jobs: ['Full room renovation', 'Bathroom renovation', 'Kitchen renovation', 'False ceiling installation', 'Partition wall construction', 'Closet and storage design', 'Staircase renovation', 'Window replacement', 'Interior design consultation'] },
    { slug: 'solar-and-energy-solutions', name: 'Solar and Energy Solutions', jobs: ['Solar panel installation', 'Solar water heater installation', 'Inverter installation', 'Battery storage system setup', 'Solar pump installation', 'Energy audit and consultation', 'Solar street light installation', 'Solar maintenance and cleaning', 'Wind turbine installation'] },
    { slug: 'handyman-and-general-repairs', name: 'Handyman and General Repairs', jobs: ['Cupboard and wardrobe assembly', 'Wooden bed assembly', 'Table and chair assembly', 'Bookshelf assembly', 'Cabinet assembly', 'Furniture disassembly', 'Shelf installation', 'Curtain rod installation', 'Blind installation', 'Mirror hanging', 'Picture and frame hanging', 'Wall hook installation', 'Drawer repair', 'Cabinet hinge repair', 'Furniture handle replacement', 'Door handle replacement', 'Door hinge repair and replacement', 'Door alignment and adjustment', 'Window handle and lock repair', 'Minor wall repair', 'Silicone and caulking work', 'General handyman service', 'Multiple small jobs'] },
    { slug: 'glass-and-aluminium', name: 'Glass and Aluminium', jobs: ['Glass door installation', 'Glass window installation', 'Window glass replacement', 'Aluminium door installation', 'Aluminium window installation', 'Sliding door and window repair', 'Shower glass installation', 'Glass partition installation', 'Mirror installation', 'Aluminium frame repair', 'Mosquito net installation'] },
    { slug: 'appliance-installation-and-repair', name: 'Appliance Installation and Repair', jobs: ['Washing machine installation', 'Washing machine repair', 'Refrigerator installation', 'Refrigerator repair', 'Dishwasher installation', 'Microwave installation', 'Oven installation', 'Water purifier installation', 'Water filter installation', 'Electric cooker installation', 'Clothes dryer installation', 'Small appliance repair'] },
    { slug: 'locksmith-services', name: 'Locksmith Services', jobs: ['Lock installation', 'Lock replacement', 'Lock repair', 'Door unlocking', 'Key duplication', 'Smart lock installation', 'Digital lock repair', 'Safe and locker opening', 'Emergency locksmith service'] },
    { slug: 'curtains-blinds-and-upholstery', name: 'Curtains/Blinds/Upholstery', jobs: ['Curtain installation', 'Curtain rod installation', 'Curtain track installation', 'Blind installation', 'Roller blind installation', 'Curtain repair', 'Curtain cleaning', 'Sofa upholstery repair', 'Chair upholstery', 'Cushion repair and replacement'] },
  ],
}

describe('proposed catalogue expansion integrity', () => {
  const violations = validateProposedExpansion(
    PROPOSED_DEPARTMENTS,
    PROPOSED_SERVICES,
    PROPOSED_SKILLS,
    EXISTING,
  )

  it('has no integrity violations', () => {
    const summary = violations
      .slice(0, 25)
      .map(v => `${v.code}: ${v.detail}`)
      .join('\n')
    expect(violations, `Proposed expansion violations:\n${summary}`).toEqual([])
  })

  it('never duplicates a live catalogue service', () => {
    const liveNames = new Set(
      EXISTING.departments.flatMap(d => d.jobs.map(job => `${d.slug}::${job.toLowerCase()}`)),
    )
    for (const service of PROPOSED_SERVICES) {
      expect(liveNames.has(`${service.department}::${service.name.toLowerCase()}`)).toBe(false)
    }
  })

  it('never invents Canadian price benchmarks', () => {
    for (const service of PROPOSED_SERVICES) {
      // priceLKR is a Sri Lankan band; Canada-only services must carry none.
      if (service.markets.includes('CA') && !service.markets.includes('LK')) {
        expect(service.priceLKR).toBeUndefined()
      }
    }
  })

  it('only references launch markets', () => {
    for (const service of PROPOSED_SERVICES) {
      for (const market of service.markets) {
        expect(['LK', 'CA']).toContain(market)
      }
    }
  })

  it('is never presented as previously approved', () => {
    expect(PROPOSED_CATALOGUE_STATUS.approved).toBe(false)
    expect(PROPOSED_CATALOGUE_STATUS.note.toLowerCase()).toContain('not previously approved')
  })

  it('imports every proposed service inactive', () => {
    const rows = buildProposedImportRows(PROPOSED_SERVICES)
    expect(rows.length).toBe(PROPOSED_SERVICES.length)
    for (const row of rows) {
      expect(row.isActive).toBe(false)
      expect(row.status).toBe('PROPOSED')
    }
  })


  it('stages LKR proposals only for Sri Lanka, never the CA market without CAD evidence', () => {
    const sample = PROPOSED_SERVICES.find(service => service.markets.includes('LK') && service.priceLKR)
    expect(sample).toBeDefined()
    expect(getSafeProposedImportPricing(sample!)).toMatchObject({
      countries: '["LK"]', currency: 'LKR', priceMin: sample!.priceLKR!.min,
      priceMax: sample!.priceLKR!.max,
    })
  })

  it('never creates a CA/LKR catalogue record for dual-market proposed services', () => {
    const sample = PROPOSED_SERVICES.find(service => service.markets.includes('CA') && service.markets.includes('LK') && service.priceLKR)
    expect(sample).toBeDefined()
    expect(getSafeProposedImportPricing(sample!)?.countries).toBe('["LK"]')
    expect(sample?.markets).toContain('CA')
  })

  it('keeps Canada-only proposals in source but excludes them from unpriced database staging', () => {
    const sample = { ...PROPOSED_SERVICES[0], markets: ['CA'] as Array<'CA' | 'LK'>, priceLKR: undefined }
    expect(getSafeProposedImportPricing(sample)).toBeNull()
  })

  it('refuses invalid or missing Sri Lankan pricing instead of persisting fake zeros', () => {
    const sample = { ...PROPOSED_SERVICES[0], markets: ['LK'] as Array<'CA' | 'LK'>, priceLKR: undefined }
    expect(getSafeProposedImportPricing(sample)).toBeNull()
    expect(getSafeProposedImportPricing({
      ...sample, priceLKR: { min: 9000, max: 1000 },
    })).toBeNull()
  })

  it('preserves every unapproved proposed source record as inactive', () => {
    const rows = buildProposedImportRows(PROPOSED_SERVICES)
    expect(rows).toHaveLength(309)
    expect(rows.every(r => !r.isActive && r.status === 'PROPOSED')).toBe(true)
  })
  it('marks company-only services correctly', () => {
    const rows = buildProposedImportRows(PROPOSED_SERVICES)
    const index = new Map(PROPOSED_SERVICES.map((s, i) => [i, s]))
    rows.forEach((row, i) => {
      expect(row.isCompanyOnly).toBe(index.get(i)!.providerType === 'COMPANY')
    })
  })
})

describe('proposed catalogue coverage', () => {
  const coverage = summariseProposedCoverage(PROPOSED_DEPARTMENTS, PROPOSED_SERVICES, EXISTING)

  it('starts from the real 24 department / 239 service live baseline', () => {
    expect(coverage.liveDepartments).toBe(24)
    expect(coverage.liveServices).toBe(239)
  })

  it('proposes the three missing departments', () => {
    expect(coverage.proposedDepartments).toBe(3)
    expect(coverage.resultingDepartments).toBe(27)
    expect(coverage.targetDepartments).toBe(27)
  })

  it('reports how far the proposal is from the 548 service target', () => {
    expect(coverage.resultingServices).toBe(239 + PROPOSED_SERVICES.length)
    expect(coverage.servicesShortfall).toBe(
      Math.max(0, 548 - coverage.resultingServices),
    )
  })

  it('exactly closes the approved 27 department / 548 service gap', () => {
    expect(coverage.resultingDepartments).toBe(27)
    expect(coverage.resultingServices).toBe(548)
    expect(coverage.servicesShortfall).toBe(0)
  })

  it('covers every department in the live catalogue and adds the three missing ones', () => {
    const covered = new Set(PROPOSED_SERVICES.map(s => s.department))
    const expected = new Set([
      ...EXISTING.departments.map(d => d.slug),
      ...PROPOSED_DEPARTMENTS.map(d => d.slug),
    ])
    expect([...expected].filter(slug => !covered.has(slug))).toEqual([])
  })

  it('splits Sri Lankan and Vancouver eligibility deliberately', () => {
    expect(Object.keys(coverage.markets).sort()).toEqual(['CA', 'LK'])
  })
})

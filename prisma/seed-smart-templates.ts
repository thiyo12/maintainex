import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

type QuestionOption = { label: string; value: string; priceEffect?: number }
type Question = {
  key: string
  label: string
  type: 'single' | 'multi' | 'text' | 'number'
  options?: QuestionOption[]
  placeholder?: string
  required?: boolean
}
type Template = { slug: string; name: string; description: string; questions: Question[] }

const TEMPLATES: Template[] = [
  {
    slug: 'electrical-works',
    name: 'Electrical Works',
    description: 'Wiring, switches, lights, fans, breakers and full electrical repair.',
    questions: [
      { key: 'service', label: 'Which electrical service do you need?', type: 'single', required: true, options: [
        { label: 'Wiring / rewiring', value: 'wiring', priceEffect: 1.6 },
        { label: 'Switch & socket install', value: 'switch', priceEffect: 0.5 },
        { label: 'Light & fan install', value: 'light', priceEffect: 0.6 },
        { label: 'Circuit breaker repair', value: 'breaker', priceEffect: 0.7 },
        { label: 'Emergency / outage', value: 'emergency', priceEffect: 1.5 },
        { label: 'Other electrical work', value: 'other', priceEffect: 1 },
      ] },
      { key: 'rooms', label: 'How many rooms / points?', type: 'single', options: [
        { label: '1 room', value: '1', priceEffect: 0.5 },
        { label: '2–3 rooms', value: '2', priceEffect: 0.8 },
        { label: 'Whole house', value: 'house', priceEffect: 1.5 },
      ] },
      { key: 'materials', label: 'Who provides materials?', type: 'single', options: [
        { label: 'I will supply', value: 'customer', priceEffect: 0.7 },
        { label: 'Tasker supplies', value: 'tasker', priceEffect: 1.2 },
      ] },
      { key: 'location', label: 'Where is the work?', type: 'single', options: [
        { label: 'Indoor', value: 'indoor', priceEffect: 1 },
        { label: 'Outdoor', value: 'outdoor', priceEffect: 1.1 },
      ] },
    ],
  },
  {
    slug: 'plumbing',
    name: 'Plumbing',
    description: 'Leaks, taps, toilets, water tanks, pumps and full plumbing repair.',
    questions: [
      { key: 'service', label: 'Which plumbing service do you need?', type: 'single', required: true, options: [
        { label: 'Leaking pipe repair', value: 'leak', priceEffect: 1.2 },
        { label: 'Tap / faucet repair', value: 'tap', priceEffect: 0.5 },
        { label: 'Toilet fix', value: 'toilet', priceEffect: 0.5 },
        { label: 'Drain unblocking', value: 'drain', priceEffect: 0.7 },
        { label: 'Water tank / pump', value: 'tank', priceEffect: 1.5 },
        { label: 'Emergency plumbing', value: 'emergency', priceEffect: 1.8 },
        { label: 'Other plumbing', value: 'other', priceEffect: 1 },
      ] },
      { key: 'severity', label: 'How bad is the issue?', type: 'single', options: [
        { label: 'Minor / slow', value: 'minor', priceEffect: 0.7 },
        { label: 'Moderate', value: 'moderate', priceEffect: 1 },
        { label: 'Severe / flooding', value: 'severe', priceEffect: 1.5 },
      ] },
      { key: 'materials', label: 'Who provides materials?', type: 'single', options: [
        { label: 'I will supply', value: 'customer', priceEffect: 0.7 },
        { label: 'Tasker supplies', value: 'tasker', priceEffect: 1.2 },
      ] },
    ],
  },
  {
    slug: 'ac-and-refrigeration',
    name: 'AC and Refrigeration',
    description: 'AC installation, servicing, gas refill, repairs and refrigeration.',
    questions: [
      { key: 'service', label: 'Which AC service do you need?', type: 'single', required: true, options: [
        { label: 'AC installation', value: 'install', priceEffect: 1.8 },
        { label: 'AC service / cleaning', value: 'service', priceEffect: 0.7 },
        { label: 'Gas refill', value: 'gas', priceEffect: 0.9 },
        { label: 'AC repair (not cooling)', value: 'repair', priceEffect: 1.2 },
        { label: 'Fridge / freezer repair', value: 'fridge', priceEffect: 1.1 },
        { label: 'Other', value: 'other', priceEffect: 1 },
      ] },
      { key: 'units', label: 'How many units?', type: 'single', options: [
        { label: '1 unit', value: '1', priceEffect: 1 },
        { label: '2 units', value: '2', priceEffect: 1.6 },
        { label: '3+ units', value: '3', priceEffect: 2.2 },
      ] },
      { key: 'type', label: 'Unit type?', type: 'single', options: [
        { label: 'Split AC', value: 'split', priceEffect: 1 },
        { label: 'Window AC', value: 'window', priceEffect: 0.8 },
        { label: 'Not sure', value: 'unknown', priceEffect: 1 },
      ] },
    ],
  },
  {
    slug: 'painting-and-decorating',
    name: 'Painting and Decorating',
    description: 'Interior, exterior, ceiling and decorative painting.',
    questions: [
      { key: 'scope', label: 'Painting scope?', type: 'single', required: true, options: [
        { label: 'One wall / room', value: 'room', priceEffect: 0.4 },
        { label: 'Interior house', value: 'interior', priceEffect: 1.3 },
        { label: 'Ceiling painting', value: 'ceiling', priceEffect: 0.6 },
        { label: 'Exterior house', value: 'exterior', priceEffect: 2 },
        { label: 'Touch-up / small', value: 'touchup', priceEffect: 0.2 },
      ] },
      { key: 'rooms', label: 'Approx. rooms / area?', type: 'single', options: [
        { label: '1–2 rooms', value: 'small', priceEffect: 0.5 },
        { label: '3–4 rooms', value: 'medium', priceEffect: 1 },
        { label: '5+ rooms / large', value: 'large', priceEffect: 1.6 },
      ] },
      { key: 'materials', label: 'Who supplies paint?', type: 'single', options: [
        { label: 'I will supply paint', value: 'customer', priceEffect: 0.6 },
        { label: 'Tasker supplies', value: 'tasker', priceEffect: 1.3 },
      ] },
    ],
  },
  {
    slug: 'carpentry-and-furniture',
    name: 'Carpentry and Furniture',
    description: 'Shelves, cabinets, doors, furniture assembly and woodwork.',
    questions: [
      { key: 'service', label: 'What carpentry do you need?', type: 'single', required: true, options: [
        { label: 'Shelving / storage', value: 'shelf', priceEffect: 1 },
        { label: 'Cabinet repair / build', value: 'cabinet', priceEffect: 1.3 },
        { label: 'Door repair / install', value: 'door', priceEffect: 0.9 },
        { label: 'Furniture assembly', value: 'assembly', priceEffect: 0.6 },
        { label: 'Built-in / custom', value: 'custom', priceEffect: 2 },
      ] },
      { key: 'size', label: 'Project size?', type: 'single', options: [
        { label: 'Small / single item', value: 'small', priceEffect: 0.5 },
        { label: 'Medium', value: 'medium', priceEffect: 1 },
        { label: 'Large / multiple', value: 'large', priceEffect: 1.7 },
      ] },
      { key: 'material', label: 'Wood / material provided?', type: 'single', options: [
        { label: 'I supply material', value: 'customer', priceEffect: 0.7 },
        { label: 'Tasker supplies', value: 'tasker', priceEffect: 1.2 },
      ] },
    ],
  },
  {
    slug: 'tiling-and-flooring',
    name: 'Tiling and Flooring',
    description: 'Floor and wall tile installation, repair and flooring.',
    questions: [
      { key: 'scope', label: 'What tiling work?', type: 'single', required: true, options: [
        { label: 'Floor tile install', value: 'floor', priceEffect: 1.4 },
        { label: 'Wall tile install', value: 'wall', priceEffect: 1.1 },
        { label: 'Tile repair', value: 'repair', priceEffect: 0.6 },
        { label: 'Flooring install', value: 'flooring', priceEffect: 1.6 },
      ] },
      { key: 'area', label: 'Approx. area (sq ft)?', type: 'single', options: [
        { label: 'Under 100 sq ft', value: 's', priceEffect: 0.4 },
        { label: '100–300 sq ft', value: 'm', priceEffect: 1 },
        { label: '300+ sq ft', value: 'l', priceEffect: 2 },
      ] },
      { key: 'materials', label: 'Who supplies tiles?', type: 'single', options: [
        { label: 'I supply', value: 'customer', priceEffect: 0.7 },
        { label: 'Tasker supplies', value: 'tasker', priceEffect: 1.2 },
      ] },
    ],
  },
  {
    slug: 'masonry-and-concrete',
    name: 'Masonry and Concrete',
    description: 'Brickwork, plastering, concrete repair and masonry.',
    questions: [
      { key: 'work', label: 'What masonry work?', type: 'single', required: true, options: [
        { label: 'Brick / block work', value: 'brick', priceEffect: 1.3 },
        { label: 'Plastering', value: 'plaster', priceEffect: 0.9 },
        { label: 'Concrete repair', value: 'concrete', priceEffect: 1 },
        { label: 'Small fix / patch', value: 'patch', priceEffect: 0.4 },
      ] },
      { key: 'area', label: 'Approx. size?', type: 'single', options: [
        { label: 'Small', value: 's', priceEffect: 0.4 },
        { label: 'Medium', value: 'm', priceEffect: 1 },
        { label: 'Large', value: 'l', priceEffect: 1.8 },
      ] },
    ],
  },
  {
    slug: 'roofing-and-gutters',
    name: 'Roofing and Gutters',
    description: 'Roof repair, leak fixing, gutter cleaning and roofing install.',
    questions: [
      { key: 'service', label: 'What roofing service?', type: 'single', required: true, options: [
        { label: 'Roof leak repair', value: 'leak', priceEffect: 1.2 },
        { label: 'Gutter cleaning', value: 'gutter', priceEffect: 0.6 },
        { label: 'Roof repair / replace', value: 'roof', priceEffect: 2 },
        { label: 'Gutter install', value: 'gutterinstall', priceEffect: 1.3 },
      ] },
      { key: 'story', label: 'Building height?', type: 'single', options: [
        { label: 'Single storey', value: '1', priceEffect: 1 },
        { label: 'Two storey', value: '2', priceEffect: 1.5 },
        { label: '3+ storey', value: '3', priceEffect: 2 },
      ] },
    ],
  },
  {
    slug: 'pest-control',
    name: 'Pest Control',
    description: 'Pest, insect, rodent and termite treatment.',
    questions: [
      { key: 'pest', label: 'What pest?', type: 'single', required: true, options: [
        { label: 'Roaches / insects', value: 'insect', priceEffect: 0.8 },
        { label: 'Rats / mice', value: 'rodent', priceEffect: 1 },
        { label: 'Termites', value: 'termite', priceEffect: 1.5 },
        { label: 'Bed bugs', value: 'bedbug', priceEffect: 1.3 },
        { label: 'Other', value: 'other', priceEffect: 1 },
      ] },
      { key: 'area', label: 'Area to treat?', type: 'single', options: [
        { label: 'One room', value: 'one', priceEffect: 0.4 },
        { label: 'Whole house', value: 'house', priceEffect: 1.2 },
        { label: 'Office / larger', value: 'large', priceEffect: 1.8 },
      ] },
      { key: 'infestation', label: 'How severe?', type: 'single', options: [
        { label: 'Light', value: 'light', priceEffect: 0.7 },
        { label: 'Moderate', value: 'moderate', priceEffect: 1 },
        { label: 'Severe', value: 'severe', priceEffect: 1.4 },
      ] },
    ],
  },
  {
    slug: 'cleaning-services',
    name: 'Cleaning Services',
    description: 'Home, deep, office and move-in/out cleaning.',
    questions: [
      { key: 'service', label: 'What cleaning?', type: 'single', required: true, options: [
        { label: 'Regular home clean', value: 'home', priceEffect: 0.7 },
        { label: 'Deep cleaning', value: 'deep', priceEffect: 1.3 },
        { label: 'Office cleaning', value: 'office', priceEffect: 1 },
        { label: 'Move-in / out', value: 'move', priceEffect: 1.5 },
        { label: 'Sofa / carpet', value: 'soft', priceEffect: 1 },
      ] },
      { key: 'hours', label: 'Approx. hours?', type: 'single', options: [
        { label: '2 hours', value: '2', priceEffect: 0.5 },
        { label: '4 hours', value: '4', priceEffect: 1 },
        { label: '6+ hours / full day', value: '8', priceEffect: 2 },
      ] },
      { key: 'workers', label: 'How many cleaners?', type: 'single', options: [
        { label: '1', value: '1', priceEffect: 1 },
        { label: '2', value: '2', priceEffect: 1.8 },
        { label: '3+', value: '3', priceEffect: 2.5 },
      ] },
    ],
  },
  {
    slug: 'gardening-and-landscaping',
    name: 'Gardening and Landscaping',
    description: 'Lawn care, tree trimming, landscaping and garden maintenance.',
    questions: [
      { key: 'service', label: 'What garden work?', type: 'single', required: true, options: [
        { label: 'Lawn mowing / care', value: 'lawn', priceEffect: 0.6 },
        { label: 'Tree / hedge trimming', value: 'trim', priceEffect: 1 },
        { label: 'Landscaping design', value: 'landscape', priceEffect: 2 },
        { label: 'Garden maintenance', value: 'maintain', priceEffect: 0.8 },
        { label: 'Planting', value: 'plant', priceEffect: 0.6 },
      ] },
      { key: 'size', label: 'Garden size?', type: 'single', options: [
        { label: 'Small', value: 's', priceEffect: 0.4 },
        { label: 'Medium', value: 'm', priceEffect: 1 },
        { label: 'Large', value: 'l', priceEffect: 1.8 },
      ] },
    ],
  },
  {
    slug: 'home-security-and-automation',
    name: 'Home Security and Automation',
    description: 'CCTV, smart locks, alarms and home automation setups.',
    questions: [
      { key: 'service', label: 'What security work?', type: 'single', required: true, options: [
        { label: 'CCTV installation', value: 'cctv', priceEffect: 1.5 },
        { label: 'Smart lock install', value: 'lock', priceEffect: 0.8 },
        { label: 'Alarm system', value: 'alarm', priceEffect: 1.1 },
        { label: 'Camera repair', value: 'repair', priceEffect: 0.7 },
      ] },
      { key: 'count', label: 'How many devices / points?', type: 'single', options: [
        { label: '1–2', value: '1', priceEffect: 0.5 },
        { label: '3–4', value: '2', priceEffect: 1 },
        { label: '5+', value: '3', priceEffect: 1.8 },
      ] },
    ],
  },
  {
    slug: 'moving-and-packing',
    name: 'Moving and Packing',
    description: 'House/office moving, packing and heavy lifting.',
    questions: [
      { key: 'service', label: 'What moving need?', type: 'single', required: true, options: [
        { label: 'House moving', value: 'house', priceEffect: 1.5 },
        { label: 'Office moving', value: 'office', priceEffect: 2 },
        { label: 'Packing only', value: 'pack', priceEffect: 0.8 },
        { label: 'Heavy lifting', value: 'lift', priceEffect: 0.7 },
        { label: 'One item', value: 'item', priceEffect: 0.5 },
      ] },
      { key: 'size', label: 'Load size?', type: 'single', options: [
        { label: 'Small / few items', value: 's', priceEffect: 0.5 },
        { label: 'Studio / 1 bed', value: 'm', priceEffect: 1 },
        { label: '2+ bed / large', value: 'l', priceEffect: 1.8 },
      ] },
      { key: 'truck', label: 'Transport needed?', type: 'single', options: [
        { label: 'Tasker provides lorry', value: 'yes', priceEffect: 1.4 },
        { label: 'I have transport', value: 'no', priceEffect: 0.7 },
      ] },
    ],
  },
  {
    slug: 'vehicle-care-and-maintenance',
    name: 'Vehicle Care and Maintenance',
    description: 'Mobile mechanic, car wash, battery and tyre services.',
    questions: [
      { key: 'service', label: 'What vehicle service?', type: 'single', required: true, options: [
        { label: 'Mobile mechanic', value: 'mechanic', priceEffect: 1.3 },
        { label: 'Car wash / detailing', value: 'wash', priceEffect: 0.5 },
        { label: 'Battery change', value: 'battery', priceEffect: 0.7 },
        { label: 'Tyre change', value: 'tyre', priceEffect: 0.6 },
        { label: 'Car AC service', value: 'ac', priceEffect: 1 },
      ] },
      { key: 'vehicle', label: 'Vehicle type?', type: 'single', options: [
        { label: 'Car', value: 'car', priceEffect: 1 },
        { label: 'Van / SUV', value: 'suv', priceEffect: 1.2 },
        { label: 'Motorcycle', value: 'bike', priceEffect: 0.6 },
        { label: 'Other', value: 'other', priceEffect: 1 },
      ] },
    ],
  },
  {
    slug: 'it-and-electronics-repair',
    name: 'IT and Electronics Repair',
    description: 'Computer repair, WiFi setup, device and electronics repair.',
    questions: [
      { key: 'service', label: 'What IT / electronics need?', type: 'single', required: true, options: [
        { label: 'Computer / laptop repair', value: 'computer', priceEffect: 1 },
        { label: 'WiFi / network setup', value: 'wifi', priceEffect: 0.7 },
        { label: 'App / dev work', value: 'dev', priceEffect: 2 },
        { label: 'Printer / device fix', value: 'device', priceEffect: 0.7 },
      ] },
      { key: 'remote', label: 'Can it be done remotely?', type: 'single', options: [
        { label: 'Remote ok', value: 'remote', priceEffect: 0.4 },
        { label: 'On-site required', value: 'onsite', priceEffect: 1.2 },
      ] },
    ],
  },
  {
    slug: 'event-and-party-services',
    name: 'Event and Party Services',
    description: 'Event setup, decoration, catering help and party services.',
    questions: [
      { key: 'service', label: 'What event help?', type: 'single', required: true, options: [
        { label: 'Event setup / teardown', value: 'setup', priceEffect: 1 },
        { label: 'Decoration', value: 'decor', priceEffect: 1.2 },
        { label: 'Catering help', value: 'catering', priceEffect: 1 },
        { label: 'Photography / media', value: 'media', priceEffect: 1.5 },
      ] },
      { key: 'guests', label: 'Approx. guests?', type: 'single', options: [
        { label: 'Under 20', value: 's', priceEffect: 0.5 },
        { label: '20–50', value: 'm', priceEffect: 1 },
        { label: '50+', value: 'l', priceEffect: 1.8 },
      ] },
      { key: 'hours', label: 'How many hours?', type: 'single', options: [
        { label: '2–3 hours', value: '2', priceEffect: 0.6 },
        { label: '4–6 hours', value: '5', priceEffect: 1 },
        { label: 'Full day', value: 'full', priceEffect: 1.6 },
      ] },
    ],
  },
  {
    slug: 'personal-care-and-wellness',
    name: 'Personal Care and Wellness',
    description: 'Massage, home salon, wellness and personal services.',
    questions: [
      { key: 'service', label: 'What personal service?', type: 'single', required: true, options: [
        { label: 'Massage therapy', value: 'massage', priceEffect: 1 },
        { label: 'Home salon / beauty', value: 'salon', priceEffect: 1.1 },
        { label: 'Wellness session', value: 'wellness', priceEffect: 1 },
        { label: 'Other', value: 'other', priceEffect: 1 },
      ] },
      { key: 'hours', label: 'Duration?', type: 'single', options: [
        { label: '30 min', value: '30', priceEffect: 0.5 },
        { label: '1 hour', value: '60', priceEffect: 1 },
        { label: '2 hours', value: '120', priceEffect: 1.8 },
      ] },
    ],
  },
  {
    slug: 'home-renovation-and-interiors',
    name: 'Home Renovation and Interiors',
    description: 'Renovation, partition walls, interiors and home improvement.',
    questions: [
      { key: 'service', label: 'What renovation work?', type: 'single', required: true, options: [
        { label: 'Full room renovation', value: 'full', priceEffect: 2 },
        { label: 'Partition / walls', value: 'partition', priceEffect: 1.3 },
        { label: 'Storage / closet build', value: 'storage', priceEffect: 1.2 },
        { label: 'Interior design consult', value: 'design', priceEffect: 0.8 },
      ] },
      { key: 'area', label: 'Approx. size?', type: 'single', options: [
        { label: 'Small', value: 's', priceEffect: 0.5 },
        { label: 'Medium', value: 'm', priceEffect: 1 },
        { label: 'Large', value: 'l', priceEffect: 1.8 },
      ] },
    ],
  },
  {
    slug: 'solar-and-energy-solutions',
    name: 'Solar and Energy Solutions',
    description: 'Solar installation, inverters, energy audits and storage.',
    questions: [
      { key: 'service', label: 'What energy solution?', type: 'single', required: true, options: [
        { label: 'Solar panel install', value: 'solar', priceEffect: 2.5 },
        { label: 'Solar water heater', value: 'heater', priceEffect: 1.8 },
        { label: 'Inverter backup', value: 'inverter', priceEffect: 1.2 },
        { label: 'Battery storage', value: 'battery', priceEffect: 1.8 },
        { label: 'Energy audit', value: 'audit', priceEffect: 1 },
        { label: 'Solar maintenance', value: 'maintain', priceEffect: 0.6 },
      ] },
      { key: 'system', label: 'System size?', type: 'single', options: [
        { label: 'Small / 1–2kW', value: 's', priceEffect: 0.6 },
        { label: 'Medium / 3–5kW', value: 'm', priceEffect: 1.2 },
        { label: 'Large / 5kW+', value: 'l', priceEffect: 2 },
      ] },
    ],
  },
]

async function main() {
  console.log('Seeding smart service templates...')
  let total = 0
  for (const t of TEMPLATES) {
    const cat = await prisma.jobCategory.findFirst({ where: { slug: t.slug } })
    if (!cat) {
      console.warn(`  Skipping unknown category slug: ${t.slug}`)
      continue
    }
    const popular = await prisma.templateJob.findFirst({
      where: { categoryId: cat.id, isPopular: true, isActive: true },
      orderBy: { priceMin: 'asc' },
    })
    const fallback = await prisma.templateJob.findFirst({
      where: { categoryId: cat.id, isActive: true },
      orderBy: { priceMin: 'asc' },
    })
    const ref = popular || fallback
    const jobId = ref?.id ?? null
    await prisma.serviceTemplate.upsert({
      where: { slug: t.slug },
      update: {
        name: t.name,
        description: t.description,
        questionsJson: JSON.stringify({ questions: t.questions }),
        templateJobId: jobId,
        defaultDurationMinutes: ref?.typicalDurationMinutes ?? 60,
        priceMin: ref?.priceMin ?? 0,
        priceMax: ref?.priceMax ?? 0,
        isActive: true,
        sortOrder: cat.sortOrder,
      },
      create: {
        jobCategoryId: cat.id,
        templateJobId: jobId,
        name: t.name,
        slug: t.slug,
        description: t.description,
        questionsJson: JSON.stringify({ questions: t.questions }),
        defaultDurationMinutes: ref?.typicalDurationMinutes ?? 60,
        priceMin: ref?.priceMin ?? 0,
        priceMax: ref?.priceMax ?? 0,
        isActive: true,
        sortOrder: cat.sortOrder,
      },
    })
    total++
    console.log(`  ${t.slug}: template ready (ref job: ${ref?.name ?? 'none'})`)
  }
  console.log(`\n✅ Total: ${total} smart service templates`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())

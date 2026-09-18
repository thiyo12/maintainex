import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

interface TaskerSeed {
  name: string
  email: string
  phone: string
  password: string
  bio: string
  hourlyRate: number
  rating: number
  completedJobs: number
  categorySlug: string
  latitude: number
  longitude: number
  isOnline: boolean
}

const TASKERS: TaskerSeed[] = [
  { name: 'Priya Jayawardena', email: 'priya@test.com', phone: '0771000001', password: 'test123', bio: 'Licensed electrician with 8 years of experience in residential and commercial wiring.', hourlyRate: 2500, rating: 4.8, completedJobs: 142, categorySlug: 'Electrical Works', latitude: 6.9271, longitude: 79.8612, isOnline: true },
  { name: 'Ranil Fernando', email: 'ranil@test.com', phone: '0771000002', password: 'test123', bio: 'Expert plumber specializing in pipe repairs, installations, and bathroom renovations.', hourlyRate: 2200, rating: 4.6, completedJobs: 98, categorySlug: 'Plumbing', latitude: 6.9345, longitude: 79.8520, isOnline: true },
  { name: 'Saman Perera', email: 'saman@test.com', phone: '0771000003', password: 'test123', bio: 'AC technician with 10+ years experience. Repairs, servicing, and new installations.', hourlyRate: 3000, rating: 4.9, completedJobs: 215, categorySlug: 'AC and Refrigeration', latitude: 6.9100, longitude: 79.8800, isOnline: true },
  { name: 'Nimali Silva', email: 'nimali@test.com', phone: '0771000004', password: 'test123', bio: 'Professional painter and decorator. Interior and exterior painting with premium finish.', hourlyRate: 1800, rating: 4.7, completedJobs: 76, categorySlug: 'Painting and Decorating', latitude: 6.9200, longitude: 79.8700, isOnline: true },
  { name: 'Kumara Wickramasinghe', email: 'kumara@test.com', phone: '0771000005', password: 'test123', bio: 'Master carpenter specializing in custom furniture, cabinets, and woodwork repairs.', hourlyRate: 2800, rating: 4.9, completedJobs: 189, categorySlug: 'Carpentry and Furniture', latitude: 6.9400, longitude: 79.8400, isOnline: true },
  { name: 'Dinesh Rathnayake', email: 'dinesh@test.com', phone: '0771000006', password: 'test123', bio: 'Tiling and flooring specialist. Ceramic, porcelain, and vinyl flooring installation.', hourlyRate: 2000, rating: 4.5, completedJobs: 64, categorySlug: 'Tiling and Flooring', latitude: 6.9150, longitude: 79.8650, isOnline: false },
  { name: 'Chaminda Bandara', email: 'chaminda@test.com', phone: '0771000007', password: 'test123', bio: 'Masonry and concrete expert. Foundations, blockwork, plastering, and renovations.', hourlyRate: 2600, rating: 4.7, completedJobs: 112, categorySlug: 'Masonry and Concrete', latitude: 6.9280, longitude: 79.8750, isOnline: true },
  { name: 'Upul Jayasinghe', email: 'upul@test.com', phone: '0771000008', password: 'test123', bio: 'Roofing specialist with 12 years of experience. Repairs, replacement, and gutter cleaning.', hourlyRate: 3200, rating: 4.8, completedJobs: 156, categorySlug: 'Roofing and Gutters', latitude: 6.9350, longitude: 79.8550, isOnline: false },
  { name: 'Sujeewa Kumari', email: 'sujeewa@test.com', phone: '0771000009', password: 'test123', bio: 'Licensed pest control technician. Safe and effective treatment for all pest types.', hourlyRate: 3500, rating: 4.6, completedJobs: 88, categorySlug: 'Pest Control', latitude: 6.9220, longitude: 79.8680, isOnline: true },
  { name: 'Lakshmi Nandana', email: 'lakshmi@test.com', phone: '0771000010', password: 'test123', bio: 'Deep cleaning expert for homes and offices. Eco-friendly products used.', hourlyRate: 1500, rating: 4.4, completedJobs: 203, categorySlug: 'Cleaning Services', latitude: 6.9300, longitude: 79.8620, isOnline: true },
  { name: 'Nuwan Rodrigo', email: 'nuwan@test.com', phone: '0771000011', password: 'test123', bio: 'Gardening and landscaping professional. Design, planting, pruning, and lawn care.', hourlyRate: 1900, rating: 4.7, completedJobs: 134, categorySlug: 'Gardening and Landscaping', latitude: 6.9250, longitude: 79.8580, isOnline: true },
  { name: 'Rohan Weerasinghe', email: 'rohan@test.com', phone: '0771000012', password: 'test123', bio: 'Home security and automation expert. CCTV, smart locks, alarm systems installation.', hourlyRate: 4000, rating: 4.9, completedJobs: 97, categorySlug: 'Home Security and Automation', latitude: 6.9380, longitude: 79.8500, isOnline: true },
  { name: 'Thilini Jayakody', email: 'thilini@test.com', phone: '0771000013', password: 'test123', bio: 'Professional moving and packing services. Careful handling guaranteed.', hourlyRate: 1600, rating: 4.5, completedJobs: 178, categorySlug: 'Moving and Packing', latitude: 7.2906, longitude: 80.6337, isOnline: false },
  { name: 'Asela Pradeep', email: 'asela@test.com', phone: '0771000014', password: 'test123', bio: 'IT and electronics repair specialist. Laptops, phones, gaming consoles, and more.', hourlyRate: 2200, rating: 4.8, completedJobs: 243, categorySlug: 'IT and Electronics Repair', latitude: 6.9320, longitude: 79.8600, isOnline: true },
  { name: 'Dilani Gamage', email: 'dilani@test.com', phone: '0771000015', password: 'test123', bio: 'Event planner and party services provider. Decorations, catering setup, and coordination.', hourlyRate: 2800, rating: 4.6, completedJobs: 67, categorySlug: 'Event and Party Services', latitude: 6.9260, longitude: 79.8640, isOnline: true },
]

async function main() {
  console.log('Seeding development taskers and complete service coverage...')

  if (process.env.NODE_ENV === 'production') {
    throw new Error('seed-taskers.ts is test data and must not run in production')
  }

  const categories = await prisma.jobCategory.findMany()
  const catByName = new Map(categories.map((category) => [category.name, category]))
  const allTemplates = await prisma.templateJob.findMany({ where: { isActive: true } })
  const profilesByCategory = new Map<string, Array<{ id: string; hourlyRate: number }>>()
  const seededProfiles: Array<{ id: string; hourlyRate: number }> = []
  const passwordHash = await bcrypt.hash('test123', 12)
  const seededLogins: TaskerSeed[] = []

  for (const tasker of TASKERS) {
    const category = catByName.get(tasker.categorySlug)
    if (!category) {
      console.log(`  SKIP ${tasker.email} — category "${tasker.categorySlug}" not found`)
      continue
    }

    const user = await prisma.user.upsert({
      where: { email: tasker.email },
      update: {
        name: tasker.name,
        phone: tasker.phone,
        role: 'TASKER',
        isActive: true,
        identityStatus: 'APPROVED',
        emailVerified: true,
      },
      create: {
        email: tasker.email,
        passwordHash,
        name: tasker.name,
        phone: tasker.phone,
        role: 'TASKER',
        identityStatus: 'APPROVED',
        emailVerified: true,
      },
    })

    const profile = await prisma.taskerProfile.upsert({
      where: { userId: user.id },
      update: {
        bio: tasker.bio,
        hourlyRate: tasker.hourlyRate,
        rating: tasker.rating,
        completedJobs: tasker.completedJobs,
        isVerified: true,
        verificationStatus: 'VERIFIED',
        isOnline: tasker.isOnline,
        skills: JSON.stringify([category.name]),
        serviceAreas: JSON.stringify(['Colombo', 'Gampaha']),
        latitude: tasker.latitude,
        longitude: tasker.longitude,
        locationUpdatedAt: new Date(),
      },
      create: {
        userId: user.id,
        bio: tasker.bio,
        hourlyRate: tasker.hourlyRate,
        rating: tasker.rating,
        completedJobs: tasker.completedJobs,
        isVerified: true,
        verificationStatus: 'VERIFIED',
        isOnline: tasker.isOnline,
        skills: JSON.stringify([category.name]),
        serviceAreas: JSON.stringify(['Colombo', 'Gampaha']),
        latitude: tasker.latitude,
        longitude: tasker.longitude,
        locationUpdatedAt: new Date(),
      },
    })

    const ref = { id: profile.id, hourlyRate: tasker.hourlyRate }
    seededProfiles.push(ref)
    profilesByCategory.set(category.id, [...(profilesByCategory.get(category.id) || []), ref])
    seededLogins.push(tasker)
    console.log(`  ✓ ${tasker.name} (${tasker.email}) — ${tasker.categorySlug}`)
  }

  if (seededProfiles.length === 0) throw new Error('No development tasker profiles were available')

  let coverageRows = 0
  for (let jobIndex = 0; jobIndex < allTemplates.length; jobIndex++) {
    const job = allTemplates[jobIndex]
    const categoryPool = profilesByCategory.get(job.categoryId) || []
    const pool = categoryPool.length > 0 ? categoryPool : seededProfiles
    const targetCount = Math.min(3, pool.length)

    for (let index = 0; index < targetCount; index++) {
      const tasker = pool[(jobIndex + index) % pool.length]
      const fixedRate = Math.max(job.priceMin, tasker.hourlyRate * job.typicalDurationMinutes / 60)
      await prisma.taskerSkill.upsert({
        where: { taskerId_jobId: { taskerId: tasker.id, jobId: job.id } },
        update: {
          experienceYears: 3 + ((jobIndex + index) % 8),
          experienceLevel: index === 0 ? 3 : 2,
          hourlyRate: tasker.hourlyRate,
          fixedRate: Math.round(fixedRate),
          currency: job.currency || 'LKR',
          countryCode: 'LK',
        },
        create: {
          taskerId: tasker.id,
          jobId: job.id,
          experienceYears: 3 + ((jobIndex + index) % 8),
          experienceLevel: index === 0 ? 3 : 2,
          hourlyRate: tasker.hourlyRate,
          fixedRate: Math.round(fixedRate),
          currency: job.currency || 'LKR',
          countryCode: 'LK',
        },
      })
      coverageRows++
    }
  }

  const coverageLinks = await prisma.taskerSkill.findMany({
    where: { jobId: { in: allTemplates.map((job) => job.id) } },
    select: { jobId: true, taskerId: true },
  })
  const uniqueTaskersByJob = new Map<string, Set<string>>()
  for (const link of coverageLinks) {
    const set = uniqueTaskersByJob.get(link.jobId) || new Set<string>()
    set.add(link.taskerId)
    uniqueTaskersByJob.set(link.jobId, set)
  }

  const underCovered = allTemplates.filter((job) => (uniqueTaskersByJob.get(job.id)?.size || 0) < 3)
  if (underCovered.length > 0) {
    const details = underCovered
      .map((job) => `${job.name || job.title || job.id}: ${uniqueTaskersByJob.get(job.id)?.size || 0}/3`)
      .join(', ')
    throw new Error(`Test tasker coverage incomplete — ${details}`)
  }

  console.log(`\n✅ Test coverage ready: ${allTemplates.length} active jobs, every job has at least 3 sample taskers (${coverageRows} seeded matches refreshed)`)
  console.log('\nTasker login credentials (password: test123):')
  for (const tasker of seededLogins) console.log(`  ${tasker.email} — ${tasker.name} (${tasker.categorySlug})`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())

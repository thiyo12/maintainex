import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

interface TaskerSeed {
  name: string
  email: string
  phone: string
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
  { name: 'Demo Tasker 01', email: 'tasker01@example.invalid', phone: '0000000001', bio: 'Licensed electrician with 8 years of experience in residential and commercial wiring.', hourlyRate: 2500, rating: 4.8, completedJobs: 142, categorySlug: 'Electrical Works', latitude: 6.9271, longitude: 79.8612, isOnline: true },
  { name: 'Demo Tasker 02', email: 'tasker02@example.invalid', phone: '0000000002', bio: 'Expert plumber specializing in pipe repairs, installations, and bathroom renovations.', hourlyRate: 2200, rating: 4.6, completedJobs: 98, categorySlug: 'Plumbing', latitude: 6.9345, longitude: 79.8520, isOnline: true },
  { name: 'Demo Tasker 03', email: 'tasker03@example.invalid', phone: '0000000003', bio: 'AC technician with 10+ years experience. Repairs, servicing, and new installations.', hourlyRate: 3000, rating: 4.9, completedJobs: 215, categorySlug: 'AC and Refrigeration', latitude: 6.9100, longitude: 79.8800, isOnline: true },
  { name: 'Demo Tasker 04', email: 'tasker04@example.invalid', phone: '0000000004', bio: 'Professional painter and decorator. Interior and exterior painting with premium finish.', hourlyRate: 1800, rating: 4.7, completedJobs: 76, categorySlug: 'Painting and Decorating', latitude: 6.9200, longitude: 79.8700, isOnline: true },
  { name: 'Demo Tasker 05', email: 'tasker05@example.invalid', phone: '0000000005', bio: 'Master carpenter specializing in custom furniture, cabinets, and woodwork repairs.', hourlyRate: 2800, rating: 4.9, completedJobs: 189, categorySlug: 'Carpentry and Furniture', latitude: 6.9400, longitude: 79.8400, isOnline: true },
  { name: 'Demo Tasker 06', email: 'tasker06@example.invalid', phone: '0000000006', bio: 'Tiling and flooring specialist. Ceramic, porcelain, and vinyl flooring installation.', hourlyRate: 2000, rating: 4.5, completedJobs: 64, categorySlug: 'Tiling and Flooring', latitude: 6.9150, longitude: 79.8650, isOnline: false },
  { name: 'Demo Tasker 07', email: 'tasker07@example.invalid', phone: '0000000007', bio: 'Masonry and concrete expert. Foundations, blockwork, plastering, and renovations.', hourlyRate: 2600, rating: 4.7, completedJobs: 112, categorySlug: 'Masonry and Concrete', latitude: 6.9280, longitude: 79.8750, isOnline: true },
  { name: 'Demo Tasker 08', email: 'tasker08@example.invalid', phone: '0000000008', bio: 'Roofing specialist with 12 years of experience. Repairs, replacement, and gutter cleaning.', hourlyRate: 3200, rating: 4.8, completedJobs: 156, categorySlug: 'Roofing and Gutters', latitude: 6.9350, longitude: 79.8550, isOnline: false },
  { name: 'Demo Tasker 09', email: 'tasker09@example.invalid', phone: '0000000009', bio: 'Licensed pest control technician. Safe and effective treatment for all pest types.', hourlyRate: 3500, rating: 4.6, completedJobs: 88, categorySlug: 'Pest Control', latitude: 6.9220, longitude: 79.8680, isOnline: true },
  { name: 'Demo Tasker 10', email: 'tasker10@example.invalid', phone: '0000000010', bio: 'Deep cleaning expert for homes and offices. Eco-friendly products used.', hourlyRate: 1500, rating: 4.4, completedJobs: 203, categorySlug: 'Cleaning Services', latitude: 6.9300, longitude: 79.8620, isOnline: true },
  { name: 'Demo Tasker 11', email: 'tasker11@example.invalid', phone: '0000000011', bio: 'Gardening and landscaping professional. Design, planting, pruning, and lawn care.', hourlyRate: 1900, rating: 4.7, completedJobs: 134, categorySlug: 'Gardening and Landscaping', latitude: 6.9250, longitude: 79.8580, isOnline: true },
  { name: 'Demo Tasker 12', email: 'tasker12@example.invalid', phone: '0000000012', bio: 'Home security and automation expert. CCTV, smart locks, alarm systems installation.', hourlyRate: 4000, rating: 4.9, completedJobs: 97, categorySlug: 'Home Security and Automation', latitude: 6.9380, longitude: 79.8500, isOnline: true },
  { name: 'Demo Tasker 13', email: 'tasker13@example.invalid', phone: '0000000013', bio: 'Professional moving and packing services. Careful handling guaranteed.', hourlyRate: 1600, rating: 4.5, completedJobs: 178, categorySlug: 'Moving and Packing', latitude: 7.2906, longitude: 80.6337, isOnline: false },
  { name: 'Demo Tasker 14', email: 'tasker14@example.invalid', phone: '0000000014', bio: 'IT and electronics repair specialist. Laptops, phones, gaming consoles, and more.', hourlyRate: 2200, rating: 4.8, completedJobs: 243, categorySlug: 'IT and Electronics Repair', latitude: 6.9320, longitude: 79.8600, isOnline: true },
  { name: 'Demo Tasker 15', email: 'tasker15@example.invalid', phone: '0000000015', bio: 'Event planner and party services provider. Decorations, catering setup, and coordination.', hourlyRate: 2800, rating: 4.6, completedJobs: 67, categorySlug: 'Event and Party Services', latitude: 6.9260, longitude: 79.8640, isOnline: true },
]

async function main() {
  console.log('Seeding tasker profiles...')

  const demoPassword = process.env.SEED_TASKER_PASSWORD
  if (!demoPassword) {
    throw new Error('SEED_TASKER_PASSWORD is required when running this seed script')
  }

  const categories = await prisma.jobCategory.findMany()
  const catByName = new Map(categories.map(c => [c.name, c]))
  const allTemplates = await prisma.templateJob.findMany()

  let created = 0
  let skipped = 0

  for (const t of TASKERS) {
    const existingUser = await prisma.user.findUnique({ where: { email: t.email } })
    if (existingUser) {
      console.log(`  SKIP ${t.email} — already exists`)
      skipped++
      continue
    }

    const category = catByName.get(t.categorySlug)
    if (!category) {
      console.log(`  SKIP ${t.email} — category "${t.categorySlug}" not found`)
      skipped++
      continue
    }

    const passwordHash = await bcrypt.hash(demoPassword, 12)

    const user = await prisma.user.create({
      data: {
        email: t.email,
        passwordHash,
        name: t.name,
        phone: t.phone,
        role: 'TASKER',
      },
    })

    const profile = await prisma.taskerProfile.create({
      data: {
        userId: user.id,
        bio: t.bio,
        hourlyRate: t.hourlyRate,
        rating: t.rating,
        completedJobs: t.completedJobs,
        isVerified: true,
        isOnline: t.isOnline,
        skills: JSON.stringify([category.name]),
        serviceAreas: JSON.stringify(['Colombo', 'Gampaha']),
        latitude: t.latitude,
        longitude: t.longitude,
        locationUpdatedAt: new Date(),
      },
    })

    const categoryTemplates = allTemplates.filter(j => j.categoryId === category.id)

    for (let i = 0; i < Math.min(categoryTemplates.length, 4); i++) {
      const job = categoryTemplates[i]
      const priceMin = Math.max(job.priceMin, t.hourlyRate * job.typicalDurationMinutes / 60)
      await prisma.taskerSkill.create({
        data: {
          taskerId: profile.id,
          jobId: job.id,
          experienceYears: Math.floor(Math.random() * 10) + 2,
          hourlyRate: t.hourlyRate,
          fixedRate: Math.round(priceMin),
          currency: 'LKR',
        },
      })
    }

    created++
    console.log(`  ✓ ${t.name} (${t.email}) — ${t.categorySlug}, ${categoryTemplates.length} templates available`)
  }

  console.log(`\n✅ Done. Created: ${created}, Skipped: ${skipped}`)

  if (created > 0) {
    console.log('\nSeeded tasker accounts (password loaded from environment):')
    for (const t of TASKERS) {
      console.log(`  ${t.email} — ${t.name} (${t.categorySlug})`)
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())

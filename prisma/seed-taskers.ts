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
  console.log('Seeding tasker profiles...')

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

    const passwordHash = await bcrypt.hash(t.password, 12)

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
        skills: [category.name],
        serviceAreas: ['Colombo', 'Gampaha'],
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
    console.log('\n📋 Tasker login credentials:')
    for (const t of TASKERS) {
      console.log(`  ${t.email} / ${t.password}  — ${t.name} (${t.categorySlug})`)
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())

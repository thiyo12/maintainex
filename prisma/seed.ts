import { PrismaClient } from '@prisma/client'
import * as bcrypt from 'bcryptjs'
import { PROVINCES, DISTRICT_TO_PROVINCE } from '../lib/provinces'

const prisma = new PrismaClient()

function cuid(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
}

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000)
}

function getMonday(weeksBack: number): Date {
  const now = new Date()
  const day = now.getDay()
  const diff = now.getDate() - day + (day === 0 ? -6 : 1) - (weeksBack * 7)
  const monday = new Date(now)
  monday.setDate(diff)
  monday.setHours(0, 0, 0, 0)
  return monday
}

function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function randomFloat(min: number, max: number, decimals: number = 1): number {
  return parseFloat((Math.random() * (max - min) + min).toFixed(decimals))
}

const SRILANKAN_PROVINCES = [
  'Western Province',
  'Central Province',
  'Southern Province',
  'Northern Province',
  'Eastern Province',
  'North Western Province',
  'North Central Province',
  'Uva Province',
  'Sabaragamuwa Province',
]

const SRILANKAN_DISTRICTS = [
  'Colombo', 'Gampaha', 'Kalutara', 'Kandy', 'Matale', 'Nuwara Eliya',
  'Galle', 'Matara', 'Hambantota', 'Jaffna', 'Kilinochchi', 'Mannar',
  'Mullaitivu', 'Vavuniya', 'Trincomalee', 'Batticaloa', 'Ampara',
  'Kurunegala', 'Puttalam', 'Anuradhapura', 'Polonnaruwa',
  'Badulla', 'Monaragala', 'Ratnapura', 'Kegalle',
]

const CATEGORY_IDS = ['assembly', 'mounting', 'moving', 'cleaning', 'outdoor', 'repairs', 'trending']

const SKILL_POOLS = [
  ['furniture-assembly', 'desk-assembly', 'bookshelf-assembly'],
  ['tv-mounting', 'art-shelf-mounting', 'mirror-mounting', 'curtain-installation'],
  ['help-moving', 'heavy-lifting', 'furniture-removal', 'appliance-moving'],
  ['residential-cleaning', 'deep-cleaning', 'office-cleaning', 'sofa-cleaning', 'carpet-cleaning'],
  ['garden-maintenance', 'lawn-care', 'pool-cleaning', 'gutter-cleaning'],
  ['minor-plumbing', 'electrical-help', 'home-repairs', 'painting', 'door-window-repair'],
  ['full-house-deep-clean', 'post-party-cleaning', 'smart-home-setup', 'wall-art-installation'],
]

async function main() {
  console.log('Seeding database with TaskRabbit-style categories and services...')

  const categoriesData = [
    {
      id: 'assembly',
      name: 'Assembly',
      slug: 'assembly',
      icon: 'wrench',
      services: [
        { title: 'Furniture Assembly', slug: 'furniture-assembly', description: 'Professional assembly of all types of furniture including wardrobes, tables, and storage units', price: 3500, duration: 120, image: 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=600' },
        { title: 'Crib Assembly', slug: 'crib-assembly', description: 'Safe and secure assembly of baby cribs and nursery furniture', price: 2500, duration: 60, image: 'https://images.unsplash.com/photo-1590165482129-1b8b27698780?w=600' },
        { title: 'Desk Assembly', slug: 'desk-assembly', description: 'Office and home desk assembly with cable management', price: 2000, duration: 45, image: 'https://images.unsplash.com/photo-1518455027359-f3f8164ba6bd?w=600' },
        { title: 'Bookshelf Assembly', slug: 'bookshelf-assembly', description: 'Wall-mounted and freestanding bookshelf assembly', price: 2500, duration: 60, image: 'https://images.unsplash.com/photo-1507842217343-583bb7270b66?w=600' },
      ]
    },
    {
      id: 'mounting',
      name: 'Mounting',
      slug: 'mounting',
      icon: 'image',
      services: [
        { title: 'TV Mounting', slug: 'tv-mounting', description: 'Secure TV wall mounting with cable management and perfect alignment', price: 3000, duration: 60, image: 'https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?w=600' },
        { title: 'Art & Shelf Mounting', slug: 'art-shelf-mounting', description: 'Professional mounting of artwork, picture frames, and floating shelves', price: 1500, duration: 30, image: 'https://images.unsplash.com/photo-1513519245088-0e12902e35a6?w=600' },
        { title: 'Mirror Mounting', slug: 'mirror-mounting', description: 'Safe and secure mirror installation on any wall type', price: 1800, duration: 45, image: 'https://images.unsplash.com/photo-1618220179428-22790b461013?w=600' },
        { title: 'Curtain Installation', slug: 'curtain-installation', description: 'Curtain rod and blinds installation for all window types', price: 2000, duration: 45, image: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?w=600' },
      ]
    },
    {
      id: 'moving',
      name: 'Moving',
      slug: 'moving',
      icon: 'package',
      services: [
        { title: 'Help Moving', slug: 'help-moving', description: 'Professional moving assistance for homes and offices', price: 5000, duration: 180, image: 'https://images.unsplash.com/photo-1600518464441-9154a4dea21b?w=600' },
        { title: 'Heavy Lifting', slug: 'heavy-lifting', description: 'Safe heavy lifting and repositioning of large items', price: 2500, duration: 90, image: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600' },
        { title: 'Furniture Removal', slug: 'furniture-removal', description: 'Safe removal and disposal of old furniture', price: 3000, duration: 120, image: 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=600' },
        { title: 'Appliance Moving', slug: 'appliance-moving', description: 'Safe moving of washing machines, refrigerators, and other appliances', price: 2000, duration: 60, image: 'https://images.unsplash.com/photo-1584568694244-14fbdf83bd30?w=600' },
      ]
    },
    {
      id: 'cleaning',
      name: 'Cleaning',
      slug: 'cleaning',
      icon: 'sparkles',
      services: [
        { title: 'Residential Cleaning', slug: 'residential-cleaning', description: 'Complete home cleaning including all rooms, kitchen, and bathrooms', price: 3000, duration: 120, image: 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=600' },
        { title: 'Industrial Cleaning', slug: 'industrial-cleaning', description: 'Heavy-duty cleaning for factories, warehouses, and industrial facilities', price: 8000, duration: 240, image: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=600' },
        { title: 'Deep Cleaning', slug: 'deep-cleaning', description: 'Thorough deep cleaning for your entire home with sanitization', price: 5500, duration: 180, image: 'https://images.unsplash.com/photo-1628177142898-93e36e4e3a50?w=600' },
        { title: 'Office Cleaning', slug: 'office-cleaning', description: 'Regular office cleaning and maintenance for workspaces', price: 4500, duration: 150, image: 'https://images.unsplash.com/photo-1497366811353-6870744d04b2?w=600' },
        { title: 'Move-in/Move-out Cleaning', slug: 'move-in-out-cleaning', description: 'Comprehensive cleaning for property transitions', price: 6500, duration: 200, image: 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=600' },
        { title: 'Sofa Cleaning', slug: 'sofa-cleaning', description: 'Professional sofa and upholstery cleaning and stain removal', price: 3000, duration: 90, image: 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=600' },
        { title: 'Carpet Cleaning', slug: 'carpet-cleaning', description: 'Deep carpet cleaning with stain treatment and sanitization', price: 3500, duration: 120, image: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600' },
      ]
    },
    {
      id: 'outdoor',
      name: 'Outdoor',
      slug: 'outdoor',
      icon: 'tree',
      services: [
        { title: 'Garden Maintenance', slug: 'garden-maintenance', description: 'Regular garden upkeep including weeding, trimming, and planting', price: 2500, duration: 120, image: 'https://images.unsplash.com/photo-1558904541-efa843a96f01?w=600' },
        { title: 'Lawn Care', slug: 'lawn-care', description: 'Lawn mowing, edging, and fertilization services', price: 3000, duration: 90, image: 'https://images.unsplash.com/photo-1558904541-efa843a96f01?w=600' },
        { title: 'Pool Cleaning', slug: 'pool-cleaning', description: 'Swimming pool cleaning and water treatment', price: 4000, duration: 120, image: 'https://images.unsplash.com/photo-1576013551627-0cc20b96c2a7?w=600' },
        { title: 'Gutter Cleaning', slug: 'gutter-cleaning', description: 'Debris removal and cleaning of gutters and downspouts', price: 2000, duration: 60, image: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600' },
      ]
    },
    {
      id: 'repairs',
      name: 'Repairs',
      slug: 'repairs',
      icon: 'plug',
      services: [
        { title: 'Minor Plumbing', slug: 'minor-plumbing', description: 'Leak repairs, faucet replacement, and minor plumbing fixes', price: 2000, duration: 60, image: 'https://images.unsplash.com/photo-1585704032915-c3400ca199e7?w=600' },
        { title: 'Electrical Help', slug: 'electrical-help', description: 'Light fixture installation, outlet repairs, and electrical troubleshooting', price: 2500, duration: 60, image: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600' },
        { title: 'Home Repairs', slug: 'home-repairs', description: 'General home repairs including doors, windows, and fixtures', price: 3000, duration: 90, image: 'https://images.unsplash.com/photo-1558904541-efa843a96f01?w=600' },
        { title: 'Painting', slug: 'painting', description: 'Interior painting, touch-ups, and wall treatments', price: 4500, duration: 180, image: 'https://images.unsplash.com/photo-1562259949-e8e7689d7828?w=600' },
        { title: 'Door & Window Repair', slug: 'door-window-repair', description: 'Fix stuck doors, broken locks, and window issues', price: 2500, duration: 60, image: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600' },
      ]
    },
    {
      id: 'trending',
      name: 'Trending',
      slug: 'trending',
      icon: 'trending',
      services: [
        { title: 'Full House Deep Clean', slug: 'full-house-deep-clean', description: 'Complete deep cleaning of your entire home including all rooms', price: 8500, duration: 300, image: 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=600' },
        { title: 'Post-Party Cleaning', slug: 'post-party-cleaning', description: 'Quick and thorough cleaning after events and parties', price: 4500, duration: 120, image: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=600' },
        { title: 'Smart Home Setup', slug: 'smart-home-setup', description: 'Installation and setup of smart home devices', price: 3500, duration: 90, image: 'https://images.unsplash.com/photo-1558002038-1055907df827?w=600' },
        { title: 'Wall Art Installation', slug: 'wall-art-installation', description: 'Professional gallery wall and art installation services', price: 3000, duration: 90, image: 'https://images.unsplash.com/photo-1513519245088-0e12902e35a6?w=600' },
      ]
    }
  ]

  for (const categoryData of categoriesData) {
    await prisma.category.upsert({
      where: { id: categoryData.id },
      update: {},
      create: {
        id: categoryData.id,
        name: categoryData.name,
        slug: categoryData.slug,
        icon: categoryData.icon,
        isActive: true
      }
    })
    console.log(`Created Category: ${categoryData.name}`)

    for (const serviceData of categoryData.services) {
      await prisma.service.upsert({
        where: { id: serviceData.slug },
        update: {},
        create: {
          id: serviceData.slug,
          name: serviceData.title,
          slug: serviceData.slug,
          description: serviceData.description,
          price: serviceData.price,
          duration: serviceData.duration,
          image: serviceData.image,
          categoryId: categoryData.id,
          isActive: true,
          features: '[]'
        }
      })
    }
    console.log(`  → ${categoryData.services.length} services added`)
  }

  const branchesData = [
    {
      name: 'Western Province Branch',
      location: 'Colombo, Sri Lanka',
      phone: '0770867601',
      email: 'western@maintainex.com',
      address: 'Colombo, Sri Lanka',
      province: 'Western Province',
      districts: ['Colombo', 'Gampaha', 'Kalutara']
    },
    {
      name: 'Central Province Branch',
      location: 'Kandy, Sri Lanka',
      phone: '0770867602',
      email: 'central@maintainex.com',
      address: 'Kandy, Sri Lanka',
      province: 'Central Province',
      districts: ['Kandy', 'Matale', 'Nuwara Eliya']
    },
    {
      name: 'Southern Province Branch',
      location: 'Galle, Sri Lanka',
      phone: '0770867603',
      email: 'southern@maintainex.com',
      address: 'Galle, Sri Lanka',
      province: 'Southern Province',
      districts: ['Galle', 'Matara', 'Hambantota']
    },
    {
      name: 'Northern Province Branch',
      location: 'Jaffna, Sri Lanka',
      phone: '0770867609',
      email: 'northern@maintainex.com',
      address: '57/1 New Senguntha Road, Thirunelvaly, Jaffna, Sri Lanka',
      province: 'Northern Province',
      districts: ['Jaffna', 'Kilinochchi', 'Mannar', 'Mullaitivu', 'Vavuniya']
    },
    {
      name: 'Eastern Province Branch',
      location: 'Trincomalee, Sri Lanka',
      phone: '0770867604',
      email: 'eastern@maintainex.com',
      address: 'Trincomalee, Sri Lanka',
      province: 'Eastern Province',
      districts: ['Trincomalee', 'Batticaloa', 'Ampara']
    },
    {
      name: 'North Western Province Branch',
      location: 'Kurunegala, Sri Lanka',
      phone: '0770867605',
      email: 'northwest@maintainex.com',
      address: 'Kurunegala, Sri Lanka',
      province: 'North Western Province',
      districts: ['Kurunegala', 'Puttalam']
    },
    {
      name: 'North Central Province Branch',
      location: 'Anuradhapura, Sri Lanka',
      phone: '0770867606',
      email: 'northcentral@maintainex.com',
      address: 'Anuradhapura, Sri Lanka',
      province: 'North Central Province',
      districts: ['Anuradhapura', 'Polonnaruwa']
    },
    {
      name: 'Uva Province Branch',
      location: 'Badulla, Sri Lanka',
      phone: '0770867608',
      email: 'uva@maintainex.com',
      address: 'Badulla, Sri Lanka',
      province: 'Uva Province',
      districts: ['Badulla', 'Monaragala']
    },
    {
      name: 'Sabaragamuwa Province Branch',
      location: 'Ratnapura, Sri Lanka',
      phone: '0770867607',
      email: 'sabaragamuwa@maintainex.com',
      address: 'Ratnapura, Sri Lanka',
      province: 'Sabaragamuwa Province',
      districts: ['Ratnapura', 'Kegalle']
    }
  ]

  for (const branchData of branchesData) {
    await prisma.branch.upsert({
      where: { id: `branch-${branchData.name.toLowerCase().replace(/\s+/g, '-')}` },
      update: {
        phone: branchData.phone,
        address: branchData.address,
        location: branchData.location,
        province: branchData.province,
        districts: JSON.stringify(branchData.districts)
      },
      create: {
        id: `branch-${branchData.name.toLowerCase().replace(/\s+/g, '-')}`,
        name: branchData.name,
        location: branchData.location,
        phone: branchData.phone,
        address: branchData.address,
        city: branchData.location.split(',')[0].trim(),
        province: branchData.province,
        districts: JSON.stringify(branchData.districts),
        isActive: true
      }
    })
    console.log(`Created/Updated: ${branchData.name}`)
  }

  const northernBranch = await prisma.branch.findUnique({
    where: { id: 'branch-northern-province-branch' }
  })

  const superAdminEmail = process.env.ADMIN_EMAIL || 'maintainex.lk@gmail.com'
  const superAdminPasswordPlain = 'M@int@in2024!'
  const superAdminPassword = await bcrypt.hash(superAdminPasswordPlain, 12)

  const existingSuper = await prisma.admin.findUnique({ where: { email: superAdminEmail } })

  let superAdminId = existingSuper?.id
  if (!existingSuper) {
    const superAdmin = await prisma.admin.create({
      data: {
        name: 'Super Admin',
        email: superAdminEmail,
        password: superAdminPassword,
        role: 'SUPER_ADMIN',
        isActive: true
      }
    })
    superAdminId = superAdmin.id
  }
  console.log('Super Admin:', superAdminEmail)

  if (northernBranch) {
    const adminEmail = 'admin.maintainex.lk@gmail.com'
    const adminPasswordPlain = 'Adm1n@M4int@in!'
    const adminPassword = await bcrypt.hash(adminPasswordPlain, 12)
    const branchAdmin = await prisma.admin.upsert({
      where: { email: adminEmail },
      update: {},
      create: {
        email: adminEmail,
        password: adminPassword,
        name: 'Northern Admin',
        role: 'OPERATIONS',
        branchId: northernBranch.id,
        isActive: true
      }
    })
    console.log(`Created Branch Admin: ${branchAdmin.email}`)
  }

  // ========================================
  // MARKETPLACE SEED DATA — Users, Profiles, Jobs, Wallets, etc.
  // ========================================
  console.log('')
  console.log('Seeding marketplace data...')

  const passwordHash = await bcrypt.hash('password123', 12)

  // ────────────────────────────────────────
  // USERS (25 total: 10 CUSTOMER, 10 TASKER, 5 COMPANY)
  // ────────────────────────────────────────

  type UserData = {
    id: string
    mxId: string
    email: string
    passwordHash: string
    name: string
    phone: string
    role: string
    isActive: boolean
    isSuspended: boolean
    isBanned: boolean
    banReason: string | null
    identityStatus: string
    createdAt: Date
  }

  const customerNames = [
    { name: 'Kavinda Perera', email: 'kavinda.perera@gmail.com' },
    { name: 'Nadeesha Fernando', email: 'nadeesha.f@gmail.com' },
    { name: 'Chamara Wickramasinghe', email: 'chamara.w@outlook.com' },
    { name: 'Dilhani Silva', email: 'dilhani.silva@yahoo.com' },
    { name: 'Ruwan Jayawardena', email: 'ruwan.jay@gmail.com' },
    { name: 'Sanduni Herath', email: 'sanduni.herath@gmail.com' },
    { name: 'Kasun Bandara', email: 'kasun.bandara@hotmail.com' },
    { name: 'Madhavi Tennakoon', email: 'madhavi.t@outlook.com' },
    { name: 'Tharaka Mendis', email: 'tharaka.mendis@gmail.com' },
    { name: 'Yoshitha Rajapaksa', email: 'yoshitha.r@gmail.com' },
  ]

  const taskerNames = [
    { name: 'Dinesh Kumara', email: 'dinesh.kumara@gmail.com' },
    { name: 'Anoma De Silva', email: 'anoma.desilva@gmail.com' },
    { name: 'Prasanna Jayasuriya', email: 'prasanna.j@outlook.com' },
    { name: 'Lakmini Rajapaksa', email: 'lakmini.raj@gmail.com' },
    { name: 'Niroshan Fernando', email: 'niroshan.f@gmail.com' },
    { name: 'Chamindri Weerasinghe', email: 'chamindri.w@yahoo.com' },
    { name: 'Buddhika Perera', email: 'buddhika.perera@gmail.com' },
    { name: 'Malsha Liyanage', email: 'malsha.liyanage@gmail.com' },
    { name: 'Harsha Bandaranayake', email: 'harsha.b@outlook.com' },
    { name: 'Thilini Gunasekara', email: 'thilini.g@gmail.com' },
  ]

  const companyNames = [
    { name: 'Roshan Manage', email: 'roshan@ceylonservices.lk', company: 'Ceylon Home Services' },
    { name: 'Jagath Tennakoon', email: 'jagath@lankatech.lk', company: 'Lanka Tech Solutions' },
    { name: 'Sumithra Jayawardena', email: 'sumithra@pearlhome.lk', company: 'Pearl Home Services' },
    { name: 'Lakmal Fernando', email: 'lakmal@islandmaintenance.lk', company: 'Island Maintenance Co.' },
    { name: 'Priya Wickramasinghe', email: 'priya@serendibfacilities.lk', company: 'Serendib Facilities' },
  ]

  const users: UserData[] = []

  // Create 10 CUSTOMER users
  for (let i = 0; i < 10; i++) {
    const u = customerNames[i]
    const userId = cuid()
    users.push({
      id: userId,
      mxId: `MXU-${String(i + 1).padStart(5, '0')}`,
      email: u.email,
      passwordHash,
      name: u.name,
      phone: `+94${randomBetween(70, 79)}${randomBetween(1000000, 9999999)}`,
      role: 'CUSTOMER',
      isActive: i !== 7 && i !== 8, // indices 7,8 inactive
      isSuspended: i === 8,
      isBanned: i === 9,
      banReason: i === 9 ? 'Off-platform deal detected' : null,
      identityStatus: i < 3 ? 'VERIFIED' : i < 6 ? 'PENDING' : 'NOT_SUBMITTED',
      createdAt: daysAgo(randomBetween(10, 90)),
    })
  }

  // Create 10 TASKER users
  for (let i = 0; i < 10; i++) {
    const u = taskerNames[i]
    const userId = cuid()
    users.push({
      id: userId,
      mxId: `MXU-${String(11 + i).padStart(5, '0')}`,
      email: u.email,
      passwordHash,
      name: u.name,
      phone: `+94${randomBetween(70, 79)}${randomBetween(1000000, 9999999)}`,
      role: 'TASKER',
      isActive: i !== 9, // index 19 inactive
      isSuspended: false,
      isBanned: false,
      banReason: null,
      identityStatus: i < 8 ? 'VERIFIED' : 'PENDING',
      createdAt: daysAgo(randomBetween(15, 85)),
    })
  }

  // Create 5 COMPANY users
  for (let i = 0; i < 5; i++) {
    const u = companyNames[i]
    const userId = cuid()
    users.push({
      id: userId,
      mxId: `MXU-${String(21 + i).padStart(5, '0')}`,
      email: u.email,
      passwordHash,
      name: u.name,
      phone: `+94${randomBetween(11, 19)}${randomBetween(1000000, 9999999)}`,
      role: 'COMPANY',
      isActive: true,
      isSuspended: false,
      isBanned: false,
      banReason: null,
      identityStatus: i < 3 ? 'VERIFIED' : 'PENDING',
      createdAt: daysAgo(randomBetween(20, 80)),
    })
  }

  // Insert all users
  console.log(`Creating ${users.length} users...`)
  for (const u of users) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: {
        id: u.id,
        mxId: u.mxId,
        email: u.email,
        passwordHash: u.passwordHash,
        name: u.name,
        phone: u.phone,
        role: u.role,
        isActive: u.isActive,
        isSuspended: u.isSuspended,
        isBanned: u.isBanned,
        banReason: u.banReason,
        identityStatus: u.identityStatus,
        createdAt: u.createdAt,
      },
    })
  }
  console.log(`  ✓ ${users.length} users created`)

  // Separate user lists by role
  const customers = users.filter(u => u.role === 'CUSTOMER')
  const taskers = users.filter(u => u.role === 'TASKER')
  const companies = users.filter(u => u.role === 'COMPANY')

  // ────────────────────────────────────────
  // TASKER PROFILES
  // ────────────────────────────────────────

  const taskerBios = [
    'Experienced furniture assembly expert with 5+ years. Fast and reliable service.',
    'Professional cleaner specializing in deep cleaning and sanitization services.',
    'Skilled handyman for all home repair needs. Licensed and insured.',
    'Expert in TV mounting and smart home installations. Quick turnaround.',
    'Reliable moving specialist. Careful handling of all items, big or small.',
    'Garden and outdoor maintenance professional. Transform your outdoor space.',
    'Multi-skilled tasker covering cleaning, repairs, and assembly jobs.',
    'Plumbing and electrical specialist with certified training.',
    'Office and commercial cleaning expert. Available for both short and long-term contracts.',
    'New to the platform but highly experienced in residential services.',
  ]

  const serviceAreaSets = [
    ['Colombo', 'Gampaha'],
    ['Kandy', 'Matale'],
    ['Galle', 'Matara'],
    ['Colombo', 'Kalutara'],
    ['Jaffna', 'Kilinochchi'],
    ['Kurunegala', 'Puttalam'],
    ['Colombo', 'Kandy', 'Galle'],
    ['Trincomalee', 'Batticaloa'],
    ['Ratnapura', 'Kegalle'],
    ['Badulla', 'Monaragala'],
  ]

  const verificationStatuses = ['PENDING', 'PENDING', 'VERIFIED', 'VERIFIED', 'VERIFIED', 'VERIFIED', 'VERIFIED', 'VERIFIED', 'REJECTED', 'REJECTED']

  console.log('Creating tasker profiles...')
  const taskerProfileIds: string[] = []
  for (let i = 0; i < 10; i++) {
    const profileId = cuid()
    taskerProfileIds.push(profileId)
    const vStatus = verificationStatuses[i]
    await prisma.taskerProfile.upsert({
      where: { userId: taskers[i].id },
      update: {},
      create: {
        id: profileId,
        userId: taskers[i].id,
        mxId: `MXT-${String(i + 1).padStart(5, '0')}`,
        verificationStatus: vStatus,
        verificationNote: vStatus === 'REJECTED' ? 'Documents not clear. Please resubmit.' : null,
        verifiedBy: vStatus === 'VERIFIED' ? superAdminId : null,
        verifiedAt: vStatus === 'VERIFIED' ? daysAgo(randomBetween(5, 60)) : null,
        bio: taskerBios[i],
        hourlyRate: randomBetween(500, 2500),
        skills: JSON.stringify(SKILL_POOLS[i % SKILL_POOLS.length]),
        serviceAreas: JSON.stringify(serviceAreaSets[i]),
        rating: randomFloat(3.5, 5.0),
        completedJobs: randomBetween(0, 50),
        isVerified: vStatus === 'VERIFIED',
        isOnline: i < 3,
        compositeScore: randomBetween(40, 95),
        penaltyPoints: i === 7 ? 5 : 0,
        completionRate: randomBetween(85, 100),
        avgResponseMin: randomBetween(5, 45),
      },
    })
  }
  console.log(`  ✓ ${10} tasker profiles created`)

  // ────────────────────────────────────────
  // COMPANY PROFILES
  // ────────────────────────────────────────

  const companyDetails = [
    { desc: 'Full-service home maintenance and repair company serving Western Province.', services: 'cleaning,repairs,assembly', areas: 'Colombo,Gampaha,Kalutara', rating: 4.8, projects: 28, staff: 12 },
    { desc: 'Technology solutions and smart home installations for modern homes.', services: 'mounting,repairs,trending', areas: 'Colombo,Kandy', rating: 4.5, projects: 15, staff: 8 },
    { desc: 'Premium residential and commercial cleaning services across Sri Lanka.', services: 'cleaning,outdoor', areas: 'Colombo,Galle,Matara', rating: 4.6, projects: 22, staff: 10 },
    { desc: 'Reliable maintenance solutions for properties and commercial spaces.', services: 'repairs,assembly,moving', areas: 'Kurunegala,Puttalam', rating: 4.2, projects: 8, staff: 5 },
    { desc: 'Integrated facilities management for corporate and residential clients.', services: 'cleaning,repairs,outdoor', areas: 'Colombo,Kandy,Galle', rating: 4.0, projects: 5, staff: 3 },
  ]

  const companyVerificationStatuses = ['VERIFIED', 'VERIFIED', 'VERIFIED', 'PENDING', 'PENDING']

  console.log('Creating company profiles...')
  const companyProfileIds: string[] = []
  for (let i = 0; i < 5; i++) {
    const profileId = cuid()
    companyProfileIds.push(profileId)
    const vStatus = companyVerificationStatuses[i]
    const detail = companyDetails[i]
    await prisma.companyProfile.upsert({
      where: { userId: companies[i].id },
      update: {},
      create: {
        id: profileId,
        userId: companies[i].id,
        mxId: `MXC-${String(i + 1).padStart(5, '0')}`,
        companyName: companyNames[i].company,
        registrationNo: `REG-${String(randomBetween(10000, 99999))}`,
        description: detail.desc,
        services: detail.services,
        serviceAreas: detail.areas,
        rating: detail.rating,
        completedProjects: detail.projects,
        staffCount: detail.staff,
        isVerified: vStatus === 'VERIFIED',
        verificationStatus: vStatus,
        verificationNote: vStatus === 'PENDING' ? null : null,
        verifiedBy: vStatus === 'VERIFIED' ? superAdminId : null,
        verifiedAt: vStatus === 'VERIFIED' ? daysAgo(randomBetween(10, 70)) : null,
        commissionRate: 10.0,
        subscriptionStatus: i < 3 ? 'ACTIVE' : 'TRIAL',
      },
    })
  }
  console.log(`  ✓ ${5} company profiles created`)

  // ────────────────────────────────────────
  // CUSTOMER PROFILES
  // ────────────────────────────────────────

  const customerProvinces = [
    'Western Province', 'Central Province', 'Southern Province',
    'Western Province', 'Western Province', 'Northern Province',
    'Eastern Province', 'Uva Province', 'North Western Province', 'Sabaragamuwa Province',
  ]

  console.log('Creating customer profiles...')
  for (let i = 0; i < 10; i++) {
    const isVIP = i === 0 || i === 4
    await prisma.customerProfile.upsert({
      where: { userId: customers[i].id },
      update: {},
      create: {
        id: cuid(),
        userId: customers[i].id,
        customerType: isVIP ? 'VIP' : 'REGULAR',
        status: i === 8 ? 'INACTIVE' : 'ACTIVE',
        totalBookings: randomBetween(1, 20),
        totalSpent: randomBetween(5000, 100000),
        lifetimeValue: randomBetween(5000, 100000),
        firstBooking: daysAgo(randomBetween(30, 90)),
        lastBooking: daysAgo(randomBetween(0, 30)),
        province: customerProvinces[i],
        source: ['WEBSITE', 'REFERRAL', 'CAMPAIGN', 'WALK_IN'][randomBetween(0, 3)],
        preferredContact: ['EMAIL', 'PHONE', 'WHATSAPP'][randomBetween(0, 2)],
      },
    })
  }
  console.log(`  ✓ ${10} customer profiles created`)

  // ────────────────────────────────────────
  // PROVIDER WALLETS
  // ────────────────────────────────────────

  console.log('Creating provider wallets...')
  const allProviderUsers = [...taskers, ...companies]
  const walletIds: string[] = []
  for (let i = 0; i < allProviderUsers.length; i++) {
    const walletId = cuid()
    walletIds.push(walletId)
    await prisma.providerWallet.upsert({
      where: { userId: allProviderUsers[i].id },
      update: {},
      create: {
        id: walletId,
        userId: allProviderUsers[i].id,
        availableBalance: randomBetween(5000, 150000),
        pendingBalance: randomBetween(0, 50000),
        isFrozen: i === 12, // One frozen wallet (tasker index 2)
      },
    })
  }
  console.log(`  ✓ ${allProviderUsers.length} provider wallets created`)

  // ────────────────────────────────────────
  // MARKETPLACE JOBS (V2) — 20 jobs
  // ────────────────────────────────────────

  const jobTitles = [
    'Furniture Assembly - 3 Bed Room House',
    'Deep Cleaning - Office Space',
    'TV Wall Mounting - 65 inch LED',
    'Home Relocation - Colombo to Kandy',
    'Garden Maintenance - Monthly Service',
    'Plumbing Repair - Kitchen Sink',
    'Electrical Wiring - New Extension',
    'Post-Construction Cleaning',
    'Sofa Upholstery Cleaning',
    'Curtain Installation - Living Room',
    'Heavy Item Moving - Piano Transport',
    'Pool Cleaning - Weekly Service',
    'Interior Painting - 2 Bed Room Flat',
    'Smart Home Setup - IoT Devices',
    'Office Deep Clean - End of Lease',
    'Door Lock Replacement - Main Entrance',
    'Carpet Steam Cleaning - Conference Hall',
    'Gutter Cleaning - Two Story House',
    'Bookshelf Assembly - Custom Design',
    'Full House Cleaning - Move-in Ready',
  ]

  const jobDescriptions = [
    'Need experienced person to assemble a complete 3 bedroom house furniture set including beds, wardrobes, and dining table. Materials already delivered.',
    'Thorough deep cleaning of a 2000 sq ft office space. Includes all workstations, conference room, kitchen, and restrooms. Weekend preferred.',
    'Mount a 65 inch Samsung TV on concrete wall in living room. Need cable concealment and soundbar mounting as well.',
    'Help required for moving household items from Colombo to Kandy. 2 truck loads estimated. Fragile items need special care.',
    'Monthly garden maintenance for a residential property. Includes mowing, trimming, weeding, and general upkeep.',
    'Kitchen sink leaking badly. Need urgent repair. Pipe connection seems loose under the basin.',
    'Install additional power outlets and lighting in a home extension room. Need proper wiring and circuit breaker setup.',
    'Post-construction cleanup for a newly built house. Remove debris, dust, and prepare for occupancy.',
    'Professional cleaning of 3 seater leather sofa and 2 armchairs. Some stain removal needed.',
    'Install curtain rods and hang curtains for 6 windows in living room and dining area.',
    'Need help moving a grand piano from ground floor to first floor. Extra hands and equipment needed.',
    'Weekly pool cleaning service for a residential swimming pool. Chemical balancing and debris removal.',
    'Paint 2 bedroom apartment interior. Walls need preparation before painting. Color already selected.',
    'Set up smart home system including cameras, smart locks, and automated lighting. Consultation needed.',
    'End of lease deep cleaning for a commercial office space. Must meet inspection standards.',
    'Replace front door lock with high-security deadbolt. Remove old lock and install new one.',
    'Steam clean carpets in a 5000 sq ft conference hall. Multiple stain treatments required.',
    'Clean gutters and downspouts on a two story house. Some sections are blocked with leaves.',
    'Assemble custom designed bookshelf unit. Parts delivered. Technical drawing available.',
    'Complete house cleaning for a newly purchased home. Kitchen, bathrooms, all rooms, and windows.',
  ]

  const budgetTypes = ['FIXED', 'FIXED', 'FIXED', 'HOUR', 'HOUR', 'NEGOTIABLE', 'NEGOTIABLE', 'QUOTES']
  const urgencies = ['normal', 'normal', 'normal', 'normal', 'normal', 'urgent', 'urgent', 'emergency']
  const jobStatuses = ['OPEN', 'OPEN', 'OPEN', 'OPEN', 'OPEN', 'ASSIGNED', 'ASSIGNED', 'ASSIGNED', 'IN_PROGRESS', 'IN_PROGRESS', 'IN_PROGRESS', 'IN_PROGRESS', 'COMPLETED', 'COMPLETED', 'COMPLETED', 'COMPLETED', 'COMPLETED', 'COMPLETED', 'CANCELLED', 'CANCELLED']

  console.log('Creating marketplace jobs...')
  const marketplaceJobIds: string[] = []
  for (let i = 0; i < 20; i++) {
    const jobId = cuid()
    marketplaceJobIds.push(jobId)
    const customerIdx = i % 10
    await prisma.marketplaceJob.create({
      data: {
        id: jobId,
        customerId: customers[customerIdx].id,
        title: jobTitles[i],
        description: jobDescriptions[i],
        categoryId: CATEGORY_IDS[i % CATEGORY_IDS.length],
        photos: JSON.stringify([`https://images.unsplash.com/photo-${randomBetween(1500000000, 1600000000)}?w=400`]),
        budgetType: budgetTypes[i % budgetTypes.length],
        budgetAmount: BigInt(randomBetween(2000, 50000)),
        urgency: urgencies[i % urgencies.length],
        status: jobStatuses[i],
        isActive: jobStatuses[i] !== 'CANCELLED',
        workersCount: randomBetween(1, 3),
        estimatedDuration: randomFloat(1, 8),
        materialHandling: ['tasker_brings', 'customer_provides', 'quote_both'][randomBetween(0, 2)],
        createdAt: daysAgo(randomBetween(5, 60)),
      },
    })
  }
  console.log(`  ✓ ${20} marketplace jobs created`)

  // ────────────────────────────────────────
  // JOB POSTINGS (V1) — 10 jobs
  // ────────────────────────────────────────

  const v1JobTitles = [
    'House Cleaning Service',
    'Furniture Assembly Help',
    'Garden Landscaping',
    'Plumbing Emergency',
    'Office Cleaning Contract',
    'Electrical Maintenance',
    'Home Painting Job',
    'Moving Day Assistance',
    'Sofa Cleaning Required',
    'TV Installation Help',
  ]

  const v1JobStatuses = ['OPEN', 'OPEN', 'OPEN', 'ASSIGNED', 'ASSIGNED', 'IN_PROGRESS', 'IN_PROGRESS', 'COMPLETED', 'COMPLETED', 'CANCELLED']

  console.log('Creating V1 job postings...')
  const jobPostingIds: string[] = []
  for (let i = 0; i < 10; i++) {
    const jobId = cuid()
    jobPostingIds.push(jobId)
    const customerIdx = i % 10
    await prisma.jobPosting.create({
      data: {
        id: jobId,
        customerId: customers[customerIdx].id,
        title: v1JobTitles[i],
        description: `Looking for a reliable professional to help with: ${v1JobTitles[i].toLowerCase()}. Please provide your availability and quote.`,
        category: CATEGORY_IDS[i % CATEGORY_IDS.length],
        budget: randomBetween(2000, 25000),
        location: SRILANKAN_DISTRICTS[randomBetween(0, SRILANKAN_DISTRICTS.length - 1)],
        status: v1JobStatuses[i],
        scheduledDate: daysAgo(randomBetween(-7, 30)),
        createdAt: daysAgo(randomBetween(10, 60)),
      },
    })
  }
  console.log(`  ✓ ${10} V1 job postings created`)

  // ────────────────────────────────────────
  // IDENTITY DOCUMENTS (KYC) — 15 documents
  // ────────────────────────────────────────

  const docTypes = ['PASSPORT', 'NATIONAL_ID', 'DRIVERS_LICENSE']
  const docSides = ['FRONT', 'BACK']
  const docStatuses = ['PENDING', 'PENDING', 'PENDING', 'PENDING', 'PENDING', 'APPROVED', 'APPROVED', 'APPROVED', 'APPROVED', 'APPROVED', 'APPROVED', 'APPROVED', 'APPROVED', 'REJECTED', 'REJECTED']

  console.log('Creating identity documents...')
  const kycUsers = [...taskers.slice(0, 8), ...companies.slice(0, 3), ...customers.slice(0, 4)]
  for (let i = 0; i < 15; i++) {
    const user = kycUsers[i]
    const status = docStatuses[i]
    await prisma.identityDocument.create({
      data: {
        id: cuid(),
        userId: user.id,
        docType: docTypes[i % docTypes.length],
        side: i % 2 === 0 ? 'FRONT' : 'BACK',
        imageUrl: `https://storage.maintainex.com/kyc/${user.id}/${docTypes[i % docTypes.length].toLowerCase()}_${i % 2 === 0 ? 'front' : 'back'}.jpg`,
        status,
        reviewNote: status === 'REJECTED' ? 'Document expired or unclear. Please resubmit.' : null,
        reviewedBy: status !== 'PENDING' ? superAdminId : null,
        reviewedAt: status !== 'PENDING' ? daysAgo(randomBetween(1, 30)) : null,
        createdAt: daysAgo(randomBetween(5, 30)),
      },
    })
  }
  console.log(`  ✓ ${15} identity documents created`)

  // ────────────────────────────────────────
  // WEEKLY SETTLEMENTS — 8 weeks
  // ────────────────────────────────────────

  console.log('Creating weekly settlements...')
  const settlementProviders = [...taskers.slice(0, 5), ...companies.slice(0, 3)]
  const settlementStatuses = ['PAID', 'PAID', 'PAID', 'PAID', 'PAID', 'PENDING', 'PENDING', 'OVERDUE']

  for (let week = 7; week >= 0; week--) {
    const weekStart = getMonday(week)
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekEnd.getDate() + 6)
    weekEnd.setHours(23, 59, 59, 999)

    const providerIdx = (7 - week) % settlementProviders.length
    const provider = settlementProviders[providerIdx]
    const earnings = randomBetween(15000, 80000)
    const commission = Math.round(earnings * 0.1)

    await prisma.weeklySettlement.create({
      data: {
        id: cuid(),
        providerId: provider.id,
        providerType: provider.role === 'TASKER' ? 'TASKER' : 'COMPANY',
        weekStart,
        weekEnd,
        totalEarnings: earnings,
        commissionRate: 10.0,
        commissionOwed: commission,
        commissionPaid: settlementStatuses[7 - week] === 'PAID',
        paidAt: settlementStatuses[7 - week] === 'PAID' ? new Date(weekEnd.getTime() + 2 * 24 * 60 * 60 * 1000) : null,
        dueAt: new Date(weekEnd.getTime() + 7 * 24 * 60 * 60 * 1000),
        status: settlementStatuses[7 - week],
        createdAt: weekStart,
      },
    })
  }
  console.log(`  ✓ ${8} weekly settlements created`)

  // ────────────────────────────────────────
  // WALLET TRANSACTIONS — 30 transactions
  // ────────────────────────────────────────

  console.log('Creating wallet transactions...')
  const txTypes = ['CREDIT', 'DEBIT']
  const txRefTypes = ['ESCROW_RELEASE', 'ESCROW_REFUND', 'WITHDRAWAL', 'SERVICE_FEE']

  for (let i = 0; i < 30; i++) {
    const providerIdx = i % allProviderUsers.length
    const provider = allProviderUsers[providerIdx]
    const amount = randomBetween(500, 25000)
    const isCredit = i % 3 !== 0
    const balanceBefore = randomBetween(10000, 100000)
    const balanceAfter = isCredit ? balanceBefore + amount : balanceBefore - amount

    await prisma.walletTransaction.create({
      data: {
        id: cuid(),
        userId: provider.id,
        walletType: 'PROVIDER',
        type: isCredit ? 'CREDIT' : 'DEBIT',
        amount,
        balanceBefore,
        balanceAfter: Math.max(0, balanceAfter),
        reference: `TXN-${String(randomBetween(100000, 999999))}`,
        referenceType: txRefTypes[i % txRefTypes.length],
        referenceId: marketplaceJobIds[i % marketplaceJobIds.length],
        status: i === 29 ? 'PENDING' : 'COMPLETED',
        createdAt: daysAgo(randomBetween(1, 45)),
      },
    })
  }
  console.log(`  ✓ ${30} wallet transactions created`)

  // ────────────────────────────────────────
  // AUDIT LOGS — 15 admin action entries
  // ────────────────────────────────────────

  console.log('Creating audit logs...')

  const adminEmail = superAdminEmail
  const auditActions = [
    { action: 'KYC_APPROVED', targetTable: 'IdentityDocument', targetLabel: 'Kavinda Perera - Passport', description: 'Approved passport verification for tasker' },
    { action: 'KYC_REJECTED', targetTable: 'IdentityDocument', targetLabel: 'Thilini Gunasekara - National ID', description: 'Rejected ID document - image unclear' },
    { action: 'USER_BAN', targetTable: 'User', targetLabel: 'Yoshitha Rajapaksa', description: 'Banned user for off-platform deal detection' },
    { action: 'USER_SUSPEND', targetTable: 'User', targetLabel: 'Madhavi Tennakoon', description: 'Suspended user for 7 days - policy violation' },
    { action: 'SETTINGS_UPDATE', targetTable: 'PlatformSettings', targetLabel: 'Commission Rate', description: 'Updated platform commission rate from 15% to 10%' },
    { action: 'COMPANY_VERIFY', targetTable: 'CompanyProfile', targetLabel: 'Ceylon Home Services', description: 'Verified company registration and documents' },
    { action: 'TASKER_VERIFY', targetTable: 'TaskerProfile', targetLabel: 'Dinesh Kumara', description: 'Verified tasker identity and skills' },
    { action: 'WALLET_FREEZE', targetTable: 'ProviderWallet', targetLabel: 'Prasanna Jayasuriya', description: 'Frozen wallet pending fraud investigation' },
    { action: 'SETTLEMENT_OVERRIDE', targetTable: 'WeeklySettlement', targetLabel: 'Week 2024-01-15', description: 'Manually marked settlement as paid after bank confirmation' },
    { action: 'JOB_CANCEL', targetTable: 'MarketplaceJob', targetLabel: 'Pool Cleaning - Weekly Service', description: 'Admin cancelled job due to duplicate posting' },
    { action: 'DISPUTE_RESOLVE', targetTable: 'Dispute', targetLabel: 'Dispute #1234', description: 'Resolved dispute in favor of customer with partial refund' },
    { action: 'USER_UNBAN', targetTable: 'User', targetLabel: 'Niroshan Fernando', description: 'Unbanned user after appeal review' },
    { action: 'KYC_APPROVED', targetTable: 'IdentityDocument', targetLabel: 'Lanka Tech Solutions - Business Reg', description: 'Approved company business registration' },
    { action: 'SETTINGS_UPDATE', targetTable: 'PlatformSettings', targetLabel: 'Escrow Release Days', description: 'Changed escrow release period from 3 to 5 days' },
    { action: 'EXPORT_DATA', targetTable: 'CustomerProfile', targetLabel: 'Western Province Customers', description: 'Exported customer data for Q4 report' },
  ]

  for (let i = 0; i < 15; i++) {
    const entry = auditActions[i]
    await prisma.auditLog.create({
      data: {
        id: cuid(),
        adminUserId: superAdminId || 'admin-super',
        adminEmail: adminEmail,
        adminRole: 'SUPER_ADMIN',
        action: entry.action,
        targetTable: entry.targetTable,
        targetId: cuid(),
        targetLabel: entry.targetLabel,
        oldValue: JSON.stringify({ status: 'previous_value' }),
        newValue: JSON.stringify({ status: 'updated_value' }),
        ipAddress: `192.168.1.${randomBetween(1, 254)}`,
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
        createdAt: daysAgo(randomBetween(1, 30)),
      },
    })
  }
  console.log(`  ✓ ${15} audit logs created`)

  // ========================================
  // SUMMARY
  // ========================================

  console.log('')
  console.log('✅ Seed completed successfully!')
  console.log('')
  console.log('Login Credentials:')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('Super Admin:  maintainex.lk@gmail.com / M@int@in2024!')
  console.log('Branch Admin: admin.maintainex.lk@gmail.com / Adm1n@M4int@in!')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('⚠️  Change these passwords immediately in production!')
  console.log('⚠️  Use environment variables: ADMIN_EMAIL, ADMIN_PASSWORD')
  console.log('')
  console.log('Test User Credentials:')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('All test users use password: password123')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('')
  console.log('Seed Summary:')
  console.log(`  • Categories: ${categoriesData.length} (${categoriesData.reduce((a, c) => a + c.services.length, 0)} services)`)
  console.log(`  • Branches: ${branchesData.length}`)
  console.log(`  • Admin users: 2`)
  console.log(`  • Users: ${users.length} (10 customers, 10 taskers, 5 companies)`)
  console.log(`  • Tasker profiles: 10`)
  console.log(`  • Company profiles: 5`)
  console.log(`  • Customer profiles: 10`)
  console.log(`  • Provider wallets: ${allProviderUsers.length}`)
  console.log(`  • Marketplace jobs (V2): 20`)
  console.log(`  • Job postings (V1): 10`)
  console.log(`  • Identity documents: 15`)
  console.log(`  • Weekly settlements: 8`)
  console.log(`  • Wallet transactions: 30`)
  console.log(`  • Audit logs: 15`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

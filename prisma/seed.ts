import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding database with TaskRabbit-style categories and services...')

  const categoriesData = [
    {
      id: 'assembly',
      name: 'Assembly',
      slug: 'assembly',
      icon: 'wrench',
      description: 'Assemble or disassemble furniture items by unboxing, building, and any cleanup.',
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
      description: 'Mount TVs, art, shelves, mirrors, and more to your walls securely.',
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
      description: 'Help with moving, heavy lifting, furniture removal, and logistics.',
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
      description: 'Professional cleaning services for homes, offices, and commercial spaces.',
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
      description: 'Garden maintenance, lawn care, and outdoor cleaning services.',
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
      description: 'Minor plumbing, electrical help, and home repair services.',
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
      description: 'Popular services that are trending right now.',
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
      update: {
        description: categoryData.description,
        icon: categoryData.icon
      },
      create: {
        id: categoryData.id,
        name: categoryData.name,
        slug: categoryData.slug,
        description: categoryData.description,
        icon: categoryData.icon,
        isActive: true
      }
    })
    console.log(`Created Category: ${categoryData.name}`)

    for (const serviceData of categoryData.services) {
      await prisma.service.upsert({
        where: { slug: serviceData.slug },
        update: {
          title: serviceData.title,
          description: serviceData.description,
          price: serviceData.price,
          duration: serviceData.duration,
          image: serviceData.image,
          categoryId: categoryData.id,
          isActive: true
        },
        create: {
          title: serviceData.title,
          slug: serviceData.slug,
          description: serviceData.description,
          price: serviceData.price,
          duration: serviceData.duration,
          image: serviceData.image,
          categoryId: categoryData.id,
          isActive: true
        }
      })
    }
    console.log(`  → ${categoryData.services.length} services added`)
  }

  const branchesData = [
    {
      name: 'Jaffna Branch',
      location: 'Jaffna, Sri Lanka',
      phone: '0770867609',
      email: 'jaffna@maintainex.com',
      address: '57/1 New Senguntha Road, Thirunelvaly, Jaffna, Sri Lanka',
      districts: ['Jaffna', 'Kilinochchi', 'Mannar', 'Vavuniya', 'Mullaitivu']
    },
    {
      name: 'Colombo Branch',
      location: 'Colombo, Sri Lanka',
      phone: '0770867601',
      email: 'colombo@maintainex.com',
      address: 'Colombo, Sri Lanka',
      districts: ['Colombo', 'Gampaha', 'Kalutara']
    },
    {
      name: 'Kandy Branch',
      location: 'Kandy, Sri Lanka',
      phone: '0770867602',
      email: 'kandy@maintainex.com',
      address: 'Kandy, Sri Lanka',
      districts: ['Kandy', 'Matale', 'Nuwara Eliya']
    },
    {
      name: 'Southern Branch',
      location: 'Galle, Sri Lanka',
      phone: '0770867603',
      email: 'southern@maintainex.com',
      address: 'Galle, Sri Lanka',
      districts: ['Galle', 'Matara', 'Hambantota']
    },
    {
      name: 'Eastern Branch',
      location: 'Trincomalee, Sri Lanka',
      phone: '0770867604',
      email: 'eastern@maintainex.com',
      address: 'Trincomalee, Sri Lanka',
      districts: ['Trincomalee', 'Batticaloa', 'Ampara']
    },
    {
      name: 'North Western Branch',
      location: 'Kurunegala, Sri Lanka',
      phone: '0770867605',
      email: 'northwest@maintainex.com',
      address: 'Kurunegala, Sri Lanka',
      districts: ['Kurunegala', 'Puttalam']
    },
    {
      name: 'North Central Branch',
      location: 'Anuradhapura, Sri Lanka',
      phone: '0770867606',
      email: 'northcentral@maintainex.com',
      address: 'Anuradhapura, Sri Lanka',
      districts: ['Anuradhapura', 'Polonnaruwa']
    },
    {
      name: 'Sabaragamuwa Branch',
      location: 'Ratnapura, Sri Lanka',
      phone: '0770867607',
      email: 'sabaragamuwa@maintainex.com',
      address: 'Ratnapura, Sri Lanka',
      districts: ['Ratnapura', 'Kegalle']
    },
    {
      name: 'Uva Branch',
      location: 'Badulla, Sri Lanka',
      phone: '0770867608',
      email: 'uva@maintainex.com',
      address: 'Badulla, Sri Lanka',
      districts: ['Badulla', 'Monaragala']
    }
  ]

  for (const branchData of branchesData) {
    await prisma.branch.upsert({
      where: { id: `branch-${branchData.name.toLowerCase().replace(/\s+/g, '-')}` },
      update: {
        districts: JSON.stringify(branchData.districts),
        phone: branchData.phone,
        email: branchData.email,
        address: branchData.address
      },
      create: {
        id: `branch-${branchData.name.toLowerCase().replace(/\s+/g, '-')}`,
        name: branchData.name,
        location: branchData.location,
        phone: branchData.phone,
        email: branchData.email,
        address: branchData.address,
        districts: JSON.stringify(branchData.districts),
        isActive: true
      }
    })
    console.log(`Created/Updated: ${branchData.name}`)
  }

  const jaffnaBranch = await prisma.branch.findUnique({
    where: { id: 'branch-jaffna-branch' }
  })

  const superAdminPassword = await bcrypt.hash('super123', 10)
  const superAdmin = await prisma.admin.upsert({
    where: { email: 'super@maintainex.com' },
    update: {},
    create: {
      email: 'super@maintainex.com',
      password: superAdminPassword,
      name: 'Super Admin',
      role: 'SUPER_ADMIN',
      isActive: true
    }
  })
  console.log(`Created Super Admin: ${superAdmin.email}`)

  if (jaffnaBranch) {
    const adminPassword = await bcrypt.hash('admin123', 10)
    const branchAdmin = await prisma.admin.upsert({
      where: { email: 'admin@maintainex.com' },
      update: {},
      create: {
        email: 'admin@maintainex.com',
        password: adminPassword,
        name: 'Jaffna Admin',
        role: 'ADMIN',
        branchId: jaffnaBranch.id,
        isActive: true
      }
    })
    console.log(`Created Branch Admin: ${branchAdmin.email}`)
  }

  console.log('')
  console.log('✅ Seed completed successfully!')
  console.log('')
  console.log('Login Credentials:')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('Super Admin:  super@maintainex.com / super123')
  console.log('Branch Admin: admin@maintainex.com / admin123')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('')
  console.log('Categories Created:')
  categoriesData.forEach(c => {
    console.log(`  • ${c.name}: ${c.services.length} services`)
  })
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding database with branches, admins, and services...')

  const categoriesData = [
    {
      id: 'home-cleaning',
      name: 'Home Cleaning',
      services: [
        { title: 'Deep Cleaning', slug: 'deep-cleaning', description: 'Thorough deep cleaning for your entire home', price: 5000, image: 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=600' },
        { title: 'Sofa Cleaning', slug: 'sofa-cleaning', description: 'Professional sofa and upholstery cleaning', price: 3000, image: 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=600' },
        { title: 'Carpet Cleaning', slug: 'carpet-cleaning', description: 'Deep carpet cleaning and stain removal', price: 3500, image: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600' },
        { title: 'Mattress Cleaning', slug: 'mattress-cleaning', description: 'Sanitized mattress cleaning service', price: 2500, image: 'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=600' },
      ]
    },
    {
      id: 'industrial-cleaning',
      name: 'Industrial Cleaning',
      services: [
        { title: 'Office Cleaning', slug: 'office-cleaning', description: 'Regular office cleaning and maintenance', price: 8000, image: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=600' },
        { title: 'Warehouse Cleaning', slug: 'warehouse-cleaning', description: 'Industrial warehouse cleaning services', price: 15000, image: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=600' },
        { title: 'Post-Construction Cleaning', slug: 'post-construction-cleaning', description: 'Complete post-construction cleanup', price: 20000, image: 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=600' },
        { title: 'Hospital Cleaning', slug: 'hospital-cleaning', description: 'Medical facility cleaning with sanitization', price: 25000, image: 'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?w=600' },
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
        slug: categoryData.id
      }
    })

    for (const serviceData of categoryData.services) {
      await prisma.service.upsert({
        where: { slug: serviceData.slug },
        update: {
          title: serviceData.title,
          description: serviceData.description,
          price: serviceData.price,
          image: serviceData.image
        },
        create: {
          title: serviceData.title,
          slug: serviceData.slug,
          description: serviceData.description,
          price: serviceData.price,
          image: serviceData.image,
          categoryId: categoryData.id,
          isActive: true
        }
      })
    }
    console.log(`Created Category: ${categoryData.name}`)
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
  console.log('Branches Created:')
  branchesData.forEach(b => {
    console.log(`  • ${b.name}: ${b.districts.join(', ')}`)
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

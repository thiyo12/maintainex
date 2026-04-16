import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Adding new categories and services...')

  const newCategories = [
    {
      id: 'pestcontrol',
      name: 'Pest Control',
      slug: 'pestcontrol',
      icon: 'wrench',
      description: 'Professional pest control services to keep your home safe and pest-free',
      services: [
        { title: 'Cockroach Treatment', slug: 'cockroach-treatment', description: 'Professional cockroach elimination and prevention treatment', price: 3500, image: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600' },
        { title: 'Termite Control', slug: 'termite-control', description: 'Complete termite inspection and treatment for your property', price: 8000, image: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600' },
        { title: 'Ant & Insect Treatment', slug: 'ant-insect-treatment', description: 'Effective ant and insect control treatment', price: 2500, image: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600' },
        { title: 'Rodent Control', slug: 'rodent-control', description: 'Professional rat and mice control solutions', price: 4000, image: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600' },
      ]
    },
    {
      id: 'acservice',
      name: 'AC Service',
      slug: 'acservice',
      icon: 'wrench',
      description: 'Expert air conditioning service and repair',
      services: [
        { title: 'AC General Service', slug: 'ac-general-service', description: 'Complete AC servicing including filter cleaning and coil check', price: 3500, image: 'https://images.unsplash.com/photo-1585771724684-38269d6639fd?w=600' },
        { title: 'AC Repair', slug: 'ac-repair', description: 'Professional AC repair for all brands and types', price: 4500, image: 'https://images.unsplash.com/photo-1585771724684-38269d6639fd?w=600' },
        { title: 'AC Gas Top-up', slug: 'ac-gas-topup', description: 'Refrigerant gas refilling for AC units', price: 5000, image: 'https://images.unsplash.com/photo-1585771724684-38269d6639fd?w=600' },
        { title: 'AC Installation', slug: 'ac-installation', description: 'Professional AC installation for new units', price: 6000, image: 'https://images.unsplash.com/photo-1585771724684-38269d6639fd?w=600' },
      ]
    },
    {
      id: 'watertank',
      name: 'Water Tank',
      slug: 'watertank',
      icon: 'wrench',
      description: 'Professional water tank cleaning and maintenance',
      services: [
        { title: 'Overhead Tank Cleaning', slug: 'overhead-tank-cleaning', description: 'Complete cleaning of overhead water tanks', price: 4000, image: 'https://images.unsplash.com/photo-1588776814546-1ffcf47267a5?w=600' },
        { title: 'Underground Tank Cleaning', slug: 'underground-tank-cleaning', description: 'Professional underground tank cleaning service', price: 8000, image: 'https://images.unsplash.com/photo-1588776814546-1ffcf47267a5?w=600' },
        { title: 'Tank Disinfection', slug: 'tank-disinfection', description: 'Complete tank disinfection and sanitization', price: 2500, image: 'https://images.unsplash.com/photo-1588776814546-1ffcf47267a5?w=600' },
      ]
    },
    {
      id: 'disinfection',
      name: 'Disinfection',
      slug: 'disinfection',
      icon: 'sparkles',
      description: 'Professional disinfection and sanitization services',
      services: [
        { title: 'Home Disinfection', slug: 'home-disinfection', description: 'Complete home sanitization and disinfection', price: 5000, image: 'https://images.unsplash.com/photo-1585771724684-38269d6639fd?w=600' },
        { title: 'Office Disinfection', slug: 'office-disinfection', description: 'Professional office and workplace disinfection', price: 8000, image: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=600' },
        { title: 'Vehicle Sanitization', slug: 'vehicle-sanitization', description: 'Complete vehicle interior sanitization', price: 2000, image: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600' },
      ]
    },
    {
      id: 'homecare',
      name: 'Home Care',
      slug: 'homecare',
      icon: 'wrench',
      description: 'Complete home maintenance and repair services',
      services: [
        { title: 'Light Fixture Installation', slug: 'light-fixture-installation', description: 'Professional light and lamp installation', price: 1500, image: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600' },
        { title: 'Fan Installation', slug: 'fan-installation', description: 'Ceiling and wall fan installation service', price: 2000, image: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600' },
        { title: 'Tap Repair', slug: 'tap-repair', description: 'Leaking tap repair and replacement', price: 1500, image: 'https://images.unsplash.com/photo-1585704032915-c3400ca199e7?w=600' },
        { title: 'Leak Fixing', slug: 'leak-fixing', description: 'Professional pipe leak detection and repair', price: 2000, image: 'https://images.unsplash.com/photo-1585704032915-c3400ca199e7?w=600' },
        { title: 'Door Repair', slug: 'door-repair', description: 'Door hinge adjustment and repair', price: 2500, image: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600' },
        { title: 'Lock Replacement', slug: 'lock-replacement', description: 'Door lock repair and replacement service', price: 2000, image: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600' },
        { title: 'Minor Painting', slug: 'minor-painting', description: 'Touch-up painting and small wall areas', price: 3500, image: 'https://images.unsplash.com/photo-1562259949-e8e7689d7828?w=600' },
        { title: 'Touch-up Work', slug: 'touch-up-work', description: 'Paint touch-ups and wall patch repairs', price: 2000, image: 'https://images.unsplash.com/photo-1562259949-e8e7689d7828?w=600' },
        { title: 'Toilet Repair', slug: 'toilet-repair', description: 'Toilet tank and flush repair service', price: 2500, image: 'https://images.unsplash.com/photo-1585704032915-c3400ca199e7?w=600' },
        { title: 'Pipe Unblocking', slug: 'pipe-unblocking', description: 'Drain and pipe clog removal service', price: 3000, image: 'https://images.unsplash.com/photo-1585704032915-c3400ca199e7?w=600' },
        { title: 'Furniture Repair', slug: 'furniture-repair', description: 'Wooden furniture repair and restoration', price: 4000, image: 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=600' },
        { title: 'Window Fixing', slug: 'window-fixing', description: 'Window glass and frame repair service', price: 2000, image: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600' },
      ]
    }
  ]

  for (const categoryData of newCategories) {
    await prisma.category.upsert({
      where: { id: categoryData.id },
      update: {
        description: categoryData.description,
      },
      create: {
        id: categoryData.id,
        name: categoryData.name,
        slug: categoryData.slug,
        icon: categoryData.icon,
        description: categoryData.description,
        isActive: true
      }
    })
    console.log(`Created/Updated Category: ${categoryData.name}`)

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
          duration: 60,
          image: serviceData.image,
          categoryId: categoryData.id,
          isActive: true
        }
      })
    }
    console.log(`  → ${categoryData.services.length} services added`)
  }

  console.log('')
  console.log('✅ New categories and services added successfully!')
  console.log('')
  console.log('New Categories:')
  newCategories.forEach(c => {
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

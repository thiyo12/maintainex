const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function seed() {
  try {
    // Create categories
    const homeCleaning = await prisma.category.upsert({
      where: { slug: 'home-cleaning' },
      update: {},
      create: {
        name: 'Home Cleaning',
        slug: 'home-cleaning'
      }
    })

    const industrialCleaning = await prisma.category.upsert({
      where: { slug: 'industrial-cleaning' },
      update: {},
      create: {
        name: 'Industrial Cleaning',
        slug: 'industrial-cleaning'
      }
    })

    // Create services
    const homeServices = [
      { title: 'Sofa Cleaning', slug: 'sofa-cleaning', description: 'Deep cleaning for all types of sofas and upholstered furniture.', price: 3500, image: 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=600' },
      { title: 'Deep Cleaning', slug: 'deep-cleaning', description: 'Thorough top-to-bottom cleaning including all rooms, bathrooms, and kitchen.', price: 8500, image: 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=600' },
      { title: 'House Washing', slug: 'house-washing', description: 'Exterior pressure washing to remove dirt, mold, and grime.', price: 12000, image: 'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=600' },
      { title: 'Carpet Cleaning', slug: 'carpet-cleaning', description: 'Professional carpet shampooing and stain removal.', price: 4000, image: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600' },
      { title: 'Mattress Cleaning', slug: 'mattress-cleaning', description: 'Sanitized cleaning for mattresses to remove dust mites and allergens.', price: 2500, image: 'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=600' },
      { title: 'Kitchen Cleaning', slug: 'kitchen-cleaning', description: 'Complete kitchen cleaning including appliances and cabinets.', price: 5000, image: 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=600' },
      { title: 'Bathroom Cleaning', slug: 'bathroom-cleaning', description: 'Sanitized bathroom cleaning with limescale removal.', price: 3000, image: 'https://images.unsplash.com/photo-1552321554-5fefe8c9ef14?w=600' },
      { title: 'Window Cleaning', slug: 'window-cleaning', description: 'Interior and exterior window cleaning for crystal clear views.', price: 2000, image: 'https://images.unsplash.com/photo-1527515637462-cff94eecc1ac?w=600' },
    ]

    const industrialServices = [
      { title: 'Hospital Cleaning', slug: 'hospital-cleaning', description: 'Medical-grade sanitization for healthcare facilities.', price: 15000, image: 'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?w=600' },
      { title: 'School Cleaning', slug: 'school-cleaning', description: 'After-hours cleaning for educational institutions.', price: 12000, image: 'https://images.unsplash.com/photo-1580582932707-520aed937b7b?w=600' },
      { title: 'Office Cleaning', slug: 'office-cleaning', description: 'Daily or weekly office cleaning to maintain a professional workspace.', price: 10000, image: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=600' },
      { title: 'Shop Cleaning', slug: 'shop-cleaning', description: 'Retail space cleaning to keep your store spotless.', price: 8000, image: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=600' },
      { title: 'Mall Cleaning', slug: 'mall-cleaning', description: 'Large-scale cleaning for shopping centers.', price: 25000, image: 'https://images.unsplash.com/photo-1519567241046-7f570eee3ce6?w=600' },
      { title: 'Warehouse Cleaning', slug: 'warehouse-cleaning', description: 'Industrial warehouse cleaning including floors.', price: 18000, image: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=600' },
      { title: 'Post-Construction Cleaning', slug: 'post-construction-cleaning', description: 'Complete cleanup after construction or renovation.', price: 20000, image: 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=600' },
      { title: 'Factory Cleaning', slug: 'factory-cleaning', description: 'Heavy-duty industrial cleaning for manufacturing facilities.', price: 22000, image: 'https://images.unsplash.com/photo-1565514020179-026b92b84bb6?w=600' },
    ]

    for (const service of homeServices) {
      await prisma.service.upsert({
        where: { slug: service.slug },
        update: {},
        create: {
          ...service,
          categoryId: homeCleaning.id
        }
      })
    }

    for (const service of industrialServices) {
      await prisma.service.upsert({
        where: { slug: service.slug },
        update: {},
        create: {
          ...service,
          categoryId: industrialCleaning.id
        }
      })
    }

    // Create settings
    await prisma.settings.upsert({
      where: { id: 'default' },
      update: {},
      create: {
        id: 'default',
        companyName: 'Maintainex',
        email: 'info@maintainex.com',
        phone: '+94 21 222 2222',
        address: 'Jaffna, Sri Lanka',
        workingHours: 'Monday - Saturday: 7:00 AM - 7:00 PM'
      }
    })

    console.log('Seed completed successfully!')
    console.log('Created categories:', homeCleaning.name, industrialCleaning.name)
    console.log('Created services:', homeServices.length + industrialServices.length)
  } catch (error) {
    console.error('Seed error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

seed()

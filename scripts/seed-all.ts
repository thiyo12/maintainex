import { prisma } from '../lib/prisma'

const categories = [
  { name: 'Home Care', slug: 'home-care', description: 'Professional home cleaning and maintenance services', icon: '🏠', displayOrder: 1 },
  { name: 'Office & Commercial', slug: 'office-commercial', description: 'Commercial cleaning services for businesses', icon: '🏢', displayOrder: 2 },
  { name: 'Plumbing & Water', slug: 'plumbing-water', description: 'Professional plumbing and water repair services', icon: '🔧', displayOrder: 3 },
  { name: 'Electrical', slug: 'electrical', description: 'Electrical wiring and repair services', icon: '⚡', displayOrder: 4 },
  { name: 'Appliance Repair', slug: 'appliance-repair', description: 'Home appliance repair and maintenance', icon: '🔌', displayOrder: 5 },
  { name: 'Software & IT', slug: 'software-it', description: 'Computer and IT repair services', icon: '💻', displayOrder: 6 },
  { name: 'Construction & Renovation', slug: 'construction-renovation', description: 'Building construction and renovation services', icon: '🏗️', displayOrder: 7 },
  { name: 'Outdoor & Garden', slug: 'outdoor-garden', description: 'Outdoor maintenance and gardening services', icon: '🌿', displayOrder: 8 },
  { name: 'Family & Lifestyle', slug: 'family-lifestyle', description: 'Personal care and lifestyle services', icon: '👨‍👩‍👧', displayOrder: 9 },
  { name: 'Events & Celebrations', slug: 'events-celebrations', description: 'Event planning and celebration services', icon: '🎉', displayOrder: 10 }
]

const services = [
  { name: 'Deep House Cleaning', categorySlug: 'home-care', description: 'Thorough cleaning for every corner of your home', price: 3500, duration: 180 },
  { name: 'House Movers', categorySlug: 'home-care', description: 'Professional packing and moving services', price: 5000, duration: 240 },
  { name: 'Plumbing & Water Repairs', categorySlug: 'home-care', description: 'Fix leaks pipes and water issues', price: 1500, duration: 60 },
  { name: 'Electrical Fixes', categorySlug: 'home-care', description: 'Wiring switches and electrical repairs', price: 1200, duration: 60 },
  { name: 'Pest Control', categorySlug: 'home-care', description: 'Eliminate pests and prevent infestations', price: 2500, duration: 120 },
  { name: 'Appliance Repair', categorySlug: 'home-care', description: 'Fix your home appliances', price: 2000, duration: 90 },
  { name: 'Waterproofing', categorySlug: 'home-care', description: 'Protect your home from water damage', price: 3000, duration: 180 },
  { name: 'Office Cleaning', categorySlug: 'office-commercial', description: 'Clean and productive workspaces', price: 2500, duration: 120 },
  { name: 'Commercial Cleaning', categorySlug: 'office-commercial', description: 'Large-scale cleaning for businesses', price: 4000, duration: 180 },
  { name: 'Deep Cleaning', categorySlug: 'office-commercial', description: 'Intensive cleaning for all spaces', price: 5000, duration: 240 },
  { name: 'HVAC Maintenance', categorySlug: 'office-commercial', description: 'Heating ventilation and AC services', price: 3500, duration: 120 },
  { name: 'Office Electrical Services', categorySlug: 'office-commercial', description: 'Commercial electrical solutions', price: 2000, duration: 90 },
  { name: 'Leak Detection & Repair', categorySlug: 'plumbing-water', description: 'Find and fix water leaks quickly', price: 1500, duration: 60 },
  { name: 'Drain Cleaning & Unblocking', categorySlug: 'plumbing-water', description: 'Clear blocked drains and pipes', price: 1200, duration: 60 },
  { name: 'Water Heater Installation & Repair', categorySlug: 'plumbing-water', description: 'Install or repair water heaters', price: 2500, duration: 120 },
  { name: 'Pipe Installation & Replacement', categorySlug: 'plumbing-water', description: 'New pipe installation and replacement', price: 3000, duration: 180 },
  { name: 'Bathroom & Kitchen Plumbing', categorySlug: 'plumbing-water', description: 'Complete bathroom and kitchen plumbing', price: 4000, duration: 240 },
  { name: 'Electrical Wiring & Rewiring', categorySlug: 'electrical', description: 'New wiring and rewiring services', price: 3500, duration: 180 },
  { name: 'Switch & Socket Installation', categorySlug: 'electrical', description: 'Install switches and sockets', price: 800, duration: 30 },
  { name: 'Electrical Panel Maintenance', categorySlug: 'electrical', description: 'Panel upgrades and maintenance', price: 2500, duration: 120 },
  { name: 'Light Installation & Repair', categorySlug: 'electrical', description: 'Install and repair lighting', price: 1000, duration: 45 },
  { name: 'Emergency Electrical Services', categorySlug: 'electrical', description: '24/7 emergency electrical repairs', price: 2000, duration: 60 },
  { name: 'AC Repair & Service', categorySlug: 'appliance-repair', description: 'Air conditioner repair and service', price: 2000, duration: 90 },
  { name: 'Washing Machine Repair', categorySlug: 'appliance-repair', description: 'Fix washing machine issues', price: 1500, duration: 60 },
  { name: 'Refrigerator Repair', categorySlug: 'appliance-repair', description: 'Refrigerator repair and maintenance', price: 1800, duration: 60 },
  { name: 'CCTV Installation & Repair', categorySlug: 'appliance-repair', description: 'Install and repair CCTV cameras', price: 2500, duration: 120 },
  { name: 'Computer & Laptop Repair', categorySlug: 'software-it', description: 'Fast and reliable device repairs', price: 1000, duration: 60 },
  { name: 'Mobile Phone Repair', categorySlug: 'software-it', description: 'Fix smartphones and tablets', price: 800, duration: 45 },
  { name: 'Social Media Marketing & SEO', categorySlug: 'software-it', description: 'Grow your business online', price: 5000, duration: 720 },
  { name: 'Software & App Support', categorySlug: 'software-it', description: 'Technical support and maintenance', price: 1500, duration: 60 },
  { name: 'House & Building Construction', categorySlug: 'construction-renovation', description: 'Build your dream property', price: 100000, duration: 10080 },
  { name: 'Renovation & Remodeling', categorySlug: 'construction-renovation', description: 'Transform your space', price: 50000, duration: 2880 },
  { name: 'Roofing & Tiling', categorySlug: 'construction-renovation', description: 'Quality roofing solutions', price: 30000, duration: 1440 },
  { name: 'Interior Designing', categorySlug: 'construction-renovation', description: 'Style your interiors', price: 25000, duration: 720 },
  { name: 'Plumbing & Wiring for New Projects', categorySlug: 'construction-renovation', description: 'Complete utility installation', price: 20000, duration: 720 },
  { name: 'Gardening & Landscaping', categorySlug: 'outdoor-garden', description: 'Create beautiful outdoor spaces', price: 5000, duration: 240 },
  { name: 'Tree Cutting & Trimming', categorySlug: 'outdoor-garden', description: 'Safe tree removal and trimming', price: 3500, duration: 180 },
  { name: 'Waste Removal & Disposal', categorySlug: 'outdoor-garden', description: 'Clean up and dispose responsibly', price: 2500, duration: 120 },
  { name: 'Babysitting & Childcare', categorySlug: 'family-lifestyle', description: 'Trusted care for your children', price: 1500, duration: 180 },
  { name: 'Elderly Care Services', categorySlug: 'family-lifestyle', description: 'Compassionate senior care', price: 2500, duration: 240 },
  { name: 'Home Tutoring', categorySlug: 'family-lifestyle', description: 'Quality education at home', price: 2000, duration: 60 },
  { name: 'Fitness Yoga & Personal Training', categorySlug: 'family-lifestyle', description: 'Stay healthy with experts', price: 1500, duration: 60 },
  { name: 'Personal Shopping & Errands', categorySlug: 'family-lifestyle', description: 'We shop so you dont have to', price: 1000, duration: 60 },
  { name: 'Event Planning & Coordination', categorySlug: 'events-celebrations', description: 'Make your event memorable', price: 10000, duration: 480 },
  { name: 'Catering & Food Services', categorySlug: 'events-celebrations', description: 'Delicious food for every occasion', price: 15000, duration: 240 },
  { name: 'Decoration & Stage Setup', categorySlug: 'events-celebrations', description: 'Stunning decor for events', price: 8000, duration: 240 },
  { name: 'Photography & Videography', categorySlug: 'events-celebrations', description: 'Capture every moment', price: 12000, duration: 180 },
  { name: 'Music Sound & Lighting', categorySlug: 'events-celebrations', description: 'Perfect atmosphere', price: 6000, duration: 180 }
]

async function seed() {
  const existing = await prisma.category.count()
  if (existing > 0) {
    console.log('Already seeded with ' + existing + ' categories')
    return
  }
  
  for (const cat of categories) {
    await prisma.category.create({ data: cat })
  }
  
  for (const s of services) {
    const cat = await prisma.category.findFirst({ where: { slug: s.categorySlug } })
    if (cat) {
      await prisma.service.create({
        data: {
          name: s.name,
          slug: s.name.toLowerCase().replace(/\s+/g, '-'),
          description: s.description,
          shortDescription: s.description,
          price: s.price,
          duration: s.duration,
          categoryId: cat.id
        }
      })
    }
  }
  
  console.log('Seeded ' + categories.length + ' categories and ' + services.length + ' services')
}

seed().catch(e => console.error(e)).finally(() => prisma.$disconnect())
import { prisma } from '../lib/prisma'

async function check() {
  const cats = await prisma.category.findMany({ select: { name: true, slug: true } })
  const servs = await prisma.service.findMany({ select: { name: true, categoryId: true } })
  
  console.log('Categories: ' + cats.length)
  console.log('Services: ' + servs.length)
  console.log(cats.map(c => c.name).join(', '))
}

check().catch(e => console.error(e)).finally(() => prisma.$disconnect())
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

function serializeService(service: any) {
  return {
    ...service,
    title: service.name,
    price: service.price ? Number(service.price) : null,
  }
}

export async function GET() {
  try {
    const categories = await prisma.category.findMany({
      include: {
        services: {
          where: { isActive: true }
        },
        _count: {
          select: { services: true }
        }
      },
      orderBy: { name: 'asc' }
    })

    const serializedCategories = categories.map(cat => ({
      ...cat,
      services: cat.services.map(serializeService)
    }))

    return NextResponse.json(serializedCategories)
  } catch {
    return NextResponse.json({ error: 'Failed to fetch categories' }, { status: 500 })
  }
}

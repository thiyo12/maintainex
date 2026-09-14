import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth-utils'

export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 403 })
  }

  const session = await getSession(request)
  if (!session || session.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS "Industry" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "name" TEXT NOT NULL,
        "icon" TEXT,
        "image" TEXT,
        "displayOrder" INTEGER DEFAULT 0,
        "isPartner" BOOLEAN DEFAULT false,
        "partnerName" TEXT,
        "isActive" BOOLEAN DEFAULT true,
        "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `

    const industries = [
      { name: 'Shopping Malls', icon: '🏬', displayOrder: 1 },
      { name: 'Schools', icon: '🏫', displayOrder: 2 },
      { name: 'Real Estate', icon: '🏠', displayOrder: 3 },
      { name: 'Hospitals', icon: '🏥', displayOrder: 4 },
      { name: 'Industrial', icon: '🏭', displayOrder: 5 },
      { name: 'Education Centres', icon: '📚', displayOrder: 6 },
      { name: 'Office Complex', icon: '🏢', displayOrder: 7 },
    ]

    for (const ind of industries) {
      const id = ind.name.toLowerCase().replace(/ /g, '-')
      await prisma.$executeRaw`
        INSERT INTO "Industry" (id, name, icon, "displayOrder")
        VALUES (${id}, ${ind.name}, ${ind.icon}, ${ind.displayOrder})
        ON CONFLICT DO NOTHING
      `
    }

    const result = await prisma.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(*) as count FROM "Industry"
    `

    return NextResponse.json({
      success: true,
      message: 'Industry table created and seeded!',
      count: Number(result[0]?.count || 0)
    })
  } catch (error) {
    console.error('Industry init error:', error)
    return NextResponse.json({ error: 'Failed to setup' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  return POST(request)
}

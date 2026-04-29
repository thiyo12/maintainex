'use server'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST() {
  try {
    console.log('Creating Industry table...')
    
    // Use Prisma's executeRaw to create table directly
    await prisma.$executeRawUnsafe(`
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
    `)

    console.log('Table created! Seeding industries...')

    // Seed default industries
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
      await prisma.$executeRawUnsafe(
        `INSERT INTO "Industry" (id, name, icon, "displayOrder") VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING`,
        id, ind.name, ind.icon, ind.displayOrder
      )
    }

    const result = await prisma.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(*) as count FROM "Industry"
    `

    console.log('Success! Industries:', result)

    return NextResponse.json({ 
      success: true, 
      message: 'Industry table created and seeded!',
      count: Number(result[0]?.count || 0)
    })
  } catch (error) {
    console.error('Setup error:', error)
    return NextResponse.json({ 
      error: 'Failed to setup',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// Also allow GET for easy testing
export async function GET() {
  return POST()
}
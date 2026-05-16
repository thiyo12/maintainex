'use server'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth-utils'

export async function POST(request: NextRequest) {
  try {
    const session = await getSession(request)
    if (!session || session.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { action } = body

    if (action === 'setup') {
      // Check if table exists by trying to count
      try {
        const existingCount = await prisma.industry.count()
        return NextResponse.json({ 
          message: 'Industry table already exists',
          count: existingCount 
        })
      } catch (tableError) {
        // Table doesn't exist - try to create it
        // Note: Prisma db push is needed to create table
        return NextResponse.json({ 
          error: 'Database table not found. Please run "npx prisma db push" on your server.',
          details: 'Table needs to be created via Prisma migration'
        }, { status: 500 })
      }
    }

    if (action === 'seed') {
      // Seed default industries
      const defaultIndustries = [
        { name: 'Shopping Malls', icon: '🏬', displayOrder: 1 },
        { name: 'Schools', icon: '🏫', displayOrder: 2 },
        { name: 'Real Estate', icon: '🏠', displayOrder: 3 },
        { name: 'Hospitals', icon: '🏥', displayOrder: 4 },
        { name: 'Industrial', icon: '🏭', displayOrder: 5 },
        { name: 'Education Centres', icon: '📚', displayOrder: 6 },
        { name: 'Office Complex', icon: '🏢', displayOrder: 7 },
        { name: 'MX Cleaning Solution', icon: '🤝', displayOrder: 0, isPartner: true, partnerName: 'MX Cleaning Solution' },
      ]

      for (const industry of defaultIndustries) {
        await prisma.industry.upsert({
          where: { id: industry.name.toLowerCase().replace(/ /g, '-') },
          create: industry,
          update: industry,
        })
      }

      const industries = await prisma.industry.findMany({
        orderBy: { displayOrder: 'asc' }
      })

      return NextResponse.json({ 
        message: 'Industries seeded successfully',
        count: industries.length,
        industries 
      })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })

  } catch (error) {
    console.error('Error in setup:', error)
    return NextResponse.json({ 
      error: 'Setup failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
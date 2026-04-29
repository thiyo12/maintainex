'use server'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    console.log('Attempting to fetch industries...')
    
    const industries = await prisma.industry.findMany({
      orderBy: { displayOrder: 'asc' }
    })

    console.log('Found industries:', industries.length)
    return NextResponse.json(industries)
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({ 
      error: 'Error fetching',
      details: error instanceof Error ? error.message : String(error) 
    }, { status: 500 })
  }
}

// Make it work without auth
export const dynamic = 'force-dynamic'
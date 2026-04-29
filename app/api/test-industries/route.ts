import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    console.log('=== Testing IndustriesTable ===')
    
    // Try simple query first
    const test = await prisma.$queryRaw`SELECT 1 as test`
    console.log('Database connection OK:', test)
    
    // Try to query industries table
    try {
      const industries = await prisma.industry.findMany({
        orderBy: { displayOrder: 'asc' }
      })
      console.log('Industries working! Count:', industries.length)
      return NextResponse.json(industries)
    } catch (indErr) {
      console.log('Industry table error:', indErr)
      return NextResponse.json({ 
        message: 'Table not found - need to create it',
        error: indErr instanceof Error ? indErr.message : String(indErr)
      }, { status: 200 })
    }
  } catch (error) {
    console.error('DB Error:', error)
    return NextResponse.json({ 
      error: 'Database error',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}
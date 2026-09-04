import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateRequest } from '@/lib/mobile-auth'
import { seedJobCategories } from '@/lib/v2-job-categories'

export async function POST(_request: NextRequest) {
  try {
    const user = await authenticateRequest(_request)
    if (!user || !['SUPER_ADMIN', 'MANAGER', 'FINANCE'].includes(user.role)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const result = await seedJobCategories(prisma)

    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    console.error('Seed categories error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

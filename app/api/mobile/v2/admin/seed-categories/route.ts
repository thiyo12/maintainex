import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { guardCrmRequest } from '@/lib/crm/security'
import { seedJobCategories } from '@/lib/v2-job-categories'

export async function POST(request: NextRequest) {
  try {
    const guard = await guardCrmRequest(request, {
      permission: 'settings:edit',
      allowedRoles: ['SUPER_ADMIN'],
      level: 'sensitive',
    })
    if (!guard.ok) return guard.response

    const result = await seedJobCategories(prisma)
    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    console.error('Seed categories error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

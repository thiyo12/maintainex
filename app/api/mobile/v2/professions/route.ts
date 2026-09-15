import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET: List all active professions with their skills (public, no auth)
export async function GET(request: NextRequest) {
  try {
    const professions = await prisma.profession.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      include: {
        skills: {
          where: { isActive: true },
          orderBy: { sortOrder: 'asc' },
          select: { id: true, slug: true, i18nKey: true, description: true },
        },
      },
    })

    return NextResponse.json({ professions })
  } catch (error) {
    console.error('Professions list error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

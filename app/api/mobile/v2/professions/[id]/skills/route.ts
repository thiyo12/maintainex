import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET: List skills for a specific profession (public, no auth)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const profession = await prisma.profession.findUnique({
      where: { id },
      select: { id: true, slug: true, i18nKey: true, isActive: true },
    })
    if (!profession) {
      return NextResponse.json({ error: 'Profession not found' }, { status: 404 })
    }

    const skills = await prisma.professionSkill.findMany({
      where: { professionId: id, isActive: true },
      orderBy: { sortOrder: 'asc' },
      select: { id: true, slug: true, i18nKey: true, description: true },
    })

    return NextResponse.json({ profession, skills })
  } catch (error) {
    console.error('Profession skills error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

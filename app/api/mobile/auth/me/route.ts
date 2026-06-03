import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateRequest } from '@/lib/mobile-auth'

export async function GET(request: NextRequest) {
  try {
    const user = await authenticateRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const fullUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { id: true, email: true, name: true, phone: true, role: true, isActive: true, createdAt: true },
    })
    if (!fullUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    let needsOnboarding = false
    if (fullUser.role === 'TASKER') {
      const profile = await prisma.taskerProfile.findUnique({
        where: { userId: user.id },
        select: { skills: true },
      })
      needsOnboarding = !profile || profile.skills.length === 0
    } else if (fullUser.role === 'COMPANY') {
      const profile = await prisma.companyProfile.findUnique({
        where: { userId: user.id },
        select: { id: true },
      })
      needsOnboarding = !profile
    }

    return NextResponse.json({ user: fullUser, needsOnboarding })
  } catch (error) {
    console.error('Me error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

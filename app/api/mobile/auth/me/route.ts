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

    return NextResponse.json({ user: fullUser })
  } catch (error) {
    console.error('Me error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth-utils'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  const session = await getSession(request)

  if (!session) {
    return NextResponse.json({ user: null })
  }

  const user = await prisma.user.findUnique({
    where: { id: session.id },
    select: {
      id: true,
      email: true,
      name: true,
      phone: true,
      role: true,
      status: true,
      isActive: true,
      avatarUrl: true,
      emailVerified: true,
      createdAt: true,
      updatedAt: true,
    }
  })

  if (!user) {
    return NextResponse.json({ user: null })
  }

  // Fetch profile based on role
  let profile = null
  if (user.role === 'CUSTOMER') {
    profile = await prisma.customerProfile.findUnique({
      where: { userId: user.id },
    })
  } else if (user.role === 'TASKER') {
    profile = await prisma.taskerProfile.findUnique({
      where: { userId: user.id },
      include: {
        skills: {
          include: { category: true },
        }
      }
    })
  } else if (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN') {
    profile = await prisma.adminProfile.findUnique({
      where: { userId: user.id },
    })
  }

  return NextResponse.json({
    user,
    profile,
  })
}

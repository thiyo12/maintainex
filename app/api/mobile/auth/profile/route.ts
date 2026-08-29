import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateRequest, assertNotSuspended } from '@/lib/mobile-auth'

const NAME_CHANGE_DAYS = 30

export async function PUT(request: NextRequest) {
  try {
    const user = await authenticateRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const blocked = assertNotSuspended(user)
    if (blocked) return blocked

    const { name, phone, profileImage } = await request.json()

    if (name !== undefined && name !== user.name) {
      if (user.lastNameChangedAt) {
        const daysSinceChange = Math.floor(
          (Date.now() - new Date(user.lastNameChangedAt).getTime()) / (1000 * 60 * 60 * 24)
        )
        if (daysSinceChange < NAME_CHANGE_DAYS) {
          const availableAt = new Date(user.lastNameChangedAt)
          availableAt.setDate(availableAt.getDate() + NAME_CHANGE_DAYS)
          return NextResponse.json({
            error: `Name can only be changed every ${NAME_CHANGE_DAYS} days. Available on ${availableAt.toISOString().split('T')[0]}.`,
            availableAt: availableAt.toISOString(),
          }, { status: 429 })
        }
      }
    }

    const updateData: any = {}
    if (name !== undefined) updateData.name = name
    if (phone !== undefined) updateData.phone = phone
    if (profileImage !== undefined) updateData.profileImage = profileImage
    if (name !== undefined && name !== user.name) updateData.lastNameChangedAt = new Date()

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: updateData,
      select: {
        id: true, email: true, name: true, phone: true,
        role: true, isActive: true, createdAt: true, lastNameChangedAt: true,
      },
    })

    return NextResponse.json({
      user: {
        ...updated,
        createdAt: updated.createdAt.toISOString(),
        lastNameChangedAt: updated.lastNameChangedAt?.toISOString() || null,
      },
    })
  } catch (error) {
    console.error('Profile update error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

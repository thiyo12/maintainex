import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { createToken } from '@/lib/mobile-auth'

export async function POST(request: NextRequest) {
  try {
    const { email, password, name, phone, role } = await request.json()

    if (!email || !password || !name) {
      return NextResponse.json({ error: 'Email, password, and name required' }, { status: 400 })
    }

    if (password.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 })
    }

    const validRoles = ['CUSTOMER', 'TASKER', 'COMPANY']
    const userRole = validRoles.includes(role) ? role : 'CUSTOMER'

    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) {
      return NextResponse.json({ error: 'Email already registered' }, { status: 409 })
    }

    const passwordHash = await bcrypt.hash(password, 12)
    const user = await prisma.user.create({
      data: { email, passwordHash, name, phone, role: userRole },
    })

    if (userRole === 'TASKER') {
      await prisma.taskerProfile.create({
        data: { userId: user.id },
      })
    }

    const token = createToken({ id: user.id, email: user.email, role: user.role })

    return NextResponse.json({
      token,
      user: { id: user.id, email: user.email, name: user.name, phone: user.phone, role: user.role, isActive: user.isActive, createdAt: user.createdAt.toISOString() },
    })
  } catch (error) {
    console.error('Register error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

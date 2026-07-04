import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const email = body.email || 'admin@maintainex.com'
    const password = body.password || 'admin123'
    const role = body.role || 'SUPER_ADMIN'

    const existing = await prisma.adminUser.findUnique({ where: { email } })
    if (existing) {
      return NextResponse.json({ success: true, message: 'Admin already exists', data: { id: existing.id, email: existing.email, role: existing.role } })
    }

    const passwordHash = await bcrypt.hash(password, 12)

    const admin = await prisma.adminUser.create({
      data: {
        email,
        passwordHash,
        role,
        firstName: 'Super',
        lastName: 'Admin',
        isActive: true,
        assignedCountries: 'LK,CA',
      },
    })

    return NextResponse.json({
      success: true,
      message: 'Admin user created',
      data: { id: admin.id, email: admin.email, role: admin.role, password },
    })
  } catch (error: any) {
    console.error('Seed admin error:', error)
    return NextResponse.json({ error: error?.message || 'Failed to seed admin' }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createToken, hashPassword } from '@/lib/auth-utils'
import { registerSchema, taskerRegisterSchema } from '@/lib/validations'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    if (body.role === 'TASKER') {
      return registerTasker(body)
    }

    return registerCustomer(body)
  } catch (error) {
    console.error('Registration error:', error)
    return NextResponse.json(
      { error: 'Failed to create account' },
      { status: 500 }
    )
  }
}

async function registerCustomer(body: Record<string, unknown>) {
  const validation = registerSchema.safeParse(body)

  if (!validation.success) {
    return NextResponse.json(
      { error: validation.error.errors[0]?.message || 'Invalid input' },
      { status: 400 }
    )
  }

  const { email, name, phone, password } = validation.data

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    return NextResponse.json(
      { error: 'An account with this email already exists' },
      { status: 409 }
    )
  }

  const passwordHash = await hashPassword(password)

  const user = await prisma.user.create({
    data: {
      email,
      name,
      phone: phone || null,
      passwordHash,
      role: 'CUSTOMER',
      status: 'ACTIVE',
      isActive: true,
      emailVerified: false,
      customerProfile: {
        create: {
          customerType: 'REGULAR',
          status: 'ACTIVE',
        }
      }
    },
    include: {
      customerProfile: true,
    }
  })

  const token = createToken({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    isActive: user.isActive,
  })

  const response = NextResponse.json({
    success: true,
    data: {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        phone: user.phone,
        role: user.role,
      },
      profile: user.customerProfile,
    }
  })

  response.cookies.set('session', token, {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60,
    path: '/',
  })

  return response
}

async function registerTasker(body: Record<string, unknown>) {
  const validation = taskerRegisterSchema.safeParse(body)

  if (!validation.success) {
    return NextResponse.json(
      { error: validation.error.errors[0]?.message || 'Invalid input' },
      { status: 400 }
    )
  }

  const { email, name, phone, password, bio, hourlyRate, primaryDistrict, serviceRadius, categoryIds } = validation.data

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    return NextResponse.json(
      { error: 'An account with this email already exists' },
      { status: 409 }
    )
  }

  const passwordHash = await hashPassword(password)

  const user = await prisma.$transaction(async (tx) => {
    const newUser = await tx.user.create({
      data: {
        email,
        name,
        phone,
        passwordHash,
        role: 'TASKER',
        status: 'PENDING_VERIFICATION',
        isActive: true,
        emailVerified: false,
        taskerProfile: {
          create: {
            bio: bio || null,
            hourlyRate,
            primaryDistrict,
            serviceRadius,
            isAvailable: false,
            skills: {
              create: categoryIds.map((categoryId: string) => ({
                categoryId,
                experienceLevel: 'intermediate',
                certified: false,
                hourlyRate: hourlyRate,
              }))
            }
          }
        }
      },
      include: {
        taskerProfile: {
          include: {
            skills: true,
          }
        }
      }
    })
    return newUser
  })

  const response = NextResponse.json({
    success: true,
    data: {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        phone: user.phone,
        role: user.role,
      },
      profile: user.taskerProfile,
    },
    message: 'Account created! Your profile is pending verification by our team.',
  })

  return response
}

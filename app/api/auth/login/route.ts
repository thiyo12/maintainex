import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyPassword, createToken, hashPassword } from '@/lib/auth-utils'
import { loginSchema } from '@/lib/validations'

const BRUTE_LIMIT = 5
const BRUTE_WINDOW = 15 * 60 * 1000

async function checkBruteForce(email: string, ip: string): Promise<boolean> {
  const since = new Date(Date.now() - BRUTE_WINDOW)
  const [emailAttempts, ipAttempts] = await Promise.all([
    prisma.failedLogin.count({
      where: { email, createdAt: { gte: since } }
    }),
    prisma.failedLogin.count({
      where: { ipAddress: ip, createdAt: { gte: since } }
    })
  ])
  return emailAttempts < BRUTE_LIMIT && ipAttempts < BRUTE_LIMIT
}

async function recordFailedAttempt(email: string, ip: string): Promise<void> {
  await prisma.failedLogin.create({
    data: { email, ipAddress: ip }
  })
}

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || request.headers.get('x-real-ip') || 'unknown'
    const body = await request.json()
    const validation = loginSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0]?.message || 'Invalid input' },
        { status: 400 }
      )
    }

    const { email, password } = validation.data

    const allowed = await checkBruteForce(email, ip)
    if (!allowed) {
      return NextResponse.json({ error: 'Too many attempts. Try again later.' }, { status: 429 })
    }

    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        customerProfile: true,
      }
    })

    if (!user) {
      await recordFailedAttempt(email, ip)
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }

    if (!user.isActive) {
      await recordFailedAttempt(email, ip)
      return NextResponse.json({ error: 'Account is deactivated' }, { status: 401 })
    }

    const isValid = await verifyPassword(password, user.passwordHash)
    if (!isValid) {
      await recordFailedAttempt(email, ip)
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }



    await prisma.failedLogin.deleteMany({
      where: { email }
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
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        phone: user.phone,
        role: user.role,
      },
      profile: user.role === 'CUSTOMER' ? user.customerProfile : null,
    })

    response.cookies.set('session', token, {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60,
      path: '/',
    })

    return response
  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json(
      { error: 'Failed to login' },
      { status: 500 }
    )
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

const JWT_SECRET = process.env.NEXTAUTH_SECRET || 'fallback-secret-key-change-in-production'

function createSimpleToken(data: any): string {
  const payload = {
    ...data,
    created: Date.now()
  }
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64')
  const signature = Buffer.from(JWT_SECRET + encoded).toString('base64').slice(0, 32)
  return `${encoded}.${signature}`
}

function verifySimpleToken(token: string): any {
  try {
    const [encoded, signature] = token.split('.')
    if (!encoded || !signature) return null
    
    const expectedSig = Buffer.from(JWT_SECRET + encoded).toString('base64').slice(0, 32)
    if (signature !== expectedSig) return null
    
    const payload = JSON.parse(Buffer.from(encoded, 'base64').toString())
    
    const maxAge = 30 * 24 * 60 * 60 * 1000
    if (Date.now() - payload.created > maxAge) return null
    
    return payload
  } catch {
    return null
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, password } = body

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password required' }, { status: 400 })
    }

    const admin = await prisma.admin.findUnique({
      where: { email }
    })

    if (!admin) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }

    if (!admin.isActive) {
      return NextResponse.json({ error: 'Account deactivated' }, { status: 401 })
    }

    const isValid = await bcrypt.compare(password, admin.password)

    if (!isValid) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }

    const token = createSimpleToken({
      id: admin.id,
      email: admin.email,
      role: admin.role,
      branchId: admin.branchId,
      name: admin.name,
      canEditServices: admin.canEditServices
    })
    
    console.log('Login successful for:', admin.email, 'role:', admin.role, 'canEditServices:', admin.canEditServices)

    const response = NextResponse.json({
      success: true,
      user: {
        id: admin.id,
        email: admin.email,
        name: admin.name,
        role: admin.role,
        branchId: admin.branchId,
        canEditServices: admin.canEditServices
      }
    })

    const isProduction = process.env.NODE_ENV === 'production'
    const isHttpUrl = process.env.NEXTAUTH_URL?.startsWith('http://')

    response.cookies.set('admin_token', token, {
      httpOnly: true,
      secure: isProduction && !isHttpUrl,
      sameSite: 'lax',
      path: '/',
      maxAge: 30 * 24 * 60 * 60
    })

    return response
  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

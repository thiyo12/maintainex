import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { cookies } from 'next/headers'

const JWT_SECRET = process.env.NEXTAUTH_SECRET || 'fallback-secret-key'

async function createToken(payload: any): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(JSON.stringify(payload))
  const key = encoder.encode(JWT_SECRET)
  
  const hashBuffer = await crypto.subtle.digest('SHA-256', key)
  const signature = Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
  
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const body = btoa(JSON.stringify(payload))
  
  return `${header}.${body}.${signature}`
}

async function verifyToken(token: string): Promise<any> {
  try {
    const [header, body, signature] = token.split('.')
    const encoder = new TextEncoder()
    const key = encoder.encode(JWT_SECRET)
    
    const hashBuffer = await crypto.subtle.digest('SHA-256', key)
    const expectedSignature = Array.from(new Uint8Array(hashBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
    
    if (signature !== expectedSignature) {
      return null
    }
    
    return JSON.parse(atob(body))
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

    const token = await createToken({
      id: admin.id,
      email: admin.email,
      role: admin.role,
      branchId: admin.branchId,
      exp: Date.now() + 30 * 24 * 60 * 60 * 1000
    })

    const response = NextResponse.json({
      success: true,
      user: {
        id: admin.id,
        email: admin.email,
        name: admin.name,
        role: admin.role,
        branchId: admin.branchId
      }
    })

    response.cookies.set('admin_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
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

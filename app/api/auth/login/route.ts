import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { logActivity } from '@/lib/activity-log'

const loginAttempts = new Map<string, { count: number; lastAttempt: number }>()
const MAX_ATTEMPTS = 5
const LOCKOUT_TIME = 15 * 60 * 1000
const CLEANUP_INTERVAL = 60 * 60 * 1000

function cleanupOldEntries() {
  const now = Date.now()
  const entries = Array.from(loginAttempts.entries())
  for (const [ip, record] of entries) {
    if (now - record.lastAttempt > LOCKOUT_TIME * 2) {
      loginAttempts.delete(ip)
    }
  }
}

if (typeof window === 'undefined') {
  setInterval(cleanupOldEntries, CLEANUP_INTERVAL)
}

function checkLoginAttempts(ip: string): { allowed: boolean; remainingAttempts: number } {
  const now = Date.now()
  const record = loginAttempts.get(ip)
  
  if (!record) {
    return { allowed: true, remainingAttempts: MAX_ATTEMPTS }
  }
  
  if (now - record.lastAttempt > LOCKOUT_TIME) {
    loginAttempts.delete(ip)
    return { allowed: true, remainingAttempts: MAX_ATTEMPTS }
  }
  
  if (record.count >= MAX_ATTEMPTS) {
    return { allowed: false, remainingAttempts: 0 }
  }
  
  return { allowed: true, remainingAttempts: MAX_ATTEMPTS - record.count }
}

function recordFailedAttempt(ip: string) {
  const now = Date.now()
  const record = loginAttempts.get(ip)
  
  if (!record) {
    loginAttempts.set(ip, { count: 1, lastAttempt: now })
  } else {
    record.count++
    record.lastAttempt = now
  }
}

function recordSuccessfulAttempt(ip: string) {
  loginAttempts.delete(ip)
}

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
    
    const { allowed, remainingAttempts } = checkLoginAttempts(ip)
    
    if (!allowed) {
      return NextResponse.json({ 
        error: 'Too many login attempts. Please try again after 15 minutes.',
        remainingAttempts: 0
      }, { status: 429 })
    }

    let email: string, password: string
    try {
      const body = await request.json()
      email = body.email
      password = body.password
    } catch {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password required' }, { status: 400 })
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 })
    }

    const admin = await prisma.admin.findUnique({
      where: { email }
    })

    if (!admin) {
      recordFailedAttempt(ip)
      return NextResponse.json({ 
        error: 'Invalid credentials',
        remainingAttempts: remainingAttempts - 1
      }, { status: 401 })
    }

    const isValid = await bcrypt.compare(password, admin.password)

    if (!isValid) {
      recordFailedAttempt(ip)
      return NextResponse.json({ 
        error: 'Invalid credentials',
        remainingAttempts: remainingAttempts - 1
      }, { status: 401 })
    }

    if (!admin.isActive) {
      return NextResponse.json({ error: 'Account is disabled' }, { status: 403 })
    }

    recordSuccessfulAttempt(ip)

    await logActivity({
      adminId: admin.id,
      adminEmail: admin.email,
      adminName: admin.name,
      action: 'LOGIN',
      entityType: 'AUTH',
      description: `Admin logged in`,
      details: { ip }
    })

    return NextResponse.json({ 
      success: true,
      admin: {
        id: admin.id,
        email: admin.email,
        name: admin.name
      }
    })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

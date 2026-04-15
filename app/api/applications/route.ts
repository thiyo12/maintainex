import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth-utils'

function sanitizeString(str: string): string {
  return str.replace(/<[^>]*>/g, '').trim()
}

function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email) && email.length <= 255
}

function isValidPhone(phone: string): boolean {
  const cleaned = phone.replace(/\D/g, '')
  return cleaned.length >= 10 && cleaned.length <= 15
}

export async function GET(request: NextRequest) {
  try {
    const session = await getSession(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const branchId = searchParams.get('branchId')

    const isSuper = session.role === 'SUPER_ADMIN'
    const userBranchId = session.branchId

    const where: any = {}
    if (status) where.status = status

    if (!isSuper && userBranchId) {
      where.branchId = userBranchId
    } else if (branchId && isSuper) {
      where.branchId = branchId
    }

    const applications = await prisma.application.findMany({
      where,
      orderBy: { createdAt: 'desc' }
    })

    return NextResponse.json(applications)
  } catch {
    return NextResponse.json({ error: 'Failed to fetch applications' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    let { name, phone, email, service, experience, branchId } = body

    if (!name || !phone || !email || !service || !experience) {
      return NextResponse.json({ error: 'Please fill in all required fields' }, { status: 400 })
    }

    name = sanitizeString(name)
    phone = sanitizeString(phone)
    email = sanitizeString(email)
    service = sanitizeString(service)
    experience = sanitizeString(experience)

    if (name.length < 2 || name.length > 100) {
      return NextResponse.json({ error: 'Name must be between 2 and 100 characters' }, { status: 400 })
    }

    if (!isValidPhone(phone)) {
      return NextResponse.json({ error: 'Please enter a valid phone number' }, { status: 400 })
    }

    if (!isValidEmail(email)) {
      return NextResponse.json({ error: 'Please enter a valid email address' }, { status: 400 })
    }

    if (experience.length < 10) {
      return NextResponse.json({ error: 'Please describe your experience in at least 10 characters' }, { status: 400 })
    }

    if (!branchId) {
      const branches = await prisma.branch.findMany({
        where: { isActive: true },
        take: 1
      })
      branchId = branches[0]?.id || null
    }

    const application = await prisma.application.create({
      data: {
        name,
        phone,
        email,
        service,
        experience,
        branchId,
        resumeUrl: body.resumeUrl || null,
      }
    })

    return NextResponse.json(application, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Failed to submit application' }, { status: 500 })
  }
}

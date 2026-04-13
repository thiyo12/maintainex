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
    const district = searchParams.get('district')

    const isSuper = session.role === 'SUPER_ADMIN'
    const userBranchId = session.branchId

    const where: any = {}
    if (status) where.status = status
    if (district) where.district = district

    if (!isSuper && userBranchId) {
      where.branchId = userBranchId
    } else if (branchId && isSuper) {
      where.branchId = branchId
    }

    const applications = await prisma.application.findMany({
      where,
      include: {
        branch: {
          select: {
            id: true,
            name: true,
            location: true
          }
        }
      },
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
    
    let { name, phone, email, district, address, position, experience } = body

    if (!name || !phone || !email || !district || !address || !position || !experience) {
      return NextResponse.json({ error: 'Please fill in all required fields' }, { status: 400 })
    }

    name = sanitizeString(name)
    phone = sanitizeString(phone)
    email = sanitizeString(email)
    district = sanitizeString(district)
    address = sanitizeString(address)
    position = sanitizeString(position)
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

    if (address.length < 5) {
      return NextResponse.json({ error: 'Please enter a complete address' }, { status: 400 })
    }

    if (experience.length < 10) {
      return NextResponse.json({ error: 'Please describe your experience in at least 10 characters' }, { status: 400 })
    }

    const branches = await prisma.branch.findMany({
      where: { isActive: true }
    })

    let branchId = null
    for (const branch of branches) {
      try {
        const branchDistricts: string[] = JSON.parse(branch.districts || '[]')
        if (Array.isArray(branchDistricts) && branchDistricts.includes(district)) {
          branchId = branch.id
          break
        }
      } catch {
        continue
      }
    }

    const application = await prisma.application.create({
      data: {
        name,
        phone,
        email,
        district,
        address,
        position,
        experience,
        branchId,
        cvUrl: body.cvUrl || null,
      }
    })

    return NextResponse.json(application, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Failed to submit application' }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions, isSuperAdmin } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const serviceId = searchParams.get('serviceId')
    const branchId = searchParams.get('branchId')
    const district = searchParams.get('district')

    const user = session?.user as any
    const isSuper = isSuperAdmin(session)
    const userBranchId = user?.branchId

    const where: any = {}
    if (status) where.status = status
    if (serviceId) where.serviceId = serviceId
    if (district) where.district = district

    if (!isSuper && userBranchId) {
      where.branchId = userBranchId
    } else if (branchId && isSuper) {
      where.branchId = branchId
    }

    const bookings = await prisma.booking.findMany({
      where,
      include: {
        service: {
          include: {
            category: true
          }
        },
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

    return NextResponse.json(bookings)
  } catch {
    return NextResponse.json({ error: 'Failed to fetch bookings' }, { status: 500 })
  }
}

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

function isValidName(name: string): boolean {
  const englishOnly = /^[a-zA-Z\s]+$/
  return englishOnly.test(name) && name.length >= 2 && name.length <= 100
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    let { name, phone, email, district, address, subService, date, time, notes } = body

    if (!name || !phone || !email || !district || !address || !date || !time) {
      return NextResponse.json({ error: 'Please fill in all required fields: Name, Phone, Email, District, Address, Date, and Time' }, { status: 400 })
    }

    name = sanitizeString(name)
    phone = sanitizeString(phone)
    email = sanitizeString(email)
    district = sanitizeString(district)
    address = sanitizeString(address)

    if (!isValidName(name)) {
      return NextResponse.json({ error: 'Please enter a valid name (English letters only, 2-100 characters)' }, { status: 400 })
    }

    if (!isValidPhone(phone)) {
      return NextResponse.json({ error: 'Please enter a valid phone number (10-15 digits)' }, { status: 400 })
    }

    if (!isValidEmail(email)) {
      return NextResponse.json({ error: 'Please enter a valid email address' }, { status: 400 })
    }

    if (address.length < 5) {
      return NextResponse.json({ error: 'Please enter a complete address' }, { status: 400 })
    }

    let serviceId = body.serviceId
    if (!serviceId || serviceId === '1' || serviceId === '2') {
      const generalService = await prisma.service.findFirst({
        where: { title: 'Deep Cleaning' }
      })
      serviceId = generalService?.id || null
    }

    const branches = await prisma.branch.findMany({
      where: { isActive: true }
    })

    let branchId = null
    for (const branch of branches) {
      try {
        const districts: string[] = JSON.parse(branch.districts || '[]')
        if (Array.isArray(districts) && districts.includes(district)) {
          branchId = branch.id
          break
        }
      } catch {
        continue
      }
    }

    const booking = await prisma.booking.create({
      data: {
        name,
        phone,
        email,
        district,
        address,
        serviceId,
        branchId,
        subService: subService || null,
        date: new Date(date),
        time,
        notes: notes ? sanitizeString(notes) : null,
        status: 'PENDING'
      }
    })

    return NextResponse.json({ 
      success: true, 
      message: 'Booking submitted successfully! We will contact you shortly.',
      booking 
    }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Failed to submit booking. Please try again or contact us via WhatsApp.' }, { status: 500 })
  }
}

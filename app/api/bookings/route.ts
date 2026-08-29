import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth-utils'
import { getProvinceFromDistrict } from '@/lib/provinces'

export async function GET(request: NextRequest) {
  try {
    const session = await getSession(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const serviceId = searchParams.get('serviceId')
    const branchId = searchParams.get('branchId')
    const district = searchParams.get('district')

    const isSuper = session.role === 'SUPER_ADMIN'
    const userBranchId = session.branchId
    const userRegion = session.region

    const where: any = serviceId ? { serviceId } : {}
    if (status) where.status = status

    if (userRegion && !isSuper) {
      where.region = userRegion
    }

    if (!isSuper && userBranchId) {
      where.branchId = userBranchId
    } else if (branchId && isSuper) {
      where.branchId = branchId
    }

    // Handle NULL serviceId - fetch all bookings and handle null service gracefully
    const bookingsRaw = await prisma.booking.findMany({
      where,
      orderBy: { createdAt: 'desc' }
    })
    
    // Map bookings to include service and branch only if they exist
    const bookings = await Promise.all(bookingsRaw.map(async (booking: any) => {
      let service = null
      let branch = null
      
      if (booking.serviceId) {
        service = await prisma.service.findUnique({
          where: { id: booking.serviceId },
          include: { category: true }
        })
      }
      
      if (booking.branchId) {
        branch = await prisma.branch.findUnique({
          where: { id: booking.branchId },
          select: { id: true, name: true, location: true, province: true }
        })
      }
      
      return { ...booking, budgetMin: booking.budgetMin, budgetMax: booking.budgetMax, service, branch }
    }))

    return NextResponse.json(bookings)
  } catch (error) {
    console.error('Bookings fetch error:', error)
    return NextResponse.json({ error: 'Failed to fetch bookings', details: String(error) }, { status: 500 })
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
  return cleaned.length >= 9 && cleaned.length <= 15
}

function isValidName(name: string): boolean {
  return name.length >= 2 && name.length <= 100
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    
    let { name, phone, email, district, address, subService, date, time, notes, budgetMin, budgetMax } = body

    if (!name || !phone || !district || !date || !time) {
      return NextResponse.json({ error: 'Please fill in all required fields: Name, Phone, District, Date, and Time' }, { status: 400 })
    }

    name = sanitizeString(name)
    phone = sanitizeString(phone)
    email = email ? sanitizeString(email) : ''
    district = sanitizeString(district)
    address = address ? sanitizeString(address) : ''

    if (!isValidName(name)) {
      return NextResponse.json({ error: 'Please enter your name (2-100 characters)' }, { status: 400 })
    }

    if (!isValidPhone(phone)) {
      return NextResponse.json({ error: 'Please enter a valid phone number (9-15 digits)' }, { status: 400 })
    }

    if (email && !isValidEmail(email)) {
      return NextResponse.json({ error: 'Please enter a valid email address' }, { status: 400 })
    }

    // Address is optional
    address = address || ''

    // Determine region from cookie
    const region = request.cookies.get('region')?.value || 'LK'

    // Calculate province from district (LK only; CA uses default)
    let province: string | null = null
    if (region === 'CA') {
      province = 'Ontario'
    } else {
      province = getProvinceFromDistrict(district)
      if (!province) {
        return NextResponse.json({ error: 'Invalid district. Please select a valid district.' }, { status: 400 })
      }
    }

    let serviceId = body.serviceId
    if (!serviceId || serviceId === '1' || serviceId === '2') {
      const generalService = await prisma.service.findFirst({
        where: { name: 'Deep Cleaning' }
      })
      serviceId = generalService?.id || null
    }

    // Find branch by province (region-aware)
    let branchId = body.branchId
    if (!branchId && province) {
      const branch = await prisma.branch.findFirst({
        where: { province, region, isActive: true }
      })
      branchId = branch?.id || null
    }
    // Fallback: if no branch found by province, use first active branch in same region
    if (!branchId) {
      const anyBranch = await prisma.branch.findFirst({
        where: { region, isActive: true }
      })
      branchId = anyBranch?.id || null
    }

    let user = await prisma.user.findUnique({ where: { email: session.email } })
    
    if (!user) {
      return NextResponse.json({ error: 'User account not found' }, { status: 400 })
    }

    if (!serviceId || !branchId) {
      return NextResponse.json({ error: 'Service and branch are required' }, { status: 400 })
    }

    const service = await prisma.service.findUnique({ where: { id: serviceId } })
    
    const booking = await prisma.booking.create({
      data: {
        userId: user.id,
        serviceId,
        branchId,
        date: new Date(date),
        timeSlot: time,
        notes: notes ? sanitizeString(notes) : null,
        totalPrice: service?.price || 0,
        budgetMin: budgetMin ? parseFloat(budgetMin) : null,
        budgetMax: budgetMax ? parseFloat(budgetMax) : null,
        status: 'PENDING',
        name,
        phone,
        email,
        district,
        province,
        region,
        address,
        time
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

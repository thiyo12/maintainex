import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth-utils'
import { getProvinceFromDistrict } from '@/lib/provinces'
import bcrypt from 'bcryptjs'

export async function GET(request: NextRequest) {
  try {
    const session = await getSession(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    console.log('Bookings API called by:', session.email, 'role:', session.role)
    
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const serviceId = searchParams.get('serviceId')
    const branchId = searchParams.get('branchId')
    const district = searchParams.get('district')

    const isSuper = session.role === 'SUPER_ADMIN'
    const userBranchId = session.branchId

    const where: any = serviceId ? { serviceId } : {}
    if (status) where.status = status

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
      
      return { ...booking, service, branch }
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
  return cleaned.length >= 10 && cleaned.length <= 15
}

function isValidName(name: string): boolean {
  return name.length >= 2 && name.length <= 100
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    let { name, phone, email, district, address, subService, date, time, notes } = body

    if (!name || !phone || !email || !district || !date || !time) {
      return NextResponse.json({ error: 'Please fill in all required fields: Name, Phone, Email, District, Date, and Time' }, { status: 400 })
    }

    name = sanitizeString(name)
    phone = sanitizeString(phone)
    email = sanitizeString(email)
    district = sanitizeString(district)
    address = sanitizeString(address)

    if (!isValidName(name)) {
      return NextResponse.json({ error: 'Please enter your name (2-100 characters)' }, { status: 400 })
    }

    if (!isValidPhone(phone)) {
      return NextResponse.json({ error: 'Please enter a valid phone number (10-15 digits)' }, { status: 400 })
    }

    if (!isValidEmail(email)) {
      return NextResponse.json({ error: 'Please enter a valid email address' }, { status: 400 })
    }

    // Address is optional
    address = address || ''

    // Calculate province from district
    const province = getProvinceFromDistrict(district)

    if (!province) {
      return NextResponse.json({ error: 'Invalid district. Please select a valid district from Sri Lanka.' }, { status: 400 })
    }

    let serviceId = body.serviceId
    if (!serviceId || serviceId === '1' || serviceId === '2') {
      const generalService = await prisma.service.findFirst({
        where: { name: 'Deep Cleaning' }
      })
      serviceId = generalService?.id || null
    }

    // Find branch by province
    let branchId = body.branchId
    if (!branchId) {
      const branch = await prisma.branch.findFirst({
        where: { province, isActive: true }
      })
      branchId = branch?.id || null
    }

    let user = await prisma.user.findUnique({ where: { email } })
    
    if (!user) {
      const hashedPassword = await bcrypt.hash('temp-password-123', 10)
      user = await prisma.user.create({
        data: {
          email,
          name,
          phone,
          passwordHash: hashedPassword,
          role: 'CUSTOMER'
        }
      })
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
        status: 'PENDING',
        name,
        phone,
        email,
        district,
        province,
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

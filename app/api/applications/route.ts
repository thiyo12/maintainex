import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { guardCrmRequest } from '@/lib/crm/security'
import { resolveReportBranchScope } from '@/lib/reports/branch-scope'
import { getProvinceFromDistrict } from '@/lib/provinces'

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
    const guard = await guardCrmRequest(request, {
      permission: 'users:view',
      level: 'read',
      requireCountryScope: true,
    })
    if (!guard.ok) return guard.response

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const requestedBranchId = searchParams.get('branchId')

    const scopeResult = await resolveReportBranchScope(guard.context, requestedBranchId)
    if (!scopeResult.ok) {
      return NextResponse.json({ error: scopeResult.error }, { status: scopeResult.status })
    }

    const where: any = {}
    if (status) where.status = status
    if (scopeResult.scope.branchIds !== null) {
      where.branchId = { in: scopeResult.scope.branchIds }
    }

    const applications = await prisma.application.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(applications)
  } catch {
    return NextResponse.json({ error: 'Failed to fetch applications' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    let { 
      name, 
      phone, 
      email, 
      position, 
      service, 
      district, 
      address,
      experience,
      cvUrl,
      resumeUrl 
    } = body

    // Support both 'position' (from careers form) and 'service' (legacy)
    const appliedPosition = position || service

    if (!name || !phone || !email || !appliedPosition || !district) {
      return NextResponse.json({ error: 'Please fill in all required fields' }, { status: 400 })
    }

    name = sanitizeString(name)
    phone = sanitizeString(phone)
    email = sanitizeString(email)
    position = sanitizeString(position || '')
    service = sanitizeString(service || '')
    experience = sanitizeString(experience || '')
    district = sanitizeString(district)
    address = sanitizeString(address || '')
    cvUrl = sanitizeString(cvUrl || '')
    resumeUrl = sanitizeString(resumeUrl || '')

    if (name.length < 2 || name.length > 100) {
      return NextResponse.json({ error: 'Name must be between 2 and 100 characters' }, { status: 400 })
    }

    if (!isValidPhone(phone)) {
      return NextResponse.json({ error: 'Please enter a valid phone number' }, { status: 400 })
    }

    if (!isValidEmail(email)) {
      return NextResponse.json({ error: 'Please enter a valid email address' }, { status: 400 })
    }

    // Auto-calculate province from district
    const province = getProvinceFromDistrict(district)

    // Find branch for this province
    const branch = await prisma.branch.findFirst({
      where: { province, isActive: true }
    })

    const branchId = branch?.id || null

    const application = await prisma.application.create({
      data: {
        name,
        phone,
        email,
        position: appliedPosition,
        service: appliedPosition, // Store position as service for backward compatibility
        experience,
        district,
        province,
        address,
        cvUrl: cvUrl || resumeUrl || null, // Support both cvUrl and resumeUrl
        resumeUrl: resumeUrl || cvUrl || null,
        branchId,
      }
    })

    return NextResponse.json(application, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Failed to submit application' }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { applicationSchema } from '@/lib/validations'
import { getServerSession } from 'next-auth'
import { authOptions, isSuperAdmin } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const branchId = searchParams.get('branchId')
    const district = searchParams.get('district')

    const user = session?.user as any
    const isSuper = isSuperAdmin(session)
    const userBranchId = user?.branchId

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
  } catch (error) {
    console.error('Error fetching applications:', error)
    return NextResponse.json({ error: 'Failed to fetch applications' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    const { name, phone, email, district, address, position, experience } = body

    if (!name || !phone || !email || !district || !address || !position || !experience) {
      return NextResponse.json({ error: 'Please fill in all required fields' }, { status: 400 })
    }

    const branches = await prisma.branch.findMany({
      where: { isActive: true }
    })

    let branchId = null
    for (const branch of branches) {
      const districts: string[] = JSON.parse(branch.districts || '[]')
      if (districts.includes(district)) {
        branchId = branch.id
        break
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
  } catch (error: any) {
    console.error('Error creating application:', error)
    return NextResponse.json({ error: 'Failed to submit application' }, { status: 500 })
  }
}

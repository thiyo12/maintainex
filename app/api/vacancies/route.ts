import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth-utils'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const isActive = searchParams.get('isActive')
    const branchId = searchParams.get('branchId')

    let where: any = {}
    if (isActive === 'true') where.isActive = true
    if (branchId) where.branchId = branchId

    const vacancies = await prisma.jobVacancy.findMany({
      where,
      orderBy: { createdAt: 'desc' }
    })

    return NextResponse.json(vacancies)
  } catch (error) {
    console.error('Vacancies GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch vacancies' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const isSuper = session.role === 'SUPER_ADMIN'
    const canManage = session.role === 'SUPER_ADMIN' || session.role === 'ADMIN'

    if (!canManage) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 })
    }

    const body = await request.json()
    const { title, description, location, isActive, branchId } = body

    if (!title || title.trim().length < 2) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 })
    }

    // Determine branchId
    let vacancyBranchId = branchId
    if (!isSuper && session.branchId) {
      vacancyBranchId = session.branchId
    }

    const vacancy = await prisma.jobVacancy.create({
      data: {
        title,
        description,
        location,
        isActive: isActive ?? true,
        branchId: vacancyBranchId
      }
    })

    return NextResponse.json(vacancy, { status: 201 })
  } catch (error) {
    console.error('Vacancies POST error:', error)
    return NextResponse.json({ error: 'Failed to create vacancy' }, { status: 500 })
  }
}
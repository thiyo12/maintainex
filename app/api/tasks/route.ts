import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth-utils'
import { taskSchema } from '@/lib/validations'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const status = searchParams.get('status')
    const category = searchParams.get('category')
    const district = searchParams.get('district')
    const province = searchParams.get('province')
    const minBudget = searchParams.get('minBudget')
    const maxBudget = searchParams.get('maxBudget')
    const urgency = searchParams.get('urgency')

    const where: Record<string, unknown> = {
      status: { not: 'DRAFT' },
    }

    if (status) where.status = status
    if (category) where.categoryId = category
    if (district) where.district = district
    if (province) where.province = province
    if (urgency) where.urgency = urgency
    if (minBudget) where.budget = { ...(where.budget as object), gte: parseFloat(minBudget) }
    if (maxBudget) where.budget = { ...(where.budget as object), lte: parseFloat(maxBudget) }

    const skip = (page - 1) * limit

    const [tasks, total] = await Promise.all([
      prisma.task.findMany({
        where,
        include: {
          category: true,
          customer: {
            include: { user: { select: { name: true, avatarUrl: true } } }
          },
          assignment: {
            include: {
              tasker: {
                include: { user: { select: { name: true, avatarUrl: true } } }
              }
            }
          },
          _count: {
            select: { applications: true }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.task.count({ where }),
    ])

    return NextResponse.json({
      success: true,
      data: tasks,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      }
    })
  } catch (error) {
    console.error('Tasks fetch error:', error)
    return NextResponse.json({ error: 'Failed to fetch tasks' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession(request)
    if (!session || session.role !== 'CUSTOMER') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const validation = taskSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0]?.message || 'Invalid input' },
        { status: 400 }
      )
    }

    const data = validation.data

    const customer = await prisma.customerProfile.findUnique({
      where: { userId: session.id },
    })

    if (!customer) {
      return NextResponse.json({ error: 'Customer profile not found' }, { status: 404 })
    }

    const { getProvinceFromDistrict } = await import('@/lib/provinces')
    const province = data.province || getProvinceFromDistrict(data.district) || ''

    const task = await prisma.task.create({
      data: {
        title: data.title,
        description: data.description,
        categoryId: data.categoryId || null,
        customerId: customer.id,
        budget: data.budget || null,
        budgetType: data.budgetType,
        urgency: data.urgency || null,
        district: data.district,
        province,
        address: data.address || null,
        isRemote: data.isRemote,
        startDate: data.startDate ? new Date(data.startDate) : null,
        endDate: data.endDate ? new Date(data.endDate) : null,
        isFlexibleDate: data.isFlexibleDate,
        preferredTime: data.preferredTime || null,
        images: data.images ? JSON.stringify(data.images) : null,
        status: 'PENDING_REVIEW',
      },
      include: {
        category: true,
        customer: true,
      }
    })

    return NextResponse.json({
      success: true,
      data: task,
      message: 'Task submitted! Our team will review it shortly.',
    }, { status: 201 })
  } catch (error) {
    console.error('Task creation error:', error)
    return NextResponse.json({ error: 'Failed to create task' }, { status: 500 })
  }
}

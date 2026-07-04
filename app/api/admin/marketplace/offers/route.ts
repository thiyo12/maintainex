import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth-utils'

export async function GET(request: NextRequest) {
  try {
    const session = await getSession(request)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const search = searchParams.get('search') || ''
    const skip = (page - 1) * limit

    const where: any = {}
    if (search) {
      where.OR = [
        { title: { contains: search } },
        { description: { contains: search } },
      ]
    }

    const [templates, total] = await Promise.all([
      prisma.offerTemplate.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.offerTemplate.count({ where }),
    ])

    return NextResponse.json({
      success: true,
      data: templates,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    })
  } catch (error) {
    console.error('Get offer templates error:', error)
    return NextResponse.json({ success: false, error: 'Failed' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession(request)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const { categoryId, title, description, priceLkr, scopeNotes, isRemote, availabilityLabel, isFeatured, photoUrl } = body

    if (!categoryId || !title || !priceLkr) {
      return NextResponse.json({ error: 'categoryId, title, priceLkr required' }, { status: 400 })
    }

    const template = await prisma.offerTemplate.create({
      data: {
        categoryId,
        title,
        description: description || '',
        priceLkr: parseInt(priceLkr),
        scopeNotes: scopeNotes || null,
        isRemote: isRemote || false,
        availabilityLabel: availabilityLabel || 'Today',
        isFeatured: isFeatured || false,
        photoUrl: photoUrl || null,
      },
    })

    return NextResponse.json({ success: true, data: template }, { status: 201 })
  } catch (error) {
    console.error('Create offer template error:', error)
    return NextResponse.json({ success: false, error: 'Failed' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await getSession(request)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const { id, ...updates } = body
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

    const template = await prisma.offerTemplate.update({
      where: { id },
      data: updates,
    })

    return NextResponse.json({ success: true, data: template })
  } catch (error) {
    console.error('Update offer template error:', error)
    return NextResponse.json({ success: false, error: 'Failed' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getSession(request)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

    await prisma.offerTemplate.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete offer template error:', error)
    return NextResponse.json({ success: false, error: 'Failed' }, { status: 500 })
  }
}

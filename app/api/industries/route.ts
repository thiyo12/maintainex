'use server'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth-utils'

export async function GET() {
  try {
    const industries = await prisma.industry.findMany({
      orderBy: { displayOrder: 'asc' }
    })
    return NextResponse.json(industries)
  } catch (error) {
    console.error('Error fetching industries:', error)
    return NextResponse.json({ error: 'Failed to fetch industries' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession(request)
    if (!session || session.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { name, icon, image, displayOrder, isPartner, partnerName } = body

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }

    const industry = await prisma.industry.create({
      data: {
        name,
        icon,
        image,
        displayOrder: displayOrder || 0,
        isPartner: isPartner || false,
        partnerName
      }
    })

    return NextResponse.json(industry)
  } catch (error) {
    console.error('Error creating industry:', error)
    return NextResponse.json({ error: 'Failed to create industry' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getSession(request)
    if (!session || session.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { id, name, icon, image, displayOrder, isPartner, partnerName, isActive } = body

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 })
    }

    const industry = await prisma.industry.update({
      where: { id },
      data: {
        name,
        icon,
        image,
        displayOrder,
        isPartner,
        partnerName,
        isActive
      }
    })

    return NextResponse.json(industry)
  } catch (error) {
    console.error('Error updating industry:', error)
    return NextResponse.json({ error: 'Failed to update industry' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getSession(request)
    if (!session || session.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 })
    }

    await prisma.industry.delete({
      where: { id }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting industry:', error)
    return NextResponse.json({ error: 'Failed to delete industry' }, { status: 500 })
  }
}
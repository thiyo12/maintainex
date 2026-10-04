'use server'

import { secureConsole } from '@/lib/shared/observability/secure-console'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { guardCrmRequest } from '@/lib/crm/security'

export async function GET() {
  try {
    const industries = await prisma.industry.findMany({
      where: { isActive: true },
      orderBy: { displayOrder: 'asc' },
      select: {
        id: true,
        name: true,
        icon: true,
        image: true,
        displayOrder: true,
        isPartner: true,
        partnerName: true,
      },
    })
    return NextResponse.json(industries)
  } catch (error) {
    secureConsole.error('Error fetching industries:', error)
    return NextResponse.json({ error: 'Failed to fetch industries' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const guard = await guardCrmRequest(request, {
      permission: 'catalog:edit',
      allowedRoles: ['SUPER_ADMIN'],
      level: 'mutation',
    })
    if (!guard.ok) return guard.response

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
    secureConsole.error('Error creating industry:', error)
    return NextResponse.json({ error: 'Failed to create industry' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const guard = await guardCrmRequest(request, {
      permission: 'catalog:edit',
      allowedRoles: ['SUPER_ADMIN'],
      level: 'mutation',
    })
    if (!guard.ok) return guard.response

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
    secureConsole.error('Error updating industry:', error)
    return NextResponse.json({ error: 'Failed to update industry' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const guard = await guardCrmRequest(request, {
      permission: 'catalog:edit',
      allowedRoles: ['SUPER_ADMIN'],
      level: 'mutation',
    })
    if (!guard.ok) return guard.response

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
    secureConsole.error('Error deleting industry:', error)
    return NextResponse.json({ error: 'Failed to delete industry' }, { status: 500 })
  }
}
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth/authentication/auth-utils'

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await getSession(request)
    if (!session || session.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const existing = await prisma.seasonalOffer.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Seasonal offer not found' }, { status: 404 })
    }

    const body = await request.json()
    const { title, description, slug, season, country, image, badgeText, bgColor, textColor, displayOrder, isActive } = body

    const data: any = {}
    if (title !== undefined) data.title = title
    if (description !== undefined) data.description = description
    if (slug !== undefined) data.slug = slug
    if (season !== undefined) data.season = season
    if (country !== undefined) data.country = country
    if (image !== undefined) data.image = image
    if (badgeText !== undefined) data.badgeText = badgeText
    if (bgColor !== undefined) data.bgColor = bgColor
    if (textColor !== undefined) data.textColor = textColor
    if (displayOrder !== undefined) data.displayOrder = displayOrder
    if (isActive !== undefined) data.isActive = isActive

    const offer = await prisma.seasonalOffer.update({ where: { id }, data })
    return NextResponse.json(offer)
  } catch (error) {
    console.error('Error updating seasonal offer:', error)
    return NextResponse.json({ error: 'Failed to update seasonal offer' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await getSession(request)
    if (!session || session.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const existing = await prisma.seasonalOffer.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Seasonal offer not found' }, { status: 404 })
    }

    await prisma.seasonalOffer.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting seasonal offer:', error)
    return NextResponse.json({ error: 'Failed to delete seasonal offer' }, { status: 500 })
  }
}

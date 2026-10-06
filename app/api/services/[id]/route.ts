import { secureConsole } from '@/lib/shared/observability/secure-console'
import { NextRequest, NextResponse } from 'next/server'
import { assertCrmCountryAllowed, guardCrmRequest } from '@/lib/crm/security'
import { prisma } from '@/lib/prisma'

async function authorizeServiceMutation(request: NextRequest, id: string) {
  const guard = await guardCrmRequest(request, {
    permission: 'catalog:edit',
    level: 'mutation',
    requireCountryScope: true,
  })
  if (!guard.ok) return { ok: false as const, response: guard.response }

  const service = await prisma.service.findUnique({ where: { id } })
  if (!service) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: 'Service not found' }, { status: 404 }),
    }
  }

  if (!assertCrmCountryAllowed(guard.context, service.countryCode)) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: 'Service is outside your assigned countries' }, { status: 403 }),
    }
  }

  return { ok: true as const, guard: guard.context, service }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const access = await authorizeServiceMutation(request, id)
    if (!access.ok) return access.response

    await prisma.service.delete({ where: { id } })
    return NextResponse.json({ success: true, message: 'Service deleted successfully' })
  } catch (error) {
    secureConsole.error('Delete service error:', error)
    return NextResponse.json({ error: 'Failed to delete service' }, { status: 500 })
  }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const service = await prisma.service.findFirst({
      where: {
        isActive: true,
        OR: [{ id }, { slug: id }],
      },
      include: { category: true },
    })

    if (!service) {
      return NextResponse.json({ error: 'Service not found' }, { status: 404 })
    }

    await prisma.service.update({
      where: { id: service.id },
      data: { views: { increment: 1 } },
    })

    const relatedServices = await prisma.service.findMany({
      where: {
        categoryId: service.categoryId,
        countryCode: service.countryCode,
        id: { not: service.id },
        isActive: true,
      },
      take: 4,
      orderBy: { views: 'desc' },
      include: { category: { select: { name: true } } },
    })

    return NextResponse.json({
      ...service,
      price: service.price ? Number(service.price) : null,
      relatedServices,
    })
  } catch {
    return NextResponse.json({ error: 'Failed to fetch service' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const access = await authorizeServiceMutation(request, id)
    if (!access.ok) return access.response

    const body = await request.json()
    const {
      name,
      description,
      shortDescription,
      image,
      price,
      duration,
      categoryId,
      isActive,
      isTrending,
      displayOrder,
      features,
    } = body

    if (categoryId) {
      const category = await prisma.category.findUnique({
        where: { id: categoryId },
        select: { id: true, countryCode: true },
      })
      if (!category || category.countryCode !== access.service.countryCode) {
        return NextResponse.json({ error: 'Invalid category for service market' }, { status: 400 })
      }
    }

    const parsedPrice = price !== undefined ? Number(price) : undefined
    const parsedDuration = duration !== undefined ? Number(duration) : undefined
    const parsedDisplayOrder = displayOrder !== undefined ? Number(displayOrder) : undefined

    if (parsedPrice !== undefined && (!Number.isFinite(parsedPrice) || parsedPrice < 0)) {
      return NextResponse.json({ error: 'Invalid price' }, { status: 400 })
    }
    if (parsedDuration !== undefined && (!Number.isInteger(parsedDuration) || parsedDuration < 0)) {
      return NextResponse.json({ error: 'Invalid duration' }, { status: 400 })
    }
    if (parsedDisplayOrder !== undefined && (!Number.isInteger(parsedDisplayOrder) || parsedDisplayOrder < 0)) {
      return NextResponse.json({ error: 'Invalid displayOrder' }, { status: 400 })
    }

    const service = await prisma.service.update({
      where: { id },
      data: {
        ...(typeof name === 'string' && name.trim() && { name: name.trim().slice(0, 160) }),
        ...(description !== undefined && { description: String(description).slice(0, 5000) }),
        ...(shortDescription !== undefined && { shortDescription: String(shortDescription).slice(0, 1000) }),
        ...(image !== undefined && { image: image ? String(image).slice(0, 2000) : null }),
        ...(parsedPrice !== undefined && { price: parsedPrice }),
        ...(parsedDuration !== undefined && { duration: parsedDuration }),
        ...(categoryId && { categoryId }),
        ...(typeof isActive === 'boolean' && { isActive }),
        ...(typeof isTrending === 'boolean' && { isTrending }),
        ...(parsedDisplayOrder !== undefined && { displayOrder: parsedDisplayOrder }),
        ...(features !== undefined && { features: String(features).slice(0, 10000) }),
      },
      include: { category: true },
    })

    return NextResponse.json({
      ...service,
      price: service.price ? Number(service.price) : null,
    })
  } catch (error) {
    secureConsole.error('Update service error:', error)
    return NextResponse.json({ error: 'Failed to update service' }, { status: 500 })
  }
}

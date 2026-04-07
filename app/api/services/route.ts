import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { serviceSchema, categorySchema } from '@/lib/validations'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { logActivity } from '@/lib/activity-log'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const categorySlug = searchParams.get('category')

    const where: any = { isActive: true }
    if (categorySlug) {
      where.category = { slug: categorySlug }
    }

    const services = await prisma.service.findMany({
      where,
      include: { category: true },
      orderBy: { createdAt: 'desc' }
    })

    return NextResponse.json(services)
  } catch (error) {
    console.error('Error fetching services:', error)
    return NextResponse.json({ error: 'Failed to fetch services' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { type } = body

    if (type === 'category') {
      const validatedData = categorySchema.parse(body)
      const category = await prisma.category.create({
        data: {
          name: validatedData.name,
          slug: validatedData.slug.toLowerCase().replace(/\s+/g, '-')
        }
      })

      await logActivity({
        adminId: (session.user as any).id,
        adminEmail: session.user!.email!,
        adminName: session.user!.name,
        action: 'CREATE',
        entityType: 'CATEGORY',
        entityId: category.id,
        description: `Created category "${category.name}"`,
        details: { name: category.name, slug: category.slug }
      })

      return NextResponse.json(category, { status: 201 })
    }

    if (type === 'service') {
      const validatedData = serviceSchema.parse(body)
      const service = await prisma.service.create({
        data: {
          title: validatedData.title,
          slug: validatedData.slug.toLowerCase().replace(/\s+/g, '-'),
          description: validatedData.description,
          image: body.image || null,
          price: validatedData.price || null,
          categoryId: validatedData.categoryId,
          isActive: validatedData.isActive
        },
        include: { category: true }
      })

      await logActivity({
        adminId: (session.user as any).id,
        adminEmail: session.user!.email!,
        adminName: session.user!.name,
        action: 'CREATE',
        entityType: 'SERVICE',
        entityId: service.id,
        description: `Created service "${service.title}"`,
        details: { title: service.title, category: service.category?.name }
      })

      return NextResponse.json(service, { status: 201 })
    }

    return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
  } catch (error: any) {
    console.error('Error creating resource:', error)
    if (error.name === 'ZodError') {
      return NextResponse.json({ error: error.errors }, { status: 400 })
    }
    return NextResponse.json({ error: 'Failed to create resource' }, { status: 500 })
  }
}

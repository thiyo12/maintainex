import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateRequest, assertNotSuspended } from '@/lib/mobile-auth'
import { createWorkItem } from '@/lib/work-queue'

export async function GET(request: NextRequest) {
  try {
    const user = await authenticateRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const docs = await prisma.identityDocument.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({
      identityStatus: user.identityStatus || 'NOT_SUBMITTED',
      documents: docs,
    })
  } catch (error) {
    console.error('Get identity error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await authenticateRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const blocked = assertNotSuspended(user)
    if (blocked) return blocked

    const body = await request.json()
    const { docType, side, imageUrl } = body

    if (!docType || !side || !imageUrl) {
      return NextResponse.json({ error: 'Missing required fields: docType, side, imageUrl' }, { status: 400 })
    }

    const validDocTypes = ['PASSPORT', 'NATIONAL_ID', 'DRIVERS_LICENSE']
    if (!validDocTypes.includes(docType)) {
      return NextResponse.json({ error: 'Invalid docType. Must be PASSPORT, NATIONAL_ID, or DRIVERS_LICENSE' }, { status: 400 })
    }

    const validSides = ['FRONT', 'BACK']
    if (!validSides.includes(side)) {
      return NextResponse.json({ error: 'Invalid side. Must be FRONT or BACK' }, { status: 400 })
    }

    const doc = await prisma.identityDocument.create({
      data: {
        userId: user.id,
        docType,
        side,
        imageUrl,
        status: 'PENDING',
      },
    })

    await prisma.user.update({
      where: { id: user.id },
      data: { identityStatus: 'PENDING' },
    })

    await createWorkItem({
      category: 'kyc',
      title: `KYC document submitted — ${docType} (${side})`,
      description: `User ${user.name || user.email} submitted a ${docType} for identity verification.`,
      targetTable: 'IdentityDocument',
      targetId: doc.id,
    })

    return NextResponse.json({ document: doc }, { status: 201 })
  } catch (error) {
    console.error('Upload identity error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

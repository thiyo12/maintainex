import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateRequest, assertNotSuspended } from '@/lib/mobile-auth'
import { createWorkItem } from '@/lib/work-queue'
import { transitionUserKyc } from '@/lib/phase6/kyc-writer'

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
    const { docType, side, imageUrl, fullName } = body

    if (!docType || !side || !imageUrl) {
      return NextResponse.json({ error: 'Missing required fields: docType, side, imageUrl' }, { status: 400 })
    }

    if (user.role === 'TASKER' && !fullName?.trim()) {
      return NextResponse.json({ error: 'Full name exactly as on the ID is required' }, { status: 400 })
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
        fullName: fullName?.trim() || null,
        status: 'PENDING',
      },
    })

    const currentIdentityStatus = (user.identityStatus || 'NOT_SUBMITTED').toUpperCase()
    if (currentIdentityStatus !== 'PENDING') {
      const result = await transitionUserKyc(prisma, {
        userId: user.id,
        action: 'SUBMIT',
        documentId: doc.id,
      })

      if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 400 })
      }
    }

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

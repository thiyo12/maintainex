import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateRequest, assertNotSuspended } from '@/lib/mobile-auth'

export async function GET(request: NextRequest) {
  try {
    const user = await authenticateRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const certs = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT * FROM "Certification" WHERE "holderType" = 'INDIVIDUAL' AND "holderId" = $1 ORDER BY "createdAt" DESC`,
      user.id
    )

    return NextResponse.json({ certifications: certs })
  } catch (error) {
    console.error('Get certifications error:', error)
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
    const { certificationType, name, issuer, referenceNumber, issuedDate, expiryDate, documentUrl } = body

    if (!certificationType || !name) {
      return NextResponse.json({ error: 'certificationType and name are required' }, { status: 400 })
    }

    const cert = await prisma.$executeRawUnsafe(
      `INSERT INTO "Certification" ("id", "holderType", "holderId", "certificationType", "name", "issuer", "referenceNumber", "issuedDate", "expiryDate", "documentUrl", "verificationStatus", "isActive", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'PENDING', true, NOW(), NOW())`,
      crypto.randomUUID(),
      'INDIVIDUAL',
      user.id,
      certificationType,
      name,
      issuer || null,
      referenceNumber || null,
      issuedDate || null,
      expiryDate || null,
      documentUrl || null
    )

    return NextResponse.json({ success: true }, { status: 201 })
  } catch (error) {
    console.error('Create certification error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

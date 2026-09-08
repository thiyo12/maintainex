import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateRequest, assertNotSuspended } from '@/lib/mobile-auth'
import { hasCompanyPermission } from '@/lib/phase6/rbac'
import { getUserCompanyRole } from '@/lib/phase6/company-ownership'
import { writeCompanyAuditLog } from '@/lib/phase6/audit'

export async function GET(request: NextRequest) {
  try {
    const user = await authenticateRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const profile = await prisma.companyProfile.findUnique({
      where: { userId: user.id },
      select: { id: true },
    })
    if (!profile) {
      return NextResponse.json({ error: 'Company profile not found' }, { status: 404 })
    }

    const certs = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT * FROM "Certification" WHERE "holderType" = 'COMPANY' AND "holderId" = $1 ORDER BY "createdAt" DESC`,
      profile.id
    )

    return NextResponse.json({ certifications: certs })
  } catch (error) {
    console.error('Get company certifications error:', error)
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

    const profile = await prisma.companyProfile.findUnique({
      where: { userId: user.id },
      select: { id: true, companyName: true },
    })
    if (!profile) {
      return NextResponse.json({ error: 'Company profile not found' }, { status: 404 })
    }

    const actorRole = await getUserCompanyRole(profile.id, user.id)
    if (!actorRole || !hasCompanyPermission(actorRole, 'certifications:manage')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const body = await request.json()
    const { certificationType, name, issuer, referenceNumber, issuedDate, expiryDate, documentUrl } = body

    if (!certificationType || !name) {
      return NextResponse.json({ error: 'certificationType and name are required' }, { status: 400 })
    }

    const certId = crypto.randomUUID()
    await prisma.$executeRawUnsafe(
      `INSERT INTO "Certification" ("id", "holderType", "holderId", "certificationType", "name", "issuer", "referenceNumber", "issuedDate", "expiryDate", "documentUrl", "verificationStatus", "isActive", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'PENDING', true, NOW(), NOW())`,
      certId,
      'COMPANY',
      profile.id,
      certificationType,
      name,
      issuer || null,
      referenceNumber || null,
      issuedDate || null,
      expiryDate || null,
      documentUrl || null
    )

    await writeCompanyAuditLog({
      companyId: profile.id,
      actorId: user.id,
      actorRole,
      action: 'CERTIFICATION_ADD',
      targetType: 'Certification',
      targetId: certId,
      description: `Added certification: ${name} (${certificationType})`,
    })

    return NextResponse.json({ success: true, id: certId }, { status: 201 })
  } catch (error) {
    console.error('Create company certification error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

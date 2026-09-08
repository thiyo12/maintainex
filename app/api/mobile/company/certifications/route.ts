import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateMarketplaceUser } from '@/lib/auth/marketplace-auth'
import { assertNotSuspended } from '@/lib/mobile-auth'
import { hasCompanyPermission } from '@/lib/phase6/rbac'
import { getUserCompanyRole } from '@/lib/phase6/company-ownership'
import { writeCompanyAuditLog } from '@/lib/phase6/audit'
import { resolveCompanyContext } from '@/lib/phase6/company-context'

export async function GET(request: NextRequest) {
  try {
    const user = await authenticateMarketplaceUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const companyId = searchParams.get('companyId')

    const { context, error } = await resolveCompanyContext(user.id, companyId, 'certifications:read')
    if (error) return error

    const certs = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT * FROM "Certification" WHERE "holderType" = 'COMPANY' AND "holderId" = $1 ORDER BY "createdAt" DESC`,
      context!.companyId
    )

    return NextResponse.json({ certifications: certs })
  } catch (error) {
    console.error('Get company certifications error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await authenticateMarketplaceUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const blocked = assertNotSuspended(user)
    if (blocked) return blocked

    const body = await request.json()
    const { companyId, certificationType, name, issuer, referenceNumber, issuedDate, expiryDate, documentUrl } = body

    if (!companyId || !certificationType || !name) {
      return NextResponse.json({ error: 'companyId, certificationType, and name are required' }, { status: 400 })
    }

    const { context, error } = await resolveCompanyContext(user.id, companyId, 'certifications:manage')
    if (error) return error

    const certId = crypto.randomUUID()
    await prisma.$executeRawUnsafe(
      `INSERT INTO "Certification" ("id", "holderType", "holderId", "certificationType", "name", "issuer", "referenceNumber", "issuedDate", "expiryDate", "documentUrl", "verificationStatus", "isActive", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'PENDING', true, NOW(), NOW())`,
      certId,
      'COMPANY',
      context!.companyId,
      certificationType,
      name,
      issuer || null,
      referenceNumber || null,
      issuedDate || null,
      expiryDate || null,
      documentUrl || null
    )

    await writeCompanyAuditLog({
      companyId: context!.companyId,
      actorId: user.id,
      actorRole: context!.role,
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

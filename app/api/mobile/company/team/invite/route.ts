import { secureConsole } from '@/lib/shared/observability/secure-console'
import { NextRequest, NextResponse } from 'next/server'
import { authenticateMarketplaceUser, assertNotSuspended } from '@/lib/auth/marketplace-auth'
import { canAssignRole } from '@/lib/phase6/rbac'
import { createCompanyInvite } from '@/lib/phase6/invitation'
import { writeCompanyAuditLog } from '@/lib/phase6/audit'
import { resolveCompanyContext } from '@/lib/phase6/company-context'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const user = await authenticateMarketplaceUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const blocked = assertNotSuspended(user)
    if (blocked) return blocked

    const body = await request.json()
    const { companyId, name, email, phone, role } = body
    if (!name) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 })
    }

    const { context, error } = await resolveCompanyContext(user.id, companyId || null, 'members:invite')
    if (error) return error
    const resolvedCompanyId = context!.companyId

    const profile = await prisma.companyProfile.findUnique({
      where: { id: resolvedCompanyId },
      select: { isVerified: true, companyName: true },
    })
    if (!profile) {
      return NextResponse.json({ error: 'Company profile not found' }, { status: 404 })
    }

    if (!profile.isVerified) {
      return NextResponse.json({ error: 'Company must be verified to invite team members' }, { status: 403 })
    }

    const targetRole = role || 'WORKER'
    if (!canAssignRole(context!.role, targetRole)) {
      return NextResponse.json({ error: 'Insufficient permissions to assign this role' }, { status: 403 })
    }

    const result = await createCompanyInvite({
      companyId: resolvedCompanyId,
      inviterUserId: user.id,
      inviterRole: context!.role,
      name,
      email,
      phone,
      role: targetRole,
    })

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    await writeCompanyAuditLog({
      companyId: resolvedCompanyId,
      actorId: user.id,
      actorRole: context!.role,
      action: 'MEMBER_INVITE',
      targetType: 'TeamInvite',
      targetId: result.inviteId,
      description: `Invited ${name} (${email || phone}) as ${targetRole}`,
      metadata: { invitedEmail: email, invitedPhone: phone, role: targetRole },
    })

    return NextResponse.json({
      success: true,
      invite: {
        id: result.inviteId,
        name,
        email,
        phone,
        role: targetRole,
        status: 'PENDING',
        token: result.token,
      },
    })
  } catch (error) {
    secureConsole.error('Team invite error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

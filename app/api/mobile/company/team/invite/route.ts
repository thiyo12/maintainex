import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateRequest, assertNotSuspended } from '@/lib/mobile-auth'
import { canAssignRole } from '@/lib/phase6/rbac'
import { getUserCompanyRole } from '@/lib/phase6/company-ownership'
import { createCompanyInvite } from '@/lib/phase6/invitation'
import { writeCompanyAuditLog } from '@/lib/phase6/audit'

export async function POST(request: NextRequest) {
  try {
    const user = await authenticateRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const blocked = assertNotSuspended(user)
    if (blocked) return blocked

    const { name, email, phone, role } = await request.json()
    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }

    const profile = await prisma.companyProfile.findUnique({
      where: { userId: user.id },
      select: { id: true, companyName: true, isVerified: true },
    })
    if (!profile) {
      return NextResponse.json({ error: 'Company profile not found' }, { status: 404 })
    }

    if (!profile.isVerified) {
      return NextResponse.json({ error: 'Company must be verified to invite team members' }, { status: 403 })
    }

    const actorRole = await getUserCompanyRole(profile.id, user.id)
    if (!actorRole) {
      return NextResponse.json({ error: 'Not a member of this company' }, { status: 403 })
    }

    const targetRole = role || 'WORKER'
    if (!canAssignRole(actorRole, targetRole)) {
      return NextResponse.json({ error: 'Insufficient permissions to assign this role' }, { status: 403 })
    }

    const result = await createCompanyInvite({
      companyId: profile.id,
      inviterUserId: user.id,
      inviterRole: actorRole,
      name,
      email,
      phone,
      role: targetRole,
    })

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    await writeCompanyAuditLog({
      companyId: profile.id,
      actorId: user.id,
      actorRole,
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
    console.error('Team invite error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

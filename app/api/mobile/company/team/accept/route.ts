import { NextRequest, NextResponse } from 'next/server'
import { authenticateMarketplaceUser } from '@/lib/auth/marketplace-auth'
import { assertNotSuspended } from '@/lib/mobile-auth'
import { acceptCompanyInvite } from '@/lib/phase6/invitation'
import { writeCompanyAuditLog } from '@/lib/phase6/audit'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const user = await authenticateMarketplaceUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const blocked = assertNotSuspended(user)
    if (blocked) return blocked

    const { token } = await request.json()
    if (!token) {
      return NextResponse.json({ error: 'Token is required' }, { status: 400 })
    }

    const result = await acceptCompanyInvite({
      token,
      userId: user.id,
      userEmail: user.email,
    })

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    const invite = await prisma.teamInvite.findUnique({
      where: { token },
      select: { companyId: true, role: true, invitedBy: true },
    })

    if (invite) {
      await writeCompanyAuditLog({
        companyId: invite.companyId,
        actorId: user.id,
        actorRole: invite.role,
        action: 'MEMBER_ACCEPT',
        targetType: 'TeamMember',
        description: `${user.name || user.email} accepted invitation as ${invite.role}`,
        metadata: { role: invite.role, invitedBy: invite.invitedBy },
      })
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { role: 'COMPANY' },
    })

    return NextResponse.json({
      success: true,
      teamMember: {
        name: result.memberName,
        companyName: result.companyName,
      },
    })
  } catch (error) {
    console.error('Team invite accept error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

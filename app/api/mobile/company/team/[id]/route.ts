import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateMarketplaceUser } from '@/lib/auth/marketplace-auth'
import { assertNotSuspended } from '@/lib/auth/compatibility/mobile-auth'
import { safeParseJsonArr } from '@/lib/db-utils'
import { canRemoveMemberSafe } from '@/lib/phase6/company-ownership'
import { writeCompanyAuditLog } from '@/lib/phase6/audit'
import { resolveCompanyContext } from '@/lib/phase6/company-context'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const user = await authenticateMarketplaceUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const blocked = assertNotSuspended(user)
    if (blocked) return blocked

    const body = await request.json().catch(() => ({}))
    const companyId = body.companyId || (await prisma.teamMember.findUnique({ where: { id }, select: { companyId: true } }))?.companyId

    const { context, error } = await resolveCompanyContext(user.id, companyId, 'members:remove')
    if (error) return error

    const member = await prisma.teamMember.findFirst({
      where: { id, companyId: context!.companyId, status: { not: 'REMOVED' } },
    })
    if (!member) {
      return NextResponse.json({ error: 'Team member not found' }, { status: 404 })
    }

    const removal = await canRemoveMemberSafe(
      context!.companyId,
      user.id,
      member.userId || '',
      context!.role
    )
    if (!removal.allowed) {
      return NextResponse.json({ error: removal.reason }, { status: 403 })
    }

    await prisma.teamMember.update({
      where: { id },
      data: { status: 'REMOVED' },
    })

    await writeCompanyAuditLog({
      companyId: context!.companyId,
      actorId: user.id,
      actorRole: context!.role,
      action: 'MEMBER_REMOVE',
      targetType: 'TeamMember',
      targetId: member.id,
      description: `Removed ${member.name} (${member.role}) from company`,
      metadata: { removedUserId: member.userId, removedRole: member.role },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Team member delete error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const user = await authenticateMarketplaceUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const member = await prisma.teamMember.findUnique({
      where: { id },
      select: { companyId: true },
    })
    if (!member) {
      return NextResponse.json({ error: 'Team member not found' }, { status: 404 })
    }

    const { context, error } = await resolveCompanyContext(user.id, member.companyId, 'members:read')
    if (error) return error

    const memberDetail = await prisma.teamMember.findFirst({
      where: { id, companyId: member.companyId },
    })
    if (!memberDetail) {
      return NextResponse.json({ error: 'Team member not found' }, { status: 404 })
    }

    return NextResponse.json({
      id: memberDetail.id,
      name: memberDetail.name,
      role: memberDetail.role,
      status: memberDetail.status,
      skills: safeParseJsonArr(memberDetail.skills),
      isOnline: memberDetail.isOnline,
      rating: memberDetail.rating,
      completedJobs: memberDetail.completedJobs,
      joinedAt: memberDetail.joinedAt.toISOString(),
    })
  } catch (error) {
    console.error('Team member get error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

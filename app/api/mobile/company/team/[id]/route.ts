import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateRequest, assertNotSuspended } from '@/lib/mobile-auth'
import { safeParseJsonArr } from '@/lib/db-utils'
import { getUserCompanyRole } from '@/lib/phase6/company-ownership'
import { canRemoveMemberSafe } from '@/lib/phase6/company-ownership'
import { writeCompanyAuditLog } from '@/lib/phase6/audit'

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await authenticateRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const blocked = assertNotSuspended(user)
    if (blocked) return blocked

    const profile = await prisma.companyProfile.findUnique({
      where: { userId: user.id },
      select: { id: true },
    })
    if (!profile) {
      return NextResponse.json({ error: 'Company profile not found' }, { status: 404 })
    }

    const actorRole = await getUserCompanyRole(profile.id, user.id)
    if (!actorRole) {
      return NextResponse.json({ error: 'Not a member of this company' }, { status: 403 })
    }

    const member = await prisma.teamMember.findFirst({
      where: { id: params.id, companyId: profile.id, status: { not: 'REMOVED' } },
    })
    if (!member) {
      return NextResponse.json({ error: 'Team member not found' }, { status: 404 })
    }

    const removal = await canRemoveMemberSafe(
      profile.id,
      user.id,
      member.userId || '',
      actorRole
    )
    if (!removal.allowed) {
      return NextResponse.json({ error: removal.reason }, { status: 403 })
    }

    await prisma.teamMember.update({
      where: { id: params.id },
      data: { status: 'REMOVED' },
    })

    await writeCompanyAuditLog({
      companyId: profile.id,
      actorId: user.id,
      actorRole,
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
  { params }: { params: { id: string } }
) {
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

    const member = await prisma.teamMember.findFirst({
      where: { id: params.id, companyId: profile.id },
    })
    if (!member) {
      return NextResponse.json({ error: 'Team member not found' }, { status: 404 })
    }

    return NextResponse.json({
      id: member.id,
      name: member.name,
      role: member.role,
      status: member.status,
      skills: safeParseJsonArr(member.skills),
      isOnline: member.isOnline,
      rating: member.rating,
      completedJobs: member.completedJobs,
      joinedAt: member.joinedAt.toISOString(),
    })
  } catch (error) {
    console.error('Team member get error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

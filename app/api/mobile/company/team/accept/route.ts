import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateRequest, assertNotSuspended } from '@/lib/mobile-auth'

export async function POST(request: NextRequest) {
  try {
    const user = await authenticateRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const blocked = assertNotSuspended(user)
    if (blocked) return blocked

    const { token } = await request.json()
    if (!token) {
      return NextResponse.json({ error: 'Token is required' }, { status: 400 })
    }

    const invite = await prisma.teamInvite.findUnique({
      where: { token },
      include: { company: true },
    })
    if (!invite) {
      return NextResponse.json({ error: 'Invalid invite token' }, { status: 404 })
    }
    if (invite.status !== 'PENDING') {
      return NextResponse.json({ error: 'Invite is no longer valid' }, { status: 400 })
    }
    if (new Date() > invite.expiresAt) {
      await prisma.teamInvite.update({ where: { id: invite.id }, data: { status: 'EXPIRED' } })
      return NextResponse.json({ error: 'Invite has expired' }, { status: 400 })
    }

    const existingMember = await prisma.teamMember.findFirst({
      where: { companyId: invite.companyId, userId: user.id },
    })
    if (existingMember) {
      return NextResponse.json({ error: 'You are already a member of this company' }, { status: 409 })
    }

    const emailMatch = invite.email && invite.email === user.email
    if (invite.email && !emailMatch) {
      return NextResponse.json({ error: 'This invite was sent to a different email address' }, { status: 403 })
    }

    const [teamMember] = await prisma.$transaction([
      prisma.teamMember.create({
        data: {
          companyId: invite.companyId,
          userId: user.id,
          name: invite.name,
          role: invite.role,
          skills: '[]',
        },
      }),
      prisma.teamInvite.update({
        where: { id: invite.id },
        data: { status: 'ACCEPTED' },
      }),
      prisma.user.update({
        where: { id: user.id },
        data: { role: 'TASKER' },
      }),
    ])

    return NextResponse.json({
      success: true,
      teamMember: {
        id: teamMember.id,
        name: teamMember.name,
        role: teamMember.role,
        companyName: invite.company.companyName,
      },
    })
  } catch (error) {
    console.error('Team invite accept error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

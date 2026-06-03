import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateRequest } from '@/lib/mobile-auth'

export async function DELETE(
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

    await prisma.teamMember.delete({ where: { id: params.id } })

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
      skills: member.skills,
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

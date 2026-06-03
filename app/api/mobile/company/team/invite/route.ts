import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateRequest } from '@/lib/mobile-auth'
import crypto from 'crypto'

export async function POST(request: NextRequest) {
  try {
    const user = await authenticateRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { name, email, phone, role } = await request.json()
    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }
    if (!email && !phone) {
      return NextResponse.json({ error: 'Email or phone is required' }, { status: 400 })
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

    const token = crypto.randomBytes(32).toString('hex')
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days

    const invite = await prisma.teamInvite.create({
      data: {
        companyId: profile.id,
        name,
        email,
        phone,
        role: role || 'MEMBER',
        token,
        expiresAt,
      },
    })

    return NextResponse.json({
      success: true,
      invite: {
        id: invite.id,
        name: invite.name,
        email: invite.email,
        phone: invite.phone,
        role: invite.role,
        status: invite.status,
        expiresAt: invite.expiresAt.toISOString(),
        token: invite.token,
      },
    })
  } catch (error) {
    console.error('Team invite error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

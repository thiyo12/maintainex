import { prisma } from '@/lib/prisma'
import { CompanyRole, isValidCompanyRole, canAssignRole } from './rbac'
import crypto from 'crypto'

export interface InviteResult {
  success: boolean
  inviteId?: string
  token?: string
  error?: string
}

export async function createCompanyInvite(params: {
  companyId: string
  inviterUserId: string
  inviterRole: CompanyRole
  name: string
  email?: string
  phone?: string
  role: CompanyRole
  ipAddress?: string
}): Promise<InviteResult> {
  if (!isValidCompanyRole(params.role)) {
    return { success: false, error: 'Invalid role' }
  }

  if (params.role === 'COMPANY_OWNER') {
    return { success: false, error: 'Cannot invite someone directly as owner. Use ownership transfer.' }
  }

  if (!canAssignRole(params.inviterRole, params.role)) {
    return { success: false, error: 'Insufficient permissions to assign this role' }
  }

  if (!params.email && !params.phone) {
    return { success: false, error: 'Email or phone is required' }
  }

  const company = await prisma.companyProfile.findUnique({
    where: { id: params.companyId },
    select: { id: true, isVerified: true, companyName: true },
  })
  if (!company) {
    return { success: false, error: 'Company not found' }
  }

  if (params.email) {
    const existingUser = await prisma.user.findUnique({
      where: { email: params.email },
      select: { id: true },
    })
    if (existingUser) {
      const existingMember = await prisma.teamMember.findFirst({
        where: {
          companyId: params.companyId,
          userId: existingUser.id,
          status: 'ACTIVE',
        },
      })
      if (existingMember) {
        return { success: false, error: 'User is already a member of this company' }
      }
    }
  }

  const existingInvite = await prisma.teamInvite.findFirst({
    where: {
      companyId: params.companyId,
      status: 'PENDING',
      OR: [
        ...(params.email ? [{ email: params.email }] : []),
        ...(params.phone ? [{ phone: params.phone }] : []),
      ],
    },
  })
  if (existingInvite) {
    return { success: false, error: 'An active invitation already exists for this contact' }
  }

  const token = crypto.randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

  const invite = await prisma.teamInvite.create({
    data: {
      companyId: params.companyId,
      name: params.name,
      email: params.email ?? null,
      phone: params.phone ?? null,
      role: params.role,
      token,
      expiresAt,
      invitedBy: params.inviterUserId,
    },
  })

  return { success: true, inviteId: invite.id, token: invite.token }
}

export async function acceptCompanyInvite(params: {
  token: string
  userId: string
  userEmail: string
  ipAddress?: string
}): Promise<{ success: boolean; memberName?: string; companyName?: string; error?: string }> {
  const invite = await prisma.teamInvite.findUnique({
    where: { token: params.token },
    include: { company: { select: { id: true, companyName: true } } },
  })

  if (!invite) {
    return { success: false, error: 'Invalid invitation token' }
  }

  if (invite.status !== 'PENDING') {
    return { success: false, error: 'Invitation is no longer valid' }
  }

  if (new Date() > invite.expiresAt) {
    await prisma.teamInvite.update({
      where: { id: invite.id },
      data: { status: 'EXPIRED' },
    })
    return { success: false, error: 'Invitation has expired' }
  }

  if (invite.email && invite.email !== params.userEmail) {
    return { success: false, error: 'This invitation was sent to a different email address' }
  }

  const existingMember = await prisma.teamMember.findFirst({
    where: {
      companyId: invite.companyId,
      userId: params.userId,
      status: { not: 'REMOVED' },
    },
  })
  if (existingMember) {
    if (existingMember.status === 'ACTIVE') {
      return { success: false, error: 'You are already a member of this company' }
    }
    if (existingMember.status === 'REMOVED') {
      await prisma.teamMember.update({
        where: { id: existingMember.id },
        data: { status: 'ACTIVE', role: invite.role },
      })
      await prisma.teamInvite.update({
        where: { id: invite.id },
        data: { status: 'ACCEPTED' },
      })
      return { success: true, memberName: invite.name, companyName: invite.company.companyName }
    }
  }

  const [teamMember] = await prisma.$transaction([
    prisma.teamMember.create({
      data: {
        companyId: invite.companyId,
        userId: params.userId,
        name: invite.name,
        role: invite.role,
        skills: '[]',
        status: 'ACTIVE',
        invitedBy: invite.invitedBy,
      },
    }),
    prisma.teamInvite.update({
      where: { id: invite.id },
      data: { status: 'ACCEPTED' },
    }),
  ])

  return { success: true, memberName: teamMember.name, companyName: invite.company.companyName }
}

export async function cancelInvite(inviteId: string, companyId: string): Promise<boolean> {
  const invite = await prisma.teamInvite.findFirst({
    where: { id: inviteId, companyId, status: 'PENDING' },
  })
  if (!invite) return false

  await prisma.teamInvite.update({
    where: { id: inviteId },
    data: { status: 'CANCELLED' },
  })
  return true
}

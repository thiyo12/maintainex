import { isIP } from 'node:net'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { guardCrmRequest } from '@/lib/crm/security'
import { createAuditLog } from '@/lib/crm/audit'

export async function GET(request: NextRequest) {
  try {
    const guard = await guardCrmRequest(request, {
      permission: 'security:view',
      level: 'read',
    })
    if (!guard.ok) return guard.response

    const blockedIPs = await prisma.ipBlock.findMany({
      where: { expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(
      {
        blockedIPs: blockedIPs.map(block => ({
          id: block.id,
          ip: block.ip,
          reason: block.reason,
          blockedAt: block.createdAt.toISOString(),
          expiresAt: block.expiresAt?.toISOString() || null,
        })),
      },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (error) {
    console.error('CRM blocked IPs GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch blocked IPs' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const guard = await guardCrmRequest(request, {
      permission: 'security:audit',
      allowedRoles: ['SUPER_ADMIN'],
      level: 'sensitive',
    })
    if (!guard.ok) return guard.response
    const security = guard.context

    const body = await request.json().catch(() => ({}))
    const ip = typeof body?.ip === 'string' ? body.ip.trim() : ''
    const reason = typeof body?.reason === 'string' ? body.reason.trim().slice(0, 1000) : ''
    const rawDuration = body?.durationMinutes
    const durationMinutes = rawDuration === undefined || rawDuration === null || rawDuration === ''
      ? null
      : Number(rawDuration)

    if (!ip || isIP(ip) === 0) {
      return NextResponse.json({ error: 'Valid IPv4 or IPv6 address is required' }, { status: 400 })
    }
    if (reason.length < 3) {
      return NextResponse.json({ error: 'Reason is required' }, { status: 400 })
    }
    if (durationMinutes !== null && (!Number.isInteger(durationMinutes) || durationMinutes < 1 || durationMinutes > 525600)) {
      return NextResponse.json({ error: 'durationMinutes must be 1–525600' }, { status: 400 })
    }

    const expiresAt = durationMinutes
      ? new Date(Date.now() + durationMinutes * 60 * 1000)
      : new Date('2099-12-31T23:59:59.999Z')

    const previous = await prisma.ipBlock.findUnique({ where: { ip } })
    const blocked = await prisma.ipBlock.upsert({
      where: { ip },
      update: { reason, expiresAt },
      create: { ip, reason, expiresAt },
    })

    await createAuditLog({
      action: 'IP_BLOCK',
      category: 'SECURITY',
      userId: security.adminId,
      userEmail: security.email,
      userRole: security.role,
      entityType: 'IPBlock',
      entityId: blocked.id,
      entityName: ip,
      description: `CRM IP block applied: ${reason}`,
      oldValue: previous ? { ip: previous.ip, reason: previous.reason, expiresAt: previous.expiresAt } : null,
      newValue: { ip, reason, expiresAt },
      ipAddress: security.ipAddress,
      userAgent: security.userAgent || undefined,
      riskLevel: 'HIGH',
    })

    return NextResponse.json({
      success: true,
      blocked: {
        id: blocked.id,
        ip: blocked.ip,
        reason: blocked.reason,
        blockedAt: blocked.createdAt.toISOString(),
        expiresAt: blocked.expiresAt?.toISOString() || null,
      },
    })
  } catch (error) {
    console.error('CRM blocked IP POST error:', error)
    return NextResponse.json({ error: 'Failed to block IP' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const guard = await guardCrmRequest(request, {
      permission: 'security:audit',
      allowedRoles: ['SUPER_ADMIN'],
      level: 'sensitive',
    })
    if (!guard.ok) return guard.response
    const security = guard.context

    const body = await request.json().catch(() => ({}))
    const ip = typeof body?.ip === 'string' ? body.ip.trim() : ''
    if (!ip || isIP(ip) === 0) {
      return NextResponse.json({ error: 'Valid IP address is required' }, { status: 400 })
    }

    const previous = await prisma.ipBlock.findUnique({ where: { ip } })
    if (!previous) return NextResponse.json({ error: 'IP block not found' }, { status: 404 })

    await prisma.ipBlock.delete({ where: { ip } })

    await createAuditLog({
      action: 'IP_UNBLOCK',
      category: 'SECURITY',
      userId: security.adminId,
      userEmail: security.email,
      userRole: security.role,
      entityType: 'IPBlock',
      entityId: previous.id,
      entityName: ip,
      description: 'CRM IP block removed',
      oldValue: { ip: previous.ip, reason: previous.reason, expiresAt: previous.expiresAt },
      newValue: { removed: true },
      ipAddress: security.ipAddress,
      userAgent: security.userAgent || undefined,
      riskLevel: 'MEDIUM',
    })

    return NextResponse.json({ success: true, message: `IP ${ip} unblocked` })
  } catch (error) {
    console.error('CRM blocked IP DELETE error:', error)
    return NextResponse.json({ error: 'Failed to unblock IP' }, { status: 500 })
  }
}

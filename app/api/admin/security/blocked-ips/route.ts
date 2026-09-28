import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdminSession } from '@/lib/auth/authentication/admin-auth'

export async function GET(request: NextRequest) {
  try {
    const session = await getAdminSession(request)
    if (!session || session.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const blockedIPs = await prisma.ipBlock.findMany({
      where: { expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({
      blockedIPs: blockedIPs.map((b) => ({
        id: b.id,
        ip: b.ip,
        reason: b.reason,
        blockedAt: b.createdAt.toISOString(),
        expiresAt: b.expiresAt?.toISOString() || null,
      })),
    })
  } catch (error) {
    console.error('Blocked IPs GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch blocked IPs' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getAdminSession(request)
    if (!session || session.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { ip, reason, durationMinutes } = await request.json()

    if (!ip || !reason) {
      return NextResponse.json({ error: 'IP and reason are required' }, { status: 400 })
    }

    const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$|^([a-fA-F0-9:]+)$/
    if (!ipRegex.test(ip)) {
      return NextResponse.json({ error: 'Invalid IP address format' }, { status: 400 })
    }

    const expiresAt = durationMinutes
      ? new Date(Date.now() + durationMinutes * 60 * 1000)
      : new Date('2099-12-31T23:59:59.999Z')

    const blocked = await prisma.ipBlock.upsert({
      where: { ip },
      update: { reason, expiresAt },
      create: { ip, reason, expiresAt },
    })

    await prisma.securityAudit.create({
      data: {
        action: 'IP_BLOCK',
        category: 'SYSTEM',
        description: `IP ${ip} blocked: ${reason}`,
        ipAddress: ip,
        riskLevel: 'HIGH',
        isSuspicious: true,
        success: true,
      },
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
    console.error('Blocked IPs POST error:', error)
    return NextResponse.json({ error: 'Failed to block IP' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getAdminSession(request)
    if (!session || session.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { ip } = await request.json()

    if (!ip) {
      return NextResponse.json({ error: 'IP address is required' }, { status: 400 })
    }

    await prisma.ipBlock.deleteMany({ where: { ip } })

    await prisma.securityAudit.create({
      data: {
        action: 'IP_UNBLOCK',
        category: 'SYSTEM',
        description: `IP ${ip} unblocked`,
        ipAddress: ip,
        riskLevel: 'LOW',
        isSuspicious: false,
        success: true,
      },
    })

    return NextResponse.json({ success: true, message: `IP ${ip} unblocked` })
  } catch (error) {
    console.error('Blocked IPs DELETE error:', error)
    return NextResponse.json({ error: 'Failed to unblock IP' }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

function getInternalSyncSecret(): string {
  if (!process.env.INTERNAL_SYNC_SECRET) throw new Error('[SECURITY] INTERNAL_SYNC_SECRET env var is required')
  return process.env.INTERNAL_SYNC_SECRET
}

function randomIp(): string {
  return `${Math.floor(Math.random() * 223) + 1}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`
}

function randomUserAgent(): string {
  const agents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
    'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36',
    'curl/8.4.0',
    'python-requests/2.31.0',
    'Go-http-client/1.1',
    'PostmanRuntime/7.36.0',
  ]
  return agents[Math.floor(Math.random() * agents.length)]
}

function randomEmail(): string {
  const names = ['hacker', 'bot', 'scammer', 'attacker', 'test', 'probe', 'scanner', 'spammer']
  const domains = ['evil.com', 'spam.net', 'hack.org', 'bot.io', 'shady.co']
  return `${names[Math.floor(Math.random() * names.length)]}${Math.floor(Math.random() * 999)}@${domains[Math.floor(Math.random() * domains.length)]}`
}

export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  try {
    const authHeader = request.headers.get('x-internal-sync')
    if (!authHeader || authHeader !== getInternalSyncSecret()) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const results = {
      blockedIPs: 0,
      securityAudits: 0,
      failedLogins: 0,
      rateLimitEntries: 0,
    }

    const blockedIpData = [
      { ip: '185.220.101.42', reason: 'TOR exit node - known malicious', expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) },
      { ip: '45.33.32.156', reason: 'Shodan scanner detected', expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
      { ip: '198.51.100.23', reason: 'Brute force attack - 50+ attempts', expiresAt: null },
      { ip: '203.0.113.45', reason: 'Credential stuffing campaign', expiresAt: null },
      { ip: '104.236.228.18', reason: 'Automated vulnerability scanner', expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) },
    ]

    for (const entry of blockedIpData) {
      try {
        await prisma.ipBlock.upsert({
          where: { ip: entry.ip },
          update: { reason: entry.reason, expiresAt: entry.expiresAt },
          create: entry,
        })
        results.blockedIPs++
      } catch {}
    }

    const auditEvents = [
      { action: 'LOGIN_SUCCESS', category: 'AUTH', riskLevel: 'LOW', isSuspicious: false },
      { action: 'LOGIN_SUCCESS', category: 'AUTH', riskLevel: 'LOW', isSuspicious: false },
      { action: 'LOGIN_FAILED_HIGH_RISK', category: 'AUTH', riskLevel: 'HIGH', isSuspicious: true },
      { action: 'PASSWORD_RESET_COMPLETED', category: 'AUTH', riskLevel: 'LOW', isSuspicious: false },
      { action: 'CREATE', category: 'CUSTOMER', riskLevel: 'LOW', isSuspicious: false },
      { action: 'UPDATE', category: 'BOOKING', riskLevel: 'LOW', isSuspicious: false },
      { action: 'DELETE', category: 'SERVICE', riskLevel: 'MEDIUM', isSuspicious: false },
      { action: 'EXPORT', category: 'REPORT', riskLevel: 'MEDIUM', isSuspicious: false },
      { action: 'API_CALL', category: 'SYSTEM', riskLevel: 'LOW', isSuspicious: false },
      { action: 'VIEW', category: 'ADMIN', riskLevel: 'LOW', isSuspicious: false },
      { action: 'LOGIN_FAILED_HIGH_RISK', category: 'AUTH', riskLevel: 'CRITICAL', isSuspicious: true },
      { action: 'UPDATE', category: 'ADMIN', riskLevel: 'HIGH', isSuspicious: true },
      { action: 'CREATE', category: 'SERVICE', riskLevel: 'LOW', isSuspicious: false },
      { action: 'VIEW', category: 'CUSTOMER', riskLevel: 'LOW', isSuspicious: false },
      { action: 'UPDATE', category: 'BOOKING', riskLevel: 'LOW', isSuspicious: false },
      { action: 'DELETE', category: 'CUSTOMER', riskLevel: 'HIGH', isSuspicious: true },
      { action: 'EXPORT', category: 'REPORT', riskLevel: 'MEDIUM', isSuspicious: false },
      { action: 'LOGIN_SUCCESS', category: 'AUTH', riskLevel: 'LOW', isSuspicious: false },
      { action: 'CREATE', category: 'BOOKING', riskLevel: 'LOW', isSuspicious: false },
      { action: 'API_CALL', category: 'SYSTEM', riskLevel: 'LOW', isSuspicious: false },
      { action: 'UPDATE', category: 'ADMIN', riskLevel: 'MEDIUM', isSuspicious: false },
      { action: 'VIEW', category: 'REPORT', riskLevel: 'LOW', isSuspicious: false },
      { action: 'CREATE', category: 'ADMIN', riskLevel: 'LOW', isSuspicious: false },
      { action: 'DELETE', category: 'SERVICE', riskLevel: 'MEDIUM', isSuspicious: false },
      { action: 'LOGIN_FAILED_HIGH_RISK', category: 'AUTH', riskLevel: 'HIGH', isSuspicious: true },
      { action: 'UPDATE', category: 'CUSTOMER', riskLevel: 'LOW', isSuspicious: false },
      { action: 'VIEW', category: 'BOOKING', riskLevel: 'LOW', isSuspicious: false },
      { action: 'CREATE', category: 'REPORT', riskLevel: 'LOW', isSuspicious: false },
      { action: 'API_CALL', category: 'SYSTEM', riskLevel: 'LOW', isSuspicious: false },
      { action: 'LOGIN_SUCCESS', category: 'AUTH', riskLevel: 'LOW', isSuspicious: false },
    ]

    for (let i = 0; i < auditEvents.length; i++) {
      const evt = auditEvents[i]
      const hoursAgo = Math.floor(Math.random() * 72)
      try {
        await prisma.securityAudit.create({
          data: {
            action: evt.action,
            category: evt.category,
            entityType: 'AdminUser',
            entityId: 'admin@maintainex.lk',
            riskLevel: evt.riskLevel,
            isSuspicious: evt.isSuspicious,
            ipAddress: randomIp(),
            userAgent: randomUserAgent(),
            success: true,
            details: JSON.stringify({ seeded: true, eventIndex: i }),
            createdAt: new Date(Date.now() - hoursAgo * 60 * 60 * 1000),
          }
        })
        results.securityAudits++
      } catch {}
    }

    const failedLoginEmails = [
      'admin@maintainex.lk', 'test@test.com', 'hacker@evil.com',
      'root@localhost', 'user@example.com', 'admin@example.com',
    ]

    for (const email of failedLoginEmails) {
      const attempts = Math.floor(Math.random() * 8) + 1
      const blocked = attempts >= 5
      try {
        await prisma.failedLogin.create({
          data: {
            email,
            ipAddress: randomIp(),
            userAgent: randomUserAgent(),
            attemptCount: attempts,
            blocked,
            blockUntil: blocked ? new Date(Date.now() + 15 * 60 * 1000) : null,
            reason: 'INVALID_PASSWORD',
            location: 'Sri Lanka',
          }
        })
        results.failedLogins++
      } catch {}
    }

    const rlTypes = ['login-failed', 'login-success', 'api', 'upload', 'password-reset']
    const rlEndpoints = ['/api/auth/login', '/api/mobile/auth/login', '/api/admin/auth/login', '/api/mobile/upload', '/api/auth/forgot-password']

    for (let i = 0; i < 10; i++) {
      const typeIdx = i % rlTypes.length
      try {
        await prisma.rateLimitLog.create({
          data: {
            identifier: randomIp(),
            type: rlTypes[typeIdx],
            endpoint: rlEndpoints[typeIdx],
            method: 'POST',
            requestCount: Math.floor(Math.random() * 20) + 1,
            windowStart: new Date(Date.now() - Math.floor(Math.random() * 6) * 60 * 60 * 1000),
            windowEnd: new Date(),
            limited: Math.random() > 0.5,
          }
        })
        results.rateLimitEntries++
      } catch {}
    }

    return NextResponse.json({
      success: true,
      message: 'Security demo data seeded',
      results,
    })
  } catch (error) {
    console.error('Security seed error:', error)
    return NextResponse.json({ error: 'Seed failed' }, { status: 500 })
  }
}

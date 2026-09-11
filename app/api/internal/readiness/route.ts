import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: Request) {
  const authHeader = request.headers.get('x-internal-sync')
  const expectedSecret = process.env.INTERNAL_SYNC_SECRET

  if (!expectedSecret || authHeader !== expectedSecret) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const checks: Record<string, string> = {}

  try {
    await prisma.$queryRaw`SELECT 1`
    checks.database = 'ok'
  } catch {
    checks.database = 'failed'
  }

  try {
    const migrationCount = await prisma.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(*) as count FROM "_prisma_migrations" WHERE "finished_at" IS NULL
    `
    checks.migrations = Number(migrationCount[0].count) === 0 ? 'ok' : 'pending'
  } catch {
    checks.migrations = 'unknown'
  }

  const healthy = checks.database === 'ok' && checks.migrations === 'ok'

  return NextResponse.json({
    status: healthy ? 'ready' : 'degraded',
    checks,
    releaseSha: process.env.APP_RELEASE_SHA || 'unknown',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  }, { status: healthy ? 200 : 503 })
}

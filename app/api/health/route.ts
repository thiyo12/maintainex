import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// Launch messaging/operations validation marker.
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`
    return NextResponse.json({
      status: 'healthy',
      release: 'launch-messaging-ops-20260924',
      testOtpMode: process.env.ALLOW_TEST_OTP === 'true' ? 'synthetic-only' : 'disabled',
      timestamp: new Date().toISOString(),
    })
  } catch {
    return NextResponse.json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
    }, { status: 503 })
  }
}

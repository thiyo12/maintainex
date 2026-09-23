import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`
    return NextResponse.json({
      status: 'healthy',
      release: 'v3-auth-tasker-flow-20260923',
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

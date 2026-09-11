import { NextResponse } from 'next/server'
import { getMetricsSummary, type MetricType } from '@/lib/metrics'

interface MetricEntry {
  name: string
  type: MetricType
  value: number
}

export async function GET(request: Request) {
  const authHeader = request.headers.get('x-internal-sync')
  const expectedSecret = process.env.INTERNAL_SYNC_SECRET

  if (!expectedSecret || authHeader !== expectedSecret) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const summary = getMetricsSummary()

  const metrics: MetricEntry[] = Object.entries(summary).map(([name, value]) => ({
    name,
    type: name.includes('counter') ? 'counter' : name.includes('histogram') ? 'histogram' : 'gauge',
    value,
  }))

  return NextResponse.json({
    metrics,
    timestamp: new Date().toISOString(),
    releaseSha: process.env.APP_RELEASE_SHA || 'unknown',
  })
}

import { getMetricsSummary, resetMetrics } from './index'

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy'
  version: string
  uptime: number
  timestamp: string
  checks: {
    process: string
    memory: string
  }
}

let startTime: number | null = null

export function startHealthTracking(): void {
  startTime = Date.now()
}

export function getHealthStatus(): HealthStatus {
  const memUsage = process.memoryUsage()
  const heapUsedMB = memUsage.heapUsed / 1024 / 1024
  const heapTotalMB = memUsage.heapTotal / 1024 / 1024
  const heapUsagePercent = heapTotalMB > 0 ? (heapUsedMB / heapTotalMB) * 100 : 0

  let status: HealthStatus['status'] = 'healthy'
  const checks: HealthStatus['checks'] = {
    process: 'ok',
    memory: 'ok',
  }

  if (heapUsagePercent > 90) {
    status = 'unhealthy'
    checks.memory = 'critical'
  } else if (heapUsagePercent > 75) {
    status = 'degraded'
    checks.memory = 'warning'
  }

  return {
    status,
    version: process.env.APP_RELEASE_SHA || 'unknown',
    uptime: startTime ? (Date.now() - startTime) / 1000 : 0,
    timestamp: new Date().toISOString(),
    checks,
  }
}

export { getMetricsSummary, resetMetrics }

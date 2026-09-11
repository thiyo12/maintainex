import { setGauge } from './index'

let startTime: number | null = null

export function startMetricsCollection(): void {
  startTime = Date.now()

  collectSystemMetrics()

  setInterval(collectSystemMetrics, 30000)
}

function collectSystemMetrics(): void {
  const memUsage = process.memoryUsage()
  setGauge('process_memory_rss_bytes', memUsage.rss)
  setGauge('process_memory_heap_used_bytes', memUsage.heapUsed)
  setGauge('process_memory_heap_total_bytes', memUsage.heapTotal)
  setGauge('process_memory_external_bytes', memUsage.external)

  if (startTime) {
    setGauge('process_uptime_seconds', (Date.now() - startTime) / 1000)
  }

  setGauge('process_active_handles', (process as any)._getActiveHandles?.()?.length || 0)
  setGauge('process_active_requests', (process as any)._getActiveRequests?.()?.length || 0)
}

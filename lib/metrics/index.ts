export type MetricType = 'counter' | 'histogram' | 'gauge'

export interface MetricPoint {
  name: string
  value: number
  type: MetricType
  labels?: Record<string, string>
  timestamp: Date
}

const metrics = new Map<string, { type: MetricType; value: number; labels?: Record<string, string> }>()

export function incrementCounter(name: string, value: number = 1, labels?: Record<string, string>): void {
  try {
    const key = `${name}:${JSON.stringify(labels || {})}`
    const existing = metrics.get(key)
    if (existing) {
      existing.value += value
    } else {
      metrics.set(key, { type: 'counter', value, labels })
    }
  } catch {
    // Metrics must never crash the caller
  }
}

export function setGauge(name: string, value: number, labels?: Record<string, string>): void {
  try {
    const key = `${name}:${JSON.stringify(labels || {})}`
    metrics.set(key, { type: 'gauge', value, labels })
  } catch {
    // Metrics must never crash the caller
  }
}

export function observeHistogram(name: string, value: number, labels?: Record<string, string>): void {
  try {
    const key = `${name}:${JSON.stringify(labels || {})}`
    const existing = metrics.get(key)
    if (existing) {
      existing.value = (existing.value + value) / 2
    } else {
      metrics.set(key, { type: 'histogram', value, labels })
    }
  } catch {
    // Metrics must never crash the caller
  }
}

export function getMetrics(): MetricPoint[] {
  const now = new Date()
  return Array.from(metrics.entries()).map(([key, data]) => {
    const [name] = key.split(':')
    return {
      name,
      value: data.value,
      type: data.type,
      labels: data.labels,
      timestamp: now,
    }
  })
}

export function getMetricsSummary(): Record<string, number> {
  const summary: Record<string, number> = {}
  for (const [key, data] of metrics.entries()) {
    const [name] = key.split(':')
    summary[name] = data.value
  }
  return summary
}

export function resetMetrics(): void {
  metrics.clear()
}

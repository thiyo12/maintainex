export function serializeBigInts<T>(value: T): any {
  return JSON.parse(
    JSON.stringify(value, (_key, child) =>
      typeof child === 'bigint' ? child.toString() : child
    )
  )
}

export function parseBenchmarkCents(value: unknown, field: string): bigint {
  if (value === undefined || value === null || value === '') {
    throw new Error(`${field} is required`)
  }

  const stringValue = typeof value === 'bigint' ? value.toString() : String(value).trim()
  if (!/^\d+$/.test(stringValue)) {
    throw new Error(`${field} must be a non-negative integer`)
  }

  const parsed = BigInt(stringValue)
  if (parsed > BigInt('9000000000000000')) {
    throw new Error(`${field} is out of range`)
  }

  return parsed
}

export function optionalBenchmarkCents(value: unknown, field: string): bigint | null | undefined {
  if (value === undefined) return undefined
  if (value === null || value === '') return null
  return parseBenchmarkCents(value, field)
}

export function boundedInteger(value: unknown, field: string, min: number, max: number): number {
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new Error(`${field} must be an integer between ${min} and ${max}`)
  }
  return parsed
}

export function safeText(value: unknown, max: number): string | null {
  if (value === undefined || value === null) return null
  const text = String(value).trim()
  return text ? text.slice(0, max) : null
}

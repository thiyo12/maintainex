export function safeParseJsonArr(val: string | null | undefined): string[] {
  if (!val) return []
  try {
    const parsed = JSON.parse(val)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return val ? val.split(',').map(s => s.trim()).filter(Boolean) : []
  }
}

export function jsonArrayContains(jsonVal: string | null | undefined, target: string): boolean {
  if (!jsonVal) return false
  try {
    const arr = JSON.parse(jsonVal)
    return Array.isArray(arr) && arr.includes(target)
  } catch {
    return false
  }
}

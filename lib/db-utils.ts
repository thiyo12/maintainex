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
  return readStoredList(jsonVal).includes(target)
}

// Robustly reads a stored list that may be a JSON string ('["LK","CA"]'),
// a comma-separated string ('LK,CA'), or a Postgres array literal ('{LK,CA}').
export function readStoredList(val: string | null | undefined): string[] {
  if (!val) return []
  const t = val.trim()
  if (!t) return []
  try {
    const p = JSON.parse(t)
    if (Array.isArray(p)) return p.map((x) => String(x))
  } catch {}
  if (t.startsWith('{') && t.endsWith('}')) {
    return t.slice(1, -1)
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => s.replace(/^"|"$/g, ''))
  }
  return t.split(',').map((s) => s.trim()).filter(Boolean)
}

export function storedListIncludes(val: string | null | undefined, target: string): boolean {
  return readStoredList(val).includes(target)
}

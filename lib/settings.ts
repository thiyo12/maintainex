import { prisma } from './prisma'

let cache: Record<string, any> = {}
let cacheAt = 0
const CACHE_TTL = 60 * 1000 // 60 seconds

function castValue(value: string, type: string): any {
  if (type === 'number') return parseFloat(value)
  if (type === 'boolean') return value === 'true'
  if (type === 'json') {
    try { return JSON.parse(value) } catch { return value }
  }
  return value
}

export async function getSetting(key: string, fallback: any = null): Promise<any> {
  const now = Date.now()
  if (Object.keys(cache).length === 0 || now - cacheAt > CACHE_TTL) {
    const rows = await prisma.appSetting.findMany()
    cache = {}
    for (const row of rows) {
      cache[row.key] = castValue(row.value, row.type)
    }
    cacheAt = now
  }
  return cache[key] ?? fallback
}

export async function getSettingsByGroup(groupName: string): Promise<Record<string, any>> {
  await getSetting('__warm') // ensure cache is warm
  const rows = await prisma.appSetting.findMany({ where: { groupName } })
  const result: Record<string, any> = {}
  for (const row of rows) {
    result[row.key] = castValue(row.value, row.type)
  }
  return result
}

export async function setSetting(key: string, value: any, adminId?: string): Promise<void> {
  await prisma.appSetting.update({
    where: { key },
    data: {
      value: String(value),
      updatedBy: adminId || null,
    },
  })
  cache = {} // bust cache
}

export async function getAllSettings(): Promise<any[]> {
  return prisma.appSetting.findMany({ orderBy: { groupName: 'asc' } })
}

export function clearSettingsCache(): void {
  cache = {}
  cacheAt = 0
}

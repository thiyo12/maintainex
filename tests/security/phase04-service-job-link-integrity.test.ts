import { describe, expect, it, vi } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { resolveJobRequirements } from '@/lib/matching/index'

function database(linkedTemplateJobId: string | null) {
  return {
    jobCategory: { findUnique: vi.fn().mockResolvedValue({ id: 'plumbing', slug: 'plumbing' }) },
    serviceTemplate: { findUnique: vi.fn().mockResolvedValue({
      slug: 'pipe-repair', jobCategoryId: 'plumbing',
      templateJobId: linkedTemplateJobId,
    }) },
    templateJob: { findUnique: vi.fn().mockImplementation(async ({ where }) => ({
      id: where.id, categoryId: 'plumbing',
    })) },
  } as unknown as PrismaClient
}

describe('Phase 04 — service/template booking identity is immutable for matching', () => {
  it('accepts matching direct and linked canonical job IDs', async () => {
    const db = database('job-a')
    const result = await resolveJobRequirements(db, 'plumbing', 'service-a', 'job-a')
    expect(result?.templateJobIds).toEqual(['job-a'])
  })

  it('blocks a service linked to job A being represented as job B, even within a category', async () => {
    const db = database('job-a')
    expect(await resolveJobRequirements(db, 'plumbing', 'service-a', 'job-b')).toBeNull()
  })

  it('preserves a historical direct-job booking with no linked ServiceTemplate', async () => {
    const db = database(null)
    expect((await resolveJobRequirements(db, 'plumbing', undefined, 'job-b'))?.templateJobIds)
      .toEqual(['job-b'])
  })

  it('rejects a linked TemplateJob whose actual category differs', async () => {
    const db = database('job-a')
    vi.mocked(db.templateJob.findUnique).mockResolvedValue({
      id: 'job-a', categoryId: 'electrical',
    } as never)
    expect(await resolveJobRequirements(db, 'plumbing', 'service-a')).toBeNull()
  })
})

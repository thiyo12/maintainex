import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

describe('Mobile marketplace taxonomy source-of-truth', () => {
  it('loads customer categories and templates from canonical mobile APIs', () => {
    const api = readFileSync(
      resolve(process.cwd(), 'apps/mobile/api/jobs.ts'),
      'utf8'
    )
    const screen = readFileSync(
      resolve(process.cwd(), 'apps/mobile/features/customer/screens/find/[categoryId].tsx'),
      'utf8'
    )

    expect(api).toContain("request<JobCategory[]>(`/api/mobile/job-categories")
    expect(api).toContain("request<TemplateJob[]>(`/api/mobile/template-jobs")
    expect(screen).toContain('jobCategories.get')
    expect(screen).toContain('templateJobs.listByCategory')
    expect(screen).not.toContain("from '@/lib/categories'")
  })

  it('serves active database taxonomy records to mobile clients', () => {
    const categories = readFileSync(
      resolve(process.cwd(), 'app/api/mobile/job-categories/route.ts'),
      'utf8'
    )
    const templates = readFileSync(
      resolve(process.cwd(), 'app/api/mobile/template-jobs/route.ts'),
      'utf8'
    )

    expect(categories).toContain('prisma.jobCategory.findMany')
    expect(categories).toContain('isActive: true')
    expect(templates).toContain('prisma.templateJob.findMany')
    expect(templates).toContain('isActive: true')
  })

  it('keeps the legacy categories file presentation-only for current customer cards', () => {
    const card = readFileSync(
      resolve(process.cwd(), 'apps/mobile/features/customer/components/CategoryCard.tsx'),
      'utf8'
    )
    expect(card).toContain('getCategoryI18nKey')
    expect(card).not.toContain('categories.map')
    expect(card).not.toContain('getCategoryById')
    expect(card).not.toContain('getCategoryByName')
  })
})

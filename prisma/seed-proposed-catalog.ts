/**
 * PROPOSED catalogue import (Phase 01, Step 4).
 *
 * This script NEVER activates proposed entries. It is gated behind an explicit
 * environment flag and always writes isActive = false, because the expansion was
 * never previously approved and must be reviewed before it can reach customers.
 *
 * Usage:
 *   PROPOSED_CATALOGUE_APPLY=1 npx tsx prisma/seed-proposed-catalog.ts
 *
 * Existing live services are never modified or deleted: departments are upserted
 * by name and services are inserted only when no matching name exists in that
 * department.
 */

import { PrismaClient } from '@prisma/client'

import {
  PROPOSED_DEPARTMENTS,
  PROPOSED_SERVICES,
  buildProposedImportRows,
  getSafeProposedImportPricing,
} from '../lib/catalog/proposed-expansion'

const prisma = new PrismaClient()

const APPLY = process.env.PROPOSED_CATALOGUE_APPLY === '1'

const slugify = (name: string) =>
  name
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

async function main() {
  if (!APPLY) {
    console.log(
      '[proposed-catalogue] DRY RUN. Nothing written.\n' +
        '[proposed-catalogue] Set PROPOSED_CATALOGUE_APPLY=1 to import proposed entries (inactive).\n' +
        '[proposed-catalogue] These entries were NOT previously approved.',
    )
    printPlan()
    return
  }

  let departmentsCreated = 0
  let servicesInserted = 0
  let servicesSkipped = 0

  for (const department of PROPOSED_DEPARTMENTS) {
    const slug = slugify(department.name)
    const existing = await prisma.jobCategory.findUnique({ where: { name: department.name } })
    if (existing) {
      console.log(`[proposed-catalogue] department exists, leaving untouched: ${department.name}`)
      continue
    }
    await prisma.jobCategory.create({
      data: {
        name: department.name,
        slug,
        iconName: department.iconName,
        colorHex: department.colorHex,
        sortOrder: department.sortOrder,
        countries: JSON.stringify(department.markets),
        // Proposed departments stay inactive until reviewed.
        isActive: false,
      },
    })
    departmentsCreated += 1
    console.log(`[proposed-catalogue] created inactive department: ${department.name}`)
  }

  const rows = buildProposedImportRows(PROPOSED_SERVICES)

  for (const row of rows) {
    const importPricing = getSafeProposedImportPricing(row)
    if (!importPricing) {
      // Keep this service in the 309-item review dataset. Do not invent CAD
      // prices or create CA/LKR rows that could later be activated by mistake.
      servicesSkipped += 1
      console.log(`[proposed-catalogue] awaiting independently approved market price: ${row.name}`)
      continue
    }
    const category = await resolveCategory(row.department)
    if (!category) {
      servicesSkipped += 1
      continue
    }

    const existing = await prisma.templateJob.findFirst({
      where: { categoryId: category.id, name: row.name },
    })
    if (existing) {
      // Never overwrite or replace a live service.
      servicesSkipped += 1
      continue
    }

    await prisma.templateJob.create({
      data: {
        categoryId: category.id,
        name: row.name,
        description: row.description,
        whatIsIncluded: row.whatIsIncluded.join('\n'),
        typicalDurationMinutes: row.typicalDurationMinutes,
        // Persist only the LKR/LK staging grant. Vancouver needs separate
        // independently priced CAD records after explicit approval.
        priceMin: importPricing.priceMin,
        priceMax: importPricing.priceMax,
        currency: importPricing.currency,
        countries: importPricing.countries,
        isCompanyOnly: row.isCompanyOnly,
        // Always inactive until the catalogue is approved.
        isActive: false,
      },
    })
    servicesInserted += 1
  }

  console.log(
    `[proposed-catalogue] done: departments=${departmentsCreated} services=${servicesInserted} skipped=${servicesSkipped}`,
  )
  console.log('[proposed-catalogue] all proposed entries remain inactive pending review')
}

async function resolveCategory(departmentSlug: string) {
  const proposed = PROPOSED_DEPARTMENTS.find(d => d.slug === departmentSlug)
  if (proposed) {
    return prisma.jobCategory.findUnique({ where: { name: proposed.name } })
  }
  return prisma.jobCategory.findFirst({ where: { slug: departmentSlug } })
}

function printPlan() {
  const byDepartment = new Map<string, number>()
  for (const service of PROPOSED_SERVICES) {
    byDepartment.set(service.department, (byDepartment.get(service.department) ?? 0) + 1)
  }
  console.log(`[proposed-catalogue] proposed departments: ${PROPOSED_DEPARTMENTS.length}`)
  console.log(`[proposed-catalogue] proposed services: ${PROPOSED_SERVICES.length}`)
  for (const [slug, count] of [...byDepartment.entries()].sort()) {
    console.log(`[proposed-catalogue]   ${slug}: ${count}`)
  }
}

main()
  .catch(error => {
    console.error('[proposed-catalogue] failed', error)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())

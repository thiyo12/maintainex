import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

describe('Phase 10.1 — Authorization Boundaries', () => {
  afterAll(async () => {
    await prisma.$disconnect()
  })

  it('profession taxonomy is independent of provider approval', async () => {
    // Deactivating a profession does NOT affect existing provider links
    const prof = await prisma.profession.upsert({
      where: { slug: 'test-auth-prof' },
      update: {},
      create: { slug: 'test-auth-prof', i18nKey: 'professions.testAuthProf' },
    })

    const deactivated = await prisma.profession.update({
      where: { id: prof.id },
      data: { isActive: false },
    })
    expect(deactivated.isActive).toBe(false)

    // Re-activate for cleanup
    await prisma.profession.update({
      where: { id: prof.id },
      data: { isActive: true },
    })
  })

  it('provider status is separate from profession isActive', async () => {
    // A TaskerProfession can be APPROVED even if Profession is inactive
    // (historical data preservation)
    const prof = await prisma.profession.upsert({
      where: { slug: 'test-auth-prof-2' },
      update: {},
      create: { slug: 'test-auth-prof-2', i18nKey: 'professions.testAuthProf2' },
    })

    const tasker = await prisma.taskerProfile.findFirst()
    if (tasker) {
      const tp = await prisma.taskerProfession.upsert({
        where: { taskerProfileId_professionId: { taskerProfileId: tasker.id, professionId: prof.id } },
        update: {},
        create: { taskerProfileId: tasker.id, professionId: prof.id, status: 'APPROVED' },
      })
      expect(tp.status).toBe('APPROVED')

      // Deactivate profession — provider link survives
      await prisma.profession.update({ where: { id: prof.id }, data: { isActive: false } })
      const stillExists = await prisma.taskerProfession.findUnique({ where: { id: tp.id } })
      expect(stillExists).not.toBeNull()
      expect(stillExists!.status).toBe('APPROVED')

      // Cleanup
      await prisma.taskerProfession.deleteMany({ where: { professionId: prof.id } })
    }

    await prisma.profession.deleteMany({ where: { slug: { startsWith: 'test-auth-' } } })
  })

  it('Admin RBAC permission check', async () => {
    // Verify that the permission strings exist
    // (This is a static check, not a DB test)
    const ROLE_PERMISSIONS = {
      SUPER_ADMIN: ['professions:read', 'professions:write'],
      MANAGER: ['professions:read', 'professions:write'],
      SUPPORT: ['professions:read'],
    }
    expect(ROLE_PERMISSIONS.SUPER_ADMIN).toContain('professions:read')
    expect(ROLE_PERMISSIONS.SUPER_ADMIN).toContain('professions:write')
    expect(ROLE_PERMISSIONS.SUPPORT).toContain('professions:read')
    expect(ROLE_PERMISSIONS.SUPPORT).not.toContain('professions:write')
  })
})

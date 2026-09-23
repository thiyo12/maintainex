import { prisma, type PrismaClientOrTx } from './prisma'
import { postWalletCredit } from './ledger'
import type { InteractiveTestRole } from './test-cert'

const DEMO_EMAIL_DOMAIN = '@maintainex-test.lk'
const DEMO_WALLET_MAJOR = 1_000_000
const DEMO_WALLET_MINOR = 100_000_000n

export function getDemoMarketCountry(): string {
  const configured = (process.env.DEMO_MARKET_COUNTRY || 'LK').trim().toUpperCase()
  return /^[A-Z]{2,3}$/.test(configured) ? configured : 'LK'
}

function demoProviderName(name: string, slug: string | null): string {
  const key = `${name} ${slug || ''}`.toLowerCase()
  if (/air|ac|refriger/.test(key)) return 'Arun AC Technician'
  if (/plumb|water/.test(key)) return 'Suresh Plumbing Pro'
  if (/electric/.test(key)) return 'Kajan Electrician'
  if (/clean/.test(key)) return 'Nimal Cleaning Pro'
  if (/cctv|security|camera/.test(key)) return 'Ravi Security Technician'
  if (/software|computer|\bit\b|network/.test(key)) return 'Asha IT Specialist'
  if (/paint|renovat|construct|floor|ceiling/.test(key)) return 'Kumar Renovation Pro'
  if (/garden|outdoor|landscape/.test(key)) return 'Mohan Garden Care'
  if (/appliance|washing|fridge/.test(key)) return 'Dinesh Appliance Technician'
  return `${name} Specialist`
}

function safeSlug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '.').replace(/^\.|\.$/g, '').slice(0, 50) || 'service'
}

async function ensureCredentials(
  client: PrismaClientOrTx,
  holderType: 'INDIVIDUAL' | 'COMPANY',
  holderId: string,
  countryCode: string,
  professionIds?: string[],
) {
  const requirements = await client.professionJurisdictionRequirement.findMany({
    where: {
      countryCode,
      isActive: true,
      credentialRequired: true,
      ...(professionIds?.length ? { professionId: { in: professionIds } } : {}),
    },
    select: { credentialType: true },
  })

  const types = [...new Set(requirements.map((item) => item.credentialType).filter((item): item is string => Boolean(item)))]
  for (const certificationType of types) {
    const existing = await client.certification.findFirst({
      where: { holderType, holderId, certificationType, verificationStatus: 'VERIFIED', isActive: true },
      select: { id: true },
    })
    if (!existing) {
      await client.certification.create({
        data: {
          holderType,
          holderId,
          certificationType,
          name: `Demo verified ${certificationType}`,
          issuer: 'MaintainEX QA',
          referenceNumber: `DEMO-${holderId.slice(-6)}-${safeSlug(certificationType).toUpperCase()}`,
          verificationStatus: 'VERIFIED',
          verifiedAt: new Date(),
          isActive: true,
        },
      })
    }
  }
}

async function approveAllTaskerProfessions(client: PrismaClientOrTx, taskerProfileId: string) {
  const professions = await client.profession.findMany({
    where: { isActive: true },
    include: { skills: { where: { isActive: true }, select: { id: true } } },
  })

  for (const profession of professions) {
    const row = await client.taskerProfession.upsert({
      where: { taskerProfileId_professionId: { taskerProfileId, professionId: profession.id } },
      update: { status: 'APPROVED', approvedAt: new Date() },
      create: { taskerProfileId, professionId: profession.id, status: 'APPROVED', approvedAt: new Date() },
      select: { id: true },
    })
    if (profession.skills.length) {
      await client.taskerProfessionSkill.createMany({
        data: profession.skills.map((skill) => ({ taskerProfessionId: row.id, professionSkillId: skill.id })),
        skipDuplicates: true,
      })
    }
  }

  return professions.map((profession) => profession.id)
}

async function approveAllCompanyProfessions(client: PrismaClientOrTx, companyProfileId: string) {
  const professions = await client.profession.findMany({
    where: { isActive: true },
    include: { skills: { where: { isActive: true }, select: { id: true } } },
  })

  for (const profession of professions) {
    const row = await client.companyProfession.upsert({
      where: { companyProfileId_professionId: { companyProfileId, professionId: profession.id } },
      update: { status: 'APPROVED', approvedAt: new Date() },
      create: { companyProfileId, professionId: profession.id, status: 'APPROVED', approvedAt: new Date() },
      select: { id: true },
    })
    if (profession.skills.length) {
      await client.companyProfessionSkill.createMany({
        data: profession.skills.map((skill) => ({ companyProfessionId: row.id, professionSkillId: skill.id })),
        skipDuplicates: true,
      })
    }
  }

  return professions.map((profession) => profession.id)
}

async function approveCategoryProfessions(
  client: PrismaClientOrTx,
  taskerProfileId: string,
  categoryId: string,
) {
  const templates = await client.serviceTemplate.findMany({
    where: { jobCategoryId: categoryId, isActive: true },
    select: { id: true },
  })
  if (!templates.length) return [] as string[]

  const requirements = await client.serviceProfessionRequirement.findMany({
    where: { serviceTemplateId: { in: templates.map((template) => template.id) } },
    include: {
      skillRequirements: { select: { professionSkillId: true } },
    },
  })

  const professionIds = [...new Set(requirements.map((requirement) => requirement.professionId))]
  for (const professionId of professionIds) {
    const row = await client.taskerProfession.upsert({
      where: { taskerProfileId_professionId: { taskerProfileId, professionId } },
      update: { status: 'APPROVED', approvedAt: new Date() },
      create: { taskerProfileId, professionId, status: 'APPROVED', approvedAt: new Date() },
      select: { id: true },
    })
    const skillIds = [...new Set(
      requirements
        .filter((requirement) => requirement.professionId === professionId)
        .flatMap((requirement) => requirement.skillRequirements.map((skill) => skill.professionSkillId)),
    )]
    if (skillIds.length) {
      await client.taskerProfessionSkill.createMany({
        data: skillIds.map((professionSkillId) => ({ taskerProfessionId: row.id, professionSkillId })),
        skipDuplicates: true,
      })
    }
  }

  return professionIds
}

async function ensureDemoCustomerWallet(userId: string) {
  const wallet = await prisma.customerWallet.upsert({
    where: { userId },
    update: {},
    create: { userId, balance: DEMO_WALLET_MAJOR, currency: 'LKR' },
    select: { id: true },
  })

  const canonical = await prisma.walletBalance.findUnique({
    where: { walletType_walletId_currency: { walletType: 'CUSTOMER', walletId: wallet.id, currency: 'LKR' } },
    select: { id: true },
  })

  if (!canonical) {
    await prisma.customerWallet.update({ where: { userId }, data: { balance: DEMO_WALLET_MAJOR } })
    await postWalletCredit(
      wallet.id,
      'CUSTOMER_WALLET',
      DEMO_WALLET_MINOR,
      'DEMO_QA_SEED',
      userId,
      `demo-wallet-seed:${userId}:v1`,
      userId,
      'LKR',
    )
  }
}

async function seedDemoProviderCatalog(countryCode: string) {
  await prisma.$transaction(async (tx) => {
    const categories = await tx.jobCategory.findMany({
      where: { isActive: true },
      select: { id: true, slug: true, name: true },
      orderBy: { sortOrder: 'asc' },
    })
    const jobs = await tx.templateJob.findMany({
      where: { isActive: true, isCompanyOnly: false },
      select: { id: true, categoryId: true, currency: true },
    })

    for (let index = 0; index < categories.length; index += 1) {
      const category = categories[index]
      const email = `demo.provider.${safeSlug(category.slug || category.name)}${DEMO_EMAIL_DOMAIN}`
      const name = demoProviderName(category.name, category.slug)

      const user = await tx.user.upsert({
        where: { email },
        update: {
          name,
          role: 'TASKER',
          countryCode,
          isActive: true,
          isSuspended: false,
          isBanned: false,
          phoneVerified: true,
          identityStatus: 'VERIFIED',
        },
        create: {
          email,
          passwordHash: '',
          name,
          role: 'TASKER',
          countryCode,
          isActive: true,
          phoneVerified: true,
          emailVerified: true,
          identityStatus: 'VERIFIED',
        },
      })

      const profile = await tx.taskerProfile.upsert({
        where: { userId: user.id },
        update: {
          skills: JSON.stringify([category.id, category.slug, category.name].filter(Boolean)),
          countryCode,
          verificationStatus: 'VERIFIED',
          isVerified: true,
          isOnline: true,
          rating: 4.6 + (index % 4) * 0.1,
          completedJobs: 18 + index,
          compositeScore: 82 + (index % 12),
          latitude: 6.9271 + (index % 5) * 0.006,
          longitude: 79.8612 + (index % 4) * 0.006,
          serviceRadius: 80,
          bio: `Verified MaintainEX demo specialist for ${category.name}.`,
        },
        create: {
          userId: user.id,
          skills: JSON.stringify([category.id, category.slug, category.name].filter(Boolean)),
          countryCode,
          verificationStatus: 'VERIFIED',
          isVerified: true,
          isOnline: true,
          rating: 4.6 + (index % 4) * 0.1,
          completedJobs: 18 + index,
          compositeScore: 82 + (index % 12),
          latitude: 6.9271 + (index % 5) * 0.006,
          longitude: 79.8612 + (index % 4) * 0.006,
          serviceRadius: 80,
          bio: `Verified MaintainEX demo specialist for ${category.name}.`,
        },
      })

      for (const job of jobs.filter((item) => item.categoryId === category.id)) {
        await tx.taskerSkill.upsert({
          where: { taskerId_jobId: { taskerId: profile.id, jobId: job.id } },
          update: { countryCode, currency: job.currency || 'LKR' },
          create: {
            taskerId: profile.id,
            jobId: job.id,
            experienceYears: 5,
            experienceLevel: 3,
            hourlyRate: 0,
            fixedRate: 0,
            currency: job.currency || 'LKR',
            countryCode,
          },
        })
      }

      const professionIds = await approveCategoryProfessions(tx, profile.id, category.id)
      await ensureCredentials(tx, 'INDIVIDUAL', user.id, countryCode, professionIds)
    }
  })
}

export async function provisionInteractiveDemoMarketplace(
  userId: string,
  role: InteractiveTestRole,
): Promise<void> {
  if (process.env.ALLOW_TEST_OTP !== 'true') return

  const countryCode = getDemoMarketCountry()

  await prisma.user.update({
    where: { id: userId },
    data: {
      countryCode,
      ...(role === 'CUSTOMER'
        ? {}
        : { identityStatus: 'VERIFIED', phoneVerified: true }),
    },
  })

  if (role === 'CUSTOMER') {
    await ensureDemoCustomerWallet(userId)
    await seedDemoProviderCatalog(countryCode)
    return
  }

  await prisma.$transaction(async (tx) => {
    const categories = await tx.jobCategory.findMany({
      where: { isActive: true },
      select: { id: true, slug: true, name: true },
    })
    const jobs = await tx.templateJob.findMany({
      where: { isActive: true, isCompanyOnly: false },
      select: { id: true, categoryId: true, currency: true },
    })

    if (role === 'TASKER') {
      const profile = await tx.taskerProfile.upsert({
        where: { userId },
        update: {
          skills: JSON.stringify(categories.flatMap((category) => [category.id, category.slug, category.name].filter(Boolean))),
          countryCode,
          verificationStatus: 'VERIFIED',
          isVerified: true,
          isOnline: true,
          latitude: 6.9271,
          longitude: 79.8612,
          serviceRadius: 100,
        },
        create: {
          userId,
          skills: JSON.stringify(categories.flatMap((category) => [category.id, category.slug, category.name].filter(Boolean))),
          countryCode,
          verificationStatus: 'VERIFIED',
          isVerified: true,
          isOnline: true,
          latitude: 6.9271,
          longitude: 79.8612,
          serviceRadius: 100,
        },
      })

      for (const job of jobs) {
        await tx.taskerSkill.upsert({
          where: { taskerId_jobId: { taskerId: profile.id, jobId: job.id } },
          update: { countryCode, currency: job.currency || 'LKR' },
          create: {
            taskerId: profile.id,
            jobId: job.id,
            experienceYears: 5,
            experienceLevel: 3,
            hourlyRate: 0,
            fixedRate: 0,
            currency: job.currency || 'LKR',
            countryCode,
          },
        })
      }

      const professionIds = await approveAllTaskerProfessions(tx, profile.id)
      await ensureCredentials(tx, 'INDIVIDUAL', userId, countryCode, professionIds)
      return
    }

    const company = await tx.companyProfile.upsert({
      where: { userId },
      update: {
        companyName: 'MaintainEX Demo Company',
        services: JSON.stringify(categories.flatMap((category) => [category.id, category.slug, category.name].filter(Boolean))),
        serviceAreas: JSON.stringify(['Colombo', 'Jaffna', 'Western Province', 'Northern Province']),
        countryCode,
        verificationStatus: 'VERIFIED',
        isVerified: true,
        subscriptionStatus: 'TRIAL',
        latitude: 6.9271,
        longitude: 79.8612,
        serviceRadius: 120,
      },
      create: {
        userId,
        companyName: 'MaintainEX Demo Company',
        services: JSON.stringify(categories.flatMap((category) => [category.id, category.slug, category.name].filter(Boolean))),
        serviceAreas: JSON.stringify(['Colombo', 'Jaffna', 'Western Province', 'Northern Province']),
        countryCode,
        verificationStatus: 'VERIFIED',
        isVerified: true,
        subscriptionStatus: 'TRIAL',
        latitude: 6.9271,
        longitude: 79.8612,
        serviceRadius: 120,
      },
    })

    const existingSpecialties = await tx.companySpecialty.findMany({
      where: { companyId: company.id },
      select: { categoryId: true },
    })
    const specialtyIds = new Set(existingSpecialties.map((row) => row.categoryId).filter(Boolean))
    for (const category of categories) {
      if (!specialtyIds.has(category.id)) {
        await tx.companySpecialty.create({ data: { companyId: company.id, categoryId: category.id } })
      }
    }

    const professionIds = await approveAllCompanyProfessions(tx, company.id)
    await ensureCredentials(tx, 'COMPANY', company.id, countryCode, professionIds)
  })

  await seedDemoProviderCatalog(countryCode)
}

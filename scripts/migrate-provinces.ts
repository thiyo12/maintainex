import { PrismaClient } from "@prisma/client"
import { DISTRICT_TO_PROVINCE, PROVINCES } from "../lib/provinces"

const prisma = new PrismaClient()

async function findBranchByProvince(province: string): Promise<{ id: string } | null> {
  const branch = await prisma.branch.findFirst({
    where: {
      province: province,
      isActive: true,
    },
    select: { id: true },
    orderBy: { createdAt: "asc" },
  })
  return branch
}

async function migrateProvinces() {
  console.log("Starting province migration...\n")

  console.log("1. Migrating branches...")
  const branches = await prisma.branch.findMany({
    select: { id: true, name: true, province: true, districts: true },
  })

  let branchCount = 0
  for (const branch of branches) {
    if (branch.province) continue

    let targetProvince: string | null = null
    const matchingProvince = PROVINCES.find((p) =>
      branch.name.toLowerCase().includes(p.toLowerCase())
    )
    if (matchingProvince) {
      targetProvince = matchingProvince
    } else if (branch.districts) {
      try {
        const districtsArray = JSON.parse(branch.districts)
        if (Array.isArray(districtsArray) && districtsArray.length > 0) {
          targetProvince = DISTRICT_TO_PROVINCE[districtsArray[0]] || null
        }
      } catch {
        targetProvince = DISTRICT_TO_PROVINCE[branch.districts] || null
      }
    }

    if (targetProvince) {
      await prisma.branch.update({
        where: { id: branch.id },
        data: { province: targetProvince },
      })
      branchCount++
    }
  }
  console.log(`   Updated ${branchCount} branches with provinces`)

  console.log("\n2. Migrating admins...")
  const admins = await prisma.admin.findMany({
    where: { branchId: { not: null }, province: null },
    select: { id: true, branchId: true },
  })

  let adminCount = 0
  for (const admin of admins) {
    if (!admin.branchId) continue
    const branch = await prisma.branch.findUnique({
      where: { id: admin.branchId },
      select: { province: true },
    })
    if (branch?.province) {
      await prisma.admin.update({
        where: { id: admin.id },
        data: { province: branch.province },
      })
      adminCount++
    }
  }
  console.log(`   Updated ${adminCount} admins with provinces from their branches`)

  console.log("\n3. Migrating bookings without province...")
  const bookings = await prisma.booking.findMany({
    where: { province: null, district: { not: null } },
    select: { id: true, district: true },
  })

  let bookingCount = 0
  for (const booking of bookings) {
    if (!booking.district) continue
    const province = DISTRICT_TO_PROVINCE[booking.district]
    if (province) {
      await prisma.booking.update({
        where: { id: booking.id },
        data: { province },
      })
      bookingCount++
    }
  }
  console.log(`   Updated ${bookingCount} bookings with provinces from districts`)

  console.log("\n4. Migrating applications without province...")
  const applications = await prisma.application.findMany({
    where: { province: null, district: { not: null } },
    select: { id: true, district: true },
  })

  let applicationCount = 0
  for (const app of applications) {
    if (!app.district) continue
    const province = DISTRICT_TO_PROVINCE[app.district]
    if (province) {
      await prisma.application.update({
        where: { id: app.id },
        data: { province },
      })
      applicationCount++
    }
  }
  console.log(`   Updated ${applicationCount} applications with provinces from districts`)

  console.log("\n5. Assigning branchIds to bookings...")
  const allBookings = await prisma.booking.findMany({
    select: { id: true, province: true, branchId: true },
  })

  let bookingsBranchCount = 0
  for (const booking of allBookings) {
    if (booking.branchId) continue
    if (!booking.province) continue

    const branch = await findBranchByProvince(booking.province)
    if (branch) {
      await prisma.booking.update({
        where: { id: booking.id },
        data: { branchId: branch.id },
      })
      bookingsBranchCount++
    }
  }
  console.log(`   Updated ${bookingsBranchCount} bookings with branchIds from provinces`)

  console.log("\n6. Assigning branchIds to applications...")
  const allApps = await prisma.application.findMany({
    select: { id: true, province: true, branchId: true },
  })

  let applicationsBranchCount = 0
  for (const app of allApps) {
    if (app.branchId) continue
    if (!app.province) continue

    const branch = await findBranchByProvince(app.province)
    if (branch) {
      await prisma.application.update({
        where: { id: app.id },
        data: { branchId: branch.id },
      })
      applicationsBranchCount++
    }
  }
  console.log(`   Updated ${applicationsBranchCount} applications with branchIds from provinces`)

  console.log("\n✅ Migration completed!")
  console.log("Summary:")
  console.log(`  - Branches: ${branchCount}`)
  console.log(`  - Admins: ${adminCount}`)
  console.log(`  - Bookings (province): ${bookingCount}`)
  console.log(`  - Applications (province): ${applicationCount}`)
  console.log(`  - Bookings (branchId): ${bookingsBranchCount}`)
  console.log(`  - Applications (branchId): ${applicationsBranchCount}`)
}

migrateProvinces()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("Migration failed:", e)
    process.exit(1)
  })

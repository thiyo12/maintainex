import { PrismaClient } from "@prisma/client"
import { DISTRICT_TO_PROVINCE, PROVINCES } from "../lib/provinces"

const prisma = new PrismaClient()

/**
 * Find the first active branch that matches the given province
 */
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

/**
 * Get the first district from a branch's districts array
 */
function getFirstDistrictFromBranch(districts: string | undefined): string | null {
  if (!districts) return null
  try {
    const districtsArray = JSON.parse(districts)
    if (Array.isArray(districtsArray) && districtsArray.length > 0) {
      return districtsArray[0]
    }
  } catch {
    // If it's not JSON, treat it as a single district
    return districts
  }
  return null
}

/**
 * Main migration function to assign provinces to existing data
 */
async function migrateProvinces() {
  console.log("Starting province migration...\n")

  // ============================================================
  // 1. Migrate branches - assign province based on name or districts
  // ============================================================
  console.log("1. Migrating branches...")

  const branches = await prisma.branch.findMany({
    select: { id: true, name: true, province: true, districts: true },
  })

  let branchCount = 0
  for (const branch of branches) {
    if (branch.province) continue

    let targetProvince: string | null = null

    // Try to match branch name to province name
    const matchingProvince = PROVINCES.find((p) =>
      branch.name.toLowerCase().includes(p.toLowerCase())
    )
    if (matchingProvince) {
      targetProvince = matchingProvince
    } else {
      // Try to get province from first district
      const firstDistrict = getFirstDistrictFromBranch(branch.districts)
      if (firstDistrict) {
        targetProvince = DISTRICT_TO_PROVINCE[firstDistrict] || null
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

  // ============================================================
  // 2. Migrate admins - assign province from their branch
  // ============================================================
  console.log("\n2. Migrating admins...")

  const admins = await prisma.admin.findMany({
    where: {
      branchId: { not: null },
      province: null,
    },
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

  // ============================================================
  // 3. Migrate bookings - assign province from district (if missing)
  // ============================================================
  console.log("\n3. Migrating bookings without province...")

  const bookings = await prisma.booking.findMany({
    where: {
      province: null,
      district: { not: null },
    },
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

  // ============================================================
  // 4. Migrate applications - assign province from district (if missing)
  // ============================================================
  console.log("\n4. Migrating applications without province...")

  const applications = await prisma.application.findMany({
    where: {
      province: null,
      district: { not: null },
    },
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

  // ============================================================
  // 5. Migrate bookings - assign branchId where missing (using province)
  // ============================================================
  console.log("\n5. Migrating bookings without branchId...")

  const bookingsWithoutBranch = await prisma.booking.findMany({
    where: {
      branchId: null,
      province: { not: null },
    },
    select: { id: true, province: true },
  })

  let bookingsBranchCount = 0
  for (const booking of bookingsWithoutBranch) {
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

  // ============================================================
  // 6. Migrate applications - assign branchId where missing (using province)
  // ============================================================
  console.log("\n6. Migrating applications without branchId...")

  const applicationsWithoutBranch = await prisma.application.findMany({
    where: {
      branchId: null,
      province: { not: null },
    },
    select: { id: true, province: true },
  })

  let applicationsBranchCount = 0
  for (const app of applicationsWithoutBranch) {
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

  // ============================================================
  // Final summary
  // ============================================================
  console.log("\n" + "=".repeat(50))
  console.log("Migration complete!")
  console.log("=".repeat(50))
  console.log(`Total updates:`)
  console.log(`  - Branches: ${branchCount}`)
  console.log(`  - Admins: ${adminCount}`)
  console.log(`  - Bookings (province): ${bookingCount}`)
  console.log(`  - Applications (province): ${applicationCount}`)
  console.log(`  - Bookings (branchId): ${bookingsBranchCount}`)
  console.log(`  - Applications (branchId): ${applicationsBranchCount}`)
}

/**
 * Run the migration
 */
async function main() {
  try {
    await migrateProvinces()
  } catch (error) {
    console.error("Migration failed:", error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()

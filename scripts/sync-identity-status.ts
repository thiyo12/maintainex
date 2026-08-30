import { PrismaClient } from '@prisma/client'

// One-off: the mobile quote route gates on identityStatus === 'VERIFIED', but the
// admin KYC approval flow used to write 'APPROVED'. This syncs any legacy rows.
// Run: npx ts-node --tsconfig tsconfig.json scripts/sync-identity-status.ts
const prisma = new PrismaClient()

async function main() {
  const users = await prisma.user.findMany({
    where: { identityStatus: 'APPROVED' },
    select: { id: true },
  })

  let updated = 0
  for (const u of users) {
    const approvedDocs = await prisma.identityDocument.count({
      where: { userId: u.id, status: 'APPROVED' },
    })
    if (approvedDocs >= 1) {
      await prisma.user.update({
        where: { id: u.id },
        data: { identityStatus: 'VERIFIED' },
      })
      updated++
    }
  }

  console.log(`Synced ${updated} of ${users.length} users: APPROVED -> VERIFIED`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
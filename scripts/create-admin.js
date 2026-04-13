const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

const prisma = new PrismaClient()

async function createAdmin() {
  const email = process.env.ADMIN_EMAIL || 'admin@maintain.lk'
  const password = process.env.ADMIN_PASSWORD

  if (!password) {
    console.error('Error: ADMIN_PASSWORD environment variable is required')
    console.error('Please set a secure password: export ADMIN_PASSWORD="your-secure-password"')
    process.exit(1)
  }

  if (password.length < 8) {
    console.error('Error: Password must be at least 8 characters long')
    process.exit(1)
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 12)
    
    const admin = await prisma.admin.upsert({
      where: { email },
      update: { password: hashedPassword },
      create: {
        email,
        password: hashedPassword,
        name: 'Admin'
      }
    })

    console.log('Admin created/updated successfully!')
    console.log(`Email: ${email}`)
    console.log('Password: [HIDDEN]')
  } catch (error) {
    console.error('Error creating admin:', error)
  } finally {
    await prisma.$disconnect()
  }
}

createAdmin()

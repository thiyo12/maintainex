const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

const prisma = new PrismaClient()

async function createAdmin() {
  const email = process.env.ADMIN_EMAIL || 'admin@maintainex.com'
  const password = process.env.ADMIN_PASSWORD || 'admin123'

  try {
    const hashedPassword = await bcrypt.hash(password, 10)
    
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
    console.log(`Password: ${password}`)
    console.log('Please change these credentials in production!')
  } catch (error) {
    console.error('Error creating admin:', error)
  } finally {
    await prisma.$disconnect()
  }
}

createAdmin()

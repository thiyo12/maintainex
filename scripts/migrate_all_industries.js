#!/usr/bin/env node
// Migrate Cloudinary-hosted industry images to local storage and update DB paths
const fs = require("fs")
const path = require("path")
const https = require("https")
const { PrismaClient } = require("@prisma/client")

const prisma = new PrismaClient()

async function download(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest)
    https.get(url, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error('Failed to download ' + url + ' - status ' + res.statusCode))
        return
      }
      res.pipe(file)
      file.on("finish", () => {
        file.close(resolve)
      })
    }).on("error", (e) => {
      fs.unlink(dest, () => reject(e))
    })
  })
}

async function main() {
  const industries = await prisma.industry.findMany({})
  const destDir = path.resolve(__dirname, '../public/uploads/industries')
  await fs.promises.mkdir(destDir, { recursive: true })

  let updated = 0
  for (const ind of industries) {
    const img = ind.image
    if (!img) continue
    if (typeof img !== 'string') continue
    if (img.startsWith('/uploads/')) continue
    if (img.includes('cloudinary.com')) {
      const url = img
      const slug = (ind.id || ind.name || 'industry').toString().toLowerCase().replace(/\s+/g, '-')
      const ext = path.extname(new URL(url).pathname) || '.jpg'
      const filename = slug + '-' + Date.now() + ext
      const dest = path.join(destDir, filename)
      try {
        await download(url, dest)
        const localUrl = '/uploads/industries/' + filename
        await prisma.industry.update({ where: { id: ind.id }, data: { image: localUrl } })
        console.log('[migrate] updated ' + ind.id + ' -> ' + localUrl)
        updated++
      } catch (e) {
        console.error('[migrate] failed for ' + ind.id + ': ' + (e?.message || e))
      }
    }
  }
  console.log('Migration completed. Updated: ' + updated)
}

main().catch((e) => {
  console.error('Migration error:', e)
}).finally(async () => {
  await prisma.$disconnect()
})
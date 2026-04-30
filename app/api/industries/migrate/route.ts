'use server'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth-utils'
import { writeFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'
import https from 'https'

async function downloadImage(url: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const file = require('fs').createWriteStream(dest)
    https.get(url, (res: any) => {
      if (res.statusCode !== 200) {
        reject(new Error('Failed to download ' + url + ' - status ' + res.statusCode))
        return
      }
      res.pipe(file)
      file.on('finish', () => {
        file.close(resolve)
      })
    }).on('error', (e: any) => {
      require('fs').unlink(dest, () => reject(e))
    })
  })
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession(request)
    if (!session || session.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const industries = await prisma.industry.findMany({})
    const uploadsDir = path.join(process.cwd(), 'public', 'uploads', 'industries')
    
    if (!existsSync(uploadsDir)) {
      await mkdir(uploadsDir, { recursive: true })
    }

    let updated = 0
    const errors: string[] = []

    for (const ind of industries) {
      const img = ind.image
      if (!img || typeof img !== 'string') continue
      if (img.startsWith('/uploads/')) continue
      if (!img.includes('cloudinary.com')) continue

      try {
        const slug = (ind.id || ind.name || 'industry').toString().toLowerCase().replace(/\s+/g, '-')
        const ext = path.extname(new URL(img).pathname) || '.jpg'
        const filename = slug + '-' + Date.now() + ext
        const dest = path.join(uploadsDir, filename)

        await downloadImage(img, dest)
        
        const localUrl = '/uploads/industries/' + filename
        await prisma.industry.update({
          where: { id: ind.id },
          data: { image: localUrl }
        })

        console.log('[migrate] updated ' + ind.id + ' -> ' + localUrl)
        updated++
      } catch (e) {
        const errMsg = '[migrate] failed for ' + ind.id + ': ' + (e instanceof Error ? e.message : String(e))
        console.error(errMsg)
        errors.push(errMsg)
      }
    }

    return NextResponse.json({ 
      success: true, 
      updated,
      message: 'Migration completed. Updated: ' + updated,
      errors: errors.length > 0 ? errors : undefined
    })
  } catch (error) {
    console.error('Migration error:', error)
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Migration failed' 
    }, { status: 500 })
  }
}
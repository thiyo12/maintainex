'use server'

import { secureConsole } from '@/lib/shared/observability/secure-console'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { guardCrmRequest } from '@/lib/crm/security'
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
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  try {
    const guard = await guardCrmRequest(request, {
      permission: 'catalog:edit',
      allowedRoles: ['SUPER_ADMIN'],
      level: 'sensitive',
    })
    if (!guard.ok) return guard.response

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
      let parsedUrl: URL
      try {
        parsedUrl = new URL(img)
      } catch {
        continue
      }
      if (
        parsedUrl.protocol !== 'https:' ||
        (parsedUrl.hostname !== 'res.cloudinary.com' && !parsedUrl.hostname.endsWith('.res.cloudinary.com'))
      ) continue

      try {
        const slug = (ind.id || ind.name || 'industry').toString().toLowerCase().replace(/\s+/g, '-')
        const rawExt = path.extname(parsedUrl.pathname).toLowerCase()
        const ext = ['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(rawExt) ? rawExt : '.jpg'
        const filename = slug + '-' + Date.now() + ext
        const dest = path.join(uploadsDir, filename)

        await downloadImage(img, dest)
        
        const localUrl = '/uploads/industries/' + filename
        await prisma.industry.update({
          where: { id: ind.id },
          data: { image: localUrl }
        })

        secureConsole.log('[migrate] updated ' + ind.id + ' -> ' + localUrl)
        updated++
      } catch (e) {
        const errMsg = '[migrate] failed for ' + ind.id + ': ' + (e instanceof Error ? e.message : String(e))
        secureConsole.error(errMsg)
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
    secureConsole.error('Migration error:', error)
    return NextResponse.json({ error: 'Migration failed' }, { status: 500 })
  }
}
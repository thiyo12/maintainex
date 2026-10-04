import { spawn } from 'child_process'
import { chmodSync, createWriteStream, existsSync, mkdirSync } from 'fs'
import { promises as fs } from 'fs'
import { join } from 'path'
import { pipeline } from 'stream/promises'
import { createGzip } from 'zlib'

export interface BackupConfig {
  databaseUrl: string
  backupDir: string
  retentionDays: number
  timestamp: string
}

export function getBackupConfig(): BackupConfig {
  return {
    databaseUrl: process.env.DATABASE_URL || '',
    backupDir: process.env.BACKUP_DIR || '/var/backups/maintainex',
    retentionDays: parseInt(process.env.BACKUP_RETENTION_DAYS || '30'),
    timestamp: new Date().toISOString().replace(/[:.]/g, '-'),
  }
}

async function dumpDatabaseToPrivateGzip(databaseUrl: string, filepath: string): Promise<void> {
  const child = spawn('pg_dump', [databaseUrl], {
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  let stderr = ''
  child.stderr.setEncoding('utf8')
  child.stderr.on('data', chunk => {
    if (stderr.length < 4096) stderr += String(chunk).slice(0, 4096 - stderr.length)
  })

  const exit = new Promise<void>((resolve, reject) => {
    child.once('error', reject)
    child.once('close', code => {
      if (code === 0) resolve()
      else reject(new Error(`pg_dump failed with exit code ${code ?? 'unknown'}`))
    })
  })

  const output = createWriteStream(filepath, {
    flags: 'wx',
    mode: 0o600,
  })

  try {
    await Promise.all([
      pipeline(child.stdout, createGzip(), output),
      exit,
    ])
    chmodSync(filepath, 0o600)
  } catch (error) {
    child.kill('SIGTERM')
    await fs.unlink(filepath).catch(() => undefined)
    // Never include pg_dump stderr or DATABASE_URL in the returned error.
    throw error instanceof Error
      ? new Error(error.message)
      : new Error('Database backup failed')
  }
}

export async function createDatabaseBackup(): Promise<{ success: boolean; path?: string; error?: string }> {
  const config = getBackupConfig()

  if (!config.databaseUrl) {
    return { success: false, error: 'DATABASE_URL not configured' }
  }

  try {
    if (!existsSync(config.backupDir)) {
      mkdirSync(config.backupDir, { recursive: true, mode: 0o700 })
    }
    chmodSync(config.backupDir, 0o700)

    const filename = `maintainex-db-${config.timestamp}.sql.gz`
    const filepath = join(config.backupDir, filename)

    await dumpDatabaseToPrivateGzip(config.databaseUrl, filepath)

    return { success: true, path: filepath }
  } catch {
    return { success: false, error: 'Database backup failed' }
  }
}

export async function listBackups(): Promise<string[]> {
  const config = getBackupConfig()
  try {
    const files = await fs.readdir(config.backupDir)
    return files
      .filter(file => file.startsWith('maintainex-db-') && file.endsWith('.sql.gz'))
      .sort()
      .reverse()
  } catch {
    return []
  }
}

export async function cleanupOldBackups(): Promise<{ deleted: number }> {
  const config = getBackupConfig()
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - config.retentionDays)

  let deleted = 0

  try {
    const files = await fs.readdir(config.backupDir)
    for (const file of files) {
      if (!file.startsWith('maintainex-db-') || !file.endsWith('.sql.gz')) continue

      const filepath = join(config.backupDir, file)
      const stats = await fs.stat(filepath)
      if (stats.mtime < cutoff) {
        await fs.unlink(filepath)
        deleted++
      }
    }
  } catch {
    // Cleanup is best-effort; backup creation remains independent.
  }

  return { deleted }
}

export async function verifyBackup(filepath: string): Promise<{ valid: boolean; size?: number; error?: string }> {
  try {
    const stats = await fs.stat(filepath)
    if (stats.size < 100) {
      return { valid: false, size: stats.size, error: 'Backup file too small' }
    }

    const handle = await fs.open(filepath, 'r')
    try {
      const header = Buffer.alloc(2)
      await handle.read(header, 0, 2, 0)
      if (header[0] !== 0x1f || header[1] !== 0x8b) {
        return { valid: false, size: stats.size, error: 'Not a valid gzip file' }
      }
    } finally {
      await handle.close()
    }

    return { valid: true, size: stats.size }
  } catch {
    return { valid: false, error: 'Backup verification failed' }
  }
}

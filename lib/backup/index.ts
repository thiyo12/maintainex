import { execSync } from 'child_process'
import { writeFileSync, mkdirSync, existsSync } from 'fs'
import { join } from 'path'

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

export async function createDatabaseBackup(): Promise<{ success: boolean; path?: string; error?: string }> {
  const config = getBackupConfig()

  if (!config.databaseUrl) {
    return { success: false, error: 'DATABASE_URL not configured' }
  }

  try {
    if (!existsSync(config.backupDir)) {
      mkdirSync(config.backupDir, { recursive: true })
    }

    const filename = `maintainex-db-${config.timestamp}.sql.gz`
    const filepath = join(config.backupDir, filename)

    const maskedUrl = config.databaseUrl.replace(/:[^@]+@/, ':***@')

    execSync(
      `pg_dump "${config.databaseUrl}" | gzip > "${filepath}"`,
      { timeout: 300000, stdio: 'pipe' }
    )

    return { success: true, path: filepath }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

export async function listBackups(): Promise<string[]> {
  const config = getBackupConfig()
  try {
    const fs = require('fs').promises
    const files = await fs.readdir(config.backupDir)
    return files.filter((f: string) => f.startsWith('maintainex-db-') && f.endsWith('.sql.gz')).sort().reverse()
  } catch {
    return []
  }
}

export async function cleanupOldBackups(): Promise<{ deleted: number }> {
  const config = getBackupConfig()
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - config.retentionDays)

  const fs = require('fs').promises
  let deleted = 0

  try {
    const files = await fs.readdir(config.backupDir)
    for (const file of files) {
      if (file.startsWith('maintainex-db-') && file.endsWith('.sql.gz')) {
        const match = file.match(/maintainex-db-(.+)\.sql\.gz/)
        if (match) {
          const fileDate = new Date(match[1].replace(/-/g, ':'))
          if (fileDate < cutoff) {
            await fs.unlink(join(config.backupDir, file))
            deleted++
          }
        }
      }
    }
  } catch {}

  return { deleted }
}

export async function verifyBackup(filepath: string): Promise<{ valid: boolean; size?: number; error?: string }> {
  const fs = require('fs').promises
  try {
    const stats = await fs.stat(filepath)
    const content = await fs.readFile(filepath)

    if (content.length < 100) {
      return { valid: false, size: content.length, error: 'Backup file too small' }
    }

    if (content[0] !== 0x1f || content[1] !== 0x8b) {
      return { valid: false, size: content.length, error: 'Not a valid gzip file' }
    }

    return { valid: true, size: content.length }
  } catch (error) {
    return { valid: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

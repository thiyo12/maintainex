import { describe, expect, it } from 'vitest'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), 'utf8')
}

describe('backup security contract', () => {
  it('keeps the full backup script syntactically valid', () => {
    expect(() =>
      execFileSync('bash', ['-n', resolve(process.cwd(), 'backup.sh')], {
        stdio: 'pipe',
      })
    ).not.toThrow()
  })

  it('keeps the production preflight syntactically valid and release-bound', () => {
    const preflight = resolve(process.cwd(), 'scripts/crm-v2-production-preflight.sh')
    expect(() =>
      execFileSync('bash', ['-n', preflight], {
        stdio: 'pipe',
      })
    ).not.toThrow()

    const source = readFileSync(preflight, 'utf8')
    expect(source).toContain("grep -Eq '^[0-9a-f]{40}
    const backup = source('backup.sh')
    expect(backup).toContain('BACKUP_ENCRYPTION_KEY_FILE=')
    expect(backup).toContain('openssl enc -aes-256-cbc -salt -pbkdf2 -iter 200000')
    expect(backup).toContain('.tar.gz.enc')
    expect(backup).toContain('chmod 600 "$BACKUP_DIR/$ARCHIVE_NAME"')
    expect(backup).toContain('openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000')
  })

  it('does not copy plaintext environment secret files into backup payloads', () => {
    const backup = source('backup.sh')
    expect(backup).not.toContain('cp "$BACKUP_DIR/envs/"')
    expect(backup).not.toContain('apps/mobile/.env')
    expect(backup).toContain('Production secret values are intentionally NOT stored in this backup.')
    expect(backup).toContain('cp "$PROJECT_DIR/.env.example"')
  })

  it('uses a private temp workspace and always cleans plaintext staging artifacts', () => {
    const backup = source('backup.sh')
    expect(backup).toContain('umask 077')
    expect(backup).toContain('WORK_DIR=$(mktemp -d)')
    expect(backup).toContain('PLAIN_ARCHIVE=$(mktemp')
    expect(backup).toContain('trap cleanup EXIT')
    expect(backup).toContain('rm -rf "$WORK_DIR"')
    expect(backup).toContain('rm -f "$PLAIN_ARCHIVE"')
  })
})
")
    expect(source).toContain('APP_RELEASE_SHA must be a lowercase 40-character git SHA')
    expect(source).toContain('release SHA does not match immutable image tag')
    expect(source).toContain('umask 077')
    expect(source).toContain('chmod 700 "$BACKUP_DIR"')
    expect(source).toContain('chmod 600 "$backup"')
  })

  it('fails closed without an encryption key and writes encrypted archives only', () => {
    const backup = source('backup.sh')
    expect(backup).toContain('BACKUP_ENCRYPTION_KEY_FILE=')
    expect(backup).toContain('openssl enc -aes-256-cbc -salt -pbkdf2 -iter 200000')
    expect(backup).toContain('.tar.gz.enc')
    expect(backup).toContain('chmod 600 "$BACKUP_DIR/$ARCHIVE_NAME"')
    expect(backup).toContain('openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000')
  })

  it('does not copy plaintext environment secret files into backup payloads', () => {
    const backup = source('backup.sh')
    expect(backup).not.toContain('cp "$BACKUP_DIR/envs/"')
    expect(backup).not.toContain('apps/mobile/.env')
    expect(backup).toContain('Production secret values are intentionally NOT stored in this backup.')
    expect(backup).toContain('cp "$PROJECT_DIR/.env.example"')
  })

  it('uses a private temp workspace and always cleans plaintext staging artifacts', () => {
    const backup = source('backup.sh')
    expect(backup).toContain('umask 077')
    expect(backup).toContain('WORK_DIR=$(mktemp -d)')
    expect(backup).toContain('PLAIN_ARCHIVE=$(mktemp')
    expect(backup).toContain('trap cleanup EXIT')
    expect(backup).toContain('rm -rf "$WORK_DIR"')
    expect(backup).toContain('rm -f "$PLAIN_ARCHIVE"')
  })
})

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), 'utf8')
}

describe('production infrastructure source hardening', () => {
  it('keeps production deployment shell scripts syntactically valid', () => {
    for (const script of [
      'deploy-rsync.sh',
      'scripts/crm-v2-production-preflight.sh',
      'scripts/start-production.sh',
    ]) {
      expect(() =>
        execFileSync('bash', ['-n', resolve(process.cwd(), script)], {
          stdio: 'pipe',
        })
      ).not.toThrow()
    }
  })

  it('does not publish the development PostgreSQL port on every host interface', () => {
    const compose = source('docker-compose.yml')
    expect(compose).toContain("'127.0.0.1:5432:5432'")
    expect(compose).not.toContain("'5432:5432'")
  })

  it('uses deterministic Docker dependency installation and a non-root runtime', () => {
    const dockerfile = source('Dockerfile')
    expect(dockerfile).toContain('RUN npm ci --ignore-scripts')
    expect(dockerfile).not.toContain('RUN npm install --ignore-scripts')
    expect(dockerfile).toContain('USER appuser')
  })

  it('never rsyncs local secret material into production staging', () => {
    const deploy = source('deploy-rsync.sh')
    for (const exclusion of [
      "--exclude='.env'",
      "--exclude='.env.*'",
      "--exclude='.npmrc'",
      "--exclude='.netrc'",
      "--exclude='secrets/'",
      "--exclude='credentials/'",
      "--exclude='id_rsa*'",
      "--exclude='id_ed25519*'",
      "--exclude='*.key'",
      "--exclude='backups/'",
      "--exclude='.terraform/'",
      "--exclude='*.tfstate'",
    ]) {
      expect(deploy).toContain(exclusion)
    }
  })

  it('attaches immutable source identity to deployments and restores it on rollback', () => {
    const deploy = source('deploy-rsync.sh')
    const readiness = source('app/api/internal/readiness/route.ts')
    const health = source('app/api/health/route.ts')

    expect(deploy).toContain("--env-add APP_RELEASE_SHA='$RELEASE_SHA'")
    expect(deploy).toContain('PREVIOUS_RELEASE_SHA=')
    expect(deploy).toContain("--env-add APP_RELEASE_SHA='$PREVIOUS_RELEASE_SHA'")
    expect(deploy).toContain('--env-rm APP_RELEASE_SHA')
    expect(deploy).toContain('EXPECTED_RELEASE_SHA')
    expect(readiness).toContain("process.env.APP_RELEASE_SHA || 'unknown'")
    expect(health).toContain("release: process.env.APP_RELEASE_SHA || 'unknown'")
    expect(health).not.toContain('company-marketplace-qa-20260924')
  })

  it('rejects Docker builds without exactly 40 lowercase hex GIT_SHA characters', () => {
    const dockerfile = source('Dockerfile')

    expect(dockerfile).not.toContain('ARG GIT_SHA=unknown')
    expect(dockerfile).toContain('ARG GIT_SHA')
    expect(dockerfile).toContain("GIT_SHA build arg must be exactly 40 lowercase hex characters")
    expect(dockerfile).toContain("grep -Eq '^[0-9a-f]{40}$'")
  })

  it('fails container startup closed when the baked release SHA is missing or malformed', () => {
    const { mkdtempSync, writeFileSync } = require('node:fs') as typeof import('node:fs')
    const { tmpdir } = require('node:os') as typeof import('node:os')
    const dir = mkdtempSync(`${tmpdir()}/release-sha-`)
    const gate = resolve(process.cwd(), 'scripts/require-release-sha.sh')

    const runGate = (env: Record<string, string>) => {
      try {
        return {
          ok: true as const,
          output: execFileSync(
            'sh',
            ['-c', `set -e; . "${gate}"; printf '%s' "$APP_RELEASE_SHA"`],
            { env: { ...process.env, ...env }, stdio: 'pipe', encoding: 'utf8' as const },
          ).trim(),
        }
      } catch (error) {
        return { ok: false as const, output: '' }
      }
    }

    const missing = `${dir}/absent`
    expect(runGate({ RELEASE_SHA_FILE: missing }).ok).toBe(false)

    const shortFile = `${dir}/short`
    writeFileSync(shortFile, 'abc123')
    expect(runGate({ RELEASE_SHA_FILE: shortFile }).ok).toBe(false)

    const upperFile = `${dir}/upper`
    writeFileSync(upperFile, 'A'.repeat(40))
    expect(runGate({ RELEASE_SHA_FILE: upperFile }).ok).toBe(false)

    const valid = 'e280515e44d9ee15c35a3b35aa334d212f2a643d'
    const validFile = `${dir}/valid`
    writeFileSync(validFile, `${valid}\n`)
    expect(runGate({ RELEASE_SHA_FILE: validFile })).toEqual({ ok: true, output: valid })
  })

  it('prefers the valid baked SHA over a stale ambient APP_RELEASE_SHA', () => {
    const gate = resolve(process.cwd(), 'scripts/require-release-sha.sh')
    const { mkdtempSync, writeFileSync } = require('node:fs') as typeof import('node:fs')
    const { tmpdir } = require('node:os') as typeof import('node:os')
    const valid = 'e280515e44d9ee15c35a3b35aa334d212f2a643d'
    const file = `${mkdtempSync(`${tmpdir()}/release-sha-`)}/valid`
    writeFileSync(file, valid)

    const output = execFileSync(
      'sh',
      ['-c', `. "${gate}"; printf '%s' "$APP_RELEASE_SHA"`],
      {
        env: {
          ...process.env,
          RELEASE_SHA_FILE: file,
          APP_RELEASE_SHA: '7c526b9401cc46b2c115006992e35735038719da',
        },
        stdio: 'pipe',
        encoding: 'utf8' as const,
      },
    ).trim()

    expect(output).toBe(valid)
  })

  it('bakes the build SHA into the image so a stale ambient SHA cannot mislabel code', () => {
    const dockerfile = source('Dockerfile')
    const starter = source('scripts/start-production.sh')

    expect(dockerfile).not.toContain('ARG GIT_SHA=unknown')
    expect(dockerfile).toContain('/app/.release-sha')
    expect(dockerfile).toContain('COPY --from=builder /app/.release-sha ./.release-sha')
    expect(dockerfile).toContain('COPY --from=builder /app/scripts/start-production.sh')
    expect(dockerfile).toContain('COPY --from=builder /app/scripts/require-release-sha.sh')
    expect(dockerfile).toContain('CMD ["sh", "/app/scripts/start-production.sh"]')
    expect(dockerfile).not.toContain('CMD npx prisma migrate deploy && node scripts/bootstrap-payment-providers.cjs && npm start')

    expect(starter).toContain('require-release-sha.sh')
    expect(starter).toContain('DIRECT_URL')
    expect(starter).toContain('unset DIRECT_URL')
    expect(starter).toContain('npx prisma migrate deploy')
    expect(starter).toContain('bootstrap-payment-providers.cjs')
    expect(starter).toContain('exec npm start')
  })

  it('runs Prisma migrations with the migration credential, never the bare runtime URL', () => {
    const starter = source('scripts/start-production.sh')

    // The schema datasource reads only env("DATABASE_URL"), so the migration
    // command must explicitly override it with DIRECT_URL for that command.
    expect(starter).toContain('DATABASE_URL="$DIRECT_URL" npx prisma migrate deploy')

    // No line may invoke migrate deploy with the ambient (runtime) DATABASE_URL.
    const bareMigrateLines = starter
      .split('\n')
      .map(line => line.trim())
      .filter(line => line === 'npx prisma migrate deploy' || line.startsWith('npx prisma migrate deploy '))
    expect(bareMigrateLines).toEqual([])

    // Migration credential must be removed before bootstrap and app start.
    const lines = starter.split('\n')
    const unsetIndex = lines.findIndex(line => line.trim() === 'unset DIRECT_URL')
    const bootstrapIndex = lines.findIndex(line => line.includes('bootstrap-payment-providers.cjs'))
    const startIndex = lines.findIndex(line => line.includes('exec npm start'))
    expect(unsetIndex).toBeGreaterThan(-1)
    expect(bootstrapIndex).toBeGreaterThan(unsetIndex)
    expect(startIndex).toBeGreaterThan(unsetIndex)
  })

  it('routes DIRECT_URL only to the migration command, never to bootstrap or app start', () => {
    const { mkdtempSync, writeFileSync, readFileSync, chmodSync } = require('node:fs') as typeof import('node:fs')
    const { tmpdir } = require('node:os') as typeof import('node:os')
    const { execFileSync } = require('node:child_process') as typeof import('node:child_process')
    const dir = mkdtempSync(`${tmpdir()}/startup-creds-`)
    const shaFile = `${dir}/release-sha`
    writeFileSync(shaFile, 'e280515e44d9ee15c35a3b35aa334d212f2a643d')

    const stub = (name: string) =>
      writeFileSync(
        `${dir}/${name}`,
        `#!/bin/sh\nprintf '%s|%s' "${name}" "DATABASE_URL=\${DATABASE_URL:-EMPTY} DIRECT_URL=\${DIRECT_URL:-EMPTY}" > "${dir}/${name}.env"\n`,
      )
    for (const name of ['npx', 'node', 'npm']) {
      stub(name)
      chmodSync(`${dir}/${name}`, 0o755)
    }

    execFileSync('sh', [resolve(process.cwd(), 'scripts/start-production.sh')], {
      env: {
        ...process.env,
        PATH: `${dir}:${process.env.PATH}`,
        RELEASE_SHA_FILE: shaFile,
        DATABASE_URL: 'postgresql://app_runtime@test-db:5432/maintainex',
        DIRECT_URL: 'postgresql://app_user@test-db:5432/maintainex',
        APP_RELEASE_SHA: 'stale-ambient-value',
      },
      stdio: 'pipe',
    })

    const seen = (name: string) => readFileSync(`${dir}/${name}.env`, 'utf8')
    // Migration ran with the migration credential.
    expect(seen('npx')).toContain('DATABASE_URL=postgresql://app_user@test-db:5432/maintainex')
    // Bootstrap and app start ran with the runtime credential and no DIRECT_URL.
    expect(seen('node')).toContain('DATABASE_URL=postgresql://app_runtime@test-db:5432/maintainex')
    expect(seen('node')).toContain('DIRECT_URL=EMPTY')
    expect(seen('npm')).toContain('DATABASE_URL=postgresql://app_runtime@test-db:5432/maintainex')
    expect(seen('npm')).toContain('DIRECT_URL=EMPTY')
  })

  it('preflight rejects unsafe production test/payment modes without printing secrets', () => {
    const preflight = source('scripts/crm-v2-production-preflight.sh')
    const deploy = source('deploy-rsync.sh')

    for (const script of [preflight, deploy]) {
      expect(script).toContain('ALLOW_TEST_OTP')
      expect(script).toContain('PAYPAL_SANDBOX')
      expect(script).toContain('PAYHERE_SANDBOX')
      expect(script).toContain('must be disabled in production')
      expect(script).toContain('must explicitly disable sandbox')
    }
    expect(preflight).toContain('APP_RELEASE_SHA')
    expect(preflight).toContain('release SHA does not match immutable image tag')
  })

  it('keeps operations runbooks on private backups and immutable releases', () => {
    const deployment = source('docs/PRODUCTION-DEPLOYMENT-RUNBOOK.md')
    const backup = source('docs/operations/backup-restore.md')

    expect(deployment).toContain('scripts/crm-v2-production-preflight.sh')
    expect(deployment).toContain('deploy-rsync.sh')
    expect(deployment).toContain('Do not manually patch a running container')
    expect(deployment).not.toContain('docker cp /tmp/maintainex-build.tar.gz')
    expect(deployment).not.toContain('docker commit $CONTAINER')
    expect(deployment).toContain('mutable `prod-latest` release')
    expect(deployment).not.toMatch(/(?:docker build|docker service update|RELEASE_IMAGE=).*prod-latest/)

    expect(backup).toContain('.tar.gz.enc')
    expect(backup).toContain('AES-256-CBC + PBKDF2')
    expect(backup).toContain('intentionally excludes production environment secret values')
    expect(backup).not.toContain('**Environment files** | `.env.example`, `mobile/.env`')
  })

  it('CI production container proves release identity and test OTP shutdown', () => {
    const workflow = source('.github/workflows/phase0-7-validation.yml')
    expect(workflow).toContain('-e APP_RELEASE_SHA="${GITHUB_SHA}"')
    expect(workflow).toContain('-e ALLOW_TEST_OTP="false"')
    expect(workflow).toContain('h.release !== process.env.GITHUB_SHA')
    expect(workflow).toContain('h.testOtpMode !== "disabled"')
  })
})

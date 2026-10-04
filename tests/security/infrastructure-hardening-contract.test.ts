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
    expect(deployment).not.toContain('prod-latest')

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

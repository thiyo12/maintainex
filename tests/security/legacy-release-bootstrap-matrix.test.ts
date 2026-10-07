import { execFileSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), 'utf8')
}

const LEGACY = '7c526b9401cc46b2c115006992e35735038719da'
const HARDENED = 'faa9251a9d733e7ced1f66dd515950c59159c6a0'

// Mirrors the shipped bootstrap decision in scripts/crm-v2-production-preflight.sh
// and deploy-rsync.sh, so the pass/fail matrix is proven by execution.
const HARNESS = [
  '#!/bin/bash',
  'set -uo pipefail',
  'SUPER_ADMIN_MFA_MISSING="$1"',
  'MFA_ACTIVE_SA="$2"',
  'MFA_ACTIVE_TEST_SEED="$3"',
  'MFA_INACTIVE_TEST_SEED="$4"',
  'MFA_INACTIVE_STAFF_SA="$5"',
  'PAYPALMODE="$6"',
  'ALLOW_INITIAL_OWNER_MFA_BOOTSTRAP="$7"',
  `LEGACY_BOOTSTRAP_RELEASE_SHA="\${LEGACY_BOOTSTRAP_RELEASE_SHA:-${LEGACY}}"`,
  'deployed_sha="$8"',
  'image="$9"',
  '',
  'if [ "$SUPER_ADMIN_MFA_MISSING" != "0" ]; then',
  '  if [ "$ALLOW_INITIAL_OWNER_MFA_BOOTSTRAP" = "true" ]; then',
  '    bootstrap_ok=1',
  '    [ "$MFA_ACTIVE_SA" = "1" ] || bootstrap_ok=0',
  '    [ "$MFA_ACTIVE_TEST_SEED" = "0" ] || bootstrap_ok=0',
  '    [ "$MFA_INACTIVE_TEST_SEED" -ge 18 ] || bootstrap_ok=0',
  '    [ "$MFA_INACTIVE_STAFF_SA" -ge 1 ] || bootstrap_ok=0',
  '    [ "$deployed_sha" = "$LEGACY_BOOTSTRAP_RELEASE_SHA" ] || bootstrap_ok=0',
  '    if [ "$bootstrap_ok" != "1" ]; then',
  '      echo "ERROR|initial owner MFA bootstrap conditions not satisfied"',
  '      exit 1',
  '    fi',
  '    echo "MFA_BOOTSTRAP|authorized-once-for-single-unenrolled-owner"',
  '  else',
  '    echo "ERROR|active SUPER_ADMIN account is missing required MFA enrollment"',
  '    exit 1',
  '  fi',
  'fi',
  '',
  'legacy_release_bootstrap=""',
  'if [ "$ALLOW_INITIAL_OWNER_MFA_BOOTSTRAP" = "true" ] && [ "$PAYPALMODE" = "sandbox-smoke-authorized" ]; then',
  '  if [ "$SUPER_ADMIN_MFA_MISSING" != "0" ] \\',
  '    && [ "$MFA_ACTIVE_SA" = "1" ] \\',
  '    && [ "$MFA_ACTIVE_TEST_SEED" = "0" ] \\',
  '    && [ "$MFA_INACTIVE_TEST_SEED" -ge 18 ] \\',
  '    && [ "$MFA_INACTIVE_STAFF_SA" -ge 1 ] \\',
  '    && [ "$deployed_sha" = "$LEGACY_BOOTSTRAP_RELEASE_SHA" ]; then',
  "    legacy_release_bootstrap='authorized-once'",
  '    echo "LEGACY_RELEASE_BOOTSTRAP|authorized-once"',
  '  fi',
  'fi',
  '',
  'if [ -z "$legacy_release_bootstrap" ]; then',
  '  short_release=$(printf \'%s\' "$deployed_sha" | cut -c1-12)',
  '  case "$image" in',
  '    *"release-$short_release"*) ;;',
  '    *)',
  '      echo "ERROR|release SHA does not match immutable image tag"',
  '      exit 1',
  '      ;;',
  '  esac',
  'fi',
  'echo "PROCEED"',
  '',
].join('\n')

type Result = { code: number; out: string }

function run(args: string[]): Result {
  const dir = mkdtempSync(join(tmpdir(), 'bootstrap-'))
  const file = join(dir, 'harness.sh')
  writeFileSync(file, HARNESS, { mode: 0o700 })
  try {
    const out = execFileSync('/bin/bash', [file, ...args], {
      encoding: 'utf8',
      env: { ...process.env },
    })
    return { code: 0, out }
  } catch (error: any) {
    return { code: error.status ?? 1, out: String(error.stdout ?? '') }
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

const LEGACY_IMAGE = 'maintainex-mx-vcaohy:latest'
const HARDENED_IMAGE = `maintainex-mx-vcaohy:release-${HARDENED.slice(0, 12)}`

describe('legacy release bootstrap matrix', () => {
  it('1. legacy release + all bootstrap conditions + flag -> PASS', () => {
    const r = run(['1', '1', '0', '18', '1', 'sandbox-smoke-authorized', 'true', LEGACY, LEGACY_IMAGE])
    expect(r.code).toBe(0)
    expect(r.out).toContain('MFA_BOOTSTRAP|authorized-once-for-single-unenrolled-owner')
    expect(r.out).toContain('LEGACY_RELEASE_BOOTSTRAP|authorized-once')
    expect(r.out).toContain('PROCEED')
  })

  it('2. same legacy state WITHOUT the flag -> FAIL', () => {
    const r = run(['1', '1', '0', '18', '1', 'sandbox-smoke-authorized', 'false', LEGACY, LEGACY_IMAGE])
    expect(r.code).not.toBe(0)
    expect(r.out).toContain('active SUPER_ADMIN account is missing required MFA enrollment')
  })

  it('3. another release + flag -> FAIL', () => {
    const r = run(['1', '1', '0', '18', '1', 'sandbox-smoke-authorized', 'true', HARDENED, HARDENED_IMAGE])
    expect(r.code).not.toBe(0)
    expect(r.out).toContain('initial owner MFA bootstrap conditions not satisfied')
  })

  it('4. multiple active SUPER_ADMINs -> FAIL', () => {
    const r = run(['1', '2', '0', '18', '1', 'sandbox-smoke-authorized', 'true', LEGACY, LEGACY_IMAGE])
    expect(r.code).not.toBe(0)
    expect(r.out).toContain('initial owner MFA bootstrap conditions not satisfied')
  })

  it('5. an active test SUPER_ADMIN exists -> FAIL', () => {
    const r = run(['1', '1', '1', '18', '1', 'sandbox-smoke-authorized', 'true', LEGACY, LEGACY_IMAGE])
    expect(r.code).not.toBe(0)
    expect(r.out).toContain('initial owner MFA bootstrap conditions not satisfied')
  })

  it('6. normal hardened release without MFA -> FAIL (bootstrap not eligible, no flag)', () => {
    const withFlag = run(['1', '1', '0', '18', '1', 'live', 'true', HARDENED, HARDENED_IMAGE])
    expect(withFlag.code).not.toBe(0)
    expect(withFlag.out).toContain('initial owner MFA bootstrap conditions not satisfied')

    const withoutFlag = run(['1', '1', '0', '18', '1', 'live', 'false', HARDENED, HARDENED_IMAGE])
    expect(withoutFlag.code).not.toBe(0)
    expect(withoutFlag.out).toContain('active SUPER_ADMIN account is missing required MFA enrollment')
  })

  it('7. hardened release with MFA enrolled -> PASS', () => {
    const r = run(['0', '1', '0', '18', '1', 'live', 'false', HARDENED, HARDENED_IMAGE])
    expect(r.code).toBe(0)
    expect(r.out).toContain('PROCEED')
  })
})

describe('bootstrap flags stay runner-only in both tools', () => {
  const deploy = source('deploy-rsync.sh')
  const preflight = source('scripts/crm-v2-production-preflight.sh')

  it('deploy script honours the same scoped flag and fails closed without it', () => {
    expect(deploy).toContain('ALLOW_INITIAL_OWNER_MFA_BOOTSTRAP="${ALLOW_INITIAL_OWNER_MFA_BOOTSTRAP:-false}"')
    expect(deploy).toContain('LEGACY_RELEASE_BOOTSTRAP|authorized-once')
    expect(deploy).toContain('ERROR: active SUPER_ADMIN account is missing required MFA enrollment')
    expect(deploy).toContain(
      '[ "$deployed_sha" = "$LEGACY_MFA_BOOTSTRAP_RELEASE_SHA" ] || bootstrap_ok=0',
    )
    // The runner-only flag must be forwarded into the remote step-1 shell, where
    // `set -u` would otherwise abort before the gate is evaluated.
    expect(deploy).toContain(
      "ALLOW_INITIAL_OWNER_MFA_BOOTSTRAP='$ALLOW_INITIAL_OWNER_MFA_BOOTSTRAP'",
    )
    expect(deploy).toContain('ALLOW_INITIAL_OWNER_MFA_BOOTSTRAP="${ALLOW_INITIAL_OWNER_MFA_BOOTSTRAP:-false}"')
  })

  it('preflight only skips legacy release identity inside the same bootstrap', () => {
    expect(preflight).toContain('LEGACY_RELEASE_BOOTSTRAP|authorized-once')
    expect(preflight).toContain('ERROR|release SHA does not match immutable image tag')
    expect(preflight).toContain(
      '[ "$release_sha" = "$LEGACY_BOOTSTRAP_RELEASE_SHA" ]',
    )
  })

  it('never persists either bootstrap flag into the service environment', () => {
    for (const flag of ['ALLOW_INITIAL_OWNER_MFA_BOOTSTRAP', 'ALLOW_PAYPAL_SANDBOX_SMOKE']) {
      expect(deploy).not.toContain(`--env-add ${flag}`)
      expect(preflight).not.toContain(`--env-add ${flag}`)
    }
  })
})
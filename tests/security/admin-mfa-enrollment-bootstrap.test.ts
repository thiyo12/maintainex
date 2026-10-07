import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), 'utf8')
}

const PREFLIGHT = 'scripts/crm-v2-production-preflight.sh'
const PAGE = 'app/(admin)/admin/security/mfa/page.tsx'
const LAYOUT = 'components/admin/AdminLayout.tsx'
const SETUP_ROUTE = 'app/api/admin/auth/2fa/setup/route.ts'
const CONFIRM_ROUTE = 'app/api/admin/auth/2fa/confirm/route.ts'

describe('Admin MFA enrollment UI', () => {
  it('requires the current password before starting enrollment', () => {
    expect(source(SETUP_ROUTE)).toContain('currentPassword')
    expect(source(SETUP_ROUTE)).toContain('verifyPasswordWithMigration')
    expect(source(PAGE)).toContain('/api/admin/auth/2fa/setup')
    expect(source(PAGE)).toContain('currentPassword')
  })

  it('confirms enrollment through the existing backend verifier with a real code', () => {
    expect(source(CONFIRM_ROUTE)).toContain('verifyTotp')
    expect(source(CONFIRM_ROUTE)).toContain('totpVerifiedAt: now')
    expect(source(CONFIRM_ROUTE)).toContain('totpEnabled: true')
    expect(source(PAGE)).toContain('/api/admin/auth/2fa/confirm')
    expect(source(PAGE)).toContain('totpCode')
    expect(source(PAGE)).toContain('/^\\d{6}$/')
  })

  it('renders the QR locally and offers a manual setup key', () => {
    const page = source(PAGE)
    expect(page).toContain("import QRCode from 'qrcode'")
    expect(page).toContain('QRCode.toCanvas')
    expect(page).toContain('Manual setup key')
  })

  it('never persists the enrollment secret in browser storage', () => {
    const page = source(PAGE)
    expect(page).not.toContain('localStorage')
    expect(page).not.toContain('sessionStorage')
    expect(page).not.toContain('document.cookie')
  })

  it('clears enrollment material from state on success and cancel', () => {
    const page = source(PAGE)
    expect(page).toContain('discardSecret')
    expect(page).toMatch(/discardSecret\(\)[\s\S]{0,200}setPhase\('enabled'\)/)
    expect(page).toMatch(/const resetAll[\s\S]{0,320}discardSecret\(\)/)
  })

  it('reports enrollment success only after backend confirmation', () => {
    const page = source(PAGE)
    expect(page).toContain('Two-factor authentication enabled')
    expect(page).toContain("toast.success('Two-factor authentication enabled')")
  })

  it('exposes the enrollment surface in admin navigation', () => {
    expect(source(LAYOUT)).toContain("href: '/admin/security/mfa'")
  })
})

describe('Initial owner MFA bootstrap deployment allowance', () => {
  it('fails closed by default and only allows an explicit one-time flag', () => {
    const preflight = source(PREFLIGHT)
    expect(preflight).toContain(
      'ALLOW_INITIAL_OWNER_MFA_BOOTSTRAP="${ALLOW_INITIAL_OWNER_MFA_BOOTSTRAP:-false}"',
    )
    expect(preflight).toContain(
      'ERROR|active SUPER_ADMIN account is missing required MFA enrollment',
    )
    expect(preflight).toContain('MFA_BOOTSTRAP|authorized-once-for-single-unenrolled-owner')
  })

  it('permits the exception only under every strict bootstrap condition', () => {
    const preflight = source(PREFLIGHT)
    expect(preflight).toContain('[ "$MFA_ACTIVE_SA" = "1" ] || bootstrap_ok=0')
    expect(preflight).toContain('[ "$MFA_ACTIVE_TEST_SEED" = "0" ] || bootstrap_ok=0')
    expect(preflight).toContain('[ "$MFA_INACTIVE_TEST_SEED" -ge 18 ] || bootstrap_ok=0')
    expect(preflight).toContain('[ "$MFA_INACTIVE_STAFF_SA" -ge 1 ] || bootstrap_ok=0')
    // The deployed-release condition is an exact-match allowlist of
    // pre-enrollment releases; anything else fails closed.
    expect(preflight).toContain(
      'case ",$PRE_ENROLLMENT_RELEASE_SHAS," in *",$bootstrap_deployed_sha,"*) ;; *) bootstrap_ok=0 ;; esac',
    )
    expect(preflight).toContain('PRE_ENROLLMENT_RELEASE_SHAS=')
    expect(preflight).toContain(
      'ERROR|initial owner MFA bootstrap conditions not satisfied',
    )
  })

  it('never stores the bootstrap flag in the application service environment', () => {
    const preflight = source(PREFLIGHT)
    expect(preflight).not.toContain('--env-add ALLOW_INITIAL_OWNER_MFA_BOOTSTRAP')
    const deploy = source('deploy-rsync.sh')
    expect(deploy).not.toContain('--env-add ALLOW_INITIAL_OWNER_MFA_BOOTSTRAP')
  })

  it('records bootstrap usage in the non-secret preflight receipt', () => {
    const preflight = source(PREFLIGHT)
    expect(preflight).toContain('mfa_bootstrap=$MFA_BOOTSTRAP_MODE')
  })
})
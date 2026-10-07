import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), 'utf8')
}

const SMOKE_WARNING =
  'PayPal sandbox explicitly authorized for controlled production smoke testing'
const SANDBOX_ERROR =
  'PayPal production configuration must explicitly disable sandbox'

describe('PayPal sandbox smoke deployment flag', () => {
  it('fails closed on sandbox without the explicit smoke override (deploy script)', () => {
    const deploy = source('deploy-rsync.sh')
    expect(deploy).toContain('ALLOW_PAYPAL_SANDBOX_SMOKE="${ALLOW_PAYPAL_SANDBOX_SMOKE:-false}"')
    expect(deploy).toContain(SANDBOX_ERROR)
    expect(deploy).toContain('if [ "$ALLOW_PAYPAL_SANDBOX_SMOKE" = "true" ]')
  })

  it('allows sandbox only with the explicit smoke override and prints the warning (deploy script)', () => {
    const deploy = source('deploy-rsync.sh')
    expect(deploy).toContain(SMOKE_WARNING)
  })

  it('allows live PayPal normally without any override (deploy script)', () => {
    const deploy = source('deploy-rsync.sh')
    // Live path emits no sandbox error and no smoke warning branch is taken:
    // the sandbox conditional only triggers when PAYPAL_SANDBOX != false.
    expect(deploy).toContain('if [ "$(env_value PAYPAL_SANDBOX)" != "false" ]')
  })

  it('fails closed on incomplete PayPal configuration (deploy script)', () => {
    const deploy = source('deploy-rsync.sh')
    expect(deploy).toContain('ERROR: incomplete PayPal production configuration')
  })

  it('never persists the smoke flag into the application service environment', () => {
    const deploy = source('deploy-rsync.sh')
    expect(deploy).not.toContain('--env-add ALLOW_PAYPAL_SANDBOX_SMOKE')
    expect(deploy).not.toContain('--env-add PAYPAL_SANDBOX')
    const preflight = source('scripts/crm-v2-production-preflight.sh')
    expect(preflight).not.toContain('--env-add ALLOW_PAYPAL_SANDBOX_SMOKE')
  })

  it('mirrors the same fail-closed override contract in production preflight', () => {
    const preflight = source('scripts/crm-v2-production-preflight.sh')
    expect(preflight).toContain(
      'ALLOW_PAYPAL_SANDBOX_SMOKE="${ALLOW_PAYPAL_SANDBOX_SMOKE:-false}"',
    )
    expect(preflight).toContain(SANDBOX_ERROR)
    expect(preflight).toContain('echo "PAYPALMODE|$PAYPALMODE"')
    expect(preflight).toContain("PAYPALMODE='sandbox-smoke-authorized'")
    expect(preflight).toContain("PAYPALMODE='live'")
    expect(preflight).toContain(SMOKE_WARNING)
    expect(preflight).toContain('paypal_mode=$PAYPALMODE')
  })

  it('blocks future deployments unless both upload mounts exist', () => {
    const deploy = source('deploy-rsync.sh')
    expect(deploy).toContain('/var/lib/maintainex/public-uploads -> /app/public/uploads')
    expect(deploy).toContain('/var/lib/maintainex/private-uploads -> /app/uploads')
    expect(deploy).toContain('uploads must not live on container overlay')
  })
})

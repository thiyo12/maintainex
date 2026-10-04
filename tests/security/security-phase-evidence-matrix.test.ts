import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

type PhaseEvidence = {
  phase: number
  area: string
  evidence: string[]
}

const PHASE_EVIDENCE: PhaseEvidence[] = [
  { phase: 0, area: 'production baseline/runtime evidence', evidence: ['docs/security/SECURITY-BASELINE.md', 'app/api/health/route.ts', 'app/api/internal/readiness/route.ts'] },
  { phase: 1, area: 'production debug/test/bypass closure', evidence: ['tests/security/production-bypass-hardening.test.ts', 'tests/security/api-attack-surface-inventory.test.ts'] },
  { phase: 2, area: 'secrets/credentials', evidence: ['tests/security/secret-boundary-contract.test.ts', 'docs/security/CREDENTIAL-ROTATION.md', 'lib/config/env-validation.ts'] },
  { phase: 3, area: 'VPS/network perimeter', evidence: ['tests/security/infrastructure-hardening-contract.test.ts', 'docker-compose.yml', 'deploy-rsync.sh'] },
  { phase: 4, area: 'Docker/Dokploy', evidence: ['tests/security/infrastructure-hardening-contract.test.ts', 'Dockerfile', 'scripts/crm-v2-production-preflight.sh'] },
  { phase: 5, area: 'GitHub/CI supply chain', evidence: ['tests/security/supply-chain-hardening.test.ts', '.github/dependabot.yml', '.github/workflows/phase0-7-validation.yml'] },
  { phase: 6, area: 'API attack-surface inventory', evidence: ['tests/security/api-attack-surface-inventory.test.ts', 'tests/security/legacy-api-authorization-closure.test.ts'] },
  { phase: 7, area: 'IDOR/broken access control', evidence: ['tests/security/idor-authorization.test.ts', 'tests/security/customer-idor.test.ts', 'tests/security/booking-idor.test.ts', 'tests/security/conversation-idor.test.ts'] },
  { phase: 8, area: 'company/tenant isolation', evidence: ['tests/security/company-quote-idor.test.ts', 'tests/security/dual-persona-isolation.test.ts', 'tests/security/matching-persona-isolation.test.ts'] },
  { phase: 9, area: 'CRM/staff authorization', evidence: ['tests/security/all-admin-routes-crm-guard.test.ts', 'tests/security/crm-section-access.test.ts', 'tests/rbac/admin-rbac-negative.test.ts'] },
  { phase: 10, area: 'high-risk CRM governance', evidence: ['tests/security/crm-governance-policy.test.ts', 'tests/security/crm-approval-engine.test.ts', 'tests/security/crm-step-up-proof.test.ts'] },
  { phase: 11, area: 'admin auth/session/MFA', evidence: ['tests/security/admin-mfa-enforcement.test.ts', 'tests/security/admin-session-token-lifecycle.test.ts', 'tests/security/admin-totp-verification.test.ts'] },
  { phase: 12, area: 'password/OTP/recovery', evidence: ['tests/security/mobile-auth-recovery-boundary.test.ts', 'tests/security/otp-demo-rate-limit.test.ts', 'tests/security/refresh-token-hardening.test.ts', 'tests/auth/password-reset.integration.test.ts'] },
  { phase: 13, area: 'identity/KYC', evidence: ['tests/security/provider-identity-integrity.test.ts', 'tests/security/crm-kyc-privacy-boundary.test.ts', 'lib/security/kyc-storage.ts'] },
  { phase: 14, area: 'payment/escrow authorization', evidence: ['tests/security/crm-payment-escrow-control-boundary.test.ts', 'tests/security/payment-public-origin.test.ts', 'tests/security/quote-acceptance-security.test.ts'] },
  { phase: 15, area: 'PayHere webhook/reconciliation', evidence: ['tests/security/payment-webhook-hardening.test.ts', 'lib/config/env-validation.ts'] },
  { phase: 16, area: 'PayPal security/sandbox completion', evidence: ['tests/security/paypal-only-payment-strategy.test.ts', 'tests/security/payment-provider-control-plane.test.ts', 'tests/security/payment-webhook-hardening.test.ts'] },
  { phase: 17, area: 'finance concurrency/idempotency', evidence: ['tests/security/concurrency-guard.test.ts', 'tests/security/rate-limit-financial.test.ts', 'tests/security/crm-financial-ledger-boundary.test.ts'] },
  { phase: 18, area: 'wallet/commission/account abuse', evidence: ['tests/security/crm-commission-control-boundary.test.ts', 'tests/security/crm-account-restrictions-domain.test.ts', 'tests/security/crm-account-action-permissions.test.ts'] },
  { phase: 19, area: 'upload/file security', evidence: ['tests/security/path-traversal.test.ts', 'tests/security/production-public-boundary-hardening.test.ts', 'lib/security/upload-validation.ts'] },
  { phase: 20, area: 'CSRF/CORS/browser security', evidence: ['tests/security/browser-origin-hardening.test.ts', 'tests/security/crm-origin-proxy-validation.test.ts', 'middleware.ts'] },
  { phase: 21, area: 'rate limiting/abuse controls', evidence: ['tests/security/rate-limiting.test.ts', 'tests/security/rate-limit-fail-closed.test.ts', 'tests/security/otp-demo-rate-limit.test.ts'] },
  { phase: 22, area: 'database hardening', evidence: ['tests/security/infrastructure-hardening-contract.test.ts', 'prisma/schema.prisma', 'scripts/crm-v2-production-preflight.sh'] },
  { phase: 23, area: 'privacy/data minimization', evidence: ['tests/security/privacy.test.ts', 'tests/security/chat-privacy-boundary.test.ts', 'tests/security/real-estate-public-privacy.test.ts'] },
  { phase: 24, area: 'logging/audit safety', evidence: ['tests/security/redaction.test.ts', 'tests/security/security-events.test.ts', 'tests/security/risk-events.test.ts'] },
  { phase: 25, area: 'security monitoring/alerts', evidence: ['tests/security/risk-events.test.ts', 'tests/security/risk-scoring.test.ts', 'tests/security/security-events.test.ts'] },
  { phase: 26, area: 'Cloudflare/edge security', evidence: ['tests/security/trusted-proxy-hardening.test.ts', 'tests/security/browser-origin-hardening.test.ts', 'lib/config/env-validation.ts'] },
  { phase: 27, area: 'IP/proxy trust', evidence: ['tests/security/trusted-proxy-hardening.test.ts', 'lib/security/client-ip.ts'] },
  { phase: 28, area: 'backup/disaster recovery', evidence: ['tests/security/backup-security-contract.test.ts', 'backup.sh', 'deploy-rsync.sh'] },
  { phase: 29, area: 'dependency/supply-chain security', evidence: ['tests/security/supply-chain-hardening.test.ts', '.github/dependabot.yml', '.github/workflows/phase0-7-validation.yml'] },
  { phase: 30, area: 'automated security regression', evidence: ['.github/workflows/phase0-7-validation.yml', 'tests/security/negative-security.test.ts'] },
  { phase: 31, area: 'external attacker simulation', evidence: ['tests/security/negative-security.test.ts', 'tests/security/security.test.ts', 'tests/security/production-public-boundary-hardening.test.ts'] },
  { phase: 32, area: 'final security release gate', evidence: ['docs/security/SECURITY-GATE.md', '.github/workflows/security-exposure-audit.yml', '.github/workflows/phase0-7-validation.yml'] },
]

describe('security phase evidence matrix', () => {
  it('tracks all security phases 0 through 32 exactly once', () => {
    expect(PHASE_EVIDENCE.map(item => item.phase)).toEqual(
      Array.from({ length: 33 }, (_, index) => index),
    )
  })

  it('keeps at least one repository evidence artifact for every phase', () => {
    const missing: Array<{ phase: number; path: string }> = []

    for (const item of PHASE_EVIDENCE) {
      for (const path of item.evidence) {
        if (!existsSync(resolve(process.cwd(), path))) {
          missing.push({ phase: item.phase, path })
        }
      }
    }

    expect(missing).toEqual([])
  })

  it('does not confuse partial repository evidence with a final GO decision', () => {
    const gate = readFileSync(resolve(process.cwd(), 'docs/security/SECURITY-GATE.md'), 'utf8')
    expect(gate).toContain('Phase 0 cannot be marked PASS')
    expect(gate).not.toContain('FINAL SECURITY GO: YES')
  })
})

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), 'utf8')
}

describe('dependency and CI supply-chain hardening', () => {
  it('pins every third-party GitHub Action in release workflows to a full commit SHA', () => {
    for (const path of [
      '.github/workflows/phase0-7-validation.yml',
      '.github/workflows/security-exposure-audit.yml',
    ]) {
      const workflow = source(path)
      const uses = workflow
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.startsWith('uses: '))

      expect(uses.length).toBeGreaterThan(0)
      for (const use of uses) {
        expect(use).toMatch(/^uses:\s+[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+@[a-f0-9]{40}(?:\s+#.*)?$/)
        expect(use).not.toMatch(/@(main|master|v\d+(?:\.\d+)*)\b/)
      }
    }
  })

  it('keeps deterministic npm installs in CI and Docker builds', () => {
    const release = source('.github/workflows/phase0-7-validation.yml')
    const docker = source('Dockerfile')

    expect(release).toContain('run: npm ci')
    expect(release).toContain('run: npm ci --prefix apps/mobile')
    expect(docker).toContain('RUN npm ci --ignore-scripts')
    expect(docker).not.toContain('RUN npm install')
  })

  it('enables Dependabot for web, mobile and GitHub Actions', () => {
    const config = source('.github/dependabot.yml')

    expect(config).toContain('package-ecosystem: npm')
    expect(config).toContain('directory: /')
    expect(config).toContain('directory: /apps/mobile')
    expect(config).toContain('package-ecosystem: github-actions')
    expect((config.match(/interval: weekly/g) || []).length).toBeGreaterThanOrEqual(3)
  })

  it('keeps mobile HIGH exceptions exact, indirect and self-expiring', () => {
    const release = source('.github/workflows/phase0-7-validation.yml')
    const mobileAudit = source('scripts/mobile-production-audit.mjs')

    expect(release).toContain('node scripts/mobile-production-audit.mjs')
    expect(mobileAudit).toContain("'--omit=dev'")
    expect(mobileAudit).toContain("'--audit-level=high'")
    expect(mobileAudit).toContain('Critical vulnerabilities are never exception-eligible')
    expect(mobileAudit).toContain('Unapproved HIGH vulnerability advisory detected')
    expect(mobileAudit).toContain('Temporary exception expired because a newer upstream version now exists')
    expect(mobileAudit).toContain('vulnerability.isDirect')

    const exceptionUrls = [
      'GHSA-vfj7-8cjw-p6xm',
      'GHSA-5p2g-fcmc-qvqq',
      'GHSA-w3rx-r6r6-pgpr',
      'GHSA-86w9-cpqp-85rv',
    ]
    for (const advisory of exceptionUrls) expect(mobileAudit).toContain(advisory)
    expect((mobileAudit.match(/github\.com\/advisories\/GHSA-/g) || []).length).toBe(4)
    expect(mobileAudit).not.toContain('audit || true')
    expect(mobileAudit).not.toContain('--audit-level=critical')
  })

  it('keeps workflow permissions least-privilege by default', () => {
    for (const path of [
      '.github/workflows/phase0-7-validation.yml',
      '.github/workflows/security-exposure-audit.yml',
    ]) {
      const workflow = source(path)
      expect(workflow).toContain('permissions:')
      expect(workflow).toContain('contents: read')
      expect(workflow).not.toContain('contents: write')
    }
  })
})

import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'

const mobileDir = resolve(process.cwd(), 'apps/mobile')

const TEMPORARY_EXCEPTIONS = new Map([
  ['https://github.com/advisories/GHSA-vfj7-8cjw-p6xm', {
    packageName: 'braces',
    maxAffectedPublishedVersion: '3.0.3',
    reason: 'Expo/Metro file-map build tooling; upstream has no patched release',
  }],
  ['https://github.com/advisories/GHSA-5p2g-fcmc-qvqq', {
    packageName: 'image-size',
    maxAffectedPublishedVersion: '2.0.2',
    reason: 'Metro image metadata build tooling; patched 2.0.3 is not published',
  }],
  ['https://github.com/advisories/GHSA-w3rx-r6r6-pgpr', {
    packageName: 'image-size',
    maxAffectedPublishedVersion: '2.0.2',
    reason: 'Metro image metadata build tooling; patched 2.0.3 is not published',
  }],
  ['https://github.com/advisories/GHSA-86w9-cpqp-85rv', {
    packageName: 'node-forge',
    maxAffectedPublishedVersion: '1.4.0',
    reason: 'Expo CLI code-signing tooling; upstream has no patched release',
  }],
])

function fail(message, detail) {
  console.error('[MOBILE SECURITY AUDIT] ' + message)
  if (detail) console.error(detail)
  process.exit(1)
}

function numericVersion(version) {
  const match = String(version || '').trim().match(/^(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/)
  if (!match) return null
  return match.slice(1).map(Number)
}

function compareVersions(left, right) {
  const a = numericVersion(left)
  const b = numericVersion(right)
  if (!a || !b) return null
  for (let i = 0; i < 3; i++) {
    if (a[i] !== b[i]) return a[i] < b[i] ? -1 : 1
  }
  return 0
}

function npmLatestVersion(packageName) {
  const result = spawnSync('npm', ['view', packageName + '@latest', 'version', '--json'], {
    cwd: mobileDir,
    encoding: 'utf8',
    env: process.env,
  })
  if (result.status !== 0) {
    fail('Could not verify whether the temporary exception has a patched release: ' + packageName)
  }

  try {
    const parsed = JSON.parse(result.stdout)
    return Array.isArray(parsed) ? parsed.at(-1) : parsed
  } catch {
    fail('Could not parse npm registry version for ' + packageName)
  }
}

const audit = spawnSync('npm', ['audit', '--omit=dev', '--audit-level=high', '--json'], {
  cwd: mobileDir,
  encoding: 'utf8',
  env: process.env,
  maxBuffer: 20 * 1024 * 1024,
})

if (!audit.stdout?.trim()) {
  fail('npm audit returned no JSON output', audit.stderr)
}

let report
try {
  report = JSON.parse(audit.stdout)
} catch {
  fail('npm audit JSON could not be parsed', audit.stdout.slice(0, 4000))
}

const metadata = report.metadata?.vulnerabilities || {}
if ((metadata.critical || 0) > 0) {
  fail('Critical vulnerabilities are never exception-eligible', JSON.stringify(metadata))
}

const rootFindings = new Map()
for (const vulnerability of Object.values(report.vulnerabilities || {})) {
  for (const via of vulnerability.via || []) {
    if (!via || typeof via !== 'object') continue
    if (via.severity !== 'high' && via.severity !== 'critical') continue
    rootFindings.set(via.url, via)
  }
}

if ((metadata.high || 0) > 0 && rootFindings.size === 0) {
  fail('High vulnerabilities exist but their advisory roots could not be determined')
}

const unknown = [...rootFindings.values()].filter(finding => !TEMPORARY_EXCEPTIONS.has(finding.url))
if (unknown.length > 0) {
  fail(
    'Unapproved HIGH vulnerability advisory detected',
    unknown.map(item => item.name + ': ' + item.url).join('\n'),
  )
}

for (const [url, exception] of TEMPORARY_EXCEPTIONS) {
  const finding = rootFindings.get(url)
  if (!finding) continue

  const vulnerability = report.vulnerabilities?.[exception.packageName]
  if (!vulnerability || vulnerability.isDirect) {
    fail('Temporary exception is no longer limited to an indirect dependency: ' + exception.packageName)
  }

  const latest = npmLatestVersion(exception.packageName)
  const comparison = compareVersions(latest, exception.maxAffectedPublishedVersion)
  if (comparison === null) {
    fail('Unable to compare latest version for ' + exception.packageName + ': ' + latest)
  }
  if (comparison > 0) {
    fail(
      'Temporary exception expired because a newer upstream version now exists: ' +
      exception.packageName + '@' + latest,
    )
  }

  console.warn(
    '[MOBILE SECURITY AUDIT] TEMPORARY CONTROLLED HIGH: ' +
    finding.name + ' (' + url + ') — ' + exception.reason,
  )
}

console.log(
  '[MOBILE SECURITY AUDIT] PASS: no Critical and no uncontrolled High advisories. ' +
  'Controlled upstream exceptions=' + rootFindings.size,
)

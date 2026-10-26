import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'
import { spawnSync } from 'node:child_process'

const mobileRequire = createRequire(path.resolve(process.cwd(), 'apps/mobile/package.json'))
const sourcePackagePath = mobileRequire.resolve('node-forge/package.json')
const patchScriptPath = path.resolve(process.cwd(), 'apps/mobile/scripts/apply-node-forge-security-patch.cjs')

let fixtureRoot: string
let fixtureMobileRoot: string
let forge: any
let keys: any

function der(tag: number, content: string): string {
  if (content.length >= 128) throw new Error('test DER fixture must use short-form lengths')
  return String.fromCharCode(tag, content.length) + content
}

function digestInfo(forgeInstance: any, digest: string, options: { includeNull: boolean; extraChild: boolean; nonEmptyNull?: boolean }): string {
  const sha256Oid = forgeInstance.util.hexToBytes('0609608648016503040201')
  const nullParameters = der(0x05, options.nonEmptyNull ? '\xff' : '')
  const unexpectedChild = forgeInstance.util.hexToBytes('0401ff')
  const algorithm = der(
    0x30,
    sha256Oid + (options.includeNull ? nullParameters : '') + (options.extraChild ? unexpectedChild : ''),
  )
  return der(0x30, algorithm + der(0x04, digest))
}

function signedRawBlock(forgeInstance: any, privateKey: any, payload: string): string {
  const keyBytes = Math.ceil(privateKey.n.bitLength() / 8)
  const paddingLength = keyBytes - payload.length - 3
  if (paddingLength < 8) throw new Error('RSA test key too small')
  const encoded = '\x00\x01' + '\xff'.repeat(paddingLength) + '\x00' + payload
  const message = new forgeInstance.jsbn.BigInteger(forgeInstance.util.bytesToHex(encoded), 16)
  const signature = message.modPow(privateKey.d, privateKey.n).toString(16).padStart(keyBytes * 2, '0')
  return forgeInstance.util.hexToBytes(signature)
}

function verifyDigestInfo(forgeInstance: any, privateKey: any, publicKey: any, options: { includeNull: boolean; extraChild: boolean; nonEmptyNull?: boolean }): boolean {
  const digest = forgeInstance.md.sha256.create()
  digest.update('MaintainEX synthetic DigestInfo parameter regression')
  const digestBytes = digest.digest().bytes()
  const payload = digestInfo(forgeInstance, digestBytes, options)
  return publicKey.verify(digestBytes, signedRawBlock(forgeInstance, privateKey, payload))
}

function runNpm(args: string[], cwd: string): string {
  const result = spawnSync('npm', args, {
    cwd,
    encoding: 'utf8',
    timeout: 120_000,
    env: { ...process.env, npm_config_cache: path.join(fixtureRoot, '.npm-cache') },
  })
  if (result.status !== 0) {
    throw new Error(`npm ${args.join(' ')} failed in fixture: ${result.stderr || result.stdout}`)
  }
  return result.stdout
}

beforeAll(() => {
  fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'maintainex-node-forge-install-'))
  const mobilePackageRoot = path.dirname(sourcePackagePath)
  const cleanPackageRoot = path.join(fixtureRoot, 'node-forge')
  fixtureMobileRoot = path.join(fixtureRoot, 'project', 'apps', 'mobile')
  fs.cpSync(mobilePackageRoot, cleanPackageRoot, { recursive: true })

  // Restore the package's upstream 1.4.0 guard in the tarball. npm ci below
  // must apply the tracked MaintainEX postinstall patch to the installed copy.
  const rsaPath = path.join(cleanPackageRoot, 'lib/rsa.js')
  const rsa = fs.readFileSync(rsaPath, 'utf8')
  const marker = '// MaintainEX CVE-2026-85393 nested DigestAlgorithm child-count validation'
  let pristine = rsa
  if (rsa.includes(marker)) {
    const guardStart = rsa.lastIndexOf('obj.value.length !== 2 ||', rsa.indexOf(marker))
    const countCheck = rsa.indexOf('obj.value[0].value.length', guardStart)
    const guardEnd = rsa.indexOf(') {', countCheck)
    if (guardStart < 0 || countCheck < 0 || guardEnd < 0) {
      throw new Error('Could not locate the installed MaintainEX guard in the node-forge fixture')
    }
    pristine = rsa.slice(0, guardStart) + 'obj.value.length !== 2) {' + rsa.slice(guardEnd + 3)
  }
  if ((rsa.includes(marker) && pristine === rsa) || !pristine.includes('obj.value.length !== 2) {')) {
    throw new Error('Could not prepare the local node-forge 1.4.0 package fixture')
  }
  fs.writeFileSync(rsaPath, pristine)

  const packed = JSON.parse(runNpm(['pack', cleanPackageRoot, '--pack-destination', fixtureRoot, '--json'], process.cwd()))
  const tarballName = packed[0]?.filename
  if (!tarballName) throw new Error('npm pack did not return a node-forge fixture tarball')

  fs.mkdirSync(path.join(fixtureMobileRoot, 'scripts'), { recursive: true })
  fs.copyFileSync(patchScriptPath, path.join(fixtureMobileRoot, 'scripts', 'apply-node-forge-security-patch.cjs'))
  fs.writeFileSync(path.join(fixtureMobileRoot, 'package.json'), JSON.stringify({
    name: 'maintainex-node-forge-install-fixture',
    version: '1.0.0',
    private: true,
    scripts: { postinstall: 'node scripts/apply-node-forge-security-patch.cjs' },
    dependencies: { 'node-forge': `file:../../../${tarballName}` },
  }, null, 2) + '\n')

  runNpm(['install', '--package-lock-only', '--ignore-scripts', '--no-audit', '--no-fund'], fixtureMobileRoot)

  // First prove that the package fixture is vulnerable with lifecycle scripts
  // disabled, then install from the same lock with postinstall enabled.
  runNpm(['ci', '--ignore-scripts', '--no-audit', '--no-fund'], fixtureMobileRoot)
  const fixtureRequire = createRequire(path.join(fixtureMobileRoot, 'package.json'))
  const unpatchedForge = fixtureRequire('node-forge')
  const unpatchedKeys = unpatchedForge.pki.rsa.generateKeyPair({ bits: 1024, e: 3 })
  expect(verifyDigestInfo(unpatchedForge, unpatchedKeys.privateKey, unpatchedKeys.publicKey, { includeNull: false, extraChild: true })).toBe(true)
  expect(verifyDigestInfo(unpatchedForge, unpatchedKeys.privateKey, unpatchedKeys.publicKey, { includeNull: true, extraChild: true })).toBe(true)
  expect(verifyDigestInfo(unpatchedForge, unpatchedKeys.privateKey, unpatchedKeys.publicKey, { includeNull: true, extraChild: false, nonEmptyNull: true })).toBe(true)

  runNpm(['ci', '--no-audit', '--no-fund'], fixtureMobileRoot)
  const installedPackageRoot = path.dirname(fixtureRequire.resolve('node-forge/package.json'))
  for (const cachedModule of Object.keys(fixtureRequire.cache)) {
    if (cachedModule.startsWith(installedPackageRoot + path.sep)) delete fixtureRequire.cache[cachedModule]
  }
  forge = fixtureRequire('node-forge')
  keys = forge.pki.rsa.generateKeyPair({ bits: 1024, e: 3 })
})

afterAll(() => {
  if (fixtureRoot) fs.rmSync(fixtureRoot, { recursive: true, force: true })
})

describe('node-forge CVE-2026-85393 install patch', () => {
  it('applies on clean npm ci and safely reapplies without modifying the installed package', () => {
    const fixtureRequire = createRequire(path.join(fixtureMobileRoot, 'package.json'))
    const installedPath = fixtureRequire.resolve('node-forge/lib/rsa.js')
    const installedBefore = fs.readFileSync(installedPath, 'utf8')
    const hardenedGuard = "obj.value[0].value.length !== (('parameters' in capture) ? 2 : 1) ||"
    expect(installedBefore).toContain('MaintainEX CVE-2026-85393 nested DigestAlgorithm child-count validation')
    expect(installedBefore).toContain(hardenedGuard)
    expect(installedBefore).toContain("('parameters' in capture && capture.parameters.length !== 0)) {")

    const fixturePatcher = require(path.join(fixtureMobileRoot, 'scripts/apply-node-forge-security-patch.cjs'))
    fixturePatcher.patchNodeForge(path.dirname(path.dirname(installedPath)))
    expect(fs.readFileSync(installedPath, 'utf8')).toBe(installedBefore)
  })

  it('accepts valid SHA-256 AlgorithmIdentifier forms with NULL present or absent', () => {
    expect(verifyDigestInfo(forge, keys.privateKey, keys.publicKey, { includeNull: false, extraChild: false })).toBe(true)
    expect(verifyDigestInfo(forge, keys.privateKey, keys.publicKey, { includeNull: true, extraChild: false })).toBe(true)
  })

  it('rejects garbage after the OID when NULL is absent', () => {
    expect(() => verifyDigestInfo(forge, keys.privateKey, keys.publicKey, { includeNull: false, extraChild: true })).toThrow(/DigestInfo/)
  })

  it('rejects garbage after OID and NULL', () => {
    expect(() => verifyDigestInfo(forge, keys.privateKey, keys.publicKey, { includeNull: true, extraChild: true })).toThrow(/DigestInfo/)
  })

  it('rejects non-empty DER NULL parameters', () => {
    expect(() => verifyDigestInfo(forge, keys.privateKey, keys.publicKey, { includeNull: true, extraChild: false, nonEmptyNull: true })).toThrow(/DigestInfo/)
  })

  it('continues to verify a standard RSA PKCS#1 v1.5 SHA-256 signature', () => {
    const digest = forge.md.sha256.create()
    digest.update('MaintainEX valid RSA signature control')
    const signature = keys.privateKey.sign(digest)
    expect(keys.publicKey.verify(digest.digest().bytes(), signature)).toBe(true)
  })
})

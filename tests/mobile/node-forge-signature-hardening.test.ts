import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'
import { spawnSync } from 'node:child_process'

const mobileRequire = createRequire(path.resolve(process.cwd(), 'apps/mobile/package.json'))
const sourcePackagePath = mobileRequire.resolve('node-forge/package.json')

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
  fixtureMobileRoot = path.join(fixtureRoot, 'project', 'apps', 'mobile')
  fs.mkdirSync(fixtureMobileRoot, { recursive: true })

  const sourcePackageRoot = path.dirname(sourcePackagePath)
  const sourceManifest = JSON.parse(fs.readFileSync(sourcePackagePath, 'utf8'))
  if (sourceManifest.name !== 'node-forge' || sourceManifest.version !== '1.4.2') {
    throw new Error(`Expected upstream node-forge 1.4.2, found ${sourceManifest.name}@${sourceManifest.version}`)
  }

  const packed = JSON.parse(runNpm(['pack', sourcePackageRoot, '--pack-destination', fixtureRoot, '--json'], process.cwd()))
  const tarballName = packed[0]?.filename
  if (!tarballName) throw new Error('Could not pack the installed node-forge 1.4.2 fixture')

  fs.writeFileSync(path.join(fixtureMobileRoot, 'package.json'), JSON.stringify({
    name: 'maintainex-node-forge-upstream-fixture',
    version: '1.0.0',
    private: true,
    dependencies: { 'node-forge': `file:../../../${tarballName}` },
  }, null, 2) + '\n')

  // Prove that a clean, lockfile-backed install retains the upstream fix.
  runNpm(['install', '--package-lock-only', '--ignore-scripts', '--no-audit', '--no-fund'], fixtureMobileRoot)
  runNpm(['ci', '--ignore-scripts', '--no-audit', '--no-fund'], fixtureMobileRoot)

  const fixtureRequire = createRequire(path.join(fixtureMobileRoot, 'package.json'))
  const installedManifest = fixtureRequire('node-forge/package.json')
  if (installedManifest.version !== '1.4.2') {
    throw new Error(`Clean install resolved unexpected node-forge ${installedManifest.version}`)
  }
  forge = fixtureRequire('node-forge')
  keys = forge.pki.rsa.generateKeyPair({ bits: 1024, e: 3 })
})

afterAll(() => {
  if (fixtureRoot) fs.rmSync(fixtureRoot, { recursive: true, force: true })
})

describe('upstream node-forge DigestInfo validation', () => {
  it('preserves the upstream guard after a clean npm ci install', () => {
    const fixtureRequire = createRequire(path.join(fixtureMobileRoot, 'package.json'))
    const installedPath = fixtureRequire.resolve('node-forge/lib/rsa.js')
    const installedSource = fs.readFileSync(installedPath, 'utf8')
    expect(installedSource).toContain('require a canonical DER DigestInfo')
    expect(installedSource).toContain('_encodeDigestInfo(oid, capture.digest, true)')
    expect(installedSource).not.toContain('MaintainEX CVE-2026-85393')
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

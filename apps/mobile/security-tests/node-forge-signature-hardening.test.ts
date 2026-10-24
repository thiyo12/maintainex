import { afterEach, describe, expect, it } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const testRequire = createRequire(import.meta.url)
const { patchNodeForge } = testRequire('../scripts/apply-node-forge-security-patch.cjs')
const mobileRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

let fixtureRoot: string | undefined

function der(tag: number, content: string): string {
  if (content.length >= 128) throw new Error('test DER fixture must use short-form lengths')
  return String.fromCharCode(tag, content.length) + content
}

function malformedDigestInfo(forge: any, digest: string): string {
  const sha256Oid = forge.util.hexToBytes('0609608648016503040201')
  const nullParameters = forge.util.hexToBytes('0500')
  const unexpectedChild = forge.util.hexToBytes('0401ff')
  const algorithm = der(0x30, sha256Oid + nullParameters + unexpectedChild)
  return der(0x30, algorithm + der(0x04, digest))
}

function signedRawBlock(forge: any, privateKey: any, payload: string): string {
  const keyBytes = Math.ceil(privateKey.n.bitLength() / 8)
  const paddingLength = keyBytes - payload.length - 3
  if (paddingLength < 8) throw new Error('RSA test key too small')
  const encoded = '\x00\x01' + '\xff'.repeat(paddingLength) + '\x00' + payload
  const message = new forge.jsbn.BigInteger(forge.util.bytesToHex(encoded), 16)
  const signature = message.modPow(privateKey.d, privateKey.n).toString(16).padStart(keyBytes * 2, '0')
  return forge.util.hexToBytes(signature)
}

afterEach(() => {
  if (fixtureRoot) fs.rmSync(fixtureRoot, { recursive: true, force: true })
  fixtureRoot = undefined
})

describe('node-forge CVE-2026-85393 install patch', () => {
  it('continues to accept valid signatures and rejects DigestAlgorithm with an extra child', () => {
    const sourceRoot = path.join(mobileRoot, 'node_modules/node-forge')
    fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'maintainex-node-forge-'))
    fs.cpSync(sourceRoot, fixtureRoot, { recursive: true })
    patchNodeForge(fixtureRoot)
    const forge = testRequire(fixtureRoot)
    const keys = forge.pki.rsa.generateKeyPair({ bits: 1024, e: 65537 })
    const validDigest = forge.md.sha256.create()
    validDigest.update('maintainex signature verification control')
    const validSignature = keys.privateKey.sign(validDigest)
    expect(keys.publicKey.verify(validDigest.digest().bytes(), validSignature)).toBe(true)

    const attackDigest = forge.md.sha256.create()
    attackDigest.update('maintainex malformed DigestInfo regression')
    const attackBytes = attackDigest.digest().bytes()
    const malformed = malformedDigestInfo(forge, attackBytes)
    const signature = signedRawBlock(forge, keys.privateKey, malformed)
    expect(() => keys.publicKey.verify(attackBytes, signature)).toThrow(/DigestInfo/)
  })
})

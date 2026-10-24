const fs = require('node:fs')
const path = require('node:path')

const MARKER = 'MaintainEX CVE-2026-85393 nested DigestAlgorithm child-count validation'

function patchNodeForge(packageRoot = path.resolve(__dirname, '../node_modules/node-forge')) {
  const manifestPath = path.join(packageRoot, 'package.json')
  const sourcePath = path.join(packageRoot, 'lib/rsa.js')
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
  if (manifest.name !== 'node-forge' || manifest.version !== '1.4.0') {
    throw new Error(`Expected node-forge 1.4.0, found ${manifest.name}@${manifest.version}`)
  }
  let source = fs.readFileSync(sourcePath, 'utf8')
  if (source.includes(MARKER)) return

  const vulnerable = 'obj.value.length !== 2) {'
  const hardened = `obj.value.length !== 2 ||\n` +
    `            // ${MARKER}\n` +
    `            !Array.isArray(obj.value[0].value) ||\n` +
    `            obj.value[0].value.length < 1 || obj.value[0].value.length > 2) {`
  const matches = source.split(vulnerable).length - 1
  if (matches !== 1) throw new Error('node-forge RSA verification source changed; refusing an unsafe partial patch')
  source = source.replace(vulnerable, hardened)
  fs.writeFileSync(sourcePath, source)
}

if (require.main === module) patchNodeForge()
module.exports = { patchNodeForge }

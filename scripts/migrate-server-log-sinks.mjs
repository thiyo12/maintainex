import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { relative, resolve } from 'node:path'

const ROOTS = [
  'app/api',
  'lib/auth',
  'lib/crm',
  'lib/security',
  'lib/payment',
  'lib/finance',
]

const IMPORT = "import { secureConsole } from '@/lib/shared/observability/secure-console'\n"

function walk(root) {
  const absolute = resolve(process.cwd(), root)
  if (!existsSync(absolute)) return []

  const out = []
  for (const entry of readdirSync(absolute)) {
    const path = resolve(absolute, entry)
    const stat = statSync(path)
    if (stat.isDirectory()) out.push(...walk(relative(process.cwd(), path)))
    else if (/\.(?:ts|tsx|js|jsx)$/.test(path)) out.push(path)
  }
  return out
}

function addImport(source) {
  if (source.includes("from '@/lib/shared/observability/secure-console'")) return source

  const directive = source.match(/^((?:['"]use (?:server|client)['"];?\s*\n)+)/)
  if (directive) {
    return source.slice(0, directive[0].length) + IMPORT + source.slice(directive[0].length)
  }
  return IMPORT + source
}

let changedFiles = 0
let replacedSinks = 0

for (const root of ROOTS) {
  for (const file of walk(root)) {
    let source = readFileSync(file, 'utf8')
    const matches = source.match(/\bconsole\.(?:error|warn|log)\s*\(/g)
    if (!matches?.length) continue

    replacedSinks += matches.length
    source = source.replace(/\bconsole\.(error|warn|log)\s*\(/g, 'secureConsole.$1(')
    source = addImport(source)
    writeFileSync(file, source)
    changedFiles += 1
  }
}

console.log(JSON.stringify({ changedFiles, replacedSinks }))

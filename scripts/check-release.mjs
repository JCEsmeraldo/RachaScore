#!/usr/bin/env node
// Garante, antes de publicar (push), que versão e Novidades estão em dia:
// 1. package.json "version" = versão da entrada do topo de src/lib/changelog.ts
// 2. existe a tag v<versão> (criada no commit da publicação)
// 3. nenhum commit feat:/fix: depois dessa tag (mudança visível sem versão nova)
// Uso: npm run check-release (o hook .githooks/pre-push roda sozinho).
// Emergência: git push --no-verify.
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const git = (cmd) => execSync(`git ${cmd}`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
const errors = []

const version = JSON.parse(readFileSync('package.json', 'utf8')).version
const changelog = readFileSync('src/lib/changelog.ts', 'utf8')
const top = changelog.match(/CHANGELOG[^=]*=\s*\[\s*\{\s*version:\s*'([^']+)'/)?.[1]

if (!top) errors.push('Não achei a entrada do topo em src/lib/changelog.ts.')
else if (top !== version) errors.push(`package.json está em ${version}, mas o topo das Novidades é ${top}.`)

let tagged = false
try {
  git(`rev-parse -q --verify refs/tags/v${version}`)
  tagged = true
} catch {
  errors.push(`Falta a tag v${version}: git tag -a v${version} -m v${version}`)
}

if (tagged) {
  const pending = git(`log v${version}..HEAD --format=%h%x20%s`)
    .split('\n')
    .filter((line) => /^\S+ (feat|fix)(\([^)]*\))?!?:/.test(line))
  if (pending.length)
    errors.push(
      `Commits visíveis depois de v${version} sem versão nova (suba a versão, adicione nas Novidades e crie a tag):\n` +
        pending.map((l) => `    ${l}`).join('\n'),
    )
}

if (errors.length) {
  console.error('\n✗ Novidades/versão desatualizadas:\n')
  for (const e of errors) console.error(`  - ${e}`)
  console.error('\n  (emergência: git push --no-verify)\n')
  process.exit(1)
}
console.log(`✓ Novidades em dia (v${version})`)

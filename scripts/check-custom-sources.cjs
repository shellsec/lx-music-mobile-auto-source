const fs = require('node:fs')
const path = require('node:path')
const { execFileSync } = require('node:child_process')

// Split historical markers so this guard does not advertise real providers.
const forbidden = [
  ['lx-music', 'source'].join('-'), ['gh', 'proxy'].join('-'),
  ['野', '花'].join(''), ['六', '音'].join(''), ['Hui', 'bq'].join(''),
  ['i', 'kun'].join(''), ['野', '草'].join(''), ['综合', 'API'].join(''),
  ['全都', '要'].join(''),
]
const names = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z']).toString().split('\0')
const failures = []
for (const name of names) {
  if (!name || !fs.existsSync(name) || name.startsWith('.ssh-deploy/')) continue
  if (!/\.(?:[cm]?js|jsx|ts|tsx|json|md|ya?ml|xml|gradle|plist|txt)$/.test(name)) continue
  const text = fs.readFileSync(name, 'utf8').toLowerCase()
  if (forbidden.some(marker => text.includes(marker.toLowerCase()))) failures.push(name)
}
const provisioned = fs.existsSync('src/sources/builtin') ? fs.readdirSync('src/sources/builtin') : []
if (provisioned.length) failures.push(...provisioned.map(name => path.join('src/sources/builtin', name)))
if (failures.length) {
  console.error('Unexpected preset source content:', failures)
  process.exitCode = 1
} else console.log('Preset source check passed; no source scripts or provider markers in repository inputs.')

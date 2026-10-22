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
// Only the user-selected APK download proxy is allowed in these documentation files.
const downloadDocs = new Set(['README.md', 'README.en.md', 'publish/changeLog.md'])
const proxyHost = ['gh', 'proxy.com'].join('-')
const releaseDownload = new RegExp('^https://' + proxyHost.replace('.', '\\.') + '/https://github\\.com/shellsec/lx-music-mobile-auto-source/releases/download/v[0-9]+\\.[0-9]+\\.[0-9]+/lx-music-mobile-v[0-9]+\\.[0-9]+\\.[0-9]+-(arm64-v8a|armeabi-v7a|universal|x86_64|x86)\\.apk$')
const allowedDownloadLink = (link) => {
  if (link === `https://${proxyHost}/` || releaseDownload.test(link)) return true
  try {
    const parsed = new URL(link)
    return parsed.origin === 'https://quickchart.io' && parsed.pathname === '/qr' && releaseDownload.test(parsed.searchParams.get('text') ?? '')
  } catch { return false }
}
const failures = []
for (const name of names) {
  if (!name || !fs.existsSync(name) || name.startsWith('.ssh-deploy/')) continue
  if (!/\.(?:[cm]?js|jsx|ts|tsx|json|md|ya?ml|xml|gradle|plist|txt)$/.test(name)) continue
  let text = fs.readFileSync(name, 'utf8')
  if (downloadDocs.has(name)) text = text.replace(/https:\/\/[^\s)]+/g, link => allowedDownloadLink(link) ? '' : link)
  text = text.toLowerCase()
  if (forbidden.some(marker => text.includes(marker.toLowerCase()))) failures.push(name)
}
const provisioned = fs.existsSync('src/sources/builtin') ? fs.readdirSync('src/sources/builtin') : []
if (provisioned.length) failures.push(...provisioned.map(name => path.join('src/sources/builtin', name)))
if (failures.length) {
  console.error('Unexpected preset source content:', failures)
  process.exitCode = 1
} else console.log('Preset source check passed; no source scripts or provider markers in repository inputs.')

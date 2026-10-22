const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const ts = require('typescript')
function coordinator(download, calls) {
  const module = { exports: {} }
  const mocks = {
    './sourceEntryCore': core(),
    './userApi': { importUserApi: async() => { calls.push('write'); return { id: 'user_api_test' } } },
    './apiSource': { setApiSource: () => calls.push('activate') },
    './common': { updateSetting: () => calls.push('settings') },
    '@/store/userApi/state': { state: { list: [] } },
    '@/sources/remoteSourceFallback': { updateRemoteCatalog: async() => 'unavailable' },
    '@/utils/request': { httpFetch: () => ({ promise: download }) },
  }
  const code = ts.transpileModule(fs.readFileSync('src/core/sourceEntry.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText
  vm.runInNewContext(code, { module, exports: module.exports, require: name => mocks[name] })
  return module.exports
}

test('closing a LAN request during download prevents saving or enabling its source', async() => {
  let finish
  let current = true
  const calls = []
  const entry = coordinator(new Promise(resolve => { finish = resolve }), calls)
  const operation = entry.addSourceEntry({ url: 'https://example.com/import', kind: 'script', enable: true }, () => current)
  current = false
  finish({ body: '/* test script */' })
  await assert.rejects(operation, /已关闭/)
  assert.deepEqual(calls, [])
})

test('import without activation saves only, and concurrent submissions are rejected', async() => {
  let finish
  const calls = []
  const entry = coordinator(new Promise(resolve => { finish = resolve }), calls)
  const request = { url: 'https://example.com/import', kind: 'script', enable: false }
  const first = entry.addSourceEntry(request)
  await assert.rejects(entry.addSourceEntry(request), /正在添加/)
  finish({ body: '/* test script */' })
  await first
  assert.deepEqual(calls, ['write'])
})
function core(URLImplementation = URL) {
  const module = { exports: {} }
  const code = ts.transpileModule(fs.readFileSync('src/core/sourceEntryCore.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText
  vm.runInNewContext(code, { module, exports: module.exports, URL: URLImplementation })
  return module.exports
}

test('address validation works with React Native incomplete URL implementation', () => {
  const { parseSourceAddress } = core(class { get protocol() { throw new Error('not implemented') } })
  assert.equal(parseSourceAddress('https://example.com/import?a=x%2By'), 'https://example.com/import?a=x%2By')
  for (const input of ['https:///path', 'https://:80/a', 'https://example.com:99999/a', 'https://user:pass@example.com/a']) assert.throws(() => parseSourceAddress(input))
})
test('scanned addresses preserve encoded query strings and accept extensionless links', () => {
  const { parseSourceAddress } = core()
  const address = 'https://example.com/import?token=a%2Bb%3D&x=1'
  assert.equal(parseSourceAddress('  ' + address + '\n'), address)
  assert.equal(parseSourceAddress('https://example.com/api'), 'https://example.com/api')
  for (const input of ['javascript:alert(1)', 'file:///tmp/a', 'https://', 'http://example.com/a b', 'https://example.com/\nscript', 'x'.repeat(4097)]) assert.throws(() => parseSourceAddress(input))
})
test('script and subscription routes are explicit, not guessed from suffix', async() => {
  const { executeSourceEntry } = core()
  const calls = []
  const deps = {
    importScript: async url => { calls.push(['script', url]); return 'user_api_test' },
    subscribe: async url => { calls.push(['subscription', url]); return 'user_api_subscription_test' },
    activate: id => calls.push(['activate', id]),
  }
  await executeSourceEntry({ url: 'https://example.com/api', kind: 'subscription', enable: true }, deps)
  assert.deepEqual(calls, [['subscription', 'https://example.com/api'], ['activate', 'user_api_subscription_test']])
  calls.length = 0
  await executeSourceEntry({ url: 'https://example.com/sources.json', kind: 'script', enable: false }, deps)
  assert.deepEqual(calls, [['script', 'https://example.com/sources.json']])
  await assert.rejects(executeSourceEntry({ url: 'https://example.com/api', kind: 'other', enable: true }, deps))
})
test('download failures and invalid requests cannot activate sources', async() => {
  const { executeSourceEntry } = core()
  let activations = 0
  const deps = { importScript: async() => { throw new Error('offline') }, subscribe: async() => undefined, activate: () => { activations++ } }
  await assert.rejects(executeSourceEntry({ url: 'https://example.com/api', kind: 'script', enable: true }, deps), /offline/)
  await assert.rejects(executeSourceEntry({ url: 'https://example.com/sources.json', kind: 'subscription', enable: true }, deps))
  assert.equal(activations, 0)
})

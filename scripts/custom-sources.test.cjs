const assert = require('node:assert/strict')
const test = require('node:test')
const fs = require('node:fs')
const vm = require('node:vm')
const ts = require('typescript')

// Execute the production modules with only the React Native boundaries replaced.
function load(file, mocks = {}, globals = {}) {
  const source = fs.readFileSync(file, 'utf8')
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText
  const module = { exports: {} }
  const context = { module, exports: module.exports, require(id) {
    if (!(id in mocks)) throw new Error(`Unexpected dependency: ${id}`)
    return mocks[id]
  }, global: globals, console, setTimeout, clearTimeout, URL, AbortController }
  vm.runInNewContext(code, context, { filename: file })
  return module.exports
}
const autoId = 'user_api_auto'
function harness(initial = []) {
  let stored = initial
  const state = { list: [] }
  const removed = []
  const data = {
    getUserApiList: async() => stored,
    replaceUserApiList: async(list) => { stored = list; return list },
    removeUserApiScripts: async(ids) => { removed.push(...ids) },
    getUserApiScript: async() => 'user imported test script',
  }
  const apis = { setUserApiList(list) { state.list = list } }
  const ensure = load('src/sources/userSources.ts', {
    './constants': { USER_API_AUTO_ID: autoId }, '@/utils/data': data,
    '@/core/userApi': apis, '@/store/userApi/state': { state },
  })
  return { ensure, state, data, apis, removed }
}

test('fresh installation stays empty, automatic switching defaults off', async() => {
  const h = harness()
  await h.ensure.initializeUserSources()
  assert.equal(h.state.list.length, 0)
  assert.equal(h.ensure.getLocalPlayableIds().length, 0)
  assert.equal(load('src/config/defaultSetting.ts').default['common.apiSource'], '')
})

test('upgrade removes provisioned entries and keeps user imports', async() => {
  const h = harness([{ id: 'user_api_builtin_old' }, { id: autoId }, { id: 'user_api_imported' }])
  await h.ensure.initializeUserSources()
  assert.deepEqual(Array.from(h.ensure.getLocalPlayableIds()), ['user_api_imported'])
  assert.deepEqual(h.removed, ['user_api_builtin_old', autoId])
})

test('reordering changes the retry order and deleted sources disappear', async() => {
  const h = harness([{ id: 'user_api_a' }, { id: 'user_api_b' }, { id: 'user_api_c' }])
  await h.ensure.initializeUserSources()
  h.state.list = [h.state.list[2], h.state.list[0]]
  assert.deepEqual(Array.from(h.ensure.getSourceRetryOrder()), ['user_api_c', 'user_api_a'])
  assert.deepEqual(Array.from(h.ensure.getSourceRetryOrder(['user_api_c'])), ['user_api_a'])
})

async function playbackHarness(failInit = [], subscription = {}) {
  const h = harness(['a', 'b', 'c'].map(id => ({ id: `user_api_${id}` })))
  await h.ensure.initializeUserSources()
  const setting = { setting: { 'common.apiSource': autoId, 'common.sourceListUrl': subscription.url ?? '' } }
  const globals = { lx: { apis: {}, apiInitPromise: [Promise.resolve(true), true, () => {}] } }
  const loaded = []
  h.apis.setUserApi = async(id) => {
    loaded.push(id)
    globals.lx.apis = { test: {} }
    globals.lx.apiInitPromise[2](!failInit.includes(id))
  }
  const failover = load('src/core/userApiFailover.ts', {
    '@/store/setting/state': { default: setting },
    '@/core/common': { updateSetting(value) { Object.assign(setting.setting, value) } },
    '@/core/userApi': h.apis, '@/utils/data': h.data,
    '@/sources/userSources': h.ensure,
    '@/sources/remoteSourceFallback': { applyRemoteSourceFallback: async() => {
      h.ensure.setLoadedSourceId(null)
      return subscription.update ? subscription.update() : false
    } },
    '@/sources/subscriptionRecovery': load('src/sources/subscriptionRecovery.ts'),
  }, globals)
  return { ...h, setting, globals, loaded, failover }
}

test('manual selection never triggers automatic switching', async() => {
  const h = await playbackHarness()
  h.setting.setting['common.apiSource'] = 'user_api_a'
  assert.equal(h.failover.isAutoApiSource(), false)
  await assert.rejects(h.failover.tryUserSourceFailover(async() => ({ url: 'https://example.com/audio', type: '128k' })), /not auto mode/)
  assert.equal(h.loaded.length, 0)
})

test('imported source success and ordered playback failover use production init gates', async() => {
  const h = await playbackHarness()
  await h.failover.activateAutoUserApi()
  assert.equal(h.ensure.getLoadedSourceId(), 'user_api_a')
  const attempted = []
  const result = await h.failover.tryUserSourceFailover(async() => {
    const id = h.ensure.getLoadedSourceId()
    attempted.push(id)
    if (id === 'user_api_b') throw new Error('test playback failed')
    return { url: 'https://example.com/audio', type: '128k' }
  })
  assert.deepEqual(attempted, ['user_api_b', 'user_api_c'])
  assert.equal(result.url, 'https://example.com/audio')
  assert.equal(h.setting.setting['common.apiSource'], autoId)
})

test('failed initialization skips to next imported source', async() => {
  const h = await playbackHarness(['user_api_a', 'user_api_b'])
  await assert.rejects(h.failover.activateAutoUserApi(), /source init failed/)
  const result = await h.failover.tryUserSourceFailover(async() => ({ url: 'https://example.com/audio', type: '128k' }))
  assert.deepEqual(h.loaded, ['user_api_a', 'user_api_b', 'user_api_c'])
  assert.equal(result.type, '128k')
})

test('all failed sources stop after one pass without remote requests', async() => {
  const h = await playbackHarness()
  await h.failover.activateAutoUserApi()
  await assert.rejects(h.failover.tryUserSourceFailover(async() => { throw new Error('test failure') }), /test failure/)
  assert.deepEqual(h.loaded, ['user_api_a', 'user_api_b', 'user_api_c'])
})

const catalog = load('src/sources/remoteSourceFallbackCore.ts')
test('catalog URL is empty by default; parser accepts both formats and rejects duplicates and non-http URLs', () => {
  assert.equal(catalog.REMOTE_SOURCES_URL, '')
  const entry = { id: 'test', name: 'Test', url: 'test.js' }
  for (const doc of [[entry], { sources: [entry] }]) {
    const parsed = catalog.parseSourcesJson(JSON.stringify(doc), 'https://example.com/sources.json')
    assert.equal(parsed[0].url, 'https://example.com/test.js')
  }
  assert.equal(catalog.parseSourcesJson(JSON.stringify([entry, entry]), 'https://example.com/sources.json'), null)
  assert.equal(catalog.resolveScriptUrl('file:///test'), null)
  assert.equal(catalog.parseSourcesJson('invalid'), null)
})

test('manual subscription empty URL never makes a network request', async() => {
  const subscription = load('src/sources/remoteSourceFallback.ts', {
    'react-native-background-timer': { default: { setTimeout, clearTimeout } },
    '@/core/userApi': {}, '@/store/userApi/state': { state: { list: [] } },
    '@/utils/data': {}, '@/sources/userSources': {}, '@/core/apiSource': {},
    '@/sources/remoteSourceFallbackCore': catalog,
  }, { fetch() { throw new Error('Unexpected network access') } })
  assert.equal(await subscription.applyRemoteSourceFallback(''), false)
})

function subscriptionHarness(initial, responses) {
  let list = initial
  let writes = 0
  const scripts = new Map()
  const selected = []
  const state = { list }
  const subscription = load('src/sources/remoteSourceFallback.ts', {
    'react-native-background-timer': { default: { setTimeout, clearTimeout } },
    '@/core/userApi': { setUserApiList(next) { state.list = next } },
    '@/store/userApi/state': { state },
    '@/utils/data': {
      getUserApiList: async() => list,
      getUserApiScript: async(id) => scripts.get(id) ?? '',
      removeUserApiScripts: async(ids) => { for (const id of ids) scripts.delete(id) },
      replaceUserApiList: async(next) => { writes++; list = next; return next },
      writeUserApiScripts: async(entries) => { writes++; for (const { id, script } of entries) scripts.set(id, script) },
    },
    '@/sources/userSources': { setLoadedSourceId() {} },
    '@/core/apiSource': { setApiSource(id) { selected.push(id) } },
    '@/sources/remoteSourceFallbackCore': catalog,
  }, {
    lx: {},
    async fetch(url) {
      const body = responses[url]
      return { ok: body != null, status: body != null ? 200 : 503, text: async() => body }
    },
  })
  return { subscription, state, scripts, selected, writes: () => writes }
}

test('failed subscription download preserves scripts and list without partial writes', async() => {
  const original = [{ id: 'user_api_local', name: 'Local' }]
  const h = subscriptionHarness(original, {
    'https://example.com/sources.json': JSON.stringify([
      { id: 'a', name: 'A', url: 'a.js' }, { id: 'b', name: 'B', url: 'b.js' },
    ]),
    'https://example.com/a.js': 'test source A',
  })
  assert.equal(await h.subscription.applyRemoteSourceFallback('https://example.com/sources.json'), false)
  assert.equal(h.state.list, original)
  assert.equal(h.writes(), 0)
})

test('manual subscription preserves user order and local imports, and unchanged updates do not write', async() => {
  const h = subscriptionHarness([
    { id: 'user_api_subscription_b', name: 'B' },
    { id: 'user_api_local', name: 'Local' },
    { id: 'user_api_subscription_a', name: 'A' },
  ], {
    'https://example.com/sources.json': JSON.stringify([
      { id: 'a', name: 'A', url: 'a.js' }, { id: 'b', name: 'B', url: 'b.js' },
    ]),
    'https://example.com/a.js': 'test source A',
    'https://example.com/b.js': 'test source B',
  })
  assert.equal(await h.subscription.applyRemoteSourceFallback('https://example.com/sources.json'), true)
  assert.deepEqual(Array.from(h.state.list, item => item.id), ['user_api_subscription_b', 'user_api_local', 'user_api_subscription_a'])
  assert.deepEqual(h.selected, [''])
  const previousWrites = h.writes()
  assert.equal(await h.subscription.applyRemoteSourceFallback('https://example.com/sources.json'), false)
  assert.equal(h.writes(), previousWrites)
})

test('saved subscription starts empty on a fresh installation', () => {
  assert.equal(load('src/config/defaultSetting.ts').default['common.sourceListUrl'], '')
})

test('automatic subscription recovery retries only changed content once per song', async() => {
  const { runSubscriptionRecovery } = load('src/sources/subscriptionRecovery.ts')
  let fetches = 0
  let retries = 0
  const options = {
    url: 'https://example.com/sources.json', songKey: 'test song',
    fetchAndUpdate: async() => { fetches++; return true },
    retry: async() => { retries++; return 'recovered' },
  }
  assert.equal(await runSubscriptionRecovery(options), 'recovered')
  assert.equal(await runSubscriptionRecovery(options), undefined)
  assert.equal(fetches, 1)
  assert.equal(retries, 1)
})

test('empty subscription, unchanged catalog and failed download never retry playback', async() => {
  const { runSubscriptionRecovery } = load('src/sources/subscriptionRecovery.ts')
  let retries = 0
  assert.equal(await runSubscriptionRecovery({ url: '', songKey: 'empty', fetchAndUpdate: async() => { throw new Error('must not fetch') }, retry: async() => { retries++ } }), undefined)
  for (const [url, fetchAndUpdate] of [
    ['https://example.com/unchanged', async() => false],
    ['https://example.com/failure', async() => { throw new Error('offline') }],
  ]) {
    assert.equal(await runSubscriptionRecovery({ url, songKey: 'song', fetchAndUpdate, retry: async() => { retries++ } }), undefined)
  }
  assert.equal(retries, 0)
})


test('all imported sources fail, saved subscription updates, then retry succeeds in user order', async() => {
  let updates = 0
  const h = await playbackHarness([], { url: 'https://example.com/sources.json', update: async() => { updates++; return true } })
  await h.failover.activateAutoUserApi()
  const result = await h.failover.tryUserSourceFailover(async() => {
    if (!updates) throw new Error('expired script')
    return { url: 'https://example.com/audio', type: '128k' }
  }, 'updated song')
  assert.equal(updates, 1)
  assert.deepEqual(h.loaded, ['user_api_a', 'user_api_b', 'user_api_c', 'user_api_a'])
  assert.equal(result.type, '128k')
  assert.equal(h.setting.setting['common.apiSource'], autoId)
})

test('updated scripts failing again stop after the second local pass', async() => {
  let updates = 0
  const h = await playbackHarness([], { url: 'https://example.com/sources.json', update: async() => { updates++; return true } })
  await h.failover.activateAutoUserApi()
  await assert.rejects(h.failover.tryUserSourceFailover(async() => { throw new Error('still unavailable') }, 'unavailable song'), /still unavailable/)
  assert.equal(updates, 1)
  assert.deepEqual(h.loaded, ['user_api_a', 'user_api_b', 'user_api_c', 'user_api_a', 'user_api_b', 'user_api_c'])
  await assert.rejects(h.failover.tryUserSourceFailover(async() => { throw new Error('still unavailable') }, 'unavailable song'))
  assert.equal(updates, 1)
})

test('single subscribed source refreshes without enabling multi-source switching', async() => {
  let updates = 0
  const h = await playbackHarness([], { url: 'https://example.com/sources.json', update: async() => { updates++; return true } })
  const id = 'user_api_subscription_test'
  h.state.list = [{ id }]
  h.setting.setting['common.apiSource'] = id
  h.failover.setExpectedSourceId(id)
  const result = await h.failover.tryUserSourceFailover(async() => ({ url: 'https://example.com/audio', type: '128k' }), 'single song')
  assert.equal(updates, 1)
  assert.deepEqual(h.loaded, [id])
  assert.equal(result.type, '128k')
  assert.equal(h.setting.setting['common.apiSource'], id)
})

test('concurrent failures and subsequent songs share the subscription check cooldown', async() => {
  const { runSubscriptionRecovery } = load('src/sources/subscriptionRecovery.ts')
  let fetches = 0
  const check = songKey => runSubscriptionRecovery({
    url: 'https://example.com/sources.json', songKey,
    fetchAndUpdate: async() => { fetches++; return false }, retry: async() => 'unexpected',
  })
  await Promise.all([check('first'), check('second'), check('third')])
  assert.equal(fetches, 1)
})

test('automatic catalog application keeps the selected playback mode', async() => {
  const h = subscriptionHarness([{ id: 'user_api_local', name: 'Local' }], {
    'https://example.com/sources.json': JSON.stringify([{ id: 'test', name: 'Test', url: 'test.js' }]),
    'https://example.com/test.js': 'test source body',
  })
  assert.equal(await h.subscription.applyRemoteSourceFallback('https://example.com/sources.json', true), true)
  assert.deepEqual(h.selected, [])
})

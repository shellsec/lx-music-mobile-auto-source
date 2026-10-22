const test = require('node:test')
const assert = require('node:assert/strict')
const vm = require('node:vm')
const fs = require('node:fs')
const html = fs.readFileSync('android/app/src/main/assets/source-entry.html', 'utf8')
function page(hash, responder) {
  const elements = new Map()
  for (const id of ['pair', 'entry', 'code', 'url', 'kind', 'enable', 'message']) {
    elements.set(id, { value: '', hidden: false, checked: true, textContent: '', button: { disabled: false }, handlers: {},
      addEventListener(event, callback) { this.handlers[event] = callback }, querySelector() { return this.button } })
  }
  elements.get('kind').value = 'script'
  const history = []
  const calls = []
  vm.runInNewContext(html.match(/<script>([\s\S]*?)<\/script>/)[1], {
    document: { getElementById: id => elements.get(id) }, location: { hash, pathname: '/' },
    history: { replaceState: (...args) => history.push(args) }, URL, URLSearchParams,
    fetch: async(path, options) => { calls.push({ path, options }); return responder(path, options) },
  })
  return { elements, history, calls, submit: async id => elements.get(id).handlers.submit({ preventDefault() {} }) }
}
const response = (result, status = 200) => ({ ok: status === 200, status, json: async() => result })
test('QR browser visit enters directly and removes the credential from address history', async() => {
  const p = page('#token=temporary-secret', () => response({ message: 'saved' }))
  assert.equal(p.elements.get('pair').hidden, true)
  assert.equal(p.elements.get('entry').hidden, false)
  assert.equal(p.history[0][2], '/')
  const address = 'https://example.com/import?token=a%2Bb%3D&x=1'
  p.elements.get('url').value = address
  p.elements.get('kind').value = 'subscription'
  p.elements.get('enable').checked = false
  await p.submit('entry')
  assert.equal(p.calls[0].options.headers.Authorization, 'Bearer temporary-secret')
  assert.equal(new URLSearchParams(p.calls[0].options.body).get('url'), address)
  assert.equal(new URLSearchParams(p.calls[0].options.body).get('enable'), 'false')
  assert.equal(p.elements.get('message').textContent, 'saved')
})
test('manual browser visit requires pairing before opening import form', async() => {
  const p = page('', () => response({ token: 'paired-token' }))
  assert.equal(p.elements.get('entry').hidden, true)
  p.elements.get('code').value = '123456'
  await p.submit('pair')
  assert.equal(p.calls[0].path, '/api/pair')
  assert.equal(p.elements.get('entry').hidden, false)
  assert.equal(p.elements.get('code').value, '')
})
test('invalid addresses never send and expired credentials return to pairing', async() => {
  const p = page('#token=old-token', () => response({ message: 'pair again' }, 401))
  p.elements.get('url').value = 'javascript:alert(1)'
  await p.submit('entry')
  assert.equal(p.calls.length, 0)
  p.elements.get('url').value = 'https://example.com/import'
  await p.submit('entry')
  assert.equal(p.elements.get('entry').hidden, true)
  assert.equal(p.elements.get('url').value, 'https://example.com/import')
  assert.equal(p.elements.get('entry').button.disabled, false)
})

import assert from 'node:assert/strict'
import test from 'node:test'
import { parseSourcesJson, resolveScriptUrl } from './remoteSourceFallbackCore.ts'

test('catalog parsing requires a user provided address for relative script paths', () => {
  assert.equal(resolveScriptUrl('test.js'), null)
  const result = parseSourcesJson('[{"id":"test","name":"Test","url":"test.js"}]', 'https://example.com/sources.json')
  assert.equal(result?.[0].url, 'https://example.com/test.js')
})

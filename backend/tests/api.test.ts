import assert from 'node:assert/strict'
import { once } from 'node:events'
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import test, { type TestContext } from 'node:test'
import { createApp } from '../src/app.js'

const origin = 'http://127.0.0.1:5173'
async function serve(t: TestContext, probe: () => Promise<void>) {
  const server = createServer(createApp([origin], probe)).listen(0, '127.0.0.1')
  await once(server, 'listening')
  t.after(() => new Promise<void>((resolve, reject) => server.close(e => e ? reject(e) : resolve())))
  return 'http://127.0.0.1:' + (server.address() as AddressInfo).port
}

test('liveness is independent of storage and both readiness requests invoke the probe', async t => {
  let calls = 0
  const base = await serve(t, async () => { calls++ })
  const live = await fetch(base + '/api/health', { headers: { Origin: origin } })
  assert.equal(live.status, 200)
  assert.deepEqual(await live.json(), { status: 'ok', service: 'rep-rivals-api' })
  assert.equal(calls, 0)
  assert.equal(live.headers.get('x-content-type-options'), 'nosniff')
  assert.equal(live.headers.get('cache-control'), 'no-store')
  assert.equal(live.headers.get('access-control-allow-origin'), origin)
  assert.equal(live.headers.get('x-powered-by'), null)
  for (let i = 0; i < 2; i++) {
    const ready = await fetch(base + '/api/health/database')
    assert.equal(ready.status, 200)
    assert.deepEqual(await ready.json(), { status: 'ok', service: 'rep-rivals-api', database: 'reachable' })
  }
  assert.equal(calls, 2)
})

test('database failure returns a generic 503 and logs a redacted cause', async t => {
  const logger = t.mock.method(console, 'error', () => {})
  const base = await serve(t, async () => { throw new Error('password authentication failed: sensitive fixture') })
  const response = await fetch(base + '/api/health/database')
  assert.equal(response.status, 503)
  assert.deepEqual(await response.json(), { status: 'error', error: { code: 'DATABASE_UNAVAILABLE', message: 'Database unavailable.' } })
  assert.deepEqual(logger.mock.calls[0]?.arguments, ['Database readiness:', 'AUTHENTICATION_FAILED'])
})

test('invalid query, denied origins, oversized or malformed JSON and unknown paths are safe API errors', async t => {
  const base = await serve(t, async () => { assert.fail('requests must fail before probing the database') })
  const cases: Array<[string, RequestInit, number, string]> = [
    ['/api/health/database?unexpected=1', {}, 400, 'INVALID_REQUEST'],
    ['/api/health/database', { headers: { Origin: 'https://other.example' } }, 403, 'ORIGIN_DENIED'],
    ['/api/health', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{bad' }, 400, 'INVALID_REQUEST'],
    ['/api/health', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify('x'.repeat(17000)) }, 413, 'PAYLOAD_TOO_LARGE'],
    ['/unknown', {}, 404, 'NOT_FOUND'],
  ]
  for (const [path, init, status, code] of cases) {
    const response = await fetch(base + path, init)
    assert.equal(response.status, status)
    assert.equal((await response.json()).error.code, code)
  }
})

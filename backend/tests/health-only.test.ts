import assert from 'node:assert/strict'
import { request } from 'node:http'
import type { AddressInfo } from 'node:net'
import test from 'node:test'
import { parseRuntimeConfig, readSettings } from '../src/config/env.js'
import { startServer } from '../src/server.js'

test('production smoke listener serves only the exact liveness request', async t => {
  const settings = readSettings(new URL('./missing-smoke-fixture.env', import.meta.url), {
    NODE_ENV: 'production', REP_RIVALS_HEALTH_ONLY: 'true',
  })
  const runtime = await startServer({ ...parseRuntimeConfig(settings), port: 0 })
  t.after(runtime.close)
  const { port } = runtime.server.address() as AddressInfo
  // Explicit HTTP request targets avoid client-side URL normalization in these tests.
  const call = (method: string, path: string) => new Promise<{ status?: number; body: string }>((resolve, reject) => {
    const req = request({ host: '127.0.0.1', port, method, path, headers: {
      Origin: 'https://untrusted.invalid', 'Content-Type': 'application/json',
      'X-HTTP-Method-Override': 'GET', 'X-Forwarded-Proto': 'https',
    } }, res => {
      let body = ''
      res.setEncoding('utf8').on('data', chunk => { body += chunk })
      res.on('end', () => resolve({ status: res.statusCode, body }))
    })
    req.on('error', reject)
    req.end(method === 'POST' ? '{invalid' : undefined)
  })
  const live = await call('GET', '/api/health')
  assert.equal(live.status, 200)
  assert.deepEqual(JSON.parse(live.body), { status: 'ok', service: 'rep-rivals-api' })
  for (const method of ['HEAD', 'OPTIONS', 'POST', 'PUT', 'PATCH', 'DELETE', 'TRACE']) {
    assert.equal((await call(method, '/api/health')).status, 404, method)
  }
  for (const path of ['/api/health/', '/API/health', '/api//health', '/api/%68ealth', '/api%2Fhealth',
    '/api/auth/../health', '/api/health?', '/api/health?x=1', '/', '/api/health/database']) {
    assert.equal((await call('GET', path)).status, 404, path)
  }
  for (const prefix of ['/api/auth', '/api/auth/native']) {
    for (const action of ['register', 'login', 'me', 'logout']) {
      const result = await call(action === 'me' ? 'GET' : 'POST', prefix + '/' + action)
      assert.equal(result.status, 404)
      assert.equal(JSON.parse(result.body).error.code, 'NOT_FOUND')
    }
  }
})

test('absent or false keeps normal production configuration and routing; invalid flag fails startup', async t => {
  const normal = { NODE_ENV: 'production', CORS_ORIGINS: 'https://web.example',
    DATABASE_URL: 'postgresql://fixture:fixture@ep-fixture.neon.tech/test' }
  for (const flag of [undefined, 'false']) {
    assert.throws(() => parseRuntimeConfig({ ...normal, CORS_ORIGINS: undefined, REP_RIVALS_HEALTH_ONLY: flag }), /CORS_ORIGINS/)
    const config = parseRuntimeConfig({ ...normal, REP_RIVALS_HEALTH_ONLY: flag })
    assert.equal(config.healthOnly, false)
    const runtime = await startServer({ ...config, port: 0 })
    t.after(runtime.close)
    const { port } = runtime.server.address() as AddressInfo
    // Anonymous browser POST reaches the normal CSRF check without touching the database.
    const denied = await fetch('http://127.0.0.1:' + port + '/api/auth/login', { method: 'POST' })
    assert.equal(denied.status, 403)
    assert.equal((await denied.json()).error.code, 'ORIGIN_DENIED')
  }
  for (const flag of ['', 'TRUE', '1', 'tru']) {
    assert.throws(() => parseRuntimeConfig({ ...normal, REP_RIVALS_HEALTH_ONLY: flag }), /REP_RIVALS_HEALTH_ONLY/)
  }
})

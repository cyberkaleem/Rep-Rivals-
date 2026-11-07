import assert from 'node:assert/strict'
import test, { type TestContext } from 'node:test'
import { once } from 'node:events'
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { createApp } from '../src/app.js'
import { bearerDigest, issueSession, sessionDigest } from '../src/auth/session.js'
import { parseRuntimeConfig } from '../src/config/env.js'

test('session tokens and their database digests are scoped to their transport', () => {
  const web = issueSession(), mobile = issueSession('android')
  assert.ok(bearerDigest('Bearer ' + mobile.token) === mobile.record.tokenHash)
  assert.equal(bearerDigest('Bearer ' + web.token), null)
  assert.equal(bearerDigest('Bearer ' + mobile.token + ', extra'), null)
  assert.equal(sessionDigest('rr_session=' + mobile.token, 'rr_session'), null)
  assert.ok(sessionDigest('rr_session=' + mobile.token.slice(5), 'rr_session') !== mobile.record.tokenHash)
  assert.ok(bearerDigest('Bearer rrn1.' + web.token) !== web.record.tokenHash)
})

const origin = 'https://web.example'
async function listen(t: TestContext, trusted: string[]) {
  const user = { id: 'test', username: 'test', email: 'test@example.invalid', createdAt: new Date() }
  const unauthorized = async () => { throw Error('Request should have failed before service') }
  const auth = { register: unauthorized, login: unauthorized, me: async () => user, logout: async () => {} }
  const server = createServer(createApp([origin], async () => {}, auth, true, trusted)).listen(0, '127.0.0.1')
  await once(server, 'listening')
  t.after(() => new Promise<void>(resolve => server.close(() => resolve())))
  return 'http://127.0.0.1:' + (server.address() as AddressInfo).port + '/api/auth'
}
test('the native router ignores spoofed forwarding from an untrusted peer', async t => {
  const base = await listen(t, [])
  const res = await fetch(base + '/native/me', { headers: { 'X-Forwarded-Proto': 'https' } })
  assert.equal(res.status, 403)
  assert.equal((await res.json()).error.code, 'HTTPS_REQUIRED')
})

test('a known proxy is supported; browser traffic and native credentials cannot cross lanes', async t => {
  const base = await listen(t, ['127.0.0.1'])
  const headers = { 'X-Forwarded-Proto': 'https', 'Content-Type': 'application/json' }
  for (const [name, value] of [['Origin', origin], ['Cookie', 'rr_session=fixture'], ['Sec-Fetch-Site', 'same-origin']]) {
    const r = await fetch(base + '/native/login', { method: 'POST', headers: { ...headers, [name]: value }, body: '{}' })
    assert.equal(r.status, 403)
    assert.equal(r.headers.get('set-cookie'), null)
  }
  assert.equal((await fetch(base + '/native/me?token=invalid', { headers })).status, 400)
  assert.equal((await fetch(base + '/me', { headers: { ...headers, Authorization: 'Bearer fake' } })).status, 400)
  assert.equal((await fetch(base + '/login', { method: 'POST', headers, body: '{}' })).status, 403)
  assert.equal((await fetch(base + '/native/logout', { method: 'POST', headers, body: '{}' })).status, 401)
  for (let i = 0; i < 20; i++) {
    const native = i % 2 === 0
    const r = await fetch(base + (native ? '/native/login' : '/login'), {
      method: 'POST', headers: native ? headers : { ...headers, Origin: origin }, body: '{}',
    })
    assert.equal(r.status, 400)
  }
  const limited = await fetch(base + '/native/register', { method: 'POST', headers, body: '{}' })
  assert.equal(limited.status, 429)
  assert.ok(limited.headers.has('retry-after'))
})

test('unknown proxies are never trusted by default or via a wildcard', () => {
  const cfg = { DATABASE_URL: 'postgresql://fixture:fixture@ep-fixture.neon.tech/test' }
  assert.deepEqual(parseRuntimeConfig(cfg).trustedProxies, [])
  assert.deepEqual(parseRuntimeConfig({ ...cfg, TRUSTED_PROXY_CIDRS: '127.0.0.1/32' }).trustedProxies, ['127.0.0.1/32'])
  for (const value of ['true', '*', '0.0.0.0/0', '::/0', '127.0.0.1/33']) {
    assert.throws(() => parseRuntimeConfig({ ...cfg, TRUSTED_PROXY_CIDRS: value }), /TRUSTED_PROXY_CIDRS/)
  }
})

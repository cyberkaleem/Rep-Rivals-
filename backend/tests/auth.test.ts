import assert from 'node:assert/strict'
import test from 'node:test'
import { createHash } from 'node:crypto'
import { issueSession, sessionCookie, sessionDigest } from '../src/auth/session.js'
import { parseRuntimeConfig } from '../src/config/env.js'

test('tokens rotate, only their digests identify sessions, ambiguous cookies fail closed', () => {
  const first = issueSession()
  const second = issueSession()
  assert.notEqual(first.record.tokenHash, second.record.tokenHash)
  assert.equal(first.record.tokenHash, createHash('sha256').update(first.token).digest('hex'))
  assert.equal(sessionDigest('other=1; rr_session=' + first.token, 'rr_session'), first.record.tokenHash)
  assert.equal(sessionDigest('rr_session=' + first.token + '; rr_session=' + second.token, 'rr_session'), null)
  assert.equal(sessionDigest('rr_session=bogus', 'rr_session'), null)
})

test('production requires explicit HTTPS origins and host-only HttpOnly Secure cookies', () => {
  const env = { NODE_ENV: 'production', DATABASE_URL: 'postgresql://test:test@ep-fixture.example.neon.tech/test' }
  assert.throws(() => parseRuntimeConfig(env), /CORS_ORIGINS/)
  assert.throws(() => parseRuntimeConfig({ ...env, CORS_ORIGINS: 'http://test.example' }), /CORS_ORIGINS/)
  const config = parseRuntimeConfig({ ...env, CORS_ORIGINS: 'https://test.example' })
  assert.deepEqual(sessionCookie(config.production), {
    name: '__Host-rr_session', options: { path: '/', httpOnly: true, secure: true, sameSite: 'lax' },
  })
})

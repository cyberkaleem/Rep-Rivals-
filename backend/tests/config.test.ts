import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { pathToFileURL } from 'node:url'
import { neonUrl, parseRuntimeConfig, readSettings } from '../src/config/env.js'
import { databaseDiagnostic } from '../src/db/diagnostics.js'

const fixture = 'postgresql://fixture:fixture@ep-test-pooler.example.neon.tech/demo?sslmode=require'

test('root-style settings load by path, exposing only API configuration with injected values taking precedence', t => {
  const dir = mkdtempSync(join(tmpdir(), 'rr-env-'))
  t.after(() => rmSync(dir, { recursive: true }))
  const file = join(dir, '.env')
  writeFileSync(file, 'DATABASE_URL=' + fixture + '\nPORT=4321\nUNRELATED=test')
  const settings = readSettings(pathToFileURL(file), { PORT: '4200' })
  assert.equal(settings.DATABASE_URL, fixture)
  assert.equal(parseRuntimeConfig(settings).port, 4200)
  assert.ok(!Object.hasOwn(settings, 'UNRELATED'))
  const hosted = readSettings(pathToFileURL(join(dir, 'absent')), { DATABASE_URL: fixture })
  assert.equal(parseRuntimeConfig(hosted).port, 4000)
})

test('runtime accepts the pooled endpoint and enforces TLS peer verification', () => {
  const config = parseRuntimeConfig({ DATABASE_URL: fixture })
  assert.equal(config.healthOnly, false)
  assert.equal(new URL(config.databaseUrl).searchParams.get('sslmode'), 'verify-full')
  assert.ok(config.origins.includes('http://127.0.0.1:5173'))
})

test('CLI uses only a direct Neon endpoint', () => {
  assert.throws(() => neonUrl(fixture, 'DIRECT_URL'), /DIRECT_URL/)
  assert.ok(neonUrl(fixture.replace('-pooler.', '.'), 'DIRECT_URL'))
})

test('configuration failures include only the setting name', () => {
  for (const value of [undefined, 'sensitive-invalid-input', fixture.replace('.neon.tech', '.example.com'), fixture + '&host=elsewhere']) {
    assert.throws(() => parseRuntimeConfig({ DATABASE_URL: value }), { message: 'Invalid or missing configuration: DATABASE_URL' })
  }
  for (const port of ['0', '-1', '65536', 'abc']) {
    assert.throws(() => parseRuntimeConfig({ DATABASE_URL: fixture, PORT: port }), /PORT/)
  }
  for (const origin of ['*', 'https://user:password@example.org', 'http://example.org/path']) {
    assert.throws(() => parseRuntimeConfig({ DATABASE_URL: fixture, CORS_ORIGINS: origin }), /CORS_ORIGINS/)
  }
})

test('nested driver errors emit only allowlisted diagnostics', () => {
  const error = { code: 'P2010', meta: { driverAdapterError: { cause: { originalCode: '28P01', originalMessage: fixture } } } }
  assert.equal(databaseDiagnostic(error), 'AUTHENTICATION_FAILED')
  assert.equal(databaseDiagnostic(new Error('getaddrinfo ENOTFOUND ' + fixture)), 'DNS_ENOTFOUND')
  assert.equal(databaseDiagnostic(new Error(fixture)), 'DATABASE_PROBE_FAILED')
})

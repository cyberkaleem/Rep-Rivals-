import assert from 'node:assert/strict'
import { createHash, randomBytes } from 'node:crypto'
import { verify } from '@node-rs/argon2'
import { developmentConnections } from '../scripts/development.mjs'
import { createDatabase } from '../dist/db/client.js'
import { startServer } from '../dist/server.js'
import { verifyAccountBrowser } from '../../UI design/REP RIVALS Fitness Arena/tests/live/account.mjs'

const digest = value => createHash('sha256').update(value).digest('hex')
const origin = 'http://127.0.0.1:5174'
function fixture() {
  const username = 'qa_' + randomBytes(10).toString('hex')
  return { username, email: username + '@example.invalid', password: randomBytes(32).toString('base64url') }
}
let stage = 'development identity'
function step(name) { stage = name; console.info('Checking', name) }

async function run() {
  const { pooled, direct } = await developmentConnections()
  const observer = createDatabase(direct)
  const players = [fixture(), fixture()]
  const [player, browserPlayer] = players
  const launch = () => startServer({ host: '127.0.0.1', port: 0, origins: [origin], databaseUrl: pooled, production: false })
  let api
  try {
    api = await launch()
    const apiOrigin = () => 'http://127.0.0.1:' + api.server.address().port
    async function call(path, body, cookie, from = origin) {
      const headers = {}
      if (from) headers.Origin = from
      if (cookie) headers.Cookie = cookie
      if (body) headers['Content-Type'] = 'application/json'
      return fetch(apiOrigin() + '/api/auth/' + path, {
        method: body ? 'POST' : 'GET', headers, body: body && JSON.stringify(body),
        signal: AbortSignal.timeout(20000),
      })
    }
    async function account(response, status) {
      assert.equal(response.status, status)
      const body = await response.json()
      assert.deepEqual(Object.keys(body), ['user'])
      assert.deepEqual(Object.keys(body.user).sort(), ['createdAt', 'email', 'id', 'username'])
      assert.equal(body.user.email, player.email)
      assert.equal(body.user.username, player.username)
      return body.user
    }
    step('anonymous access, CSRF and input validation')
    assert.equal((await call('me')).status, 401)
    assert.equal((await call('register', player, null, '')).status, 403)
    assert.equal((await call('register', player, null, 'https://untrusted.invalid')).status, 403)
    assert.equal((await call('register', { ...player, username: '!' })).status, 400)
    step('registration, normalized unique constraints and public response fields')
    const registered = await call('register', { ...player, username: player.username.toUpperCase(), email: player.email.toUpperCase() })
    const user = await account(registered, 201)
    const setCookie = registered.headers.get('set-cookie') ?? ''
    assert.ok(setCookie.includes('HttpOnly') && setCookie.includes('SameSite=Lax'))
    const cookie = setCookie.split(';')[0]
    assert.equal((await call('register', { ...player, username: 'other_' + randomBytes(5).toString('hex') })).status, 409)
    assert.equal((await call('register', { ...player, email: 'other_' + player.email })).status, 409)
    step('durable Argon2id password and token digest, persistence across server restart')
    const saved = await observer.prisma.user.findUniqueOrThrow({ where: { id: user.id }, include: { sessions: true } })
    assert.ok(saved.passwordHash.startsWith('$argon2id$') && await verify(saved.passwordHash, player.password))
    assert.equal(saved.sessions.length, 1)
    assert.ok(saved.sessions[0].tokenHash === digest(cookie.slice(cookie.indexOf('=') + 1)))
    await api.close()
    api = await launch()
    await account(await call('me', null, cookie), 200)
    step('invalid credentials, login, session expiry and logout replay')
    const login = { email: player.email, password: player.password }
    const bad = await call('login', { ...login, password: 'wrong' })
    const unknown = await call('login', { ...login, email: 'unknown_' + player.email })
    assert.equal(bad.status, 401)
    assert.equal(unknown.status, 401)
    assert.deepEqual(await bad.json(), await unknown.json())
    const signedIn = await call('login', login)
    await account(signedIn, 200)
    const loginCookie = signedIn.headers.get('set-cookie').split(';')[0]
    assert.ok(loginCookie !== cookie)
    await account(await call('me', null, loginCookie), 200)
    const logout = await call('logout', {}, loginCookie)
    assert.equal(logout.status, 204)
    assert.ok(logout.headers.get('set-cookie')?.includes('Expires=Thu, 01 Jan 1970'))
    assert.equal((await call('me', null, loginCookie)).status, 401)
    assert.equal(await observer.prisma.authenticationSession.count({ where: { userId: user.id, revokedAt: { not: null } } }), 1)
    await observer.prisma.authenticationSession.update({
      where: { id: saved.sessions[0].id },
      data: { createdAt: new Date(Date.now() - 120000), expiresAt: new Date(Date.now() - 60000) },
    })
    assert.equal((await call('me', null, cookie)).status, 401)
    step('Chromium registration, refresh restoration, login, logout and protected route')
    await verifyAccountBrowser(apiOrigin(), browserPlayer)
    step('auth rate limiting')
    for (let i = 0; i < 20; i++) await call('login', {})
    const limited = await call('register', {})
    assert.equal(limited.status, 429)
    assert.ok(limited.headers.has('retry-after'))
  } finally {
    try {
      await api?.close()
      for (const { username, email } of players) {
        const row = await observer.prisma.user.findFirst({ where: { username, email }, select: { id: true } })
        if (row) await observer.prisma.$transaction([
          observer.prisma.authenticationSession.deleteMany({ where: { userId: row.id } }),
          observer.prisma.user.delete({ where: { id: row.id } }),
        ])
      }
    } finally { await observer.close() }
  }
}

run().then(() => console.info('Live API and browser checks passed. Test accounts cleaned up.')).catch(error => {
  // Do not print driver details, Playwright traces, cookie values or credentials.
  const kind = error?.code === 'ERR_ASSERTION' ? 'assertion' : error?.name === 'TimeoutError' ? 'timeout' : 'failure'
  console.error('Live verification stopped during:', stage, '(' + kind + ')')
  process.exitCode = 1
})

// Real emulator / TLS / Neon test. No screenshots, request-body logging or test secrets on disk.
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { request } from 'node:https'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { setTimeout as delay } from 'node:timers/promises'
import { verify } from '@node-rs/argon2'
import { developmentConnections } from '../scripts/development.mjs'
import { startDevelopmentHttps } from '../scripts/dev-https.mjs'
import { authority } from '../scripts/emulator-tls.mjs'
import { bearerDigest } from '../dist/auth/session.js'
import { createDatabase } from '../dist/db/client.js'

const serial = process.env.ANDROID_SERIAL || 'emulator-5554'
const adbPath = process.env.ADB_EXE || join(process.env.ANDROID_HOME || join(process.env.LOCALAPPDATA, 'Android/Sdk'), 'platform-tools/adb.exe')
const apk = fileURLToPath(new URL('../../UI design/REP RIVALS Fitness Arena/android/app/build/outputs/apk/debug/app-debug.apk', import.meta.url))
const pkg = 'com.reprivals.app'
const adb = (...args) => execFileSync(adbPath, ['-s', serial, ...args], {
  encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true, timeout: 30000, maxBuffer: 12 * 1024 * 1024,
}).trim()
let stage = 'development preflight'
const step = name => { stage = name; console.info('Checking', name) }

async function inspectWebView() {
  const pid = adb('shell', 'pidof', pkg)
  assert.match(pid, /^\d+$/)
  const port = adb('forward', 'tcp:0', 'localabstract:webview_devtools_remote_' + pid)
  let ws
  try {
    for (let i = 0; i < 50; i++) {
      const tabs = await fetch('http://127.0.0.1:' + port + '/json/list').then(r => r.json()).catch(() => [])
      const page = tabs.find(p => new URL(p.url).origin === 'https://localhost')
      if (page) { ws = new WebSocket(page.webSocketDebuggerUrl); break }
      await delay(200)
    }
    assert.ok(ws)
    await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject })
  } catch (error) { adb('forward', '--remove', 'tcp:' + port); throw error }
  let seq = 0
  async function command(method, params) {
    const id = ++seq
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(Error('WebView timeout')), 6000)
      ws.onmessage = event => {
        const msg = JSON.parse(event.data)
        if (msg.id !== id) return
        clearTimeout(timer)
        if (msg.error || msg.result.exceptionDetails) reject(Error('WebView evaluation failed'))
        else resolve(msg.result.result?.value)
      }
      ws.send(JSON.stringify({ id, method, params }))
    })
  }
  const evaluate = expression => command('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
  async function tapLink(path) {
    const selector = JSON.stringify('a[href="' + path + '"]')
    await waitFor('!!document.querySelector('+selector+')')
    const point = await evaluate('(() => {const a=document.querySelector('+selector+'); a.scrollIntoView({block:"center"}); const r=a.getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2}})()')
    await command('Input.dispatchMouseEvent', { type:'mousePressed', ...point, button:'left', clickCount:1 })
    await command('Input.dispatchMouseEvent', { type:'mouseReleased', ...point, button:'left', clickCount:1 })
  }
  async function waitFor(expression) {
    const deadline = Date.now() + 30000
    while (Date.now() < deadline) {
      if (await evaluate(expression).catch(() => false)) return
      await delay(150)
    }
    throw Error('UI condition timed out')
  }
  async function visit(path) {
    await evaluate('history.pushState({}, "", ' + JSON.stringify(path) + '); dispatchEvent(new PopStateEvent("popstate")); true')
  }
  async function submit(fields) {
    await waitFor('!!document.querySelector("form")')
    await evaluate('(' + (values => {
      const form = document.querySelector('form')
      for (const [key, value] of Object.entries(values)) {
        const input = form.elements.namedItem(key)
        input.value = value
        input.dispatchEvent(new Event('input', { bubbles: true }))
      }
      if (!form.reportValidity()) throw Error('Invalid fixture')
      form.querySelector('button').click()
      return true
    }).toString() + ')(' + JSON.stringify(fields) + ')')
  }
  return { pid, evaluate, waitFor, visit, tapLink, submit, close() { ws.close(); adb('forward', '--remove', 'tcp:' + port) } }
}

function replay(header, path = '/api/auth/native/me', cookie) {
  return new Promise((resolve, reject) => {
    const headers = {}
    if (header) headers.Authorization = header
    if (cookie) headers.Cookie = cookie
    const req = request({ hostname: '127.0.0.1', port: 4443, path, ca: readFileSync(authority), headers, timeout: 10000 },
      res => { res.resume(); res.on('end', () => resolve(res.statusCode)) })
    req.on('error', reject); req.on('timeout', () => req.destroy()); req.end()
  })
}

async function run() {
  const { direct, pooled } = await developmentConnections()
  step('Pixel 7 AVD and SDK identity')
  assert.match(serial, /^emulator-\d+$/)
  assert.ok(adb('emu', 'avd', 'name').includes('Pixel_7'))
  assert.equal(adb('shell', 'getprop', 'ro.build.version.sdk'), '35')
  const username = 'qa_' + randomBytes(10).toString('hex')
  const email = username + '@example.invalid'
  const password = randomBytes(32).toString('base64url')
  const expected = 'location.pathname === "/account" && document.querySelector(".account-panel dl")?.textContent.includes(' + JSON.stringify(email) + ')'
  const db = createDatabase(direct)
  let api, ui, reverseOwned = false, capture = false, header, id
  const pids = new Set()
  async function launchApi() {
    api = await startDevelopmentHttps(pooled)
    api.server.prependListener('request', req => {
      if (capture && req.url === '/api/auth/native/me') header = req.headers.authorization
    })
  }
  async function launchApp() {
    adb('shell', 'am', 'start', '-W', '-n', pkg + '/.MainActivity')
    ui = await inspectWebView()
    pids.add(ui.pid)
    await ui.waitFor('!!document.querySelector("#root > *")')
  }
  async function logout() {
    await ui.evaluate('[...document.querySelectorAll("button")].find(b=>b.textContent==="Log out").click(); true')
    await ui.waitFor('location.pathname === "/login" && !!document.querySelector("form")')
  }
  try {
    step('isolated HTTPS listener, APK install and local ADB mapping')
    await launchApi()
    assert.ok(adb('install', '-r', apk).includes('Success'))
    const reverse = adb('reverse', '--list').split(/\r?\n/).find(l => l.split(/\s+/)[1] === 'tcp:4443')
    if (reverse) assert.ok(reverse.endsWith('tcp:4443 tcp:4443'))
    else { adb('reverse', '--no-rebind', 'tcp:4443', 'tcp:4443'); reverseOwned = true }
    await launchApp()
    step('protected entry and native registration')
    await ui.visit('/account')
    // Do not take over an existing signed-in player.
    await ui.waitFor('location.pathname === "/login" && !!document.querySelector("form")')
    await ui.visit('/register')
    await ui.waitFor('!!document.querySelector("input[name=confirmation]")')
    await ui.submit({ username, email, password, confirmation: password })
    await ui.waitFor(expected)
    const user = await db.prisma.user.findUniqueOrThrow({ where: { email }, include: { sessions: true } })
    assert.equal(user.username, username)
    id = user.id
    assert.ok(await verify(user.passwordHash, password))
    assert.equal(user.sessions.length, 1)
    step('OS force-stop, cold relaunch and authenticated Neon account')
    const oldPid = ui.pid
    ui.close(); ui = undefined
    adb('shell', 'am', 'force-stop', pkg)
    capture = true
    await launchApp()
    assert.notEqual(ui.pid, oldPid)
    await ui.visit('/account')
    await ui.waitFor(expected)
    step('restored credential digest and native storage isolation')
    capture = false
    assert.ok(typeof header === 'string' && bearerDigest(header) === user.sessions[0].tokenHash)
    assert.ok(await ui.evaluate('document.querySelector(".account-panel dl").textContent.includes(' + JSON.stringify(username) + ')'))
    const storage = await ui.evaluate('JSON.stringify([document.cookie,localStorage,sessionStorage])')
    const prefs = adb('exec-out', 'run-as', pkg, 'cat', 'shared_prefs/rep_rivals_session.xml')
    for (const text of [storage, prefs]) assert.ok(!text.includes(header.slice(7)) && !text.includes(password))
    assert.ok(prefs.includes('<string'))
    step('verified TLS replay and browser/native isolation')
    assert.equal(await replay(header), 200)
    assert.equal(await replay(null, '/api/auth/me', '__Host-rr_session=' + header.slice(7)), 401)
    if (process.env.REP_RIVALS_VERIFY_GAME === '1') {
      step('Android dashboard, WebGL and two-player battle')
      await (await import('./android-game.mjs')).verifyAndroidGame(ui, db, () => adb('shell','input','keyevent','4'))
    }
    if (process.env.REP_RIVALS_VERIFY_PHYSICAL === '1') {
      step('supervised three-rep Android camera workout')
      adb('shell','pm','grant',pkg,'android.permission.CAMERA')
      await (await import('./android-workout.mjs')).verifyPhysicalWorkout(ui, db, id)
    }
    step('backend outage, retry and preserved session')
    await api.close(); api = undefined
    await ui.visit('/login'); await ui.waitFor('!!document.querySelector("form")')
    await ui.visit('/account')
    await ui.waitFor('!!document.querySelector("[role=alert]") && !document.querySelector(".account-panel dl")')
    await launchApi()
    await ui.evaluate('[...document.querySelectorAll("button")].find(b=>b.textContent==="Retry").click(); true')
    await ui.waitFor(expected)
    step('logout, local deletion, replay denial and protected route')
    await logout()
    assert.equal(await replay(header), 401)
    assert.ok((await db.prisma.authenticationSession.findUniqueOrThrow({ where: { id: user.sessions[0].id } })).revokedAt)
    assert.ok(!adb('exec-out', 'run-as', pkg, 'cat', 'shared_prefs/rep_rivals_session.xml').includes('<string'))
    await ui.visit('/account')
    await ui.waitFor('location.pathname === "/login" && !!document.querySelector("form")')
    step('invalid password, real login and expiration')
    await ui.submit({ email, password: 'deliberately-incorrect-fixture' })
    await ui.waitFor('document.querySelector("[role=alert]")?.textContent.includes("Incorrect")')
    const revoked = header
    capture = true
    await ui.submit({ email, password })
    await ui.waitFor(expected)
    capture = false
    assert.ok(header && header !== revoked)
    const newSession = await db.prisma.authenticationSession.findFirstOrThrow({ where: { userId: id, tokenHash: bearerDigest(header) } })
    await db.prisma.authenticationSession.update({ where: { id: newSession.id }, data: {
      createdAt: new Date(Date.now() - 120000), expiresAt: new Date(Date.now() - 60000),
    } })
    assert.equal(await replay(header), 401)
    await ui.visit('/login'); await ui.waitFor('!!document.querySelector("form")')
    await ui.visit('/account'); await ui.waitFor('location.pathname === "/login" && !!document.querySelector("form")')
    assert.ok(!adb('exec-out', 'run-as', pkg, 'cat', 'shared_prefs/rep_rivals_session.xml').includes('<string'))
    for (const pid of pids) {
      const log = adb('logcat', '-d', '--pid=' + pid, '-t', '10000')
      assert.ok(!/FATAL EXCEPTION:|Uncaught (?:TypeError|ReferenceError|SyntaxError|RangeError):/.test(log), 'Unexpected app runtime exception')
      assert.ok(!log.includes(password) && !log.includes(header.slice(7)) && !log.includes(revoked.slice(7)))
    }
    console.info('Pixel 7 real HTTPS authentication, restart, outage, expiry and revocation passed.')
  } finally {
    try {
      ui?.close()
      if (reverseOwned) adb('reverse', '--remove', 'tcp:4443')
      await api?.close()
    } finally {
      try {
        const row = await db.prisma.user.findFirst({ where: { username, email, ...(id && { id }) }, select: { id: true } })
        if (row) {
          await db.prisma.$transaction([
            db.prisma.authenticationSession.deleteMany({ where: { userId: row.id } }),
            db.prisma.user.delete({ where: { id: row.id } }),
          ])
          assert.equal(await db.prisma.user.count({ where: { id: row.id } }), 0)
          console.info('Disposable Android account and sessions cleaned up.')
        }
      } finally { await db.close() }
    }
  }
}

run().catch(error => {
  for (const frame of error.stack?.split('\n') ?? []) {
    const match = frame.match(/(android-game|game-rival)\.mjs:(\d+):\d+/)
    if (match) console.error('Gameplay test location:', match[1], match[2])
  }
  const line = error.stack?.split('\n').slice(1).map(s => /live-android\.mjs:(\d+):\d+/.exec(s)?.[1]).find(Boolean)
  const kind = error.code === 'ERR_ASSERTION' ? 'assertion' : error.name === 'TypeError' ? 'type' : 'operation'
  console.error('Android live check stopped during:', stage, '(' + kind + ', verification line ' + (line ?? 'unknown') + ')')
  process.exitCode = 1
})

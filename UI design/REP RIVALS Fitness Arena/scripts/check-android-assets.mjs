import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))
const dist = path.join(root, 'dist')
const assets = path.join(root, 'android/app/src/main/assets')
const packaged = path.join(assets, 'public')
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex')
async function files(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const nested = await Promise.all(entries.map(async (entry) => {
    const file = path.join(directory, entry.name)
    return entry.isDirectory() ? files(file) : [file]
  }))
  return nested.flat()
}

const config = JSON.parse(await readFile(path.join(assets, 'capacitor.config.json'), 'utf8'))
assert.equal(config.appId, 'com.reprivals.app')
assert.equal(config.appName, 'REP RIVALS')
assert.equal(config.webDir, 'dist')
assert.equal(config.server?.url, undefined, 'Live reload must not be packaged')
assert.equal(config.server?.hostname, 'localhost')
assert.equal(config.server?.androidScheme, 'https')
assert.equal(config.server?.cleartext, false)
assert.equal(config.android?.allowMixedContent, false)
assert.equal(config.server?.allowNavigation, undefined)

const builtFiles = await files(dist)
for (const file of builtFiles) {
  const relative = path.relative(dist, file)
  assert.equal(hash(await readFile(path.join(packaged, relative))), hash(await readFile(file)),
    `Stale or missing copied asset: ${relative}`)
}
const model = await readFile(path.join(packaged, 'vision/pose_landmarker_lite.task'))
assert.equal(hash(model), '59929e1d1ee95287735ddd833b19cf4ac46d29bc7afddbbf6753c459690d574a')
const wasmRoot = path.join(root, 'node_modules/@mediapipe/tasks-vision/wasm')
for (const file of await files(wasmRoot)) {
  assert.equal(hash(await readFile(path.join(packaged, 'vision/wasm', path.relative(wasmRoot, file)))),
    hash(await readFile(file)), 'Packaged WASM must match the installed MediaPipe version')
}
for (const file of await files(assets)) {
  assert.ok(!/^\.env(?:\.|$)/i.test(path.basename(file)), 'Environment file in assets')
  if (!/\.(?:html|js|css|json|txt|map)$/i.test(file)) continue
  const text = await readFile(file, 'utf8')
  // Report only the file path, never a potential secret value.
  assert.ok(!/postgres(?:ql)?:\/\/|\b(?:VITE_)?DATABASE_URL\b|\bDIRECT_URL\b|\.neon\.tech/i.test(text),
    `Server configuration in ${path.relative(assets, file)}`)
}
const html = await readFile(path.join(packaged, 'index.html'), 'utf8')
const api = process.env.REP_RIVALS_EMULATOR_TLS === '1' ? 'https://127.0.0.1:4443' : process.env.REP_RIVALS_ANDROID_API_ORIGIN
const socket = api ? ' ' + api.replace('https:', 'wss:') : ''
assert.ok(html.includes("connect-src 'self'" + socket + "; frame-src 'none'"), 'Use only the configured game socket')
assert.equal(config.loggingBehavior, 'none', 'Capacitor must not log authentication arguments')
assert.ok(!html.includes('/@vite/client'), 'Development client in packaged HTML')
console.log(`Android assets verified: ${builtFiles.length} build files match, versioned model/WASM match, no database configuration found.`)

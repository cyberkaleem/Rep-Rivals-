import { createServer } from 'node:https'
import { readFileSync } from 'node:fs'
import { once } from 'node:events'
import { pathToFileURL } from 'node:url'
import { developmentConnections } from './development.mjs'
import { prepareTls, certificate, privateKey } from './emulator-tls.mjs'
import { createApp } from '../dist/app.js'
import { createAuthService } from '../dist/auth/service.js'
import { createDatabase } from '../dist/db/client.js'

import { createGame } from '../dist/game/socket.js'
import { gameStore } from '../dist/game/store.js'

export async function startDevelopmentHttps(pooled) {
  const db = createDatabase(pooled)
  const auth = createAuthService(db.prisma)
  // The browser rival reaches this same room manager through its local Vite proxy.
  const origins = ['http://127.0.0.1:5173', 'http://localhost:5173']
  const game = createGame(auth, gameStore(db.prisma), origins)
  const server = createServer({ cert: readFileSync(certificate), key: readFileSync(privateKey), minVersion: 'TLSv1.2' },
    createApp(origins, db.check, auth, true, [], game))
  const closeGame = game.attach(server)
  try {
    server.listen(4443, '127.0.0.1')
    await once(server, 'listening')
  } catch (error) { await db.close(); throw error }
  return { server, async close() {
    server.closeAllConnections()
    await closeGame()
    await db.close()
  } }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    prepareTls()
    const { pooled } = await developmentConnections()
    const api = await startDevelopmentHttps(pooled)
    console.info('Verified development API listening on HTTPS loopback port 4443.')
    for (const signal of ['SIGINT','SIGTERM']) process.once(signal, () => void api.close())
  } catch { console.error('Unable to start verified development HTTPS API. Check certificates, branch connectivity and port 4443.'); process.exitCode = 1 }
}

import { createServer } from 'node:https'
import { readFileSync } from 'node:fs'
import { once } from 'node:events'
import { pathToFileURL } from 'node:url'
import { developmentConnections } from './development.mjs'
import { prepareTls, certificate, privateKey } from './emulator-tls.mjs'
import { createApp } from '../dist/app.js'
import { createAuthService } from '../dist/auth/service.js'
import { createDatabase } from '../dist/db/client.js'

export async function startDevelopmentHttps(pooled) {
  const db = createDatabase(pooled)
  const server = createServer({ cert: readFileSync(certificate), key: readFileSync(privateKey), minVersion: 'TLSv1.2' },
    createApp([], db.check, createAuthService(db.prisma), true))
  try {
    server.listen(4443, '127.0.0.1')
    await once(server, 'listening')
  } catch (error) { await db.close(); throw error }
  return { server, async close() {
    const closed = new Promise(resolve => server.close(resolve))
    server.closeAllConnections()
    await closed
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

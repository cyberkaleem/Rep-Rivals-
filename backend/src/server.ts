import { once } from 'node:events'
import { createServer } from 'node:http'
import { pathToFileURL } from 'node:url'
import { createApp } from './app.js'
import { ConfigurationError, parseRuntimeConfig, readSettings } from './config/env.js'
import { createDatabase } from './db/client.js'
import { createAuthService } from './auth/service.js'

export async function startServer(config = parseRuntimeConfig(readSettings())) {
  const database = createDatabase(config.databaseUrl)
  const server = createServer(createApp(config.origins, database.check, createAuthService(database.prisma), config.production, config.trustedProxies))
  try {
    server.listen(config.port, config.host)
    await once(server, 'listening')
  } catch (error) {
    await database.close()
    throw error
  }

  let closing: Promise<void> | undefined
  function close() {
    closing ??= (async () => {
      const limit = setTimeout(() => server.closeAllConnections(), 12_000).unref()
      try {
        await new Promise<void>((resolve, reject) =>
          server.close(error => error ? reject(error) : resolve()))
      } finally {
        clearTimeout(limit)
        await database.close()
      }
    })()
    return closing
  }
  return { server, close }
}

async function main() {
  const { server, close } = await startServer()
  const address = server.address()
  if (address && typeof address !== 'string') console.info('rep-rivals-api listening on port', address.port)
  const shutdown = () => {
    void close().catch(() => { console.error('API shutdown failed.'); process.exitCode = 1 })
  }
  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  main().catch(error => {
    const reason = error instanceof ConfigurationError ? error.message
      : error?.code === 'EADDRINUSE' ? 'Port already in use.' : 'Unable to start API.'
    console.error(reason)
    process.exitCode = 1
  })
}

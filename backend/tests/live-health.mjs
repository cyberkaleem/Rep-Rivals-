// Opt-in integration check. Uses the built server, real configuration and an ephemeral loopback port.
import { ConfigurationError, parseRuntimeConfig, readSettings } from '../dist/config/env.js'
import { startServer } from '../dist/server.js'

async function verify() {
  const config = parseRuntimeConfig(readSettings())
  const { server, close } = await startServer({ ...config, host: '127.0.0.1', port: 0 })
  try {
    const base = 'http://127.0.0.1:' + server.address().port
    for (const path of ['/api/health', '/api/health/database']) {
      const response = await fetch(base + path, { signal: AbortSignal.timeout(25_000) })
      console.info('GET', path, 'HTTP', response.status)
      const body = await response.json()
      if (!response.ok || body.status !== 'ok' || body.service !== 'rep-rivals-api' ||
          (path.endsWith('/database') && body.database !== 'reachable')) {
        throw new Error('HEALTH_CHECK_FAILED')
      }
    }
    console.info('Neon SELECT 1 returned the expected value through Prisma.')
  } finally {
    await close()
  }
}

verify().catch(error => {
  console.error(error instanceof ConfigurationError ? error.message : 'Live health check failed. See the safe diagnostic above.')
  process.exitCode = 1
})

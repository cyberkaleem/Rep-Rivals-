// This operator/test helper is intentionally pinned to the compute identified by the
// owner on the development branch's Neon Console page. Never run against another branch.
import { pathToFileURL } from 'node:url'
import { readSettings, neonUrl } from '../src/config/env.ts'
import { createDatabase } from '../src/db/client.ts'

export function developmentUrls() {
  const expected = 'ep-crimson-meadow-b3jvhb1q'
  const settings = readSettings()
  const pooled = new URL(neonUrl(settings.DATABASE_URL, 'DATABASE_URL'))
  const direct = new URL(neonUrl(settings.DIRECT_URL, 'DIRECT_URL'))
  if (direct.hostname.split('.')[0] !== expected || pooled.hostname !== direct.hostname.replace(expected, expected + '-pooler') ||
      pooled.pathname !== direct.pathname || pooled.port !== direct.port) throw Error('Development URL mismatch')
  return { pooled: pooled.href, direct: direct.href, expected }
}

export async function developmentConnections() {
  const { pooled, direct, expected } = developmentUrls()
  if (process.env.REP_RIVALS_DEV_DNS === 'google') {
    const { enableDevelopmentDns } = await import('./dev-dns.mjs')
    enableDevelopmentDns([new URL(pooled).hostname, new URL(direct).hostname])
  }
  let branch
  for (const url of [direct, pooled]) {
    const db = createDatabase(url)
    try {
      const [row] = await db.prisma.$queryRaw`SELECT current_setting('neon.endpoint_id') AS endpoint, current_setting('neon.branch_id') AS branch`
      if (row.endpoint !== expected || !row.branch || (branch && row.branch !== branch)) throw Error('Development identity mismatch')
      branch = row.branch
    } finally { await db.close() }
  }
  return { pooled, direct }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const urls = await developmentConnections()
    const db = createDatabase(urls.direct)
    try {
      const [row] = await db.prisma.$queryRaw`SELECT count(*)::int AS count FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN ('r','p','v','m','f','S','i')`
      console.info('Live development identity confirmed on both connections. Public relations:', row.count)
      if (row.count !== 0) throw Error('Initial migration requires review of existing relations')
    } finally { await db.close() }
  } catch { console.error('Development preflight failed. Stop before migrating.'); process.exitCode = 1 }
}

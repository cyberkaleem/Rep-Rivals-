// Operator preflight for the manual Render development deployment. No HTTP route or writes.
import { neonUrl, readSettings } from '../dist/config/env.js'
import { createDatabase } from '../dist/db/client.js'

// Owner-confirmed development compute and the branch ID read from that compute over verified TLS.
const endpoint = 'ep-crimson-meadow-b3jvhb1q'
const branch = 'br-flat-hat-b35pchm8'

async function verify() {
  const url = new URL(neonUrl(readSettings().DATABASE_URL, 'DATABASE_URL'))
  if (url.hostname.split('.')[0] !== endpoint + '-pooler') throw Error()
  const db = createDatabase(url.href)
  try {
    const [row] = await db.prisma.$queryRaw`SELECT current_setting('neon.endpoint_id') AS endpoint, current_setting('neon.branch_id') AS branch`
    if (row?.endpoint !== endpoint || row.branch !== branch) throw Error()
  } finally {
    await db.close()
  }
}

verify().then(() => console.info('Verified pooled Neon development identity over TLS.')).catch(() => {
  console.error('Development database preflight failed. Check the pooled target, TLS connectivity and branch metadata.')
  process.exitCode = 1
})

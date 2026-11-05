import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../generated/prisma/client.js'
import { databaseDiagnostic } from './diagnostics.js'

export function createDatabase(databaseUrl: string) {
  const reportError = (error: Error) => console.error('Database connection:', databaseDiagnostic(error))
  const adapter = new PrismaPg({
    connectionString: databaseUrl,
    enableChannelBinding: true,
    max: 4,
    connectionTimeoutMillis: 10_000,
    idleTimeoutMillis: 30_000,
    query_timeout: 10_000,
  }, { onPoolError: reportError, onConnectionError: reportError })
  const prisma = new PrismaClient({ adapter, log: [], errorFormat: 'minimal' })

  return {
    prisma,
    async check() {
      const rows = await prisma.$queryRaw<Array<{ ok: number }>>`SELECT 1 AS ok`
      if (rows.length !== 1 || rows[0]?.ok !== 1) throw new Error('PROBE_RESULT_INVALID')
    },
    close: () => prisma.$disconnect(),
  }
}

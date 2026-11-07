import { Router } from 'express'
import { z } from 'zod'
import { databaseDiagnostic } from '../db/diagnostics.js'
import { ApiError } from '../middleware/errors.js'

const healthQuery = z.strictObject({})
export const healthy = { status: 'ok', service: 'rep-rivals-api' } as const

export function healthRouter(checkDatabase: () => Promise<void>) {
  const router = Router()
  router.get('/', (req, res) => {
    healthQuery.parse(req.query)
    res.json(healthy)
  })
  router.get('/database', async (req, res) => {
    healthQuery.parse(req.query)
    try {
      await checkDatabase()
    } catch (error) {
      console.error('Database readiness:', databaseDiagnostic(error))
      throw new ApiError(503, 'DATABASE_UNAVAILABLE', 'Database unavailable.')
    }
    res.json({ ...healthy, database: 'reachable' })
  })
  return router
}

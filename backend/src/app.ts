import cors from 'cors'
import express from 'express'
import helmet from 'helmet'
import { ApiError, errorHandler } from './middleware/errors.js'
import { healthRouter } from './routes/health.js'
import { authRouter } from './routes/auth.js'
import type { AuthService } from './auth/service.js'

export function createApp(origins: string[], checkDatabase: () => Promise<void>, auth?: AuthService, production = false, trustedProxies: string[] = []) {
  const app = express()
  app.disable('x-powered-by')
  if (trustedProxies.length) app.set('trust proxy', trustedProxies)
  app.use(helmet())
  app.use((_req, res, next) => { res.set('Cache-Control', 'no-store'); next() })
  app.use(cors({
    origin(origin, callback) {
      if (origin === undefined || origins.includes(origin)) return callback(null, true)
      callback(new ApiError(403, 'ORIGIN_DENIED', 'Origin is not allowed.'))
    },
    methods: ['GET', 'HEAD', 'POST'],
    credentials: true,
  }))
  app.use(express.json({ limit: '16kb' }))
  app.use('/api/health', healthRouter(checkDatabase))
  if (auth) app.use('/api/auth', authRouter(auth, production, origins))
  app.use((_req, _res, next) => next(new ApiError(404, 'NOT_FOUND', 'Route not found.')))
  app.use(errorHandler)
  return app
}

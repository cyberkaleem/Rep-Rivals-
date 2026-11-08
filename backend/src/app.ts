import cors from 'cors'
import express from 'express'
import helmet from 'helmet'
import { ApiError, errorHandler } from './middleware/errors.js'
import { healthy, healthRouter } from './routes/health.js'
import { authRouter } from './routes/auth.js'
import type { AuthService } from './auth/service.js'
import type { Game } from './game/socket.js'

function baseApp() {
  const app = express()
  app.disable('x-powered-by')
  app.use(helmet())
  app.use((_req, res, next) => { res.set('Cache-Control', 'no-store'); next() })
  return app
}

export function createHealthOnlyApp() {
  const app = baseApp()
  // Compare the raw target: Express GET routes also match HEAD and path aliases.
  app.use((req, res, next) => {
    if (req.method === 'GET' && req.originalUrl === '/api/health') res.json(healthy)
    else next(new ApiError(404, 'NOT_FOUND', 'Route not found.'))
  })
  app.use(errorHandler)
  return app
}

export function createApp(origins: string[], checkDatabase: () => Promise<void>, auth?: AuthService, production = false, trustedProxies: string[] = [], game?: Game) {
  const app = baseApp()
  if (trustedProxies.length) app.set('trust proxy', trustedProxies)
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
  if (auth) app.use('/api/auth', authRouter(auth, production, origins, game))
  app.use((_req, _res, next) => next(new ApiError(404, 'NOT_FOUND', 'Route not found.')))
  app.use(errorHandler)
  return app
}

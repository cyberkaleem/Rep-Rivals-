import { Router } from 'express'
import { rateLimit } from 'express-rate-limit'
import { z } from 'zod'
import type { AuthService } from '../auth/service.js'
import { sessionCookie, sessionDigest, sessionLifetimeMs } from '../auth/session.js'
import { ApiError } from '../middleware/errors.js'

const email = z.string().trim().toLowerCase().max(254).pipe(z.email())
const registration = z.strictObject({
  username: z.string().trim().toLowerCase().regex(/^[a-z0-9_]{3,24}$/),
  email, password: z.string().min(15).max(128),
})
const credentials = z.strictObject({ email, password: z.string().min(1).max(128) })

export function authRouter(auth: AuthService, production: boolean, origins: string[]) {
  const router = Router()
  const cookie = sessionCookie(production)
  const attempts = rateLimit({
    windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: 'draft-8', legacyHeaders: false,
    handler: (_req, _res, next) => next(new ApiError(429, 'RATE_LIMITED', 'Too many attempts. Try again later.')),
  })
  router.use((req, _res, next) => {
    if (req.method === 'POST') {
      if (!origins.includes(req.get('Origin') ?? '')) throw new ApiError(403, 'ORIGIN_DENIED', 'A trusted origin is required.')
      if (!req.is('application/json')) throw new ApiError(415, 'JSON_REQUIRED', 'Send a JSON request.')
    }
    next()
  })
  router.post('/register', attempts, async (req, res) => {
    const { username, email, password } = registration.parse(req.body)
    const { user, token } = await auth.register(username, email, password)
    res.cookie(cookie.name, token, { ...cookie.options, maxAge: sessionLifetimeMs }).status(201).json({ user })
  })
  router.post('/login', attempts, async (req, res) => {
    const { email, password } = credentials.parse(req.body)
    const { user, token } = await auth.login(email, password)
    res.cookie(cookie.name, token, { ...cookie.options, maxAge: sessionLifetimeMs }).json({ user })
  })
  router.get('/me', async (req, res) => {
    const user = await auth.me(sessionDigest(req.headers.cookie, cookie.name))
    res.json({ user })
  })
  router.post('/logout', async (req, res) => {
    await auth.logout(sessionDigest(req.headers.cookie, cookie.name))
    res.clearCookie(cookie.name, cookie.options).sendStatus(204)
  })
  return router
}

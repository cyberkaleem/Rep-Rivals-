import { Router, type Request, type Response } from 'express'
import { rateLimit } from 'express-rate-limit'
import { z } from 'zod'
import type { AuthService } from '../auth/service.js'
import { bearerDigest, sessionCookie, sessionDigest, sessionLifetimeMs, type SessionClient } from '../auth/session.js'
import { ApiError } from '../middleware/errors.js'

const email = z.string().trim().toLowerCase().max(254).pipe(z.email())
const registration = z.strictObject({
  username: z.string().trim().toLowerCase().regex(/^[a-z0-9_]{3,24}$/),
  email, password: z.string().min(15).max(128),
})
const credentials = z.strictObject({ email, password: z.string().min(1).max(128) })

import type { Game } from '../game/socket.js'

export function authRouter(auth: AuthService, production: boolean, origins: string[], game?: Game) {
  const router = Router()
  const cookie = sessionCookie(production)
  const attempts = rateLimit({
    windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: 'draft-8', legacyHeaders: false,
    handler: (_req, _res, next) => next(new ApiError(429, 'RATE_LIMITED', 'Too many attempts. Try again later.')),
  })
  function endpoints(client: SessionClient) {
    const group = Router()
    const native = client === 'android'
    const digest = (req: Request) => native ? bearerDigest(req.get('Authorization')) : sessionDigest(req.headers.cookie, cookie.name)
    function signedIn(res: Response, status: number, { user, token }: Awaited<ReturnType<AuthService['login']>>) {
      if (native) return res.status(status).json({ user, token })
      return res.cookie(cookie.name, token, { ...cookie.options, maxAge: sessionLifetimeMs }).status(status).json({ user })
    }
    group.use((req, _res, next) => {
      if (native) {
        if (!req.secure) throw new ApiError(403, 'HTTPS_REQUIRED', 'A secure connection is required.')
        if (req.get('Origin') !== undefined || req.get('Cookie') !== undefined || req.get('Sec-Fetch-Site') !== undefined) {
          throw new ApiError(403, 'WRONG_TRANSPORT', 'Use the browser account endpoint.')
        }
        if (Object.keys(req.query).length) throw new ApiError(400, 'INVALID_REQUEST', 'Invalid request.')
        if ((req.headersDistinct.authorization?.length ?? 0) > 1) throw new ApiError(400, 'INVALID_REQUEST', 'Ambiguous authorization.')
      } else {
        if (req.get('Authorization') !== undefined) throw new ApiError(400, 'WRONG_TRANSPORT', 'Use cookie authentication.')
        if (req.method === 'POST' && !origins.includes(req.get('Origin') ?? '')) {
          throw new ApiError(403, 'ORIGIN_DENIED', 'A trusted origin is required.')
        }
      }
      if (req.method === 'POST' && !req.is('application/json')) throw new ApiError(415, 'JSON_REQUIRED', 'Send a JSON request.')
      next()
    })
    if (game) group.post('/ticket', async (req, res) => {
      z.strictObject({}).parse(req.body)
      const hash = digest(req)
      await auth.me(hash)
      if (!hash) throw new ApiError(401, 'AUTH_REQUIRED', 'Please sign in.')
      res.json({ ticket: game.issue(hash, native ? 'https://localhost' : req.get('Origin')!) })
    })
    group.post('/register', attempts, async (req, res) => {
      const { username, email, password } = registration.parse(req.body)
      signedIn(res, 201, await auth.register(username, email, password, client))
    })
    group.post('/login', attempts, async (req, res) => {
      const { email, password } = credentials.parse(req.body)
      signedIn(res, 200, await auth.login(email, password, client))
    })
    group.get('/me', async (req, res) => { res.json({ user: await auth.me(digest(req)) }) })
    group.post('/logout', async (req, res) => {
      z.strictObject({}).parse(req.body)
      const hash = digest(req)
      if (native && !hash) throw new ApiError(401, 'AUTH_REQUIRED', 'Please sign in.')
      await auth.logout(hash)
      if (!native) res.clearCookie(cookie.name, cookie.options)
      res.sendStatus(204)
    })
    return group
  }
  router.use('/native', endpoints('android'))
  router.use(endpoints('web'))
  return router
}

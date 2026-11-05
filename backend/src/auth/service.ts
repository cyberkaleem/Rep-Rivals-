import { randomBytes } from 'node:crypto'
import { Algorithm, hash, verify } from '@node-rs/argon2'
import { Prisma, type PrismaClient } from '../generated/prisma/client.js'
import { ApiError } from '../middleware/errors.js'
import { issueSession } from './session.js'

const publicFields = { id: true, username: true, email: true, createdAt: true } as const
const hashPassword = (password: string) => hash(password, {
  algorithm: Algorithm.Argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1, outputLen: 32,
})
// Unknown email addresses also incur a password verification.
let dummyHash: Promise<string> | undefined

export function createAuthService(prisma: PrismaClient) {
  return {
    async register(username: string, email: string, password: string) {
      const passwordHash = await hashPassword(password)
      const session = issueSession()
      try {
        const user = await prisma.user.create({
          data: { username, email, passwordHash, sessions: { create: session.record } },
          select: publicFields,
        })
        return { user, token: session.token }
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
          throw new ApiError(409, 'ACCOUNT_UNAVAILABLE', 'This email or username is already in use.')
        }
        throw error
      }
    },
    async login(email: string, password: string) {
      const credentials = await prisma.user.findUnique({ where: { email }, select: { id: true, passwordHash: true } })
      const encoded = credentials?.passwordHash ?? await (dummyHash ??= hashPassword(randomBytes(32).toString('hex')))
      const matches = await verify(encoded, password)
      if (!credentials || !matches) throw new ApiError(401, 'INVALID_CREDENTIALS', 'Incorrect email or password.')
      const session = issueSession()
      const { user } = await prisma.authenticationSession.create({
        data: { userId: credentials.id, ...session.record },
        select: { user: { select: publicFields } },
      })
      return { user, token: session.token }
    },
    async me(tokenHash: string | null) {
      const session = tokenHash && await prisma.authenticationSession.findFirst({
        where: { tokenHash, revokedAt: null, expiresAt: { gt: new Date() } },
        select: { user: { select: publicFields } },
      })
      if (!session) throw new ApiError(401, 'AUTH_REQUIRED', 'Please sign in.')
      return session.user
    },
    async logout(tokenHash: string | null) {
      if (tokenHash) await prisma.authenticationSession.updateMany({
        where: { tokenHash, revokedAt: null }, data: { revokedAt: new Date() },
      })
    },
  }
}

export type AuthService = ReturnType<typeof createAuthService>

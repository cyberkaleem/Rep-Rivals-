import { createHash, randomBytes } from 'node:crypto'
import type { CookieOptions } from 'express'

export const sessionLifetimeMs = 7 * 24 * 60 * 60 * 1000

export function sessionCookie(production: boolean) {
  const options: CookieOptions = { path: '/', httpOnly: true, secure: production, sameSite: 'lax' }
  return { name: production ? '__Host-rr_session' : 'rr_session', options }
}

const digest = (token: string) => createHash('sha256').update(token).digest('hex')

export type SessionClient = 'web' | 'android'
const androidDigest = (token: string) => digest('rep-rivals:android:v1\0' + token)

export function bearerDigest(header?: string) {
  const match = /^Bearer (rrn1\.[A-Za-z0-9_-]{43})$/i.exec(header ?? '')
  return match ? androidDigest(match[1]) : null
}

export function issueSession(client: SessionClient = 'web') {
  const random = randomBytes(32).toString('base64url')
  const token = client === 'android' ? 'rrn1.' + random : random
  const tokenHash = client === 'android' ? androidDigest(token) : digest(token)
  return { token, record: { tokenHash, expiresAt: new Date(Date.now() + sessionLifetimeMs) } }
}

export function sessionDigest(header: string | undefined, name: string) {
  const cookies = header?.split(';').map(pair => pair.trim()).filter(pair => pair.startsWith(name + '='))
  if (cookies?.length !== 1) return null
  const token = cookies[0].slice(name.length + 1)
  return /^[A-Za-z0-9_-]{43}$/.test(token) ? digest(token) : null
}

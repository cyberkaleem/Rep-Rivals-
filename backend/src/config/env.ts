import { readFileSync } from 'node:fs'
import { parseEnv } from 'node:util'
import { z } from 'zod'

const rootEnv = new URL('../../../.env', import.meta.url)
const settings = ['DATABASE_URL', 'DIRECT_URL', 'HOST', 'PORT', 'CORS_ORIGINS', 'NODE_ENV'] as const
type Settings = Partial<Record<typeof settings[number], string>>

// The relative path is identical in src/config and dist/config. Injected settings win.
export function readSettings(path = rootEnv, injected = process.env): Settings {
  let local: NodeJS.Dict<string> = {}
  try {
    local = parseEnv(readFileSync(path, 'utf8'))
  } catch (error) {
    if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) {
      throw new ConfigurationError('root .env')
    }
  }
  return Object.fromEntries(settings.map(key => [key, injected[key] ?? local[key]]))
}

export class ConfigurationError extends Error {
  constructor(readonly setting: typeof settings[number] | 'root .env') {
    super('Invalid or missing configuration: ' + setting)
  }
}

export function neonUrl(value: string | undefined, key: 'DATABASE_URL' | 'DIRECT_URL'): string {
  const url = value ? URL.parse(value) : null
  if (!url || !['postgres:', 'postgresql:'].includes(url.protocol) ||
      !url.hostname.endsWith('.neon.tech') || !url.username || !url.password ||
      url.pathname.length <= 1 || url.hash ||
      [...url.searchParams.keys()].some(k => !['sslmode', 'channel_binding', 'pgbouncer'].includes(k)) ||
      (key === 'DIRECT_URL' && url.hostname.split('.')[0].endsWith('-pooler'))) {
    throw new ConfigurationError(key)
  }
  // Match standard Neon connection strings and always verify the TLS peer.
  url.searchParams.set('sslmode', 'verify-full')
  return url.toString()
}

const defaultOrigins = [5173, 8443].flatMap(port =>
  ['localhost', '127.0.0.1'].map(host => 'http://' + host + ':' + port))
const httpOrigin = z.string().refine(value => {
  const url = URL.parse(value)
  return !!url && ['http:', 'https:'].includes(url.protocol) && url.origin === value
})

export function parseRuntimeConfig(settings: Settings) {
  const environment = z.enum(['development', 'test', 'production']).safeParse(settings.NODE_ENV ?? 'development')
  if (!environment.success) throw new ConfigurationError('NODE_ENV')
  const production = environment.data === 'production'
  const port = z.coerce.number().int().min(1).max(65535).safeParse(settings.PORT ?? 4000)
  if (!port.success) throw new ConfigurationError('PORT')
  const host = z.string().trim().min(1).safeParse(settings.HOST ?? '127.0.0.1')
  if (!host.success) throw new ConfigurationError('HOST')
  const origins = z.array(httpOrigin).min(1).safeParse(
    settings.CORS_ORIGINS?.split(',').map(origin => origin.trim()) ?? defaultOrigins,
  )
  if (!origins.success) throw new ConfigurationError('CORS_ORIGINS')
  if (production && (!settings.CORS_ORIGINS || origins.data.some(origin => !origin.startsWith('https://')))) {
    throw new ConfigurationError('CORS_ORIGINS')
  }
  return { port: port.data, host: host.data, origins: origins.data, production, databaseUrl: neonUrl(settings.DATABASE_URL, 'DATABASE_URL') }
}

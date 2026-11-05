import { defineConfig } from 'prisma/config'
import { neonUrl, readSettings } from './src/config/env.js'

const { DIRECT_URL } = readSettings()

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  // Offline generation works without credentials. Database CLI workflows require DIRECT_URL.
  ...(DIRECT_URL ? { datasource: { url: neonUrl(DIRECT_URL, 'DIRECT_URL') } } : {}),
})

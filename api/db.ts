import { neon, neonConfig } from '@neondatabase/serverless'

neonConfig.fetchConnectionCache = true

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL not set')
}

export const sql = neon(process.env.DATABASE_URL)

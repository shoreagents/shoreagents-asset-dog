import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient
}

// Disable prepared statements to avoid "prepared statement already exists" error
// This happens with PgBouncer/connection pooling and dev HMR
function makeConnectionUrl() {
  const url = process.env.DATABASE_URL || ''
  if (!url) return url
  
  const urlObj = new URL(url)
  
  // Add pgbouncer=true to disable prepared statements
  urlObj.searchParams.set('pgbouncer', 'true')
  
  // Add connection timeout settings if not already present
  if (!urlObj.searchParams.has('connect_timeout')) {
    urlObj.searchParams.set('connect_timeout', '10')
  }
  if (!urlObj.searchParams.has('pool_timeout')) {
    urlObj.searchParams.set('pool_timeout', '10')
  }
  
  return urlObj.toString()
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    // Reduced logging in development - P1001 connection errors are handled via retry logic
    // Query/error logs are suppressed to reduce noise (errors are handled in API routes)
    log: process.env.NODE_ENV === 'development' 
      ? ['warn']
      : ['error', 'warn'],
    datasources: {
      db: {
        url: makeConnectionUrl(),
      },
    },
  })

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}

import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient
}

// Disable prepared statements to avoid "prepared statement already exists" error
// This happens with PgBouncer/connection pooling and dev HMR
function makeConnectionUrl() {
  const url = process.env.DATABASE_URL || ''
  if (!url) {
    console.error('[PRISMA] DATABASE_URL is not set')
    return url
  }
  
  try {
    const urlObj = new URL(url)
    
    // Add pgbouncer=true to disable prepared statements (for Supabase pooler)
    urlObj.searchParams.set('pgbouncer', 'true')
    
    // Add connection timeout settings if not already present
    // Increased timeout to handle connection pool exhaustion and network issues better
    if (!urlObj.searchParams.has('connect_timeout')) {
      urlObj.searchParams.set('connect_timeout', '30')
    }
    if (!urlObj.searchParams.has('pool_timeout')) {
      urlObj.searchParams.set('pool_timeout', '30')
    }
    
    // Add statement cache size for better connection pool handling
    if (!urlObj.searchParams.has('statement_cache_size')) {
      urlObj.searchParams.set('statement_cache_size', '0')
    }
    
    // Add connection pool settings for better handling of concurrent requests
    // These help Prisma manage connections more efficiently with Supabase pooler
    if (!urlObj.searchParams.has('connection_limit')) {
      // Increase limit for production workloads
      // Supabase pooler supports 15-20 connections, use 15 for production, 10 for dev
      const limit = process.env.NODE_ENV === 'production' ? '15' : '10'
      urlObj.searchParams.set('connection_limit', limit)
    }
    
    return urlObj.toString()
  } catch (error) {
    console.error('[PRISMA] Invalid DATABASE_URL format:', error)
    return url
  }
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
    // Optimize connection pool settings
    // Increase connection timeout to handle pool exhaustion better
    // Connection pool is managed by Supabase PgBouncer, but we can optimize client-side
  })

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}

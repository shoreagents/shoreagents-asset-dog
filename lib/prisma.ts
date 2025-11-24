import { PrismaClient } from '@prisma/client'

// Next.js 16 compatible singleton pattern
// Prevents multiple Prisma instances in development (especially with Turbo/HMR)
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

/**
 * Validates and fixes DATABASE_URL configuration
 * - Detects if using pooler URL with wrong port (5432 should be 6543)
 * - Configures connection parameters for Supabase
 */
function makeConnectionUrl(): string {
  const url = process.env.DATABASE_URL || ''
  if (!url) {
    console.error('[PRISMA] DATABASE_URL is not set')
    throw new Error('DATABASE_URL environment variable is required')
  }
  
  try {
    const urlObj = new URL(url)
    const hostname = urlObj.hostname
    const port = urlObj.port || (urlObj.protocol === 'postgresql:' ? '5432' : '')
    
    // CRITICAL FIX: Supabase pooler uses port 6543, not 5432
    // If using pooler URL but wrong port, fix it
    if (hostname.includes('pooler.supabase.com') && port === '5432') {
      console.warn('[PRISMA] ⚠️  Detected pooler URL with wrong port (5432). Fixing to 6543...')
      urlObj.port = '6543'
    }
    
    // For Supabase pooler (port 6543), disable prepared statements
    // For direct connection (port 5432), prepared statements are fine
    const isPooler = hostname.includes('pooler.supabase.com') || port === '6543'
    
    if (isPooler) {
      urlObj.searchParams.set('pgbouncer', 'true')
      // Disable statement cache for pooler
      if (!urlObj.searchParams.has('statement_cache_size')) {
        urlObj.searchParams.set('statement_cache_size', '0')
      }
    }
    
    // Connection timeout settings
    if (!urlObj.searchParams.has('connect_timeout')) {
      urlObj.searchParams.set('connect_timeout', '10') // Reduced from 30 - fail fast
    }
    
    // Connection pool settings
    // Supabase pooler: 15-20 connections max
    // Direct connection: Can use more, but keep reasonable
    if (!urlObj.searchParams.has('connection_limit')) {
      const limit = isPooler 
        ? (process.env.NODE_ENV === 'production' ? '15' : '10')
        : (process.env.NODE_ENV === 'production' ? '20' : '15')
      urlObj.searchParams.set('connection_limit', limit)
    }
    
    const finalUrl = urlObj.toString()
    
    // Log connection type for debugging
    if (process.env.NODE_ENV === 'development') {
      console.log(`[PRISMA] Using ${isPooler ? 'pooler' : 'direct'} connection: ${hostname}:${urlObj.port}`)
    }
    
    return finalUrl
  } catch (error) {
    console.error('[PRISMA] Invalid DATABASE_URL format:', error)
    throw new Error(`Invalid DATABASE_URL: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

// Create Prisma client with proper Next.js 16 singleton pattern
export const prisma: PrismaClient =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' 
      ? ['warn', 'error']
      : ['error'],
    datasources: {
      db: {
        url: makeConnectionUrl(),
      },
    },
  })

// Store in global for Next.js 16 (works in both dev and prod)
// This prevents multiple instances during HMR/Turbo rebuilds
if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}

// Graceful shutdown
if (typeof process !== 'undefined') {
  process.on('beforeExit', async () => {
    await prisma.$disconnect()
  })
}

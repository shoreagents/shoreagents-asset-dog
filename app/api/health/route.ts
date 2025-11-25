import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCacheStats } from '@/lib/cache-utils'

/**
 * Health check endpoint for monitoring production database connectivity
 * Use this to diagnose performance issues and monitor latency
 */
export async function GET() {
  const start = Date.now()
  
  try {
    // Simple query to check DB connection
    await prisma.$queryRaw`SELECT 1`
    const dbLatency = Date.now() - start
    
    // Get cache stats
    const cacheStats = getCacheStats()
    
    return NextResponse.json({
      status: 'ok',
      database: 'connected',
      latency_ms: dbLatency,
      cache: {
        entries: cacheStats.size,
        keys: cacheStats.keys,
        redisAvailable: cacheStats.redisAvailable,
      },
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
    })
  } catch (error) {
    const dbLatency = Date.now() - start
    
    return NextResponse.json(
      {
        status: 'error',
        database: 'disconnected',
        latency_ms: dbLatency,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV,
      },
      { status: 503 }
    )
  }
}


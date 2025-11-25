/**
 * Redis client for caching expensive database queries
 * Uses Railway Redis connection string
 * Falls back to in-memory cache if Redis is unavailable
 */

import Redis from 'ioredis'

let redis: Redis | null = null
let redisAvailable = false

// Initialize Redis client
function initRedis(): Redis | null {
  if (redis) {
    return redis
  }

  // Use environment variable or fallback to Railway Redis
  const redisUrl = process.env.REDIS_URL || process.env.NEXT_PUBLIC_REDIS_URL || 'redis://default:vsgifpOIJzdLzLarKYsAZaYvuBSkIdkK@turntable.proxy.rlwy.net:14968'

  if (!redisUrl) {
    console.warn('[REDIS] No REDIS_URL found, using in-memory cache fallback')
    return null
  }

  try {
    redis = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000)
        return delay
      },
      enableReadyCheck: true,
      connectTimeout: 10000,
      lazyConnect: true,
      enableOfflineQueue: false, // Don't queue commands if disconnected
    })

    redis.on('error', (err) => {
      console.error('[REDIS] Connection error:', err.message)
      redisAvailable = false
    })

    redis.on('connect', () => {
      console.log('[REDIS] Connected successfully')
      redisAvailable = true
    })

    redis.on('ready', () => {
      console.log('[REDIS] Ready to accept commands')
      redisAvailable = true
    })

    redis.on('close', () => {
      console.log('[REDIS] Connection closed')
      redisAvailable = false
    })

    // Try to connect, but don't block if it fails
    redis.connect().catch((err) => {
      console.warn('[REDIS] Failed to connect (will retry on first command):', err.message)
      redisAvailable = false
    })

    return redis
  } catch (error) {
    console.error('[REDIS] Failed to initialize:', error)
    redisAvailable = false
    return null
  }
}

/**
 * Get Redis client instance
 * Returns null if Redis is unavailable
 */
export function getRedisClient(): Redis | null {
  if (!redis) {
    return initRedis()
  }
  return redis
}

/**
 * Check if Redis is available
 * Note: This checks the flag, but Redis might still be connecting.
 * For accurate status, check client.status === 'ready'
 */
export function isRedisAvailable(): boolean {
  if (!redis) {
    return false
  }
  // Check both flag and actual status
  return redisAvailable && (redis.status === 'ready' || redis.status === 'connect')
}

/**
 * Get cached data from Redis
 */
export async function getRedisCached<T>(key: string): Promise<T | null> {
  const client = getRedisClient()
  if (!client) {
    return null
  }

  try {
    // Check if client is ready, if not try to connect
    if (client.status !== 'ready') {
      try {
        await client.connect()
      } catch {
        // Connection failed, fallback to in-memory
        return null
      }
    }

    const data = await client.get(key)
    if (!data) {
      return null
    }
    redisAvailable = true
    return JSON.parse(data) as T
  } catch {
    // Silently fallback to in-memory cache
    redisAvailable = false
    return null
  }
}

/**
 * Set cached data in Redis with TTL
 */
export async function setRedisCached<T>(key: string, data: T, ttlSeconds: number): Promise<void> {
  const client = getRedisClient()
  if (!client) {
    return
  }

  try {
    // Check if client is ready, if not try to connect
    if (client.status !== 'ready') {
      try {
        await client.connect()
      } catch {
        // Connection failed, skip Redis caching
        return
      }
    }

    await client.setex(key, ttlSeconds, JSON.stringify(data))
    redisAvailable = true
  } catch {
    // Silently fallback - in-memory cache will still work
    redisAvailable = false
  }
}

/**
 * Delete cached data from Redis
 */
export async function deleteRedisCached(key: string): Promise<void> {
  const client = getRedisClient()
  if (!client || !redisAvailable) {
    return
  }

  try {
    await client.del(key)
  } catch {
    // Silently fail - in-memory cache will still work
    redisAvailable = false
  }
}

/**
 * Delete cached data by prefix from Redis
 */
export async function deleteRedisCachedByPrefix(prefix: string): Promise<void> {
  const client = getRedisClient()
  if (!client || !redisAvailable) {
    return
  }

  try {
    const keys = await client.keys(`${prefix}*`)
    if (keys.length > 0) {
      await client.del(...keys)
    }
  } catch (error) {
    console.error(`[REDIS] Error deleting keys with prefix ${prefix}:`, error)
  }
}

/**
 * Clear all Redis cache
 */
export async function clearAllRedisCache(): Promise<void> {
  const client = getRedisClient()
  if (!client || !redisAvailable) {
    return
  }

  try {
    await client.flushdb()
  } catch {
    // Silently fail - in-memory cache will still work
    redisAvailable = false
  }
}


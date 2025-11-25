/**
 * Hybrid cache system: Redis (primary) + In-memory (fallback)
 * 
 * For production with multiple serverless instances, Redis ensures cache is shared
 * Falls back to in-memory cache if Redis is unavailable
 * 
 * This reduces database load by caching expensive query results
 */

import { getRedisCached, setRedisCached, deleteRedisCachedByPrefix, isRedisAvailable } from './redis'

interface CacheEntry<T> {
  data: T
  expiresAt: number
}

// In-memory cache store (fallback)
const cache = new Map<string, CacheEntry<unknown>>()

/**
 * Get cached data if it exists and hasn't expired
 * Tries Redis first, falls back to in-memory cache
 * @param key - Cache key
 * @returns Cached data or null if expired/not found
 */
export async function getCached<T>(key: string): Promise<T | null> {
  // Always try Redis first (it will connect if needed and fallback silently if unavailable)
  try {
    const redisData = await getRedisCached<T>(key)
    if (redisData !== null) {
      return redisData
    }
  } catch {
    // Silently fallback - Redis might not be available yet
  }

  // Fallback to in-memory cache
  const entry = cache.get(key) as CacheEntry<T> | undefined
  
  if (entry && entry.expiresAt > Date.now()) {
    return entry.data
  }
  
  // Remove expired entry
  if (entry) {
    cache.delete(key)
  }
  
  return null
}

/**
 * Store data in cache with TTL
 * Stores in Redis if available, also stores in-memory as backup
 * @param key - Cache key
 * @param data - Data to cache
 * @param ttlMs - Time to live in milliseconds
 */
export async function setCached<T>(key: string, data: T, ttlMs: number): Promise<void> {
  const ttlSeconds = Math.ceil(ttlMs / 1000)

  // Always try Redis first (it will connect if needed and fail silently if unavailable)
  try {
    await setRedisCached(key, data, ttlSeconds)
  } catch {
    // Silently fallback - Redis might not be available yet
  }

  // Always store in-memory as fallback
  cache.set(key, {
    data,
    expiresAt: Date.now() + ttlMs,
  })
}

/**
 * Clear cache entries
 * Clears from both Redis and in-memory cache
 * @param keyPrefix - Optional prefix to clear specific entries. If omitted, clears all.
 */
export async function clearCache(keyPrefix?: string): Promise<void> {
  // Clear from Redis if available
  if (isRedisAvailable()) {
    try {
      if (keyPrefix) {
        await deleteRedisCachedByPrefix(keyPrefix)
      } else {
        // Note: clearAllRedisCache() clears entire database - use with caution
        // For now, we'll only clear by prefix to be safe
        await deleteRedisCachedByPrefix('')
      }
    } catch (error) {
      console.error(`[CACHE] Redis clear failed:`, error)
    }
  }

  // Clear from in-memory cache
  if (!keyPrefix) {
    cache.clear()
    return
  }
  
  for (const key of cache.keys()) {
    if (key.startsWith(keyPrefix)) {
      cache.delete(key)
    }
  }
}

/**
 * Get cache statistics
 * @returns Cache size and keys (from in-memory cache only)
 */
export function getCacheStats(): { size: number; keys: string[]; redisAvailable: boolean } {
  return {
    size: cache.size,
    keys: Array.from(cache.keys()),
    redisAvailable: isRedisAvailable(),
  }
}

// Clean up expired entries every 5 minutes to prevent memory bloat
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now()
    let cleaned = 0
    
    for (const [key, entry] of cache.entries()) {
      if (entry.expiresAt <= now) {
        cache.delete(key)
        cleaned++
      }
    }
    
    if (cleaned > 0) {
      console.log(`[CACHE] Cleaned ${cleaned} expired entries from memory`)
    }
  }, 300000) // 5 minutes
}


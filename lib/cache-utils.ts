/**
 * Simple in-memory cache for API responses
 * For production with multiple serverless instances, consider Redis/Vercel KV
 * 
 * This reduces database load by caching expensive query results
 */

interface CacheEntry<T> {
  data: T
  expiresAt: number
}

// In-memory cache store
const cache = new Map<string, CacheEntry<unknown>>()

/**
 * Get cached data if it exists and hasn't expired
 * @param key - Cache key
 * @returns Cached data or null if expired/not found
 */
export function getCached<T>(key: string): T | null {
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
 * @param key - Cache key
 * @param data - Data to cache
 * @param ttlMs - Time to live in milliseconds
 */
export function setCached<T>(key: string, data: T, ttlMs: number): void {
  cache.set(key, {
    data,
    expiresAt: Date.now() + ttlMs,
  })
}

/**
 * Clear cache entries
 * @param keyPrefix - Optional prefix to clear specific entries. If omitted, clears all.
 */
export function clearCache(keyPrefix?: string): void {
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
 * @returns Cache size and entries
 */
export function getCacheStats(): { size: number; keys: string[] } {
  return {
    size: cache.size,
    keys: Array.from(cache.keys()),
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
      console.log(`[CACHE] Cleaned ${cleaned} expired entries`)
    }
  }, 300000) // 5 minutes
}


/**
 * Database utility functions for handling retries and connection errors
 * 
 * NOTE: Retry logic should only be used for truly transient network errors.
 * If you're getting persistent connection errors, check your DATABASE_URL configuration:
 * - Pooler URL should use port 6543, not 5432
 * - Direct connection should use port 5432
 * - Ensure DATABASE_URL is correctly set in your environment
 */

import { PrismaClientInitializationError, PrismaClientKnownRequestError } from '@prisma/client/runtime/library'

/**
 * Checks if an error is a transient connection error that might benefit from retry
 * Non-transient errors (wrong port, auth failures, etc.) should NOT be retried
 */
function isTransientConnectionError(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  
  const errorMessage = error.message.toLowerCase()
  
  // Prisma error codes that indicate transient issues
  if (error instanceof PrismaClientKnownRequestError) {
    // P1001: Can't reach database server (transient)
    // P2024: Connection pool timeout (transient)
    // P1017: Server closed connection (transient)
    if (['P1001', 'P2024', 'P1017'].includes(error.code)) {
      // BUT: If it's a persistent "Can't reach" error, it's likely configuration
      // Only retry if it's a timeout or pool exhaustion, not "can't reach"
      if (error.code === 'P1001' && errorMessage.includes("can't reach")) {
        // This is usually a configuration issue, not transient
        // But we'll retry once in case it's a brief network hiccup
        return true
      }
      return true
    }
  }
  
  if (error instanceof PrismaClientInitializationError) {
    // Initialization errors are usually configuration issues, not transient
    // Only retry if it's clearly a timeout
    return errorMessage.includes('timeout') || errorMessage.includes('timed out')
  }
  
  // Network-level transient errors
  const transientPatterns = [
    'connection timeout',
    'timed out fetching',
    'econnrefused', // Might be transient
    'etimedout',
    'connection pool', // Pool exhaustion might be transient
    'connection closed', // Server closed, might reconnect
    'connection terminated', // Server terminated, might reconnect
  ]
  
  // Configuration errors that should NOT be retried
  const configErrors = [
    "can't reach database server", // Usually wrong host/port
    'enotfound', // DNS resolution failure - config issue
    'authentication failed',
    'password authentication failed',
    'invalid connection string',
  ]
  
  // If it's a config error, don't retry
  if (configErrors.some(pattern => errorMessage.includes(pattern))) {
    return false
  }
  
  // Check for transient patterns
  return transientPatterns.some(pattern => errorMessage.includes(pattern))
}

/**
 * Retry operation with exponential backoff for TRULY TRANSIENT database connection errors
 * 
 * ⚠️ WARNING: If you're always getting connection errors, this is likely a configuration issue:
 * - Check DATABASE_URL uses correct port (6543 for pooler, 5432 for direct)
 * - Verify database server is accessible
 * - Check network/firewall settings
 * 
 * @param operation - The async operation to retry
 * @param maxRetries - Maximum number of retry attempts (default: 2, reduced from 3)
 * @param delay - Initial delay in milliseconds (default: 500, reduced from 1000)
 * @returns The result of the operation
 */
export async function retryDbOperation<T>(
  operation: () => Promise<T>,
  maxRetries = 2, // Reduced: if it fails twice, it's likely not transient
  delay = 500 // Reduced: fail faster if it's a config issue
): Promise<T> {
  let lastError: unknown
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await operation()
    } catch (error: unknown) {
      lastError = error
      
      // Only retry if it's a truly transient error
      const isTransient = isTransientConnectionError(error)
      
      if (isTransient && attempt < maxRetries - 1) {
        const attemptNum = attempt + 1
        const errorCode = error instanceof PrismaClientKnownRequestError 
          ? error.code 
          : error instanceof PrismaClientInitializationError 
          ? 'INIT_ERROR' 
          : 'CONN_ERROR'
        
        console.warn(`[DB] Transient connection error (attempt ${attemptNum}/${maxRetries}, code: ${errorCode})`)
        
        // Exponential backoff with jitter: 500ms, 1000ms
        const baseDelay = delay * Math.pow(2, attempt)
        const jitter = Math.random() * 100 // 0-100ms random jitter
        const backoffDelay = baseDelay + jitter
        
        await new Promise(resolve => setTimeout(resolve, backoffDelay))
        continue
      }
      
      // If not retryable or out of retries, throw immediately
      // This helps surface configuration issues faster
      throw error
    }
  }
  
  // If we exhausted all retries, throw the last error
  throw lastError
}


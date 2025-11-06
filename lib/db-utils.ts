/**
 * Database utility functions for handling retries and connection errors
 */

/**
 * Retry operation with exponential backoff for transient database connection errors
 * @param operation - The async operation to retry
 * @param maxRetries - Maximum number of retry attempts (default: 3)
 * @param delay - Initial delay in milliseconds (default: 500)
 * @returns The result of the operation
 */
export async function retryDbOperation<T>(
  operation: () => Promise<T>,
  maxRetries = 3,
  delay = 500
): Promise<T> {
  let lastError: unknown
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await operation()
    } catch (error: unknown) {
      const prismaError = error as { code?: string; message?: string }
      // Only retry on connection errors (P1001)
      if (prismaError?.code === 'P1001' && attempt < maxRetries - 1) {
        lastError = error
        // Exponential backoff: 500ms, 1000ms, 2000ms
        await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, attempt)))
        continue
      }
      throw error
    }
  }
  throw lastError
}


import { sql } from '../db.js'

/**
 * Simple rate limiter using database storage
 * Tracks requests by IP address in a lightweight table
 */

interface RateLimitResult {
  allowed: boolean
  remaining?: number
  resetAt?: Date
}

/**
 * Check if a request should be rate limited
 * @param identifier - IP address or user identifier
 * @param maxRequests - Maximum requests allowed in window
 * @param windowMinutes - Time window in minutes (default: 15)
 * @returns RateLimitResult with allowed status
 */
export async function checkRateLimit(
  identifier: string,
  maxRequests: number = 10,
  windowMinutes: number = 15
): Promise<RateLimitResult> {
  try {
    // Create rate_limits table if it doesn't exist (lightweight schema)
    await sql`
      CREATE TABLE IF NOT EXISTS rate_limits (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        identifier TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_rate_limits_identifier_created ON rate_limits(identifier, created_at);
    `

    // Clean old entries outside the window
    const windowStart = new Date()
    windowStart.setMinutes(windowStart.getMinutes() - windowMinutes)

    await sql`
      DELETE FROM rate_limits
      WHERE created_at < ${windowStart.toISOString()}
    `

    // Count recent requests from this identifier
    const result = await sql`
      SELECT COUNT(*) as count FROM rate_limits
      WHERE identifier = ${identifier}
    `

    const count = parseInt(result[0].count)

    if (count >= maxRequests) {
      // Find when the oldest request will expire
      const oldestResult = await sql`
        SELECT created_at FROM rate_limits
        WHERE identifier = ${identifier}
        ORDER BY created_at ASC
        LIMIT 1
      `

      const resetAt = oldestResult.length > 0
        ? new Date(new Date(oldestResult[0].created_at).getTime() + windowMinutes * 60 * 1000)
        : new Date(Date.now() + windowMinutes * 60 * 1000)

      return { allowed: false, remaining: 0, resetAt }
    }

    // Record this request
    await sql`
      INSERT INTO rate_limits (identifier)
      VALUES (${identifier})
    `

    return { allowed: true, remaining: maxRequests - count - 1 }
  } catch (error) {
    console.error('Rate limit check failed:', error)
    // Fail open - allow request if rate limiting fails
    return { allowed: true }
  }
}

/**
 * Extract IP address from request headers
 */
export function getClientIP(request: Request): string {
  // Check various headers for real IP (accounting for proxies)
  const forwardedFor = request.headers.get('x-forwarded-for')
  const realIP = request.headers.get('x-real-ip')
  const cfConnectingIP = request.headers.get('cf-connecting-ip')

  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim()
  }

  if (realIP) {
    return realIP
  }

  if (cfConnectingIP) {
    return cfConnectingIP
  }

  return 'unknown'
}

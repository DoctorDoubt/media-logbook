/**
 * Password check endpoint with JWT token generation
 * Validates password server-side and returns a JWT token for authenticated requests
 */

import { generateAccessToken } from './lib/auth.js'
import { getSingleUserId } from './lib/single-user.js'
import { checkRateLimit, getClientIP } from './lib/rate-limit.js'

// Login attempts allowed per IP per window.
const MAX_LOGIN_ATTEMPTS = 10
const LOGIN_WINDOW_MINUTES = 15

const correctPassword = process.env.SITE_PASSWORD

if (!correctPassword) {
  throw new Error('SITE_PASSWORD environment variable is not set')
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as { password?: string }
    const { password } = body

    // Rate limiting is backed by the database rather than process memory:
    // each serverless instance has its own heap, so an in-memory counter
    // resets on every cold start and never sees attempts handled by a
    // sibling instance — which made the previous limiter close to a no-op.
    const rateLimitKey = `password-check:${getClientIP(request)}`
    const limit = await checkRateLimit(rateLimitKey, MAX_LOGIN_ATTEMPTS, LOGIN_WINDOW_MINUTES)

    if (!limit.allowed) {
      const retryAfter = limit.resetAt
        ? Math.max(1, Math.ceil((limit.resetAt.getTime() - Date.now()) / 1000))
        : LOGIN_WINDOW_MINUTES * 60
      return new Response(
        JSON.stringify({
          error: 'Too many attempts. Please try again later.',
          resetAt: limit.resetAt
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': String(retryAfter)
          }
        }
      )
    }

    // Check password
    if (password === correctPassword) {
      // Get user ID and generate JWT token
      const userId = await getSingleUserId()
      const token = await generateAccessToken({
        userId,
        username: 'user'
      })

      return new Response(
        JSON.stringify({ success: true, token }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        }
      )
    }

    return new Response(
      JSON.stringify({ success: false, error: 'Incorrect password' }),
      {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      }
    )
  } catch (error) {
    console.error('Password check error:', error)
    return new Response(
      JSON.stringify({ error: 'Password check failed' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    )
  }
}

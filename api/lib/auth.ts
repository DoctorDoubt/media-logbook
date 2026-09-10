import { SignJWT, jwtVerify } from 'jose'

if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is not set')
}
if (!process.env.JWT_REFRESH_SECRET) {
  throw new Error('JWT_REFRESH_SECRET environment variable is not set')
}

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET)
const JWT_REFRESH_SECRET = new TextEncoder().encode(process.env.JWT_REFRESH_SECRET)

export interface TokenPayload {
  userId: string
  username: string
}

export interface AuthenticatedRequest extends Request {
  userId?: string
  username?: string
}

/**
 * Generate an access token (short-lived, 15 minutes)
 */
export async function generateAccessToken(
  payload: TokenPayload
): Promise<string> {
  return await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(process.env.JWT_EXPIRES_IN || '15m')
    .sign(JWT_SECRET)
}

/**
 * Generate a refresh token (long-lived, 7 days)
 */
export async function generateRefreshToken(
  payload: TokenPayload
): Promise<string> {
  return await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(process.env.JWT_REFRESH_EXPIRES_IN || '7d')
    .sign(JWT_REFRESH_SECRET)
}

/**
 * Verify an access token
 */
export async function verifyAccessToken(
  token: string
): Promise<TokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET)
    return {
      userId: payload.userId as string,
      username: payload.username as string,
    }
  } catch (error) {
    console.error('Token verification failed:', error)
    return null
  }
}

/**
 * Verify a refresh token
 */
export async function verifyRefreshToken(
  token: string
): Promise<TokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_REFRESH_SECRET)
    return {
      userId: payload.userId as string,
      username: payload.username as string,
    }
  } catch (error) {
    console.error('Refresh token verification failed:', error)
    return null
  }
}

/**
 * Extract and verify JWT from Authorization header
 * Returns null if token is invalid or missing
 */
export async function authenticateRequest(
  request: Request
): Promise<TokenPayload | null> {
  const authHeader = request.headers.get('Authorization')

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null
  }

  const token = authHeader.substring(7) // Remove 'Bearer ' prefix
  return await verifyAccessToken(token)
}

/**
 * Middleware function to protect API endpoints
 * Returns 401 Unauthorized if token is invalid
 */
export async function requireAuth(
  request: Request
): Promise<TokenPayload> {
  const auth = await authenticateRequest(request)

  if (!auth) {
    throw new AuthError('Unauthorized')
  }

  return auth
}

export class AuthError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AuthError'
  }
}

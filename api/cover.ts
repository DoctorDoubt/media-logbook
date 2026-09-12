import { requireAuth, AuthError } from './lib/auth.js'
import {
  searchCovers,
  ALLOWED_PROXY_HOSTS,
  MAX_PROXY_BYTES,
  type CoverKeys,
} from '../shared/covers.js'

function keysFromEnv(): CoverKeys {
  return {
    tmdbApiKey: process.env.TMDB_API_KEY,
    igdbClientId: process.env.IGDB_CLIENT_ID,
    igdbClientSecret: process.env.IGDB_CLIENT_SECRET,
  }
}

async function proxyImage(imageUrl: string): Promise<Response> {
  let parsed: URL
  try {
    parsed = new URL(imageUrl)
  } catch {
    return new Response('Invalid url', { status: 400 })
  }
  if (parsed.protocol !== 'https:') {
    return new Response('Disallowed protocol', { status: 403 })
  }
  if (!ALLOWED_PROXY_HOSTS.some((h) => parsed.hostname === h)) {
    return new Response('Disallowed host', { status: 403 })
  }
  // redirect: 'manual' keeps the allowlist meaningful — following redirects
  // would let an allowed host bounce us to an arbitrary destination.
  const res = await fetch(imageUrl, { redirect: 'manual' })
  if (res.status >= 300 && res.status < 400) {
    return new Response('Upstream redirect refused', { status: 502 })
  }
  if (!res.ok) return new Response('Upstream error', { status: 502 })

  const declaredLength = Number(res.headers.get('Content-Length') ?? '0')
  if (declaredLength > MAX_PROXY_BYTES) {
    return new Response('Upstream image too large', { status: 502 })
  }
  const buffer = await res.arrayBuffer()
  if (buffer.byteLength > MAX_PROXY_BYTES) {
    return new Response('Upstream image too large', { status: 502 })
  }
  return new Response(buffer, {
    headers: {
      'Content-Type': res.headers.get('Content-Type') ?? 'image/jpeg',
      'Cache-Control': 'public, max-age=604800, immutable',
      'Access-Control-Allow-Origin': '*',
    },
  })
}

export async function GET(request: Request) {
  // Both modes call out to paid third-party APIs or relay bytes on our
  // bandwidth, so they require a valid session like every other endpoint.
  try {
    await requireAuth(request)
  } catch (error) {
    if (error instanceof AuthError) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    throw error
  }

  const url = new URL(request.url)

  // Image proxy mode — used by AnsiArt to avoid CORS issues
  const proxyUrl = url.searchParams.get('proxy')
  if (proxyUrl) return proxyImage(proxyUrl)

  // Cover search mode
  const title = url.searchParams.get('title')
  const type = url.searchParams.get('type')

  if (!title || !type) {
    return new Response(JSON.stringify({ error: 'Missing title or type' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const urls = await searchCovers(type, title, keysFromEnv())

  return new Response(JSON.stringify({ urls }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

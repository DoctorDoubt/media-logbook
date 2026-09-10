import { requireAuth, AuthError } from './lib/auth.js'

const TMDB_IMG = 'https://image.tmdb.org/t/p/w200'

const ALLOWED_PROXY_HOSTS = ['image.tmdb.org', 'media.rawg.io', 'covers.openlibrary.org', 'images.igdb.com']

// Cap on proxied image size, so an upstream host cannot exhaust function memory.
const MAX_PROXY_BYTES = 10 * 1024 * 1024

async function proxyImage(imageUrl: string): Promise<Response> {
  let parsed: URL
  try { parsed = new URL(imageUrl) } catch {
    return new Response('Invalid url', { status: 400 })
  }
  if (parsed.protocol !== 'https:') {
    return new Response('Disallowed protocol', { status: 403 })
  }
  if (!ALLOWED_PROXY_HOSTS.some(h => parsed.hostname === h)) {
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

async function fetchTMDBPosters(endpoint: string, title: string): Promise<string[]> {
  const apiKey = process.env.TMDB_API_KEY
  if (!apiKey) return []

  // Step 1: search to get ID
  const searchRes = await fetch(
    `https://api.themoviedb.org/3/search/${endpoint}?api_key=${apiKey}&query=${encodeURIComponent(title)}&page=1`
  )
  const searchData = await searchRes.json() as any
  const topResults = (searchData.results ?? []).filter((r: any) => r.poster_path).slice(0, 3)
  if (topResults.length === 0) return []

  // Step 2: fetch all posters for the top result
  const id = topResults[0].id
  const imgRes = await fetch(
    `https://api.themoviedb.org/3/${endpoint}/${id}/images?api_key=${apiKey}`
  )
  const imgData = await imgRes.json() as any
  const posters: string[] = (imgData.posters ?? [])
    .sort((a: any, b: any) => (b.vote_count ?? 0) - (a.vote_count ?? 0))
    .slice(0, 5)
    .map((p: any) => `${TMDB_IMG}${p.file_path}`)

  // Fall back to search result posters if images endpoint returns nothing
  if (posters.length === 0) {
    return topResults.map((r: any) => `${TMDB_IMG}${r.poster_path}`)
  }
  return posters
}

async function fetchMovieCovers(title: string): Promise<string[]> {
  return fetchTMDBPosters('movie', title)
}

async function fetchTVCovers(title: string): Promise<string[]> {
  return fetchTMDBPosters('tv', title)
}

async function getIGDBToken(): Promise<string | null> {
  const clientId = process.env.IGDB_CLIENT_ID
  const clientSecret = process.env.IGDB_CLIENT_SECRET
  if (!clientId || !clientSecret) return null
  const res = await fetch(
    `https://id.twitch.tv/oauth2/token?client_id=${clientId}&client_secret=${clientSecret}&grant_type=client_credentials`,
    { method: 'POST' }
  )
  const data = await res.json() as any
  return data.access_token ?? null
}

async function fetchGameCovers(title: string): Promise<string[]> {
  const clientId = process.env.IGDB_CLIENT_ID
  const token = await getIGDBToken()
  if (!clientId || !token) return []

  const res = await fetch('https://api.igdb.com/v4/games', {
    method: 'POST',
    headers: {
      'Client-ID': clientId,
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'text/plain',
    },
    // Escape backslashes and quotes so a title cannot break out of the
    // quoted string and append its own APICalypse clauses.
    body: `search "${title.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"; fields name,cover.image_id; where cover != null; limit 5;`,
  })
  const data = await res.json() as any
  return (data ?? [])
    .filter((g: any) => g.cover?.image_id)
    .map((g: any) => `https://images.igdb.com/igdb/image/upload/t_cover_big/${g.cover.image_id}.jpg`)
}

async function fetchComicCovers(title: string): Promise<string[]> {
  const res = await fetch(
    `https://openlibrary.org/search.json?title=${encodeURIComponent(title)}&limit=5&fields=cover_i`
  )
  const data = await res.json() as any
  return (data.docs ?? [])
    .filter((d: any) => d.cover_i)
    .map((d: any) => `https://covers.openlibrary.org/b/id/${d.cover_i}-M.jpg`)
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

  let urls: string[] = []
  try {
    if (type === 'movie') urls = await fetchMovieCovers(title)
    else if (type === 'tv') urls = await fetchTVCovers(title)
    else if (type === 'game') urls = await fetchGameCovers(title)
    else if (type === 'comic') urls = await fetchComicCovers(title)
  } catch (e) {
    console.error('Cover fetch error:', e)
  }

  return new Response(JSON.stringify({ urls }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

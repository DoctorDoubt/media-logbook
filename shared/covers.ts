/**
 * Cover art lookup, shared by the server and the offline storage modes.
 *
 * The providers are reached over plain fetch and take their credentials as an
 * argument, so the same code runs on the server (keys from the environment)
 * and inside the browser or desktop app (a key the user supplied in Settings).
 *
 * What works where, and why:
 *
 *   TMDB (movies, TV)   Sends Access-Control-Allow-Origin: *, so the webview
 *                       can call it directly with the user's own API key.
 *   OpenLibrary (comics) Same, and needs no key at all.
 *   IGDB (games)        Sends no CORS headers and authenticates with a client
 *                       secret, which does not belong in a client. Games
 *                       therefore only resolve covers in server mode.
 */

export type MediaKind = 'movie' | 'tv' | 'game' | 'comic'

export interface CoverKeys {
  tmdbApiKey?: string
  igdbClientId?: string
  igdbClientSecret?: string
}

/** Media kinds resolvable without a server. */
export const CLIENT_RESOLVABLE: MediaKind[] = ['movie', 'tv', 'comic']

export const TMDB_IMG = 'https://image.tmdb.org/t/p/w200'

/** Hosts the image proxy will relay. Every cover URL produced here is one of these. */
export const ALLOWED_PROXY_HOSTS = [
  'image.tmdb.org',
  'media.rawg.io',
  'covers.openlibrary.org',
  'images.igdb.com',
]

/** Cap on proxied image size, so an upstream host cannot exhaust memory. */
export const MAX_PROXY_BYTES = 10 * 1024 * 1024

type Fetch = typeof globalThis.fetch

async function fetchTMDBPosters(
  endpoint: 'movie' | 'tv',
  title: string,
  apiKey: string | undefined,
  doFetch: Fetch
): Promise<string[]> {
  if (!apiKey) return []

  const searchRes = await doFetch(
    `https://api.themoviedb.org/3/search/${endpoint}?api_key=${apiKey}&query=${encodeURIComponent(title)}&page=1`
  )
  const searchData = (await searchRes.json()) as any
  const topResults = (searchData.results ?? []).filter((r: any) => r.poster_path).slice(0, 3)
  if (topResults.length === 0) return []

  const id = topResults[0].id
  const imgRes = await doFetch(
    `https://api.themoviedb.org/3/${endpoint}/${id}/images?api_key=${apiKey}`
  )
  const imgData = (await imgRes.json()) as any
  const posters: string[] = (imgData.posters ?? [])
    .sort((a: any, b: any) => (b.vote_count ?? 0) - (a.vote_count ?? 0))
    .slice(0, 5)
    .map((p: any) => `${TMDB_IMG}${p.file_path}`)

  // Fall back to search result posters if the images endpoint returns nothing.
  if (posters.length === 0) {
    return topResults.map((r: any) => `${TMDB_IMG}${r.poster_path}`)
  }
  return posters
}

async function getIGDBToken(keys: CoverKeys, doFetch: Fetch): Promise<string | null> {
  if (!keys.igdbClientId || !keys.igdbClientSecret) return null
  const res = await doFetch(
    `https://id.twitch.tv/oauth2/token?client_id=${keys.igdbClientId}&client_secret=${keys.igdbClientSecret}&grant_type=client_credentials`,
    { method: 'POST' }
  )
  const data = (await res.json()) as any
  return data.access_token ?? null
}

async function fetchGameCovers(
  title: string,
  keys: CoverKeys,
  doFetch: Fetch
): Promise<string[]> {
  const token = await getIGDBToken(keys, doFetch)
  if (!keys.igdbClientId || !token) return []

  const res = await doFetch('https://api.igdb.com/v4/games', {
    method: 'POST',
    headers: {
      'Client-ID': keys.igdbClientId,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'text/plain',
    },
    // Escape backslashes and quotes so a title cannot break out of the quoted
    // string and append its own APICalypse clauses.
    body: `search "${title.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"; fields name,cover.image_id; where cover != null; limit 5;`,
  })
  const data = (await res.json()) as any
  return (data ?? [])
    .filter((g: any) => g.cover?.image_id)
    .map((g: any) => `https://images.igdb.com/igdb/image/upload/t_cover_big/${g.cover.image_id}.jpg`)
}

async function fetchComicCovers(title: string, doFetch: Fetch): Promise<string[]> {
  const res = await doFetch(
    `https://openlibrary.org/search.json?title=${encodeURIComponent(title)}&limit=5&fields=cover_i`
  )
  const data = (await res.json()) as any
  return (data.docs ?? [])
    .filter((d: any) => d.cover_i)
    .map((d: any) => `https://covers.openlibrary.org/b/id/${d.cover_i}-M.jpg`)
}

/**
 * Look up cover URLs for a title. Never throws: a provider that is
 * unconfigured, rate limited or down yields an empty list, and the caller
 * treats "no covers" the same either way.
 */
export async function searchCovers(
  type: string,
  title: string,
  keys: CoverKeys,
  doFetch: Fetch = globalThis.fetch
): Promise<string[]> {
  try {
    if (type === 'movie') return await fetchTMDBPosters('movie', title, keys.tmdbApiKey, doFetch)
    if (type === 'tv') return await fetchTMDBPosters('tv', title, keys.tmdbApiKey, doFetch)
    if (type === 'game') return await fetchGameCovers(title, keys, doFetch)
    if (type === 'comic') return await fetchComicCovers(title, doFetch)
  } catch (e) {
    console.error('Cover fetch error:', e)
  }
  return []
}

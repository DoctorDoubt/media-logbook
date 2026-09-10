import type { MediaEntry, ListType } from '../types'

const API_BASE = '/api'
const AUTH_TOKEN_KEY = 'jefflog-auth-token'

export interface FetchEntriesResponse {
  entries: (MediaEntry & { createdAt: Date })[]
  error?: string
}

export interface CreateEntryResponse {
  entry?: MediaEntry
  error?: string
}

/**
 * Fetch wrapper with JWT authentication
 * Adds Authorization header with token from sessionStorage
 */
async function fetchWrapper(url: string, options?: RequestInit): Promise<Response> {
  const token = sessionStorage.getItem(AUTH_TOKEN_KEY)

  const headers = {
    ...options?.headers,
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
  }

  const response = await fetch(url, {
    ...options,
    headers,
  })

  // Only reload if we had a token that became invalid (expired session)
  // Don't reload if we never had a token (user not logged in yet)
  if (response.status === 401 && token) {
    sessionStorage.removeItem(AUTH_TOKEN_KEY)
    sessionStorage.removeItem('jefflog-unlocked')
    window.location.reload() // Force reload to show password screen
  }

  return response
}

// Normalize entry from API format to frontend format
function normalizeEntry(entry: any): MediaEntry {
  return {
    ...entry,
    // Map snake_case to camelCase
    list: entry.list_type || entry.list,
    releaseDate: entry.release_date ?? entry.releaseDate,
    seasonsCompleted: entry.seasons_completed ?? entry.seasonsCompleted,
    completedAt: entry.completed_at ?? entry.completedAt,
    coverUrl: entry.cover_url ?? entry.coverUrl,
    createdAt: new Date(entry.createdAt || entry.created_at),
    updatedAt: new Date(entry.updatedAt || entry.updated_at),
  }
}

// Fetch entries for authenticated user and list type
export async function fetchEntries(
  listType: ListType
): Promise<FetchEntriesResponse> {
  try {
    const res = await fetchWrapper(`${API_BASE}/entries?list=${listType}`)
    const data = await res.json()

    // Normalize entries from API format
    if (data.entries) {
      data.entries = data.entries.map(normalizeEntry)
    }

    return data
  } catch (error) {
    console.error('Fetch entries error:', error)
    return { entries: [], error: 'Failed to fetch entries' }
  }
}

// Create a new media entry
export async function createEntry(
  entry: Omit<MediaEntry, 'id' | 'createdAt' | 'userId' | 'updatedAt'>
): Promise<CreateEntryResponse> {
  try {
    const res = await fetchWrapper(`${API_BASE}/entries/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: entry.title,
        type: entry.type,
        status: entry.status,
        year: entry.year,
        listType: entry.list,
        seasonsCompleted: entry.seasonsCompleted,
        coverUrl: entry.coverUrl,
        releaseDate: entry.releaseDate,
        completedAt: entry.completedAt,
      }),
    })
    const data = await res.json()

    // Normalize the created entry
    if (data.entry) {
      data.entry = normalizeEntry(data.entry)
    }

    return data
  } catch (error) {
    console.error('Create entry error:', error)
    return { error: 'Failed to create entry' }
  }
}

// Update an existing entry
export async function updateEntry(
  id: string,
  updates: Partial<MediaEntry>
): Promise<{ entry?: MediaEntry; error?: string }> {
  try {
    const res = await fetchWrapper(`${API_BASE}/entries/update`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, updates }),
    })
    const data = await res.json()

    // Normalize the updated entry
    if (data.entry) {
      data.entry = normalizeEntry(data.entry)
    }

    return data
  } catch (error) {
    console.error('Update entry error:', error)
    return { error: 'Failed to update entry' }
  }
}

// Delete an entry
export async function deleteEntry(
  id: string
): Promise<{ success?: boolean; error?: string }> {
  try {
    const res = await fetchWrapper(`${API_BASE}/entries/delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    const data = await res.json()
    return data
  } catch (error) {
    console.error('Delete entry error:', error)
    return { error: 'Failed to delete entry' }
  }
}

import type { ListType } from '../types'

const SYNC_STATE_KEY = 'media-logbook-sync-state'
const AUTH_TOKEN_KEY = 'jefflog-auth-token'

export interface SyncState {
  lastSyncTime: string | null
  deviceId: string
}

export interface SyncResult {
  entries: any[]
  serverTime: string
  isNewData: boolean
  isInitial: boolean
}

export function getSyncState(): SyncState {
  const stored = localStorage.getItem(SYNC_STATE_KEY)
  if (stored) return JSON.parse(stored)

  const deviceId = 'device-' + crypto.randomUUID()
  const initialState = { lastSyncTime: null, deviceId }
  localStorage.setItem(SYNC_STATE_KEY, JSON.stringify(initialState))
  return initialState
}

export function updateSyncState(updates: Partial<SyncState>) {
  const current = getSyncState()
  const updated = { ...current, ...updates }
  localStorage.setItem(SYNC_STATE_KEY, JSON.stringify(updated))
}

/**
 * Authenticated fetch for sync API calls
 */
async function authenticatedFetch(url: string): Promise<Response> {
  const token = sessionStorage.getItem(AUTH_TOKEN_KEY)

  const headers: HeadersInit = {}
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const response = await fetch(url, { headers })

  // Only reload if we had a token that became invalid (expired session)
  // Don't reload if we never had a token (user not logged in yet)
  if (response.status === 401 && token) {
    sessionStorage.removeItem(AUTH_TOKEN_KEY)
    sessionStorage.removeItem('jefflog-unlocked')
    window.location.reload() // Force reload to show password screen
  }

  return response
}

export async function performSync(listType: ListType): Promise<SyncResult> {
  const state = getSyncState()
  const since = state.lastSyncTime || ''

  const url = since
    ? `/api/entries/sync?list=${listType}&since=${since}`
    : `/api/entries/sync?list=${listType}`

  const res = await authenticatedFetch(url)
  if (!res.ok) throw new Error('Sync failed')

  const data = await res.json()

  // Update sync state with server time
  updateSyncState({ lastSyncTime: data.serverTime })

  // Return entries for merging
  return {
    entries: data.entries,
    serverTime: data.serverTime,
    isNewData: data.entries.length > 0,
    isInitial: data.isInitial
  }
}

import type { MediaEntry, ListType } from '../types'
import * as api from './api'

const BACKLOG_KEY = 'media-logbook-backlog'
const FUTURELOG_KEY = 'media-logbook-futurelog'
const OLD_STORAGE_KEY = 'media-logbook-entries'
const USER_KEY = 'media-logbook-user'
const MIGRATED_KEY = 'media-logbook-migrated'

// Generate or retrieve a local user ID (for backward compatibility)
export const getLocalUserId = (): string => {
  let userId = localStorage.getItem(USER_KEY)
  if (!userId) {
    userId = 'local-' + crypto.randomUUID()
    localStorage.setItem(USER_KEY, userId)
  }
  return userId
}

// Always use cloud API for single-user mode
export const isCloudUser = (): boolean => {
  return true // Always use API for single-user mode
}

const getStorageKey = (listType: ListType): string => {
  return listType === 'backlog' ? BACKLOG_KEY : FUTURELOG_KEY
}

// Migration function - runs once on app startup
export const migrateToSeparateStorage = () => {
  const migrated = localStorage.getItem(MIGRATED_KEY)
  if (migrated) return

  const oldData = localStorage.getItem(OLD_STORAGE_KEY)
  if (oldData) {
    try {
      const entries: (MediaEntry & { createdAt: string })[] = JSON.parse(oldData)

      const backlogEntries = entries.filter((e) => e.list === 'backlog' || !e.list)
      const futurelogEntries = entries.filter((e) => e.list === 'futurelog')

      if (backlogEntries.length > 0) {
        localStorage.setItem(BACKLOG_KEY, JSON.stringify(backlogEntries))
      }
      if (futurelogEntries.length > 0) {
        localStorage.setItem(FUTURELOG_KEY, JSON.stringify(futurelogEntries))
      }

      localStorage.removeItem(OLD_STORAGE_KEY)
    } catch {
      // If parsing fails, just mark as migrated and move on
    }
  }

  localStorage.setItem(MIGRATED_KEY, 'true')
}

export const loadEntries = (listType: ListType): MediaEntry[] => {
  const key = getStorageKey(listType)
  const data = localStorage.getItem(key)
  if (!data) return []
  try {
    const parsed = JSON.parse(data)
    return parsed.map((e: any) => ({
      ...e,
      // Map list_type to list
      list: e.list_type || e.list || listType,
      createdAt: new Date(e.createdAt || e.created_at),
      updatedAt: new Date(e.updatedAt || e.updated_at),
    }))
  } catch {
    return []
  }
}

export const saveEntries = (entries: MediaEntry[], listType: ListType) => {
  const key = getStorageKey(listType)
  localStorage.setItem(key, JSON.stringify(entries))
}

type Callback = (entries: MediaEntry[]) => void

// Separate listener registries per list type
const listenersByList: Record<ListType, Callback[]> = {
  backlog: [],
  futurelog: [],
}

const notifyListeners = (listType: ListType) => {
  const entries = loadEntries(listType)
  listenersByList[listType].forEach((cb) => cb(entries))
}

// Listen for sync events from sync-manager
window.addEventListener('media-entries-synced', ((event: CustomEvent) => {
  const detail = event.detail as { listType: ListType }
  notifyListeners(detail.listType)
}) as EventListener)

// Sync entries from cloud to local cache
export const syncEntriesFromCloud = async (listType: ListType) => {
  const result = await api.fetchEntries(listType)
  if (result.entries && !result.error) {
    saveEntries(result.entries, listType)
    return result.entries
  }
  return loadEntries(listType)
}

export const subscribeToEntries = (
  listType: ListType,
  callback: (entries: MediaEntry[]) => void
) => {
  // Sync from cloud on mount (single-user mode always uses cloud)
  syncEntriesFromCloud(listType).catch(console.error)

  listenersByList[listType].push(callback)
  callback(loadEntries(listType))

  return () => {
    listenersByList[listType] = listenersByList[listType].filter((cb) => cb !== callback)
  }
}

export const addEntry = async (entry: Omit<MediaEntry, 'id' | 'createdAt' | 'userId' | 'updatedAt'>) => {
  const listType = entry.list

  // Generate temporary optimistic entry
  const tempId = 'temp-' + crypto.randomUUID()
  const now = new Date()
  const optimisticEntry: MediaEntry = {
    ...entry,
    id: tempId,
    createdAt: now,
    updatedAt: now,
    userId: getLocalUserId(),
  }

  // Update local cache immediately (optimistic) - instant feedback
  const entries = loadEntries(listType)
  entries.push(optimisticEntry)
  saveEntries(entries, listType)
  notifyListeners(listType) // Immediate update

  // Make API call
  const result = await api.createEntry(entry)
  if (result.entry) {
    // Replace optimistic entry with real one
    const currentEntries = loadEntries(listType)
    const index = currentEntries.findIndex((e) => e.id === tempId)
    if (index !== -1) {
      currentEntries[index] = result.entry
      saveEntries(currentEntries, listType)
    }
    // Defer second notify to avoid interrupting the first render
    requestAnimationFrame(() => {
      notifyListeners(listType)
    })
    return result.entry
  } else {
    // Revert on error
    const currentEntries = loadEntries(listType)
    const filtered = currentEntries.filter((e) => e.id !== tempId)
    saveEntries(filtered, listType)
    notifyListeners(listType)
    throw new Error(result.error || 'Failed to create entry')
  }
}

export const updateEntry = async (id: string, updates: Partial<MediaEntry>, listType: ListType) => {
  // Store previous state for potential rollback
  const entries = loadEntries(listType)
  const index = entries.findIndex((e) => e.id === id)
  if (index === -1) {
    throw new Error('Entry not found')
  }
  const previousEntry = entries[index]

  // Optimistic update - instant feedback
  const optimisticEntry = { ...previousEntry, ...updates, updatedAt: new Date() }
  entries[index] = optimisticEntry
  saveEntries(entries, listType)
  notifyListeners(listType) // Immediate update

  // Make API call
  const result = await api.updateEntry(id, updates)
  if (result.entry) {
    // Update with server response
    const currentEntries = loadEntries(listType)
    const idx = currentEntries.findIndex((e) => e.id === id)
    if (idx !== -1) {
      currentEntries[idx] = result.entry
      saveEntries(currentEntries, listType)
    }
    // Defer second notify to avoid interrupting the first render
    requestAnimationFrame(() => {
      notifyListeners(listType)
    })
    return
  } else {
    // Revert on error
    const currentEntries = loadEntries(listType)
    const idx = currentEntries.findIndex((e) => e.id === id)
    if (idx !== -1) {
      currentEntries[idx] = previousEntry
    }
    saveEntries(currentEntries, listType)
    notifyListeners(listType)
    throw new Error(result.error || 'Failed to update entry')
  }
}

export const deleteEntry = async (id: string, listType: ListType) => {
  // Store previous state for potential rollback
  const entries = loadEntries(listType)
  const entryToDelete = entries.find((e) => e.id === id)
  if (!entryToDelete) {
    throw new Error('Entry not found')
  }

  // Optimistic delete - instant feedback
  const filtered = entries.filter((e) => e.id !== id)
  saveEntries(filtered, listType)
  notifyListeners(listType) // Immediate update

  // Make API call
  const result = await api.deleteEntry(id)
  if (result.success) {
    return
  } else {
    // Revert on error
    const currentEntries = loadEntries(listType)
    currentEntries.push(entryToDelete)
    saveEntries(currentEntries, listType)
    notifyListeners(listType)
    throw new Error(result.error || 'Failed to delete entry')
  }
}

// No-op for single-user mode (keep for compatibility)
export const initializeGistSync = async (): Promise<void> => {
  // No gist sync in single-user mode
}

export const promoteMaturedFuturelogEntries = async (): Promise<void> => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // Fetch fresh from cloud so we don't miss entries not yet in localStorage
  const futurelogEntries = await syncEntriesFromCloud('futurelog')
  const toPromote = futurelogEntries.filter((entry) => {
    if (!entry.releaseDate) return false
    const parts = entry.releaseDate.split('/')
    if (parts.length !== 3) return false
    let yr = parseInt(parts[2], 10)
    if (yr < 100) yr = yr < 50 ? 2000 + yr : 1900 + yr
    const releaseDate = new Date(yr, parseInt(parts[1], 10) - 1, parseInt(parts[0], 10))
    return releaseDate <= today
  })

  if (toPromote.length === 0) return

  // Remove promoted entries from futurelog
  const remaining = futurelogEntries.filter((e) => !toPromote.find((p) => p.id === e.id))
  saveEntries(remaining, 'futurelog')
  notifyListeners('futurelog')

  // Add to backlog and update in DB
  const backlogEntries = loadEntries('backlog')
  for (const entry of toPromote) {
    const parts = entry.releaseDate!.split('/')
    let yr = parseInt(parts[2], 10)
    if (yr < 100) yr = yr < 50 ? 2000 + yr : 1900 + yr
    const promoted = { ...entry, list: 'backlog' as ListType, status: 'planned' as const, year: yr, releaseDate: undefined }
    backlogEntries.push(promoted)
    await api.updateEntry(entry.id, { list: 'backlog', status: 'planned', year: yr, releaseDate: undefined })
  }
  saveEntries(backlogEntries, 'backlog')
  notifyListeners('backlog')
}

import { performSync } from './sync'
import { loadEntries, saveEntries } from './storage'
import type { ListType } from '../types'

let syncInterval: number | null = null
let isPageVisible = true

type SyncCallback = (listType: ListType, hasNewData: boolean) => void

export function startBackgroundSync(
  listTypes: ListType[],
  onSync?: SyncCallback
) {
  stopBackgroundSync()

  // Track page visibility
  document.addEventListener('visibilitychange', handleVisibilityChange)

  // Initial sync
  syncAll(listTypes, onSync)

  // Start 60-second polling (only when page visible)
  syncInterval = window.setInterval(() => {
    if (isPageVisible) {
      syncAll(listTypes, onSync)
    }
  }, 60000)
}

export function stopBackgroundSync() {
  if (syncInterval) {
    clearInterval(syncInterval)
    syncInterval = null
  }
  document.removeEventListener('visibilitychange', handleVisibilityChange)
}

function handleVisibilityChange() {
  const wasVisible = isPageVisible
  isPageVisible = !document.hidden

  // Sync immediately when page becomes visible
  if (!wasVisible && isPageVisible) {
    const listTypes: ListType[] = ['backlog', 'futurelog']
    syncAll(listTypes)
  }
}

export function syncOnFocus() {
  if (isPageVisible) {
    const listTypes: ListType[] = ['backlog', 'futurelog']
    syncAll(listTypes)
  }
}

async function syncAll(
  listTypes: ListType[],
  onSync?: SyncCallback
) {
  for (const listType of listTypes) {
    try {
      const result = await performSync(listType)

      // Merge entries into local storage
      if (result.entries.length > 0 || result.isInitial) {
        const existing = loadEntries(listType)
        const entryMap = new Map(existing.map(e => [e.id, e]))

        // Update/add entries from server
        for (const entry of result.entries) {
          entryMap.set((entry as any).id, entry)
        }

        const merged = Array.from(entryMap.values())
        saveEntries(merged, listType)

        // Notify listeners (trigger re-renders in components)
        window.dispatchEvent(new CustomEvent('media-entries-synced', { detail: { listType } }))
      }

      onSync?.(listType, result.isNewData)
    } catch (error) {
      console.error(`Sync failed for ${listType}:`, error)
      onSync?.(listType, false)
    }
  }
}

export async function syncNow(): Promise<void> {
  await syncAll(['backlog', 'futurelog'])
}

// Export the notifyListeners function needed by sync-manager
// We'll trigger custom events that storage.ts can listen to
export function notifyListeners(listType: ListType) {
  window.dispatchEvent(new CustomEvent('media-entries-synced', { detail: { listType } }))
}

import { useState, useEffect, useMemo } from 'react'
import {
  subscribeToEntries,
  addEntry,
  updateEntry,
  deleteEntry,
  initializeGistSync,
} from '../lib/storage'
import { startBackgroundSync, stopBackgroundSync, syncOnFocus, syncNow } from '../lib/sync-manager'
import { promoteMaturedFuturelogEntries } from '../lib/storage'
import type { MediaEntry, SortField, Filters, ListType } from '../types'

export type SyncStatus = 'syncing' | 'synced' | 'error'

export function useMediaEntries(listType: ListType) {
  const [entries, setEntries] = useState<MediaEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [sortField, setSortField] = useState<SortField>('title')
  const [filters, setFilters] = useState<Filters>({ type: 'all', status: 'all' })
  const [refreshKey, setRefreshKey] = useState(0)
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('synced')

  // Initialize gist sync on mount (only once)
  useEffect(() => {
    initializeGistSync().catch(console.error)
  }, [])

  // Start background sync on mount
  useEffect(() => {
    startBackgroundSync([listType], (syncedListType, hasNewData) => {
      setSyncStatus('synced')
      if (hasNewData && syncedListType === listType) {
        // Trigger re-fetch when new data arrives
        setRefreshKey(prev => prev + 1)
      }
    })

    // Sync on window focus
    window.addEventListener('focus', syncOnFocus)

    return () => {
      stopBackgroundSync()
      window.removeEventListener('focus', syncOnFocus)
    }
  }, [listType])

  useEffect(() => {
    setLoading(true)
    const unsubscribe = subscribeToEntries(listType, (data) => {
      setEntries(data)
      setLoading(false)
    })

    return unsubscribe
  }, [listType, refreshKey])

  // Memoize filtered/sorted entries to avoid re-computation on every render
  const filteredEntries = useMemo(() => {
    // Define status priority order
    const statusPriority: Record<string, number> = {
      'in_progress': 0,
      'paused': 1,
      'planned': 2,
      'completed': 3,
      'dropped': 4,
    }

    return entries
      .filter((e) => filters.type === 'all' || e.type === filters.type)
      .filter((e) => filters.status === 'all' || e.status === filters.status)
      .sort((a, b) => {
        // Primary sort by status priority (in_progress first, then paused, then planned)
        const statusCompare = (statusPriority[a.status] ?? 99) - (statusPriority[b.status] ?? 99)
        if (statusCompare !== 0) return statusCompare

        // Secondary sort by creation time (newest last within each status group)
        const createdCompare = a.createdAt.getTime() - b.createdAt.getTime()
        if (createdCompare !== 0) return createdCompare

        // Tertiary sort by the selected field
        if (sortField === 'title') {
          return a.title.localeCompare(b.title)
        }
        return b.year - a.year
      })
  }, [entries, filters, sortField])

  const add = async (entry: Omit<MediaEntry, 'id' | 'createdAt' | 'userId' | 'updatedAt'>) => {
    await addEntry(entry)
  }

  const update = async (id: string, updates: Partial<MediaEntry>) => {
    await updateEntry(id, updates, listType)
  }

  const remove = async (id: string) => {
    await deleteEntry(id, listType)
  }

  const refresh = async () => {
    setRefreshKey(prev => prev + 1)
  }

  const manualSync = async () => {
    setSyncStatus('syncing')
    try {
      await syncNow()
      await promoteMaturedFuturelogEntries()
      setRefreshKey(prev => prev + 1)
      setSyncStatus('synced')
    } catch {
      setSyncStatus('error')
    }
  }

  return {
    entries: filteredEntries,
    loading,
    syncStatus,
    sortField,
    setSortField,
    filters,
    setFilters,
    add,
    update,
    remove,
    refresh,
    manualSync,
  }
}

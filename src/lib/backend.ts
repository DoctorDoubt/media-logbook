import type { MediaEntry, ListType } from '../types'
import * as cloud from './api'

/**
 * Storage backends.
 *
 * The rest of the app talks to this module instead of ./api, so where entries
 * actually live is a runtime choice rather than a build-time one.
 *
 *   cloud    Vercel serverless functions backed by Neon Postgres. Syncs across
 *            devices, needs the site password and a deployed API.
 *   desktop  SQLite inside the Tauri app, via the Rust commands in
 *            src-tauri/src/lib.rs. No network, no account. Desktop only.
 *   browser  localStorage in this browser only. No backend of any kind, so the
 *            web build can be served as a static site with no infrastructure.
 */
export type StorageMode = 'cloud' | 'desktop' | 'browser'

const MODE_KEY = 'jefflog-storage-mode'
const BROWSER_STORE_PREFIX = 'jefflog-browser-entries-'

export interface BackendResult<T> {
  data?: T
  error?: string
}

// ─── Mode detection and selection ────────────────────────────────────────────

/** True when running inside the Tauri desktop shell. */
export function isDesktop(): boolean {
  if (typeof window === 'undefined') return false
  return '__TAURI_INTERNALS__' in window || '__TAURI__' in window
}

/** Modes that can actually be selected in the current environment. */
export function availableModes(): StorageMode[] {
  return isDesktop() ? ['desktop', 'cloud', 'browser'] : ['cloud', 'browser']
}

/**
 * The active mode. An explicit choice wins; otherwise the desktop app defaults
 * to its local database and the web build defaults to the cloud API, which
 * preserves existing behaviour for anyone who never opens settings.
 */
export function getStorageMode(): StorageMode {
  const stored = localStorage.getItem(MODE_KEY) as StorageMode | null
  if (stored && availableModes().includes(stored)) return stored
  return isDesktop() ? 'desktop' : 'cloud'
}

export function setStorageMode(mode: StorageMode) {
  localStorage.setItem(MODE_KEY, mode)
}

/** Whether the active mode needs the password prompt and a network round trip. */
export function requiresAuth(): boolean {
  return getStorageMode() === 'cloud'
}

// ─── Desktop backend (Tauri + SQLite) ────────────────────────────────────────

// Imported lazily so the web bundle never pulls in the Tauri client.
async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke: tauriInvoke } = await import('@tauri-apps/api/core')
  return tauriInvoke<T>(cmd, args)
}

function reviveDates(entry: any): MediaEntry {
  return {
    ...entry,
    createdAt: new Date(entry.createdAt),
    updatedAt: new Date(entry.updatedAt),
  }
}

// ─── Browser backend (localStorage, no server) ───────────────────────────────

function browserKey(listType: ListType): string {
  return `${BROWSER_STORE_PREFIX}${listType}`
}

function browserLoad(listType: ListType): MediaEntry[] {
  const raw = localStorage.getItem(browserKey(listType))
  if (!raw) return []
  try {
    return JSON.parse(raw).map(reviveDates)
  } catch {
    return []
  }
}

function browserSave(entries: MediaEntry[], listType: ListType) {
  localStorage.setItem(browserKey(listType), JSON.stringify(entries))
}

function browserFindById(id: string): { entry: MediaEntry; listType: ListType } | null {
  for (const listType of ['backlog', 'futurelog'] as ListType[]) {
    const found = browserLoad(listType).find(e => e.id === id)
    if (found) return { entry: found, listType }
  }
  return null
}

// ─── Public API — mirrors ./api so storage.ts can swap between them ──────────

export async function fetchEntries(
  listType: ListType
): Promise<{ entries: (MediaEntry & { createdAt: Date })[]; error?: string }> {
  const mode = getStorageMode()

  if (mode === 'cloud') return cloud.fetchEntries(listType)

  if (mode === 'browser') {
    return { entries: browserLoad(listType) as (MediaEntry & { createdAt: Date })[] }
  }

  try {
    const rows = await invoke<any[]>('get_entries', { listType })
    return { entries: rows.map(reviveDates) as (MediaEntry & { createdAt: Date })[] }
  } catch (e) {
    return { entries: [], error: String(e) }
  }
}

export async function createEntry(
  entry: Omit<MediaEntry, 'id' | 'createdAt' | 'userId' | 'updatedAt'>
): Promise<{ entry?: MediaEntry; error?: string }> {
  const mode = getStorageMode()

  if (mode === 'cloud') return cloud.createEntry(entry)

  if (mode === 'browser') {
    const now = new Date()
    const created: MediaEntry = {
      ...entry,
      id: crypto.randomUUID(),
      userId: 'local',
      createdAt: now,
      updatedAt: now,
    }
    const entries = browserLoad(entry.list)
    entries.push(created)
    browserSave(entries, entry.list)
    return { entry: created }
  }

  try {
    const created = await invoke<any>('create_entry', { entry })
    return { entry: reviveDates(created) }
  } catch (e) {
    return { error: String(e) }
  }
}

export async function updateEntry(
  id: string,
  updates: Partial<MediaEntry>
): Promise<{ entry?: MediaEntry; error?: string }> {
  const mode = getStorageMode()

  if (mode === 'cloud') return cloud.updateEntry(id, updates)

  if (mode === 'browser') {
    const found = browserFindById(id)
    if (!found) return { error: 'Entry not found' }

    const updated: MediaEntry = { ...found.entry, ...updates, updatedAt: new Date() }

    // A change to `list` moves the entry between the two stores.
    const targetList = updated.list
    if (targetList !== found.listType) {
      browserSave(browserLoad(found.listType).filter(e => e.id !== id), found.listType)
      const target = browserLoad(targetList)
      target.push(updated)
      browserSave(target, targetList)
    } else {
      const entries = browserLoad(found.listType)
      const index = entries.findIndex(e => e.id === id)
      entries[index] = updated
      browserSave(entries, found.listType)
    }
    return { entry: updated }
  }

  try {
    const updated = await invoke<any>('update_entry', { id, updates })
    return { entry: reviveDates(updated) }
  } catch (e) {
    return { error: String(e) }
  }
}

export async function deleteEntry(
  id: string
): Promise<{ success?: boolean; error?: string }> {
  const mode = getStorageMode()

  if (mode === 'cloud') return cloud.deleteEntry(id)

  if (mode === 'browser') {
    const found = browserFindById(id)
    if (!found) return { error: 'Entry not found' }
    browserSave(browserLoad(found.listType).filter(e => e.id !== id), found.listType)
    return { success: true }
  }

  try {
    await invoke<boolean>('delete_entry', { id })
    return { success: true }
  } catch (e) {
    return { error: String(e) }
  }
}

// ─── Portability ─────────────────────────────────────────────────────────────

export interface ExportBundle {
  version: 1
  exportedAt: string
  backlog: MediaEntry[]
  futurelog: MediaEntry[]
}

/** Read both lists out of the active backend as a portable bundle. */
export async function exportAll(): Promise<ExportBundle> {
  const [backlog, futurelog] = await Promise.all([
    fetchEntries('backlog'),
    fetchEntries('futurelog'),
  ])
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    backlog: backlog.entries,
    futurelog: futurelog.entries,
  }
}

/**
 * Write a bundle into the active backend, entry by entry, so it works the same
 * whichever mode is selected. Existing entries are left alone — this adds.
 */
export async function importAll(bundle: ExportBundle): Promise<{ imported: number; failed: number }> {
  let imported = 0
  let failed = 0

  for (const listType of ['backlog', 'futurelog'] as ListType[]) {
    for (const entry of bundle[listType] ?? []) {
      const { id, userId, createdAt, updatedAt, ...rest } = entry
      const result = await createEntry({ ...rest, list: listType } as any)
      if (result.entry) imported++
      else failed++
    }
  }

  return { imported, failed }
}

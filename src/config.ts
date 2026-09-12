/**
 * Branding and storage configuration.
 *
 * Renaming the app is a two-line change: set APP_NAME and STORAGE_PREFIX below.
 * Everything user-visible and every browser storage key is derived from these,
 * so nothing else needs touching.
 *
 * If you change STORAGE_PREFIX on an app that already has users, add the old
 * value to LEGACY_STORAGE_PREFIXES so their data carries over on next load.
 */

/** Display name — window title, export filenames, password prompt. */
export const APP_NAME = 'MediaLog'

/** Namespace for every localStorage / sessionStorage key this app writes. */
export const STORAGE_PREFIX = 'medialog'

/** Older prefixes to migrate from, oldest last. */
const LEGACY_STORAGE_PREFIXES = ['media-logbook']

/** The storage key suffixes this app owns. Used for keying and migration. */
const STORAGE_SUFFIXES = [
  'unlocked',
  'auth-token',
  'cover-modes',
  'theme',
  'storage-mode',
  'sync-state',
  'browser-entries-backlog',
  'browser-entries-futurelog',
  'backlog',
  'futurelog',
  'entries',
  'user',
  'migrated',
] as const

export type StorageSuffix = (typeof STORAGE_SUFFIXES)[number]

/** Build a namespaced storage key: storageKey('theme') → 'medialog-theme'. */
export function storageKey(suffix: StorageSuffix): string {
  return `${STORAGE_PREFIX}-${suffix}`
}

/**
 * Copy values written under an older prefix onto the current one, once.
 *
 * Runs before the app reads any state. A legacy value is only used when the
 * current key is absent, so a fresh write always wins and re-running is safe.
 * Both storage areas are covered because `unlocked` lives in sessionStorage.
 */
export function migrateStorageKeys(): void {
  if (typeof window === 'undefined') return

  for (const legacy of LEGACY_STORAGE_PREFIXES) {
    if (legacy === STORAGE_PREFIX) continue

    for (const suffix of STORAGE_SUFFIXES) {
      const from = `${legacy}-${suffix}`
      const to = `${STORAGE_PREFIX}-${suffix}`

      for (const store of [localStorage, sessionStorage]) {
        try {
          const value = store.getItem(from)
          if (value === null) continue
          if (store.getItem(to) === null) store.setItem(to, value)
          store.removeItem(from)
        } catch {
          // Private mode, disabled storage, quota — nothing here is critical.
        }
      }
    }
  }
}

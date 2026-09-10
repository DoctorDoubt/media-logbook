import type { SyncStatus } from '../hooks/useMediaEntries'

export function SyncIndicator({ status }: { status: SyncStatus }) {
  if (status === 'syncing') {
    return (
      <div className="flex items-center gap-2 text-xs text-blue-500">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin">
          <path d="M21 12a9 9 0 1 1-6.219-8.56" />
        </svg>
        Syncing...
      </div>
    )
  }
  if (status === 'error') {
    return (
      <div className="flex items-center gap-2 text-xs text-red-500">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        Sync failed
      </div>
    )
  }
  return null // Don't show when synced
}

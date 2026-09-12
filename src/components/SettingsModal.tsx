import { useRef, useState } from 'react'
import { X } from 'lucide-react'
import {
  availableModes,
  getStorageMode,
  setStorageMode,
  exportAll,
  importAll,
  isDesktop,
  type StorageMode,
} from '../lib/backend'
import { APP_NAME } from '../config'

interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
}

const MODE_LABELS: Record<StorageMode, { name: string; blurb: string }> = {
  cloud: {
    name: 'CLOUD',
    blurb: 'Stored in the hosted database. Syncs across devices, needs the site password and a network connection.',
  },
  desktop: {
    name: 'THIS MAC',
    blurb: 'Stored in a SQLite file inside the app. No network, no password. Data stays on this machine.',
  },
  browser: {
    name: 'THIS BROWSER',
    blurb: 'Stored in this browser only. No server at all. Clearing site data erases it, so export regularly.',
  },
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const [mode, setMode] = useState<StorageMode>(() => getStorageMode())
  const [busy, setBusy] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  if (!isOpen) return null

  const modes = availableModes()

  const handleModeChange = (next: StorageMode) => {
    if (next === mode) return
    setStorageMode(next)
    setMode(next)
    // Entries are held per-backend, so the whole app has to re-read from the
    // newly selected one. A reload is the simplest correct way to do that.
    window.location.reload()
  }

  const handleExport = async () => {
    setBusy('Exporting…')
    try {
      const bundle = await exportAll()
      const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${APP_NAME.toLowerCase()}-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(url)
      setBusy(null)
    } catch (e) {
      setBusy(`Export failed: ${e}`)
    }
  }

  const handleImport = async (file: File) => {
    setBusy('Importing…')
    try {
      const bundle = JSON.parse(await file.text())
      const { imported, failed } = await importAll(bundle)
      setBusy(`Imported ${imported} entr${imported === 1 ? 'y' : 'ies'}${failed ? `, ${failed} failed` : ''}. Reloading…`)
      setTimeout(() => window.location.reload(), 1200)
    } catch (e) {
      setBusy(`Import failed: ${e}`)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80" onClick={onClose} />
      <div className="relative w-full max-w-md border border-border bg-bg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="px-4 py-2 border-b border-border flex items-center justify-between sticky top-0 bg-bg z-10">
          <span className="text-sm text-text">SETTINGS</span>
          <button
            onClick={onClose}
            className="text-muted hover:text-text"
            title="Close settings"
          >
            <X width={14} height={14} />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Storage mode */}
          <div className="space-y-2">
            <h4 className="text-xs text-label">WHERE ENTRIES ARE STORED</h4>
            <div className="space-y-1">
              {modes.map((m) => (
                <button
                  key={m}
                  onClick={() => handleModeChange(m)}
                  className={`w-full text-left px-2 py-2 border text-xs ${
                    m === mode
                      ? 'border-text text-text'
                      : 'border-border text-muted hover:text-text'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span>{MODE_LABELS[m].name}</span>
                    {m === mode && <span className="text-label">ACTIVE</span>}
                  </div>
                  <p className="mt-1 text-muted leading-relaxed">{MODE_LABELS[m].blurb}</p>
                </button>
              ))}
            </div>
            {!isDesktop() && (
              <p className="text-xs text-muted">
                Local file storage is available in the desktop app.
              </p>
            )}
            <p className="text-xs text-muted">
              Switching modes does not move your entries. Export from one and
              import into the other to carry them across.
            </p>
          </div>

          {/* Export / import */}
          <div className="pt-3 border-t border-border space-y-2">
            <h4 className="text-xs text-label">YOUR DATA</h4>
            <div className="flex gap-2">
              <button
                onClick={handleExport}
                className="flex-1 px-2 py-1 border border-border text-xs text-muted hover:text-text"
              >
                EXPORT JSON
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex-1 px-2 py-1 border border-border text-xs text-muted hover:text-text"
              >
                IMPORT JSON
              </button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) handleImport(file)
                e.target.value = ''
              }}
            />
            {busy && <p className="text-xs text-label">{busy}</p>}
          </div>
        </div>
      </div>
    </div>
  )
}

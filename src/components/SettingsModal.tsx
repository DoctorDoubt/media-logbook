import { X } from 'lucide-react'

interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  if (!isOpen) return null

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
          {/* Info Section */}
          <div className="pt-3 border-t border-border space-y-2">
            <h4 className="text-xs text-label">HOW IT WORKS</h4>
            <ul className="text-xs text-muted space-y-1 list-disc list-inside">
              <li>Your entries are stored in the cloud database</li>
              <li>Sign in with your password on any device to access your data</li>
              <li>All changes sync automatically across devices</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}

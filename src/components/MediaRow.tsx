import type { MediaEntry } from '../types'

interface MediaRowProps {
  entry: MediaEntry
  onClick: () => void
}

const typeLabels = {
  movie: 'mov',
  tv: 'tv ',
  game: 'gam',
  comic: 'com',
}

const statusSymbols = {
  planned: '[ ]',
  in_progress: '[~]',
  paused: '[|]',
  completed: '[x]',
  dropped: '[-]',
  replaying: '[R]',
}

export function MediaRow({ entry, onClick }: MediaRowProps) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-3 w-full px-4 py-1.5 text-left hover:bg-panel border-b border-border/50 group"
    >
      <span className="text-dim">{statusSymbols[entry.status]}</span>
      <span className="text-dim text-xs">{typeLabels[entry.type]}</span>
      <span className="flex-1 text-text truncate group-hover:text-accent">{entry.title}</span>
      <span className="text-muted text-sm">{entry.year}</span>
      {entry.type === 'tv' && entry.seasonsCompleted !== undefined && (
        <span className="text-dim text-xs">s{entry.seasonsCompleted}</span>
      )}
    </button>
  )
}

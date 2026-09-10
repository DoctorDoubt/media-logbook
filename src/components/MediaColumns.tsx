import { useState, useEffect, useCallback, useRef, memo } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragOverlay,
  useDroppable,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { MediaEntry, MediaType, ListType } from '../types'

interface MediaColumnsProps {
  entries: MediaEntry[]
  onEntryClick: (entry: MediaEntry) => void
  currentList: ListType
  onAddEntry?: (type: MediaType) => void
  onDeleteEntry?: (entry: MediaEntry) => void
  onUpdateEntry?: (id: string, updates: Partial<MediaEntry>) => void
}

const columns: { type: MediaType; label: string; color: string }[] = [
  { type: 'movie', label: 'MOVIES', color: 'text-movie border-movie/30' },
  { type: 'tv', label: 'TV SHOWS', color: 'text-tv border-tv/30' },
  { type: 'game', label: 'GAMES', color: 'text-game border-game/30' },
  { type: 'comic', label: 'COMICS', color: 'text-comic border-comic/30' },
]

const hoverColors: Record<MediaType, string> = {
  movie: 'hover:text-movie',
  tv: 'hover:text-tv',
  game: 'hover:text-game',
  comic: 'hover:text-comic',
}

const winnerColors: Record<MediaType, string> = {
  movie: 'text-movie',
  tv: 'text-tv',
  game: 'text-game',
  comic: 'text-comic',
}

interface DraggableEntryProps {
  entry: MediaEntry
  currentList: ListType
  onEntryClick: (entry: MediaEntry) => void
  onDeleteEntry?: (entry: MediaEntry) => void
}

interface DroppableColumnProps {
  type: MediaType
  label: string
  color: string
  entries: MediaEntry[]
  currentList: ListType
  onEntryClick: (entry: MediaEntry) => void
  onAddEntry?: (type: MediaType) => void
  onDeleteEntry?: (entry: MediaEntry) => void
  onRandomize?: (type: MediaType) => void
  randomizerState?: { currentTitle: string; winner: MediaEntry | null; phase: 'spinning' | 'result' } | null
  onRandomizerClose?: () => void
}

const DroppableColumn = memo(function DroppableColumn({ type, label, color, entries, currentList, onEntryClick, onAddEntry, onDeleteEntry, onRandomize, randomizerState, onRandomizerClose }: DroppableColumnProps) {
  const { setNodeRef } = useDroppable({
    id: type,
  })

  return (
    <div className="bg-bg flex flex-col h-full min-h-0 relative">
      <div
        ref={setNodeRef}
        className={`px-4 py-3 border-b ${color} flex justify-between items-center`}
      >
        <span className="text-xs">{label}</span>
        {entries.length >= 2 && onRandomize && (
          <button
            onClick={(e) => { e.stopPropagation(); onRandomize(type) }}
            className="opacity-40 hover:opacity-100 transition-opacity"
            title="Pick for me"
          >
            <svg width="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="2" y="2" width="20" height="20" rx="3" ry="3" />
              {/* center */}
              <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
              {/* corners */}
              <circle cx="7" cy="7" r="1.5" fill="currentColor" stroke="none" />
              <circle cx="17" cy="7" r="1.5" fill="currentColor" stroke="none" />
              <circle cx="7" cy="17" r="1.5" fill="currentColor" stroke="none" />
              <circle cx="17" cy="17" r="1.5" fill="currentColor" stroke="none" />
            </svg>
          </button>
        )}
      </div>
      <div
        onClick={() => onAddEntry?.(type)}
        className={`flex-1 overflow-y-auto min-h-0 ${onAddEntry ? 'hover:bg-panel/30 cursor-pointer' : ''} transition-colors`}
      >
        <SortableContext
          items={entries.map((e) => e.id)}
          strategy={verticalListSortingStrategy}
        >
          {entries.map((entry) => (
            <DraggableEntry
              key={entry.id}
              entry={entry}
              currentList={currentList}
              onEntryClick={onEntryClick}
              onDeleteEntry={onDeleteEntry}
            />
          ))}
        </SortableContext>
        {entries.length === 0 && (
          <div className="px-4 py-8 text-dim text-xs text-center">
            No entries
          </div>
        )}
      </div>

      {randomizerState && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 z-20 px-4" style={{ backgroundColor: 'var(--color-bg)' }}>
          {randomizerState.phase === 'spinning' ? (
            <>
              <span className="text-dim text-xs">Picking...</span>
              <span className="text-text text-sm text-center font-mono">{randomizerState.currentTitle}</span>
            </>
          ) : (
            <>
              <span className="text-dim text-xs">Your pick:</span>
              <button
                onClick={() => { randomizerState.winner && onEntryClick(randomizerState.winner) }}
                className={`text-sm text-center font-mono ${winnerColors[type]} hover:underline`}
              >
                {randomizerState.winner?.title}
              </button>
              <button
                onClick={onRandomizerClose}
                className="text-dim hover:text-text text-xs border border-border hover:border-border/80 px-3 py-1 transition-colors"
              >
                Close
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
})

const DraggableEntry = memo(function DraggableEntry({ entry, currentList, onEntryClick, onDeleteEntry }: DraggableEntryProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: entry.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div ref={setNodeRef} style={style} className="relative group/entry">
      <div
        {...attributes}
        onClick={(e) => {
          e.stopPropagation()
          onEntryClick(entry)
        }}
        className={`w-full text-left border-b border-border/50 hover:bg-panel px-4 py-2 ${hoverColors[entry.type]}`}
      >
        <button
          {...listeners}
          className="w-full text-left -mx-4 -my-2 px-4 py-2"
        >
          <div className="flex items-center gap-2">
            <span className="text-text text-sm truncate flex-1">
              {entry.title}
            </span>
          </div>
        </button>
        <div className="text-dim text-xs">
          {currentList === 'futurelog' ? (entry.releaseDate || 'No date') : (
            <>
              <span className={
                entry.status === 'planned' ? 'text-planned' :
                entry.status === 'in_progress' ? 'text-inprogress' :
                entry.status === 'paused' ? 'text-paused' :
                entry.status === 'dropped' ? 'text-dropped' :
                entry.status === 'replaying' ? 'text-replaying' :
                'text-completed'
              }>{entry.status.replace('_', ' ').toUpperCase()}</span>
              <span> · {entry.year}</span>
              {entry.status === 'completed' && entry.completedAt && (
                <span> · {entry.completedAt}</span>
              )}
            </>
          )}
        </div>
      </div>
      {onDeleteEntry && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            onDeleteEntry(entry)
          }}
          className="absolute top-1/2 -translate-y-1/2 right-2 opacity-0 group-hover/entry:opacity-100 text-dim hover:text-dropped text-xs px-1.5 py-0.5 bg-bg border border-border hover:border-dropped/50 transition-opacity z-10"
          title="Delete entry"
        >
          ×
        </button>
      )}
    </div>
  )
})

const MediaColumnsInner = function MediaColumnsInner({ entries, onEntryClick, currentList, onAddEntry, onDeleteEntry, onUpdateEntry }: MediaColumnsProps) {
  const [items, setItems] = useState<MediaEntry[]>(entries)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [randomizer, setRandomizer] = useState<{
    column: MediaType
    currentTitle: string
    winner: MediaEntry | null
    phase: 'spinning' | 'result'
  } | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const activeEntry = activeId ? items.find((e) => e.id === activeId) : null

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  // Update local state when entries prop changes
  useEffect(() => {
    setItems(entries)
  }, [entries])

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  const startRandomizer = useCallback((type: MediaType) => {
    const pool = items.filter((e) => e.type === type)
    if (pool.length < 2) return

    const winner = pool[Math.floor(Math.random() * pool.length)]
    const steps = 30

    setRandomizer({ column: type, currentTitle: pool[0].title, winner, phase: 'spinning' })

    let step = 0
    const animate = () => {
      step++
      const progress = step / steps
      const delay = 60 + progress * progress * 200

      const current = pool[Math.floor(Math.random() * pool.length)]
      if (step === steps) {
        setRandomizer({ column: type, currentTitle: winner.title, winner, phase: 'result' })
      } else {
        setRandomizer({ column: type, currentTitle: current.title, winner, phase: 'spinning' })
        timerRef.current = setTimeout(animate, delay)
      }
    }

    timerRef.current = setTimeout(animate, 60)
  }, [items])

  const closeRandomizer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    setRandomizer(null)
  }, [])

  const getEntriesByType = (type: MediaType) =>
    items.filter((e) => e.type === type)

  const handleDragStart = (event: DragEndEvent) => {
    setActiveId(event.active.id as string)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event

    if (!over) return

    const activeId = active.id as string
    const overId = over.id as string

    const activeEntry = items.find((e) => e.id === activeId)
    if (!activeEntry) return

    // Check if dropped on a column header (type change)
    const targetType = columns.find((col) => col.type === overId)?.type
    if (targetType && activeEntry.type !== targetType) {
      // Update the entry type
      onUpdateEntry?.(activeId, { type: targetType })
      setActiveId(null)
      return
    }

    // Check if dropped on another entry
    const overEntry = items.find((e) => e.id === overId)
    if (overEntry) {
      if (activeEntry.type !== overEntry.type) {
        // Different types - update the active entry's type to match the column
        onUpdateEntry?.(activeId, { type: overEntry.type })
      } else {
        // Same type - reorder within the column
        const oldIndex = items.findIndex((e) => e.id === activeId)
        const newIndex = items.findIndex((e) => e.id === overId)
        setItems((items) => arrayMove(items, oldIndex, newIndex))
      }
    }

    setActiveId(null)
  }

  return (
    <div className="flex-1 relative overflow-hidden">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex-1 grid grid-cols-4 gap-px bg-border h-full overflow-hidden">
          {columns.map(({ type, label, color }) => (
            <DroppableColumn
              key={type}
              type={type}
              label={label}
              color={color}
              entries={getEntriesByType(type)}
              currentList={currentList}
              onEntryClick={onEntryClick}
              onAddEntry={onAddEntry}
              onDeleteEntry={onDeleteEntry}
              onRandomize={startRandomizer}
              randomizerState={randomizer?.column === type ? { currentTitle: randomizer.currentTitle, winner: randomizer.winner, phase: randomizer.phase } : null}
              onRandomizerClose={closeRandomizer}
            />
          ))}
        </div>

        {activeEntry && (
          <DragOverlay>
            <div className="w-60 px-4 py-2 border border-border bg-panel shadow-lg rounded">
              <div className="flex items-center gap-2">
                <span className="text-text text-sm truncate">
                  {activeEntry.title}
                </span>
              </div>
            </div>
          </DragOverlay>
        )}
      </DndContext>
    </div>
  )
}

export const MediaColumns = memo(MediaColumnsInner)

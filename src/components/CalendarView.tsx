import { memo, useMemo } from 'react'
import type { MediaEntry, ListType } from '../types'
import { Film, Tv, Gamepad2, BookOpen } from 'lucide-react'

const typeIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  movie: Film,
  tv: Tv,
  game: Gamepad2,
  comic: BookOpen,
}

interface CalendarViewProps {
  entries: MediaEntry[]
  onEntryClick: (entry: MediaEntry) => void
  currentList: ListType
}

function parseReleaseDate(dateStr: string): Date | null {
  // Parse DD/MM/YY format
  const parts = dateStr.split('/')
  if (parts.length !== 3) return null
  const day = parseInt(parts[0], 10)
  const month = parseInt(parts[1], 10) - 1 // months are 0-indexed
  let year = parseInt(parts[2], 10)
  // Convert 2-digit year to 4-digit
  if (year < 100) {
    year += year < 50 ? 2000 : 1900
  }
  const date = new Date(year, month, day)
  if (isNaN(date.getTime())) return null
  return date
}

function formatMonthYear(date: Date): string {
  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']
  return `${months[date.getMonth()]} ${date.getFullYear()}`
}

function formatYear(date: Date): string {
  return date.getFullYear().toString()
}

function getTypeColor(type: string) {
  switch (type) {
    case 'movie': return 'text-movie'
    case 'tv': return 'text-tv'
    case 'game': return 'text-game'
    case 'comic': return 'text-comic'
    default: return 'text-muted'
  }
}

const CalendarViewInner = function CalendarViewInner({ entries, onEntryClick, currentList }: CalendarViewProps) {
  const isFuturelog = currentList === 'futurelog'

  // Memoize expensive grouping/sorting computations
  const { withDates, withoutDates, groups } = useMemo(() => {
    // Separate entries with and without dates
    const withDatesResult: { entry: MediaEntry; date: Date }[] = []
    const withoutDatesResult: MediaEntry[] = []

    entries.forEach(entry => {
      if (isFuturelog) {
        // Futurelog: use releaseDate
        if (entry.releaseDate) {
          const date = parseReleaseDate(entry.releaseDate)
          if (date) {
            withDatesResult.push({ entry, date })
          } else {
            withoutDatesResult.push(entry)
          }
        } else {
          withoutDatesResult.push(entry)
        }
      } else {
        // Backlog: use completedAt, fall back to year for completed entries
        if (entry.completedAt) {
          const date = parseReleaseDate(entry.completedAt)
          if (date) {
            withDatesResult.push({ entry, date })
          }
        } else if (entry.status === 'completed' && entry.year) {
          // Use year as a date placeholder (January 1st of that year)
          const date = new Date(entry.year, 0, 1)
          withDatesResult.push({ entry, date })
        } else if (entry.status === 'completed') {
          withoutDatesResult.push(entry)
        }
      }
    })

    // Sort by date: ascending for futurelog (upcoming), descending for backlog (recent first)
    if (isFuturelog) {
      withDatesResult.sort((a, b) => a.date.getTime() - b.date.getTime())
    } else {
      withDatesResult.sort((a, b) => b.date.getTime() - a.date.getTime())
    }

    // Group by month/year for futurelog, by year for backlog
    const groupsResult: Map<string, { entry: MediaEntry; date: Date }[]> = new Map()
    withDatesResult.forEach(item => {
      const key = isFuturelog ? formatMonthYear(item.date) : formatYear(item.date)
      if (!groupsResult.has(key)) {
        groupsResult.set(key, [])
      }
      groupsResult.get(key)!.push(item)
    })

    return { withDates: withDatesResult, withoutDates: withoutDatesResult, groups: groupsResult }
  }, [entries, isFuturelog])

  return (
    <div className="h-full overflow-y-auto overscroll-contain p-4 pt-16 border-l border-border">
      <div className="text-xs text-label mb-4">
        {isFuturelog ? 'UPCOMING RELEASES' : 'COMPLETED'}
      </div>

      {Array.from(groups.entries()).map(([monthYear, items]) => (
        <div key={monthYear} className="mb-4">
          <div className="text-xs text-muted mb-2 border-b border-border pb-1">{monthYear}</div>
          <div className="space-y-2">
            {items.map(({ entry, date }) => {
              const IconComponent = typeIcons[entry.type]
              return (
                <button
                  key={entry.id}
                  onClick={() => onEntryClick(entry)}
                  className="w-full text-left px-2 py-1 border border-border hover:border-muted transition-colors"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <IconComponent className={`w-3 h-3 flex-shrink-0 ${getTypeColor(entry.type)}`} />
                      <span className="text-text text-sm truncate">{entry.title}</span>
                    </div>
                    <span className="text-dim text-xs whitespace-nowrap">
                      {isFuturelog
                        ? `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear().toString().slice(-2)}`
                        : date.getFullYear().toString()
                      }
                    </span>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      ))}

      {withoutDates.length > 0 && (
        <div className="mb-4">
          <div className="text-xs text-muted mb-2 border-b border-border pb-1">NO DATE</div>
          <div className="space-y-2">
            {withoutDates.map(entry => {
              const IconComponent = typeIcons[entry.type]
              return (
                <button
                  key={entry.id}
                  onClick={() => onEntryClick(entry)}
                  className="w-full text-left px-2 py-1 border border-border hover:border-muted transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <IconComponent className={`w-3 h-3 flex-shrink-0 ${getTypeColor(entry.type)}`} />
                    <span className="text-text text-sm truncate">{entry.title}</span>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {withDates.length === 0 && withoutDates.length === 0 && (
        <div className="text-dim text-xs text-center py-8">
          {isFuturelog ? 'No entries in futurelog' : 'No completed entries'}
        </div>
      )}
    </div>
  )
}

export const CalendarView = memo(CalendarViewInner)

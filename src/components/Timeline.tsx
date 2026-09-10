import { memo } from 'react'
import type { MediaEntry, ListType } from '../types'

interface TimelineProps {
  entries: MediaEntry[]
  selectedYear: number | null
  onYearSelect: (year: number | null) => void
  currentList: ListType
}

function parseReleaseYear(dateStr: string): number | null {
  const parts = dateStr.split('/')
  if (parts.length !== 3) return null
  let year = parseInt(parts[2], 10)
  if (year < 100) year += year < 50 ? 2000 : 1900
  return year
}

const TimelineInner = function TimelineInner({ entries, selectedYear, onYearSelect, currentList }: TimelineProps) {
  const isFuturelog = currentList === 'futurelog'

  let years: number[] = []

  if (isFuturelog) {
    // Get years from release dates
    const yearSet = new Set<number>()
    entries.forEach(e => {
      if (e.releaseDate) {
        const year = parseReleaseYear(e.releaseDate)
        if (year) yearSet.add(year)
      }
    })
    years = [...yearSet].sort((a, b) => a - b)
  } else {
    // Get years from entry year field
    years = [...new Set(entries.map((e) => e.year))].sort((a, b) => b - a)
  }

  return (
    <div className="w-20 border-r border-border flex flex-col py-4">
      <div className="px-3 mb-4">
        <span className="text-label text-xs">{isFuturelog ? 'RELEASE' : 'TIME'}</span>
      </div>

      <div className="flex-1 overflow-y-auto px-3 space-y-2">
        <button
          onClick={() => onYearSelect(null)}
          className={`flex items-center gap-2 text-xs ${
            selectedYear === null ? 'text-accent' : 'text-muted hover:text-text'
          }`}
        >
          <span className={selectedYear === null ? 'text-accent' : 'text-dim'}>
            {selectedYear === null ? '*' : ' '}
          </span>
          <span>ALL</span>
        </button>

        {years.map((year) => {
          const isSelected = selectedYear === year
          return (
            <button
              key={year}
              onClick={() => onYearSelect(isSelected ? null : year)}
              className={`flex items-center gap-2 text-xs ${
                isSelected ? 'text-accent' : 'text-muted hover:text-text'
              }`}
            >
              <span className={isSelected ? 'text-accent' : 'text-dim'}>
                {isSelected ? '*' : ' '}
              </span>
              <span>{year}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export const Timeline = memo(TimelineInner)
